"""Read-only Docker measurements; only the bounded JSONL watch log is written."""

import argparse
from collections import deque
from contextlib import ExitStack, contextmanager
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
import json
import math
import os
from pathlib import Path
import re
import stat
import subprocess

GIB = 1024 ** 3
MAX_LOG_BYTES = 5 * 1024 * 1024
MAX_OUTPUT_BYTES = 1024 * 1024
MAX_TAIL_BYTES = 2 * 1024 * 1024
REPARSE = getattr(stat, 'FILE_ATTRIBUTE_REPARSE_POINT', 0x400)
ROOT = Path(__file__).resolve().parents[2]
DEFAULT_VHDX = Path('D:/Docker/DockerDesktopWSL/disk/docker_data.vhdx')
DEFAULT_LOG = ROOT / '.tmp' / 'docker-disk-watch' / 'watch.jsonl'
SIZE_UNITS = {
    'b': 1, 'kb': 1000, 'mb': 1000 ** 2, 'gb': 1000 ** 3, 'tb': 1000 ** 4,
    'kib': 1024, 'mib': 1024 ** 2, 'gib': GIB, 'tib': 1024 ** 4,
}


class CommandError(RuntimeError):
    pass


def size_bytes(value):
    if isinstance(value, bool) or value is None:
        raise ValueError('invalid_size')
    if isinstance(value, (int, float)):
        if not math.isfinite(value) or value < 0:
            raise ValueError('invalid_size')
        return int(value)
    if not isinstance(value, str):
        raise ValueError('invalid_size')
    match = re.fullmatch(r'\s*(\d+(?:\.\d+)?)\s*(B|kB|MB|GB|TB|KiB|MiB|GiB|TiB)?\s*', value, re.IGNORECASE)
    if not match:
        raise ValueError('invalid_size')
    return int(Decimal(match.group(1)) * SIZE_UNITS[(match.group(2) or 'b').lower()])


def json_rows(output):
    if not output.strip():
        return []
    if output.lstrip().startswith('['):
        rows = json.loads(output)
        if not isinstance(rows, list):
            raise ValueError('invalid_output')
        return rows
    return [json.loads(line) for line in output.splitlines() if line.strip()]


def parse_system_df(output):
    rows = json_rows(output)
    by_type = {row.get('Type'): row for row in rows if isinstance(row, dict)}
    images = by_type.get('Images')
    containers = by_type.get('Containers')
    if images is None or containers is None:
        raise ValueError('invalid_output')
    active = containers.get('Active')
    if isinstance(active, bool) or not re.fullmatch(r'\d+', str(active)):
        raise ValueError('invalid_output')
    return {'imagesGB': size_bytes(images.get('Size')) / 1000 ** 3, 'containersRunning': int(active)}


def parse_cache_bytes(output):
    total = 0
    for row in json_rows(output):
        total += size_bytes(row.get('Size') if isinstance(row, dict) else row)
    return total


def disk_gib(value):
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        if math.isfinite(value) and value >= 0:
            return Decimal(str(value))
        return None
    if not isinstance(value, str):
        return None
    match = re.fullmatch(r'\s*(\d+(?:\.\d+)?)\s*([KMGT]?)\s*', value, re.IGNORECASE)
    if not match:
        return None
    number = Decimal(match.group(1))
    unit = match.group(2).upper()
    if not unit:
        return number
    factor = {'K': Decimal(1) / 1024 ** 2, 'M': Decimal(1) / 1024, 'G': Decimal(1), 'T': Decimal(1024)}
    return number * factor[unit]


def parse_disk_used(output):
    for line in reversed(output.splitlines()):
        fields = line.split()
        if len(fields) >= 6 and fields[-1] == '/mnt/docker-desktop-disk':
            match = re.fullmatch(r'(\d+(?:\.\d+)?)([KMGT]?)(?:i?B)?', fields[2], re.IGNORECASE)
            if match:
                # df -h has binary units; a unitless external value is bytes.
                power = {'': 0, 'K': 1, 'M': 2, 'G': 3, 'T': 4}[match.group(2).upper()]
                return float(Decimal(match.group(1)) * 1024 ** power / GIB)
    raise ValueError('invalid_output')


def parse_running_count(output):
    ids = [line.strip() for line in output.splitlines() if line.strip()]
    if any(not re.fullmatch(r'[a-f0-9]{12,64}', value) for value in ids):
        raise ValueError('invalid_output')
    return len(set(ids))


def run_command(args):
    try:
        result = subprocess.run(
            args, stdin=subprocess.DEVNULL, capture_output=True, text=True,
            encoding='utf-8', errors='replace', timeout=15 if args[0] == 'wsl.exe' or 'buildx' in args else 10,
        )
    except subprocess.TimeoutExpired as error:
        raise CommandError('command_timeout') from error
    except FileNotFoundError as error:
        raise CommandError('command_not_found') from error
    except OSError as error:
        raise CommandError('command_unavailable') from error
    if result.returncode != 0:
        raise CommandError('command_failed')
    if len(result.stdout.encode('utf-8')) > MAX_OUTPUT_BYTES:
        raise CommandError('output_limit')
    return result.stdout


def read_vhdx_bytes(path):
    value = os.stat(path, follow_symlinks=False)
    if not stat.S_ISREG(value.st_mode) or getattr(value, 'st_file_attributes', 0) & REPARSE:
        raise ValueError('unsafe_vhdx_path')
    return value.st_size


def warning_messages(entry, previous=None):
    warnings = []
    size = entry.get('vhdxBytes')
    if isinstance(size, int) and size > 18 * GIB:
        warnings.append('VHDX > 18GiB')
    cache = entry.get('buildCacheGB')
    if isinstance(cache, (int, float)) and math.isfinite(cache) and Decimal(str(cache)) > Decimal('4.5'):
        warnings.append('BUILD CACHE > 4.5GB')
    current = disk_gib(entry.get('diskUsedGiB'))
    prior = disk_gib(previous.get('diskUsedGiB')) if isinstance(previous, dict) else None
    if current is not None and prior is not None and current - prior > 3:
        warnings.append(f'DISK USED +{current - prior:.2f}GiB since previous reading')
    return warnings


def collect_snapshot(vhdx=DEFAULT_VHDX, runner=None):
    runner = runner or run_command
    entry = {
        'timestamp_utc': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'vhdxBytes': None, 'vhdxGiB': None, 'dockerRunning': False,
        'buildCacheGB': None, 'imagesGB': None, 'containersRunning': None, 'diskUsedGiB': None,
    }
    errors = []
    try:
        size = read_vhdx_bytes(vhdx)
        entry.update(vhdxBytes=size, vhdxGiB=round(size / GIB, 2))
    except (OSError, ValueError):
        errors.append({'metric': 'vhdxBytes', 'reason': 'measurement_unavailable'})
    try:
        version = runner(['docker', 'info', '--format', '{{.ServerVersion}}']).strip()
    except CommandError as error:
        errors.append({'metric': 'dockerRunning', 'reason': str(error)})
        entry.update(errors=errors, warnings=warning_messages(entry))
        return entry
    entry.update(dockerRunning=True, serverVersion=version)
    measurements = [
        ('imagesGB', ['docker', 'system', 'df', '--format', '{{json .}}'], lambda value: parse_system_df(value)['imagesGB']),
        ('buildCacheGB', ['docker', 'buildx', 'du', '--builder', 'desktop-linux', '--format', '{{json .Size}}'], lambda value: parse_cache_bytes(value) / 1000 ** 3),
        ('containersRunning', ['docker', 'ps', '--no-trunc', '--format', '{{.ID}}', '--filter', 'status=running'], parse_running_count),
        ('diskUsedGiB', ['wsl.exe', '-d', 'docker-desktop', '--', 'sh', '-c', 'df -h /mnt/docker-desktop-disk'], parse_disk_used),
    ]
    for metric, args, parser in measurements:
        try:
            entry[metric] = parser(runner(args))
        except CommandError as error:
            errors.append({'metric': metric, 'reason': str(error)})
        except (ValueError, TypeError, KeyError, InvalidOperation):
            errors.append({'metric': metric, 'reason': 'invalid_output'})
    if errors:
        entry['errors'] = errors
    entry['warnings'] = warning_messages(entry)
    return entry


def assert_safe_log_path(path):
    if path.suffix.lower() != '.jsonl' or path.name.startswith('.env'):
        raise ValueError('unsafe_log_path')
    for current in [*reversed(path.parents), path]:
        try:
            value = current.lstat()
        except FileNotFoundError:
            continue
        if stat.S_ISLNK(value.st_mode) or getattr(value, 'st_file_attributes', 0) & REPARSE:
            raise ValueError('unsafe_log_path')
        if current == path and not stat.S_ISREG(value.st_mode):
            raise ValueError('unsafe_log_path')


@contextmanager
def log_lock(handle):
    handle.seek(0)
    try:
        if os.name == 'nt':
            import msvcrt
            msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl
            fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError as error:
        raise ValueError('watch_log_busy') from error
    try:
        yield
    finally:
        handle.seek(0)
        if os.name == 'nt':
            msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
        else:
            fcntl.flock(handle.fileno(), fcntl.LOCK_UN)


def recent_lines(handle, count):
    handle.seek(0, os.SEEK_END)
    position = handle.tell()
    chunks = []
    read_bytes = 0
    newlines = 0
    while position > 0 and newlines <= count:
        width = min(position, 8192)
        position -= width
        handle.seek(position)
        chunk = handle.read(width)
        chunks.append(chunk)
        read_bytes += len(chunk)
        newlines += chunk.count(b'\n')
        if read_bytes > MAX_TAIL_BYTES:
            raise ValueError('watch_log_tail_limit')
    data = b''.join(reversed(chunks))
    return list(deque((line for line in data.splitlines() if line.strip()), maxlen=count))


def assert_log_handle(handle, path):
    assert_safe_log_path(path)
    opened = os.fstat(handle.fileno())
    current = path.lstat()
    if (
        not stat.S_ISREG(opened.st_mode)
        or getattr(opened, 'st_file_attributes', 0) & REPARSE
        or opened.st_nlink != 1
        or (opened.st_dev, opened.st_ino) != (current.st_dev, current.st_ino)
    ):
        raise ValueError('unsafe_log_handle')


@contextmanager
def open_log_file(path):
    path = path.absolute()
    if str(path).startswith(('\\\\', '//')):
        raise ValueError('unsafe_log_path')
    assert_safe_log_path(path)
    with ExitStack() as owners:
        if os.name == 'nt':
            import ctypes
            import msvcrt
            kernel = ctypes.WinDLL('kernel32', use_last_error=True)
            kernel.CreateFileW.argtypes = [ctypes.c_wchar_p, ctypes.c_ulong, ctypes.c_ulong, ctypes.c_void_p, ctypes.c_ulong, ctypes.c_ulong, ctypes.c_void_p]
            kernel.CreateFileW.restype = ctypes.c_void_p
            kernel.CloseHandle.argtypes = [ctypes.c_void_p]
            kernel.GetFileInformationByHandleEx.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.c_void_p, ctypes.c_ulong]
            kernel.GetFileInformationByHandleEx.restype = ctypes.c_int
            invalid = ctypes.c_void_p(-1).value

            class AttributeTag(ctypes.Structure):
                _fields_ = [('attributes', ctypes.c_ulong), ('tag', ctypes.c_ulong)]

            def open_handle(current, directory):
                # Hold ancestors without write/delete sharing; open reparse points themselves.
                access = 0x80 if directory else 0x80000000 | 0x40000000
                sharing = 1 if directory else 3
                flags = 0x00200000 | (0x02000000 if directory else 0x80)
                raw = kernel.CreateFileW(str(current), access, sharing, None, 3 if directory else 4, flags, None)
                if raw is None or raw == invalid:
                    raise ctypes.WinError(ctypes.get_last_error())
                value = AttributeTag()
                if not kernel.GetFileInformationByHandleEx(raw, 9, ctypes.byref(value), ctypes.sizeof(value)):
                    error = ctypes.WinError(ctypes.get_last_error())
                    kernel.CloseHandle(raw)
                    raise error
                if value.attributes & REPARSE or bool(value.attributes & 0x10) != directory:
                    kernel.CloseHandle(raw)
                    raise ValueError('unsafe_log_path')
                return raw

            for parent in reversed(path.parents):
                parent.mkdir(exist_ok=True)
                owned = open_handle(parent, True)
                owners.callback(kernel.CloseHandle, owned)
            raw = open_handle(path, False)
            try:
                descriptor = msvcrt.open_osfhandle(raw, os.O_RDWR | os.O_APPEND | os.O_BINARY)
            except OSError:
                kernel.CloseHandle(raw)
                raise
        else:
            flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW
            parent_fd = os.open(path.anchor, flags)
            owners.callback(os.close, parent_fd)
            for name in path.parts[1:-1]:
                try:
                    child = os.open(name, flags, dir_fd=parent_fd)
                except FileNotFoundError:
                    os.mkdir(name, mode=0o700, dir_fd=parent_fd)
                    child = os.open(name, flags, dir_fd=parent_fd)
                owners.callback(os.close, child)
                parent_fd = child
            descriptor = os.open(path.name, os.O_RDWR | os.O_CREAT | os.O_APPEND | os.O_NOFOLLOW, 0o600, dir_fd=parent_fd)
        with os.fdopen(descriptor, 'a+b') as handle:
            assert_log_handle(handle, path)
            yield handle


def append_record(path, entry):
    assert_safe_log_path(path)
    with open_log_file(path) as handle, log_lock(handle):
        assert_log_handle(handle, path)
        lines = recent_lines(handle, 500)
        previous = None
        result = dict(entry)
        if lines:
            try:
                previous = json.loads(lines[-1])
                if not isinstance(previous, dict):
                    raise ValueError('invalid_record')
            except (ValueError, UnicodeError):
                result['errors'] = [*result.get('errors', []), {'metric': 'previousRecord', 'reason': 'invalid_record'}]
        result['warnings'] = warning_messages(result, previous)
        if os.fstat(handle.fileno()).st_size > MAX_LOG_BYTES:
            handle.seek(0)
            handle.truncate()
            if lines:
                handle.write(b'\n'.join(lines) + b'\n')
        else:
            handle.seek(0, os.SEEK_END)
            if handle.tell():
                handle.seek(-1, os.SEEK_END)
                if handle.read(1) != b'\n':
                    handle.write(b'\n')
        handle.write(json.dumps(result, ensure_ascii=True, separators=(',', ':')).encode('utf-8') + b'\n')
        handle.flush()
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--vhdx', type=Path, default=DEFAULT_VHDX)
    parser.add_argument('--log-path', type=Path, default=DEFAULT_LOG)
    args = parser.parse_args()
    result = append_record(args.log_path, collect_snapshot(args.vhdx))
    print(json.dumps(result, ensure_ascii=True, indent=2))


if __name__ == '__main__':
    main()
