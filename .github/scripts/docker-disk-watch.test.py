import importlib.util
import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

SCRIPT = Path(__file__).with_name('docker-disk-watch.py')
spec = importlib.util.spec_from_file_location('docker_disk_watch', SCRIPT)
watch = importlib.util.module_from_spec(spec)
spec.loader.exec_module(watch)

SYSTEM_DF = '\n'.join(json.dumps(row) for row in [
    {'Type': 'Images', 'Size': '18.05GB', 'Reclaimable': '9.741GB (53%)', 'TotalCount': '28', 'Active': '11'},
    {'Type': 'Containers', 'Size': '166.8MB', 'Reclaimable': '166.7MB (99%)', 'TotalCount': '15', 'Active': '3'},
    {'Type': 'Local Volumes', 'Size': '320.3MB', 'TotalCount': '22', 'Active': '5'},
])
DISK_DF = 'Filesystem Size Used Available Use% Mounted on\n/dev/sdd 1006.9G 13.3G 942G 1% /mnt/docker-desktop-disk\n'


def entry(**updates):
    value = {
        'timestamp_utc': '2026-11-23T00:00:00+00:00',
        'vhdxBytes': 16 * 1024 ** 3,
        'vhdxGiB': 16.0,
        'dockerRunning': True,
        'buildCacheGB': 0.0,
        'imagesGB': 18.05,
        'containersRunning': 2,
        'diskUsedGiB': 13.3,
    }
    value.update(updates)
    return value


class SizeAndMetadataTests(unittest.TestCase):
    def test_decimal_binary_and_raw_byte_sizes(self):
        for value, expected in [('0B', 0), ('8.451GB', 8451000000), ('1.5MiB', 1572864), ('2KB', 2000), ('1024', 1024), (123, 123)]:
            with self.subTest(value=value):
                self.assertEqual(watch.size_bytes(value), expected)
        for value in [None, True, '-1B', 'NaN', '1garbage', {}, float('inf')]:
            with self.subTest(value=value):
                with self.assertRaises(ValueError):
                    watch.size_bytes(value)

    def test_system_df_uses_size_and_active_not_reclaimable_or_total(self):
        parsed = watch.parse_system_df(SYSTEM_DF)
        self.assertEqual(parsed['imagesGB'], 18.05)
        self.assertEqual(parsed['containersRunning'], 3)
        self.assertNotEqual(parsed['imagesGB'], 9.741)
        self.assertNotEqual(parsed['containersRunning'], 15)

    def test_cache_scalar_and_record_json_sizes(self):
        self.assertEqual(watch.parse_cache_bytes('"0.43GB"\n640\n'), 430000640)
        self.assertEqual(watch.parse_cache_bytes('{"Size":"1MiB"}\n'), 1048576)
        self.assertEqual(watch.parse_cache_bytes(''), 0)
        for value in ['Total: 4GB', '{"Description":"not a size"}', 'null']:
            with self.subTest(value=value):
                with self.assertRaises(ValueError):
                    watch.parse_cache_bytes(value)

    def test_df_targets_mount_and_handles_binary_units(self):
        self.assertEqual(watch.parse_disk_used(DISK_DF), 13.3)
        self.assertEqual(watch.parse_disk_used(DISK_DF.replace('13.3G', '512M')), 0.5)
        with self.assertRaises(ValueError):
            watch.parse_disk_used('Filesystem Size Used\n/dev/sdd 100G 50G /different/mount')


    def test_unitless_external_df_values_are_bytes_not_stored_gib(self):
        self.assertAlmostEqual(watch.parse_disk_used(DISK_DF.replace('13.3G', '512')), 512 / 1024 ** 3, places=12)
        self.assertEqual(watch.parse_disk_used(DISK_DF.replace('13.3G', '0')), 0.0)
        self.assertEqual(watch.disk_gib('13.3'), watch.Decimal('13.3'))


class CollectionTests(unittest.TestCase):
    def fake_runner(self, calls, cache_failure=False):
        def run(args):
            calls.append(args)
            if args[0] == 'docker' and args[1] == 'info':
                return '29.9.2\n'
            if args[:3] == ['docker', 'system', 'df']:
                return SYSTEM_DF
            if args[:3] == ['docker', 'buildx', 'du']:
                if cache_failure:
                    raise watch.CommandError('command_failed')
                return '"0.43GB"\n'
            if args[:2] == ['docker', 'ps']:
                return 'a' * 64 + '\n' + 'b' * 64 + '\n'
            if args[0] == 'wsl.exe':
                return DISK_DF
            raise AssertionError(f'Unexpected command: {args}')
        return run

    def test_running_collection_is_readonly_and_reports_numeric_values(self):
        calls = []
        with patch.object(watch, 'read_vhdx_bytes', return_value=16 * 1024 ** 3):
            result = watch.collect_snapshot(Path('unused.vhdx'), self.fake_runner(calls))
        self.assertTrue(result['dockerRunning'])
        self.assertEqual(result['imagesGB'], 18.05)
        self.assertEqual(result['containersRunning'], 2)
        self.assertEqual(result['buildCacheGB'], 0.43)
        self.assertEqual(result['diskUsedGiB'], 13.3)
        self.assertEqual(len(calls), 5)
        for args in calls:
            self.assertFalse(set(args).intersection({'prune', 'trim', 'start', 'stop', 'rm'}))
        self.assertEqual(calls[0], ['docker', 'info', '--format', '{{.ServerVersion}}'])
        self.assertIn('{{json .Size}}', calls[2])

    def test_off_daemon_never_calls_other_docker_or_wsl_commands(self):
        calls = []
        def run(args):
            calls.append(args)
            raise watch.CommandError('command_failed')
        with patch.object(watch, 'read_vhdx_bytes', return_value=19 * 1024 ** 3):
            result = watch.collect_snapshot(Path('unused.vhdx'), run)
        self.assertFalse(result['dockerRunning'])
        self.assertEqual(len(calls), 1)
        self.assertEqual(result['vhdxBytes'], 19 * 1024 ** 3)
        self.assertIsNone(result['buildCacheGB'])
        self.assertIsNone(result['imagesGB'])
        self.assertIsNone(result['containersRunning'])
        self.assertIsNone(result['diskUsedGiB'])
        self.assertIn('VHDX > 18GiB', result['warnings'])

    def test_failed_cache_is_unknown_not_zero_and_is_not_retried(self):
        calls = []
        with patch.object(watch, 'read_vhdx_bytes', return_value=16 * 1024 ** 3):
            result = watch.collect_snapshot(Path('unused.vhdx'), self.fake_runner(calls, True))
        self.assertIsNone(result['buildCacheGB'])
        self.assertIn({'metric': 'buildCacheGB', 'reason': 'command_failed'}, result['errors'])
        self.assertEqual(sum(args[:3] == ['docker', 'buildx', 'du'] for args in calls), 1)
        self.assertEqual(result['containersRunning'], 2)

    def test_command_errors_do_not_expose_stderr(self):
        completed = subprocess.CompletedProcess(['docker'], 1, '', 'private token=not-for-log')
        with patch.object(watch.subprocess, 'run', return_value=completed):
            with self.assertRaises(watch.CommandError) as caught:
                watch.run_command(['docker', 'info'])
        self.assertEqual(str(caught.exception), 'command_failed')
        self.assertNotIn('private', str(caught.exception))
        with patch.object(watch.subprocess, 'run', side_effect=subprocess.TimeoutExpired(['docker'], 1)):
            with self.assertRaisesRegex(watch.CommandError, 'command_timeout'):
                watch.run_command(['docker', 'info'])


class LogAndWarningTests(unittest.TestCase):
    def test_appends_one_complete_record_and_normalizes_legacy_disk_units(self):
        with tempfile.TemporaryDirectory() as directory:
            log = Path(directory) / 'watch.jsonl'
            previous = entry(diskUsedGiB='13.3G', imagesGB='wrong legacy value', containersRunning='9')
            log.write_text(json.dumps(previous) + '\n', encoding='utf-8')
            result = watch.append_record(log, entry(diskUsedGiB=16.5))
            rows = [json.loads(line) for line in log.read_text(encoding='utf-8').splitlines()]
            self.assertEqual(len(rows), 2)
            self.assertEqual(rows[0], previous)
            self.assertEqual(rows[-1], result)
            self.assertTrue(any('DISK USED' in warning for warning in result['warnings']))

    def test_uses_immediate_previous_record_not_an_older_running_sample(self):
        with tempfile.TemporaryDirectory() as directory:
            log = Path(directory) / 'watch.jsonl'
            older = entry(diskUsedGiB=5.0)
            previous = entry(dockerRunning=False, diskUsedGiB=None)
            log.write_text(json.dumps(older) + '\n' + json.dumps(previous) + '\n', encoding='utf-8')
            result = watch.append_record(log, entry(diskUsedGiB=13.3))
            self.assertEqual(result['warnings'], [])

    def test_retains_last500_before_exactly_one_append_when_size_limit_is_crossed(self):
        with tempfile.TemporaryDirectory() as directory:
            log = Path(directory) / 'watch.jsonl'
            log.write_text(''.join(json.dumps(entry(number=index)) + '\n' for index in range(510)), encoding='utf-8')
            with patch.object(watch, 'MAX_LOG_BYTES', 100):
                watch.append_record(log, entry(number=510))
            rows = [json.loads(line) for line in log.read_text(encoding='utf-8').splitlines()]
            self.assertEqual(len(rows), 501)
            self.assertEqual(rows[0]['number'], 10)
            self.assertEqual(rows[-1]['number'], 510)

    def test_thresholds_are_strict_and_do_not_depend_on_rounded_display_values(self):
        at_threshold = entry(vhdxBytes=18 * 1024 ** 3, buildCacheGB=4.5, diskUsedGiB=14.1)
        self.assertEqual(watch.warning_messages(at_threshold, entry(diskUsedGiB=11.1)), [])
        above = entry(vhdxBytes=18 * 1024 ** 3 + 1, buildCacheGB=4.500001, diskUsedGiB=14.2)
        self.assertEqual(len(watch.warning_messages(above, entry(diskUsedGiB=11.1))), 3)

    def test_redirected_path_open_cannot_append_to_another_file(self):
        with tempfile.TemporaryDirectory() as directory:
            log = Path(directory) / 'watch.jsonl'
            victim = Path(directory) / 'other.jsonl'
            log.write_text(json.dumps(entry()) + '\n', encoding='utf-8')
            protected = json.dumps({'protected': True}) + '\n'
            victim.write_text(protected, encoding='utf-8')
            original_open = Path.open
            def redirected(path, mode='r', *args, **kwargs):
                return original_open(victim if path == log and mode == 'a+b' else path, mode, *args, **kwargs)
            with patch.object(Path, 'open', new=redirected):
                try:
                    watch.append_record(log, entry())
                except ValueError:
                    pass
            self.assertEqual(victim.read_text(encoding='utf-8'), protected)

    def test_opened_handle_identity_must_match_the_log_path(self):
        with tempfile.TemporaryDirectory() as directory:
            log = Path(directory) / 'watch.jsonl'
            other = Path(directory) / 'other.jsonl'
            original = json.dumps(entry()) + '\n'
            log.write_text(original, encoding='utf-8')
            other.write_text('{}\n', encoding='utf-8')
            with patch.object(watch.os, 'fstat', return_value=other.stat()):
                with self.assertRaisesRegex(ValueError, 'unsafe_log_handle'):
                    watch.append_record(log, entry())
            self.assertEqual(log.read_text(encoding='utf-8'), original)

    def test_rejects_symlink_log_without_overwriting_its_target(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / 'watch.jsonl'
            target.write_text('protected content', encoding='utf-8')
            with patch.object(watch, 'assert_safe_log_path', side_effect=ValueError('unsafe_log_path')):
                with self.assertRaises(ValueError):
                    watch.append_record(target, entry())
            self.assertEqual(target.read_text(encoding='utf-8'), 'protected content')


if __name__ == '__main__':
    unittest.main()
