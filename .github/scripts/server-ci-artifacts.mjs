import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseBrowserJson } from './browser-ci-artifacts.mjs';

const SERVER = resolve(dirname(fileURLToPath(import.meta.url)), '../../server');
const MANIFEST = 'server-build-manifest.json';
const KIND = 'sealed-server-full-stack-build';
const VARIANT = 'server-full-stack-fixture-v1';
const FILE_LIMIT = 32 * 1024 * 1024;
const TOTAL_LIMIT = 128 * 1024 * 1024;
const JSON_LIMIT = 16 * 1024 * 1024;
const HASH = /^[a-f0-9]{64}$/;
const VERSION = /^[0-9]+\.[0-9]+\.[0-9]+$/;
const REQUIRED = ['src/main.js', 'src/app.module.js', 'src/prisma/prisma.service.js', 'src/auth/auth.service.js', 'src/query/query.service.js', 'src/connections/connections.service.js', 'src/database-strategies/sqlite.strategy.js'];
const GENERATED = ['default.js', 'index.js', 'index.d.ts', 'client.js', 'query_compiler_bg.js', 'query_compiler_bg.wasm'];
const DEPENDENCIES = ['packageSha256', 'lockSha256', 'schemaSha256', 'prismaVersion', 'prismaClientVersion'];
const BINDING_KEYS = ['formatVersion', 'variant', 'releaseSha', 'treeSha', 'runId', 'runAttempt', 'nodeVersion', 'platform', 'arch', 'nodeAbi', ...DEPENDENCIES];
const check = (value, code) => { if (!value) throw new Error(code); };
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const order = (left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0;
const exactKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));

function assertBinding(value) {
  check(value && value.formatVersion === 1 && value.variant === VARIANT && ['releaseSha', 'treeSha'].every((key) => typeof value[key] === 'string' && /^[a-f0-9]{40}$/.test(value[key])) && typeof value.runId === 'string' && /^(?:[1-9][0-9]{0,19}|local)$/.test(value.runId) && typeof value.runAttempt === 'string' && /^[1-9][0-9]{0,5}$/.test(value.runAttempt) && DEPENDENCIES.slice(0, 3).every((key) => typeof value[key] === 'string' && HASH.test(value[key])) && ['prismaVersion', 'prismaClientVersion'].every((key) => typeof value[key] === 'string' && VERSION.test(value[key])) && typeof value.nodeVersion === 'string' && /^v22\.[0-9]+\.[0-9]+$/.test(value.nodeVersion) && ['platform', 'arch', 'nodeAbi'].every((key) => typeof value[key] === 'string' && /^[a-z0-9]{1,32}$/.test(value[key])), 'INVALID_SERVER_BUILD_BINDING');
  check(value.nodeVersion === process.version && value.platform === process.platform && value.arch === process.arch && value.nodeAbi === process.versions.modules, 'SERVER_RUNTIME_MISMATCH');
}

function safeRelative(value) {
  check(typeof value === 'string' && value.length <= 512 && !isAbsolute(value) && !/[\\\u0000-\u001f\u007f<>:"|?*]/.test(value) && value.split('/').every((part) => part && part !== '.' && part !== '..' && !/[ .]$/.test(part) && !/^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(part)), 'UNSAFE_ARTIFACT_PATH');
  return value;
}

function safeEmit(value, directory = false) {
  safeRelative(value);
  check(value.split('/').every((part) => !part.startsWith('.') && !/^(?:node_modules|keys|secrets)$/i.test(part) && !/\.(?:sql|prisma|db|sqlite3?|pem|key)(?:[-.]|$)/i.test(part)), 'UNSAFE_SERVER_EMIT');
  // Only TypeScript emit is transferred; never source, schema, SQL, DB, keys or dependency trees.
  check(directory || /\.(?:[cm]?js(?:\.map)?|d\.(?:ts|mts|cts)(?:\.map)?)$/.test(value), 'UNSAFE_SERVER_EMIT');
}

async function checkedDirectory(path) {
  const directory = resolve(path);
  for (let current = directory; ; current = dirname(current)) {
    const stat = await fs.lstat(current, { bigint: true });
    check(stat.isDirectory() && !stat.isSymbolicLink(), 'ARTIFACT_DIRECTORY_INVALID');
    if (current === dirname(current)) return directory;
  }
}

async function boundedBytes(path, maximum = FILE_LIMIT) {
  const before = await fs.lstat(path, { bigint: true });
  check(before.isFile() && !before.isSymbolicLink() && before.size <= BigInt(maximum), 'ARTIFACT_FILE_LIMIT');
  const handle = await fs.open(path, 'r');
  try {
    const stat = await handle.stat({ bigint: true });
    check(stat.isFile() && stat.size <= BigInt(maximum) && (process.platform === 'win32' || stat.dev === before.dev) && stat.ino === before.ino, 'ARTIFACT_FILE_CHANGED');
    const size = Number(stat.size);
    const buffer = Buffer.alloc(Math.min(size + 1, maximum + 1));
    let used = 0;
    while (used < buffer.length) {
      const { bytesRead } = await handle.read(buffer, used, buffer.length - used, null);
      if (!bytesRead) break;
      used += bytesRead;
    }
    check(used === size, 'ARTIFACT_FILE_CHANGED');
    return buffer.subarray(0, used);
  } finally { await handle.close(); }
}

const readJson = async (path) => parseBrowserJson((await boundedBytes(path, JSON_LIMIT)).toString('utf8'));

async function generatedSchemaMatches(serverRoot, schema, generated) {
  if (hash(schema) === hash(generated)) return true;
  const formatter = join(serverRoot, 'node_modules/prisma/build/index.js');
  const directory = await fs.mkdtemp(join(tmpdir(), 'server-schema-format-'));
  const path = join(directory, 'schema.prisma');
  try {
    check((await boundedBytes(formatter)).length > 0, 'GENERATED_PRISMA_SCHEMA_MISMATCH');
    await fs.writeFile(path, schema, { flag: 'wx', mode: 0o600 });
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(?:PATH|PATHEXT|SYSTEMROOT|COMSPEC|TEMP|TMP|TMPDIR|HOME|USERPROFILE|LOCALAPPDATA|APPDATA)$/i.test(key)));
    Object.assign(env, { CI: 'true', PRISMA_HIDE_UPDATE_MESSAGE: 'true', CHECKPOINT_DISABLE: '1' });
    execFileSync(process.execPath, [formatter, 'format', '--schema', path], { cwd: directory, env, timeout: 15000, maxBuffer: 1024 * 1024, stdio: 'pipe' });
    return hash(await boundedBytes(path)) === hash(generated);
  } catch { return false; }
  finally {
    try { await fs.unlink(path); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    await fs.rmdir(directory);
  }
}

async function serverPrerequisites(serverRoot) {
  await checkedDirectory(serverRoot);
  try {
    await fs.lstat(join(serverRoot, '.env')); // Presence only: never read an environment file.
    throw new Error('SERVER_ENV_FILE_PRESENT');
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await checkedDirectory(join(serverRoot, 'prisma'));
  const [pkg, lock, schema] = await Promise.all(['package.json', 'package-lock.json', 'prisma/schema.prisma'].map((path) => boundedBytes(join(serverRoot, path))));
  check(pkg.length && lock.length && schema.length, 'SERVER_DEPENDENCY_OR_SCHEMA_MISMATCH');
  const modules = join(serverRoot, 'node_modules');
  for (const path of ['prisma', '@prisma/client/runtime', '.prisma/client']) await checkedDirectory(join(modules, path));
  const prismaVersion = (await readJson(join(modules, 'prisma/package.json'))).version;
  const prismaClientVersion = (await readJson(join(modules, '@prisma/client/package.json'))).version;
  check(typeof prismaVersion === 'string' && VERSION.test(prismaVersion) && prismaVersion === prismaClientVersion, 'PRISMA_VERSION_MISMATCH');
  const generated = join(modules, '.prisma/client');
  for (const path of GENERATED) check((await boundedBytes(join(generated, path))).length > 0, 'GENERATED_PRISMA_FILE_EMPTY');
  check((await boundedBytes(join(modules, '@prisma/client/runtime/client.js'))).length > 0, 'GENERATED_PRISMA_FILE_EMPTY');
  check((await readJson(join(generated, 'package.json'))).version === prismaClientVersion, 'GENERATED_PRISMA_VERSION_MISMATCH');
  const schemaSha256 = hash(schema);
  check(await generatedSchemaMatches(serverRoot, schema, await boundedBytes(join(generated, 'schema.prisma'))), 'GENERATED_PRISMA_SCHEMA_MISMATCH');
  return { packageSha256: hash(pkg), lockSha256: hash(lock), schemaSha256, prismaVersion, prismaClientVersion };
}

export async function readServerBinding(serverRoot = SERVER, env = process.env) {
  const dependencies = await serverPrerequisites(serverRoot);
  const sourceRoot = resolve(serverRoot, '..');
  const git = (...args) => execFileSync('git', ['--no-optional-locks', '-c', 'core.fsmonitor=false', ...args], { cwd: sourceRoot, encoding: 'utf8', timeout: 15000, maxBuffer: 1024 * 1024 }).trim();
  check(resolve(git('rev-parse', '--show-toplevel')) === sourceRoot, 'SERVER_CHECKOUT_ROOT_MISMATCH');
  const releaseSha = git('rev-parse', 'HEAD');
  check(env.GITHUB_SHA === releaseSha || (env.GITHUB_SHA === undefined && env.GITHUB_ACTIONS !== 'true'), 'CHECKOUT_SHA_MISMATCH');
  check(git('status', '--porcelain', '--untracked-files=all', '--ignore-submodules=none') === '', 'DIRTY_CI_SOURCE');
  const value = {
    formatVersion: 1, variant: VARIANT, releaseSha, treeSha: git('rev-parse', 'HEAD^{tree}'),
    runId: env.GITHUB_RUN_ID ?? 'local', runAttempt: env.GITHUB_RUN_ATTEMPT ?? '1',
    nodeVersion: process.version, platform: process.platform, arch: process.arch, nodeAbi: process.versions.modules,
    ...dependencies,
  };
  assertBinding(value);
  return value;
}

async function checkContext(context, serverRoot) {
  check(exactKeys(context, BINDING_KEYS), 'INVALID_SERVER_BUILD_BINDING');
  assertBinding(context);
  const actual = await serverPrerequisites(serverRoot);
  check(DEPENDENCIES.every((key) => actual[key] === context[key]), 'SERVER_DEPENDENCY_OR_SCHEMA_MISMATCH');
}

async function fileInventory(directory, skipBuildInfo = false) {
  await checkedDirectory(directory);
  const files = [];
  const names = new Set();
  let total = 0;
  let visited = 0;
  const visit = async (folder, prefix = '') => {
    for (const name of await fs.readdir(folder)) {
      check(++visited <= 10000, 'SERVER_BUILD_ARTIFACT_LIMIT');
      const path = `${prefix}${name}`;
      safeEmit(path, true);
      const requested = join(folder, name);
      const stat = await fs.lstat(requested, { bigint: true });
      check(!stat.isSymbolicLink(), 'ARTIFACT_SYMLINK');
      if (stat.isDirectory()) await visit(requested, `${path}/`);
      else {
        check(stat.isFile(), 'UNSAFE_SERVER_EMIT');
        if (skipBuildInfo && path.endsWith('.tsbuildinfo')) continue;
        safeEmit(path);
        check(files.length < 5000 && !names.has(path.toLowerCase()), 'SERVER_BUILD_ARTIFACT_LIMIT');
        names.add(path.toLowerCase());
        const bytes = await boundedBytes(requested);
        total += bytes.length;
        check(total <= TOTAL_LIMIT, 'SERVER_BUILD_ARTIFACT_LIMIT');
        files.push({ path: `dist/${path}`, bytes: bytes.length, sha256: hash(bytes) });
      }
    }
  };
  await visit(directory);
  return files.sort(order);
}

function completeBuild(files) {
  check(REQUIRED.every((path) => files.some((file) => file.path === `dist/${path}` && file.bytes > 0)), 'INCOMPLETE_SERVER_BUILD');
}

function validateManifest(manifest, context) {
  check(exactKeys(manifest, [...BINDING_KEYS, 'kind', 'files']) && manifest.kind === KIND && Array.isArray(manifest.files) && manifest.files.length > 0 && manifest.files.length <= 5000, 'INVALID_SERVER_BUILD_MANIFEST');
  assertBinding(manifest);
  check(BINDING_KEYS.every((key) => manifest[key] === context[key]), 'BUILD_SOURCE_OR_RUN_MISMATCH');
  const seen = new Set();
  let total = 0;
  const files = manifest.files.map((file) => {
    check(exactKeys(file, ['path', 'bytes', 'sha256']), 'INVALID_SERVER_BUILD_MANIFEST');
    safeRelative(file.path);
    check(file.path.startsWith('dist/'), 'UNSAFE_SERVER_EMIT');
    safeEmit(file.path.slice(5));
    check(!seen.has(file.path.toLowerCase()) && Number.isSafeInteger(file.bytes) && file.bytes >= 0 && file.bytes <= FILE_LIMIT && typeof file.sha256 === 'string' && HASH.test(file.sha256), 'INVALID_SERVER_BUILD_MANIFEST');
    seen.add(file.path.toLowerCase()); total += file.bytes;
    check(total <= TOTAL_LIMIT, 'SERVER_BUILD_ARTIFACT_LIMIT');
    return { path: file.path, bytes: file.bytes, sha256: file.sha256 };
  }).sort(order);
  completeBuild(files);
  return files;
}

async function copyVerified(source, destination, files) {
  await fs.mkdir(destination); // Exclusive creation: no merge into an existing destination.
  for (const file of files) {
    const local = file.path.slice(5);
    const requested = join(source, local);
    await checkedDirectory(dirname(requested));
    const bytes = await boundedBytes(requested);
    check(bytes.length === file.bytes && hash(bytes) === file.sha256, 'BUILD_CHECKSUM_OR_INVENTORY_MISMATCH');
    const target = join(destination, local);
    await fs.mkdir(dirname(target), { recursive: true });
    await checkedDirectory(dirname(target));
    await fs.writeFile(target, bytes, { flag: 'wx', mode: 0o600 });
  }
}

export async function sealServerBuild(directory, context, serverRoot = SERVER) {
  await checkContext(context, serverRoot);
  const source = join(serverRoot, 'dist');
  const files = await fileInventory(source, true);
  completeBuild(files);
  const destination = resolve(directory);
  const within = relative(resolve(source), destination);
  check(isAbsolute(within) || within === '..' || within.startsWith(`..${sep}`), 'UNSAFE_ARTIFACT_DESTINATION');
  await checkedDirectory(dirname(destination));
  try { await fs.mkdir(destination); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    await checkedDirectory(destination);
    check((await fs.readdir(destination)).length === 0, 'SERVER_ARTIFACT_DESTINATION_NOT_EMPTY');
  }
  await copyVerified(source, join(destination, 'dist'), files);
  const manifest = { ...context, kind: KIND, files };
  await fs.writeFile(join(destination, MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  return verifyServerBuild(destination, context, false, serverRoot);
}

export async function verifyServerBuild(directory, context, installed = false, serverRoot = SERVER) {
  check(typeof installed === 'boolean', 'INVALID_SERVER_CI_ARGUMENTS');
  await checkContext(context, serverRoot);
  const requested = await checkedDirectory(directory);
  const entries = await fs.readdir(requested);
  check(entries.length === 2 && entries.includes('dist') && entries.includes(MANIFEST), 'INVALID_SERVER_ARTIFACT_DIRECTORY');
  const manifest = await readJson(join(requested, MANIFEST));
  const expected = validateManifest(manifest, context);
  const actual = await fileInventory(join(requested, 'dist'));
  check(JSON.stringify(actual) === JSON.stringify(expected), 'BUILD_CHECKSUM_OR_INVENTORY_MISMATCH');
  completeBuild(actual);
  if (installed) check(JSON.stringify(await fileInventory(join(serverRoot, 'dist'))) === JSON.stringify(expected), 'INSTALLED_SERVER_BUILD_MISMATCH');
  return manifest;
}

export async function installServerBuild(directory, context, serverRoot = SERVER) {
  const manifest = await verifyServerBuild(directory, context, false, serverRoot);
  const destination = join(serverRoot, 'dist');
  try { await fs.lstat(destination); throw new Error('SERVER_DIST_ALREADY_PRESENT'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  await copyVerified(join(resolve(directory), 'dist'), destination, manifest.files);
  return verifyServerBuild(directory, context, true, serverRoot);
}

export async function main(args = process.argv.slice(2)) {
  const [action, directory] = args;
  check(args.length === 2 && ['seal-build', 'verify-build', 'install-build', 'verify-installed-build'].includes(action) && typeof directory === 'string' && directory.length > 0, 'INVALID_SERVER_CI_ARGUMENTS');
  const context = await readServerBinding();
  const result = action === 'seal-build' ? await sealServerBuild(directory, context) : action === 'install-build' ? await installServerBuild(directory, context) : await verifyServerBuild(directory, context, action === 'verify-installed-build');
  process.stdout.write(`${JSON.stringify({ action, releaseSha: context.releaseSha, runId: context.runId, runAttempt: context.runAttempt, files: result.files.length, verified: true })}\n`);
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => { process.stderr.write(`${/^[A-Z0-9_]{1,100}$/.test(error?.message || '') ? error.message : 'SERVER_CI_VERIFICATION_FAILED'}\n`); process.exitCode = 1; });
}
