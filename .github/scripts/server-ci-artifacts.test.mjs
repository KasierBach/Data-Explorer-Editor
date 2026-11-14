import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import childProcess, { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const api = await import('./server-ci-artifacts.mjs').catch((error) => {
  if (error.code === 'ERR_MODULE_NOT_FOUND' && error.message.includes('server-ci-artifacts.mjs')) return null;
  throw error;
});
const MANIFEST = 'server-build-manifest.json';
const REQUIRED = ['src/main.js', 'src/app.module.js', 'src/prisma/prisma.service.js', 'src/auth/auth.service.js', 'src/query/query.service.js', 'src/connections/connections.service.js', 'src/database-strategies/sqlite.strategy.js'];
const GENERATED = ['default.js', 'index.js', 'index.d.ts', 'client.js', 'package.json', 'query_compiler_bg.js', 'query_compiler_bg.wasm', 'schema.prisma'];
const SCHEMA = '// inert unit fixture, not an executable schema\n';
const PACKAGE = '{"name":"server-unit-fixture","version":"1.0.0"}\n';
const LOCK = '{"name":"server-unit-fixture","lockfileVersion":3}\n';
const INERT = 'throw new Error("ARTIFACT_MUST_NEVER_EXECUTE");\n';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const binding = () => ({
  formatVersion: 1, variant: 'server-full-stack-fixture-v1', releaseSha: 'a'.repeat(40), treeSha: 'b'.repeat(40),
  runId: '123', runAttempt: '1', nodeVersion: process.version, platform: process.platform, arch: process.arch,
  nodeAbi: process.versions.modules, packageSha256: hash(PACKAGE), lockSha256: hash(LOCK), schemaSha256: hash(SCHEMA),
  prismaVersion: '6.19.3', prismaClientVersion: '6.19.3',
});
const saveJson = (path, value) => fs.writeFile(path, `${JSON.stringify(value)}\n`);

async function fixture(t) {
  const root = await fs.mkdtemp(join(tmpdir(), 'server-artifact-unit-'));
  t.after(async () => {
    t.mock.restoreAll();
    assert.ok((await fs.lstat(root)).isDirectory());
    await fs.rm(root, { recursive: true, force: true });
  });
  const serverRoot = join(root, 'server');
  const generated = join(serverRoot, 'node_modules/.prisma/client');
  for (const path of [generated, join(serverRoot, 'prisma'), join(serverRoot, 'node_modules/prisma'), join(serverRoot, 'node_modules/@prisma/client/runtime')]) await fs.mkdir(path, { recursive: true });
  await fs.writeFile(join(serverRoot, 'package.json'), PACKAGE);
  await fs.writeFile(join(serverRoot, 'package-lock.json'), LOCK);
  await fs.writeFile(join(serverRoot, 'prisma/schema.prisma'), SCHEMA);
  for (const path of ['prisma/package.json', '@prisma/client/package.json']) await saveJson(join(serverRoot, 'node_modules', path), { version: '6.19.3' });
  for (const name of GENERATED) await fs.writeFile(join(generated, name), name === 'schema.prisma' ? SCHEMA : name === 'package.json' ? '{"version":"6.19.3"}' : INERT);
  await fs.writeFile(join(serverRoot, 'node_modules/@prisma/client/runtime/client.js'), INERT);
  for (const name of [...REQUIRED, 'src/main.js.map', 'src/main.d.ts', 'prisma.config.js', 'prisma.config.js.map', 'prisma.config.d.ts', 'tsconfig.build.tsbuildinfo']) {
    const path = join(serverRoot, 'dist', name);
    await fs.mkdir(dirname(path), { recursive: true });
    await fs.writeFile(path, name.endsWith('.map') ? '{"version":3}' : INERT);
  }
  return { root, serverRoot, generated, artifact: join(root, 'artifact'), context: binding() };
}

async function rewriteManifest(f, change) {
  const path = join(f.artifact, MANIFEST);
  const value = JSON.parse(await fs.readFile(path, 'utf8'));
  change(value);
  await saveJson(path, value);
}

async function installedFixture(t) {
  const f = await fixture(t);
  await api.sealServerBuild(f.artifact, f.context, f.serverRoot);
  await fs.rm(join(f.serverRoot, 'dist'), { recursive: true });
  await api.installServerBuild(f.artifact, f.context, f.serverRoot);
  return f;
}

function git(root, ...args) {
  return execFileSync('git', ['-c', 'core.hooksPath=.git/empty-hooks', '-c', 'commit.gpgSign=false', '-c', 'core.autocrlf=false', ...args], {
    cwd: root, encoding: 'utf8', timeout: 15000, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_AUTHOR_NAME: 'Unit Fixture', GIT_AUTHOR_EMAIL: 'fixture@example.invalid', GIT_COMMITTER_NAME: 'Unit Fixture', GIT_COMMITTER_EMAIL: 'fixture@example.invalid', GIT_AUTHOR_DATE: '2026-01-01T00:00:00Z', GIT_COMMITTER_DATE: '2026-01-01T00:00:00Z' },
  }).trim();
}

async function sourceFixture(t) {
  const f = await fixture(t);
  await fs.writeFile(join(f.root, '.gitignore'), 'server/node_modules/\nserver/dist/\nserver/.env\n');
  git(f.root, 'init', '--quiet');
  await fs.mkdir(join(f.root, '.git/empty-hooks'));
  git(f.root, 'add', '--', '.gitignore', 'server/package.json', 'server/package-lock.json', 'server/prisma/schema.prisma');
  git(f.root, 'commit', '--quiet', '--no-verify', '-m', 'inert unit fixture');
  f.context.releaseSha = git(f.root, 'rev-parse', 'HEAD');
  f.context.treeSha = git(f.root, 'rev-parse', 'HEAD^{tree}');
  return f;
}

async function temporaryEnv(values, task) {
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  try {
    for (const [key, value] of Object.entries(values)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
    return await task();
  } finally {
    for (const [key, value] of Object.entries(previous)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
}

function pretendLink(t, path) {
  const original = fs.lstat.bind(fs);
  t.mock.method(fs, 'lstat', async (requested, options) => {
    const stat = await original(requested, options);
    return resolve(String(requested)) === resolve(path) ? Object.assign(Object.create(stat), { isSymbolicLink: () => true }) : stat;
  });
}

// The first run intentionally has no implementation: this is an explicit, real RED.
test('server artifact helper exports the required pure API', () => {
  assert.ok(api, 'MISSING_SERVER_CI_ARTIFACT_HELPER: implementation must follow this RED run');
  for (const name of ['readServerBinding', 'sealServerBuild', 'verifyServerBuild', 'installServerBuild', 'main']) assert.equal(typeof api[name], 'function', name);
});

if (api) {
  test('accepts Prisma-generated field-alignment normalization while binding the exact raw checkout schema', async (t) => {
    const f = await fixture(t);
    // Mirrors the real Prisma 6.19.3 source/generated difference: whitespace, not schema drift.
    const source = 'model FixtureRecord {\n  id String @id\n  environment String?   @default("none")\n}\n';
    const generated = 'model FixtureRecord {\n  id          String  @id\n  environment String? @default("none")\n}\n';
    assert.notEqual(hash(source), hash(generated));
    await fs.writeFile(join(f.serverRoot, 'prisma/schema.prisma'), source);
    await fs.writeFile(join(f.generated, 'schema.prisma'), generated);
    f.context.schemaSha256 = hash(source);
    const formatter = join(f.serverRoot, 'node_modules/prisma/build/index.js');
    await fs.mkdir(dirname(formatter), { recursive: true });
    await fs.writeFile(formatter, INERT); // Never execute dependency/artifact code in this unit test.
    const formattedPaths = [];
    let expectedSource = source;
    const originalExec = childProcess.execFileSync;
    const mock = t.mock.method(childProcess, 'execFileSync', (command, args, options) => {
      if (command === 'git') return originalExec(command, args, options);
      assert.equal(command, process.execPath);
      assert.deepEqual(args.slice(0, 3), [formatter, 'format', '--schema']);
      assert.equal(args.length, 4);
      assert.equal(options.cwd, dirname(args[3]));
      assert.notEqual(resolve(options.cwd), resolve(f.serverRoot));
      assert.ok(resolve(options.cwd).startsWith(resolve(tmpdir())));
      assert.equal(readFileSync(args[3], 'utf8'), readFileSync(join(f.serverRoot, 'prisma/schema.prisma'), 'utf8'));
      assert.notEqual(resolve(args[3]), resolve(join(f.generated, 'schema.prisma')));
      assert.equal(readFileSync(join(f.serverRoot, 'prisma/schema.prisma'), 'utf8'), expectedSource);
      assert.equal(options.env.CI, 'true');
      assert.ok(Object.keys(options.env).every((key) => /^(?:PATH|PATHEXT|SYSTEMROOT|COMSPEC|TEMP|TMP|TMPDIR|HOME|USERPROFILE|LOCALAPPDATA|APPDATA|CI|PRISMA_HIDE_UPDATE_MESSAGE|CHECKPOINT_DISABLE)$/i.test(key)));
      for (const key of ['DATABASE_URL', 'OPENAI_API_KEY', 'GOOGLE_API_KEY', 'NODE_OPTIONS']) assert.equal(options.env[key], undefined);
      formattedPaths.push(args[3]);
      writeFileSync(args[3], generated);
      return '';
    });
    syncBuiltinESMExports();
    t.after(() => { mock.mock.restore(); syncBuiltinESMExports(); });
    await temporaryEnv({ DATABASE_URL: 'inert-unit-marker', OPENAI_API_KEY: 'inert-unit-marker', GOOGLE_API_KEY: 'inert-unit-marker', NODE_OPTIONS: '--trace-warnings' }, async () => {
      const sealed = await api.sealServerBuild(f.artifact, f.context, f.serverRoot);
      assert.equal(sealed.schemaSha256, hash(source));
      assert.notEqual(sealed.schemaSha256, hash(generated));
      assert.deepEqual(await api.verifyServerBuild(f.artifact, f.context, false, f.serverRoot), sealed);
      await fs.rm(join(f.serverRoot, 'dist'), { recursive: true });
      await api.installServerBuild(f.artifact, f.context, f.serverRoot);
      assert.equal((await api.verifyServerBuild(f.artifact, f.context, true, f.serverRoot)).schemaSha256, hash(source));
      await fs.writeFile(join(f.generated, 'schema.prisma'), generated.replace('@default("none")', '@default("other")'));
      await assert.rejects(api.verifyServerBuild(f.artifact, f.context, true, f.serverRoot), /GENERATED_PRISMA_SCHEMA_MISMATCH/);
      await fs.writeFile(join(f.generated, 'schema.prisma'), generated);
      expectedSource = `${source}\n`;
      await fs.writeFile(join(f.serverRoot, 'prisma/schema.prisma'), expectedSource);
      await assert.rejects(api.verifyServerBuild(f.artifact, f.context, true, f.serverRoot), /SERVER_DEPENDENCY_OR_SCHEMA_MISMATCH/);
    });
    assert.equal(formattedPaths.length, 8);
    assert.equal(new Set(formattedPaths).size, formattedPaths.length);
    for (const path of formattedPaths) await assert.rejects(fs.lstat(dirname(path)), { code: 'ENOENT' });
  });

  test('seals complete emitted JS/maps/declarations, excludes build info, installs and rehashes without executing code', async (t) => {
    const f = await fixture(t);
    const sealed = await api.sealServerBuild(f.artifact, f.context, f.serverRoot);
    assert.equal(sealed.kind, 'sealed-server-full-stack-build');
    assert.equal(sealed.variant, 'server-full-stack-fixture-v1');
    assert.equal(sealed.formatVersion, 1);
    assert.equal(sealed.files.length, REQUIRED.length + 5);
    for (const path of [...REQUIRED, 'src/main.js.map', 'src/main.d.ts', 'prisma.config.js', 'prisma.config.js.map', 'prisma.config.d.ts']) {
      const bytes = await fs.readFile(join(f.serverRoot, 'dist', path));
      assert.deepEqual(sealed.files.find((file) => file.path === `dist/${path}`), { path: `dist/${path}`, bytes: bytes.length, sha256: hash(bytes) });
    }
    assert.deepEqual(await fs.readdir(f.artifact), ['dist', MANIFEST]);
    assert.ok(sealed.files.every((file) => !file.path.includes('node_modules') && !file.path.endsWith('.tsbuildinfo')));
    assert.deepEqual(await api.verifyServerBuild(f.artifact, f.context, false, f.serverRoot), sealed);
    await fs.rm(join(f.serverRoot, 'dist'), { recursive: true });
    assert.deepEqual(await api.installServerBuild(f.artifact, f.context, f.serverRoot), sealed);
    assert.deepEqual(await api.verifyServerBuild(f.artifact, f.context, true, f.serverRoot), sealed);
    assert.equal(await fs.readFile(join(f.serverRoot, 'dist/src/main.js'), 'utf8'), INERT);
    await assert.rejects(fs.lstat(join(f.serverRoot, 'dist/tsconfig.build.tsbuildinfo')), { code: 'ENOENT' });
  });

  const changedBindings = {
    releaseSha: 'c'.repeat(40), treeSha: 'd'.repeat(40), runId: '124', runAttempt: '2',
    packageSha256: 'e'.repeat(64), lockSha256: 'f'.repeat(64), schemaSha256: '1'.repeat(64),
    prismaVersion: '6.19.4', prismaClientVersion: '6.19.4', nodeVersion: 'v22.0.0',
    platform: process.platform === 'win32' ? 'linux' : 'win32', arch: process.arch === 'x64' ? 'arm64' : 'x64',
    nodeAbi: '999', variant: 'browser-mock-preview-v1', formatVersion: 2,
  };
  for (const [field, value] of Object.entries(changedBindings)) test(`rejects manifest binding drift: ${field}`, async (t) => {
    const f = await fixture(t);
    await api.sealServerBuild(f.artifact, f.context, f.serverRoot);
    await rewriteManifest(f, (manifest) => { manifest[field] = value; });
    await assert.rejects(api.verifyServerBuild(f.artifact, f.context, false, f.serverRoot), /BUILD_SOURCE_OR_RUN_MISMATCH|INVALID_SERVER_BUILD_BINDING|SERVER_RUNTIME_MISMATCH/);
  });

  test('rejects wrong kind and unexpected manifest fields', async (t) => {
    const f = await fixture(t);
    await api.sealServerBuild(f.artifact, f.context, f.serverRoot);
    await rewriteManifest(f, (manifest) => { manifest.kind = 'sealed-client-browser-build'; });
    await assert.rejects(api.verifyServerBuild(f.artifact, f.context, false, f.serverRoot), /INVALID_SERVER_BUILD_MANIFEST/);
    await rewriteManifest(f, (manifest) => { manifest.kind = 'sealed-server-full-stack-build'; manifest.extra = true; });
    await assert.rejects(api.verifyServerBuild(f.artifact, f.context, false, f.serverRoot), /INVALID_SERVER_BUILD_MANIFEST/);
  });

  for (const name of ['package.json', 'package-lock.json', 'prisma/schema.prisma', 'node_modules/prisma/package.json', 'node_modules/@prisma/client/package.json']) test(`rejects changed checkout dependency/schema bytes: ${name}`, async (t) => {
    const f = await fixture(t);
    await api.sealServerBuild(f.artifact, f.context, f.serverRoot);
    const path = join(f.serverRoot, name);
    await fs.writeFile(path, name.startsWith('node_modules/') ? '{"version":"6.19.4"}' : `${await fs.readFile(path, 'utf8')} `);
    await assert.rejects(api.verifyServerBuild(f.artifact, f.context, false, f.serverRoot), /SERVER_DEPENDENCY_OR_SCHEMA_MISMATCH|PRISMA_VERSION_MISMATCH|GENERATED_PRISMA_SCHEMA_MISMATCH|GENERATED_PRISMA_VERSION_MISMATCH/);
  });

  for (const name of [...GENERATED.map((name) => `node_modules/.prisma/client/${name}`), 'node_modules/@prisma/client/runtime/client.js']) test(`requires regular, generated-client prerequisite on producer and consumer: ${name}`, async (t) => {
    const f = await fixture(t);
    const path = join(f.serverRoot, name);
    const bytes = await fs.readFile(path);
    await fs.rm(path);
    await assert.rejects(api.sealServerBuild(f.artifact, f.context, f.serverRoot), /PRISMA|ENOENT/);
    await fs.writeFile(path, bytes);
    await api.sealServerBuild(f.artifact, f.context, f.serverRoot);
    await fs.rm(join(f.serverRoot, 'dist'), { recursive: true });
    await fs.rm(path);
    await assert.rejects(api.verifyServerBuild(f.artifact, f.context, false, f.serverRoot), /PRISMA|ENOENT/);
    await assert.rejects(api.installServerBuild(f.artifact, f.context, f.serverRoot), /PRISMA|ENOENT/);
    await assert.rejects(fs.lstat(join(f.serverRoot, 'dist')), { code: 'ENOENT' });
  });

  for (const [name, kind] of [['default.js', 'empty'], ['index.js', 'directory'], ['query_compiler_bg.wasm', 'link']]) test(`rejects ${kind} generated-client file without creating real links`, async (t) => {
    const f = await fixture(t);
    const path = join(f.generated, name);
    if (kind === 'link') pretendLink(t, path);
    else { await fs.rm(path); if (kind === 'directory') await fs.mkdir(path); else await fs.writeFile(path, ''); }
    await assert.rejects(api.sealServerBuild(f.artifact, f.context, f.serverRoot), /PRISMA|ARTIFACT|UNSAFE/);
  });

  for (const [name, content] of [['schema.prisma', '// mismatched fixture'], ['package.json', '{"version":"6.19.4"}']]) test(`rejects generated-client mismatch: ${name}`, async (t) => {
    const f = await fixture(t);
    await fs.writeFile(join(f.generated, name), content);
    await assert.rejects(api.sealServerBuild(f.artifact, f.context, f.serverRoot), /GENERATED_PRISMA_(SCHEMA|VERSION)_MISMATCH/);
  });

  for (const poison of ['{"kind":1,"kind":2}', '{"__proto__":{}}', '{"files":[{"constructor":{}}]}', '{"prototype":0}', '{"files":[],"fi\\u006ces":[]}']) test(`rejects unsafe JSON before trusting it: ${poison}`, async (t) => {
    const f = await fixture(t);
    await api.sealServerBuild(f.artifact, f.context, f.serverRoot);
    await fs.writeFile(join(f.artifact, MANIFEST), poison);
    await assert.rejects(api.verifyServerBuild(f.artifact, f.context, false, f.serverRoot), /DUPLICATE_OR_UNSAFE_JSON_KEY/);
  });

  for (const path of ['../escape.js', '/dist/main.js', 'dist/../main.js', 'dist\\src\\main.js', 'C:/dist/main.js', 'dist/src/main.js:stream', 'dist/src/CON.js', 'dist/src/main.js.']) test(`rejects unsafe manifest path: ${path}`, async (t) => {
    const f = await fixture(t);
    await api.sealServerBuild(f.artifact, f.context, f.serverRoot);
    await rewriteManifest(f, (manifest) => { manifest.files[0].path = path; });
    await assert.rejects(api.verifyServerBuild(f.artifact, f.context, false, f.serverRoot), /UNSAFE_ARTIFACT_PATH|UNSAFE_SERVER_EMIT/);
  });

  for (const path of ['.env', '.env.js', 'node_modules/secret.js', '.prisma/client/index.js', 'prisma/schema.prisma', 'prisma/migrations/init.sql', 'fixtures/data.sqlite', 'fixtures/data.db', 'keys/private.pem', 'src/source.ts', 'public/index.html']) test(`refuses non-emitted/private payload: ${path}`, async (t) => {
    const f = await fixture(t);
    const requested = join(f.serverRoot, 'dist', path);
    await fs.mkdir(dirname(requested), { recursive: true });
    await fs.writeFile(requested, 'inert forbidden fixture');
    await assert.rejects(api.sealServerBuild(f.artifact, f.context, f.serverRoot), /UNSAFE_ARTIFACT_PATH|UNSAFE_SERVER_EMIT/);
    await assert.rejects(fs.lstat(f.artifact), { code: 'ENOENT' });
  });

  for (const name of REQUIRED) test(`requires compiled module even with rehashed manifest: ${name}`, async (t) => {
    const f = await fixture(t);
    await api.sealServerBuild(f.artifact, f.context, f.serverRoot);
    await fs.rm(join(f.artifact, 'dist', name));
    await rewriteManifest(f, (manifest) => { manifest.files = manifest.files.filter((file) => file.path !== `dist/${name}`); });
    await assert.rejects(api.verifyServerBuild(f.artifact, f.context, false, f.serverRoot), /INCOMPLETE_SERVER_BUILD/);
  });

  test('producer rejects missing main and consumer rejects a rehashed empty main', async (t) => {
    const f = await fixture(t);
    await fs.rm(join(f.serverRoot, 'dist/src/main.js'));
    await assert.rejects(api.sealServerBuild(f.artifact, f.context, f.serverRoot), /INCOMPLETE_SERVER_BUILD/);
    await fs.writeFile(join(f.serverRoot, 'dist/src/main.js'), INERT);
    await api.sealServerBuild(f.artifact, f.context, f.serverRoot);
    await fs.writeFile(join(f.artifact, 'dist/src/main.js'), '');
    await rewriteManifest(f, (manifest) => { Object.assign(manifest.files.find((file) => file.path === 'dist/src/main.js'), { bytes: 0, sha256: hash('') }); });
    await assert.rejects(api.verifyServerBuild(f.artifact, f.context, false, f.serverRoot), /INCOMPLETE_SERVER_BUILD/);
  });

  for (const change of ['changed', 'added', 'missing']) test(`rejects ${change} artifact bytes, with no installation fallback`, async (t) => {
    const f = await fixture(t);
    await api.sealServerBuild(f.artifact, f.context, f.serverRoot);
    const path = join(f.artifact, 'dist/src/main.js');
    if (change === 'missing') await fs.rm(path);
    else await fs.writeFile(change === 'added' ? join(f.artifact, 'dist/src/added.js') : path, 'changed inert bytes');
    await fs.rm(join(f.serverRoot, 'dist'), { recursive: true });
    await assert.rejects(api.installServerBuild(f.artifact, f.context, f.serverRoot), /BUILD_CHECKSUM_OR_INVENTORY_MISMATCH|INCOMPLETE_SERVER_BUILD/);
    await assert.rejects(fs.lstat(join(f.serverRoot, 'dist')), { code: 'ENOENT' });
  });

  for (const change of ['changed', 'added', 'missing']) test(`rehashes installed dist and rejects ${change} bytes`, async (t) => {
    const f = await installedFixture(t);
    const path = join(f.serverRoot, 'dist/src/main.js');
    if (change === 'missing') await fs.rm(path);
    else await fs.writeFile(change === 'added' ? join(f.serverRoot, 'dist/src/added.js') : path, 'installed drift');
    await assert.rejects(api.verifyServerBuild(f.artifact, f.context, true, f.serverRoot), /INSTALLED_SERVER_BUILD_MISMATCH/);
  });

  test('never overwrites existing dist or a previously sealed artifact', async (t) => {
    const f = await fixture(t);
    await api.sealServerBuild(f.artifact, f.context, f.serverRoot);
    const before = await fs.readFile(join(f.serverRoot, 'dist/src/main.js'));
    await assert.rejects(api.installServerBuild(f.artifact, f.context, f.serverRoot), /SERVER_DIST_ALREADY_PRESENT/);
    assert.deepEqual(await fs.readFile(join(f.serverRoot, 'dist/src/main.js')), before);
    await assert.rejects(api.sealServerBuild(f.artifact, f.context, f.serverRoot), /SERVER_ARTIFACT_DESTINATION_NOT_EMPTY/);
    await api.verifyServerBuild(f.artifact, f.context, false, f.serverRoot);
  });

  for (const type of ['file', 'directory']) test(`rejects extra artifact-root ${type}`, async (t) => {
    const f = await fixture(t);
    await api.sealServerBuild(f.artifact, f.context, f.serverRoot);
    if (type === 'directory') await fs.mkdir(join(f.artifact, 'extra')); else await fs.writeFile(join(f.artifact, 'extra.json'), '{}');
    await assert.rejects(api.verifyServerBuild(f.artifact, f.context, false, f.serverRoot), /INVALID_SERVER_ARTIFACT_DIRECTORY/);
  });

  for (const location of ['artifact', 'artifact/dist', 'artifact/dist/src', 'artifact/dist/src/main.js', `artifact/${MANIFEST}`, 'server/dist', 'server/node_modules/.prisma/client']) test(`rejects simulated directory/file symlink: ${location}`, async (t) => {
    const f = await fixture(t);
    await api.sealServerBuild(f.artifact, f.context, f.serverRoot);
    pretendLink(t, join(f.root, location));
    const task = location === 'server/dist' ? api.sealServerBuild(join(f.root, 'other-artifact'), f.context, f.serverRoot) : api.verifyServerBuild(f.artifact, f.context, false, f.serverRoot);
    await assert.rejects(task, /ARTIFACT|PRISMA|UNSAFE/);
  });

  test('checks file identity across lstat/fstat before reading', async (t) => {
    const f = await fixture(t);
    const original = fs.open.bind(fs);
    t.mock.method(fs, 'open', async (path, flags, mode) => {
      const handle = await original(path, flags, mode);
      if (resolve(String(path)) !== resolve(join(f.serverRoot, 'dist/src/main.js'))) return handle;
      const stat = handle.stat.bind(handle);
      handle.stat = async (options) => { const value = await stat(options); return Object.assign(Object.create(value), { ino: value.ino + 1n }); };
      return handle;
    });
    await assert.rejects(api.sealServerBuild(f.artifact, f.context, f.serverRoot), /ARTIFACT_FILE_CHANGED/);
  });

  test('preserves inode checks while exempting Windows device-number mismatch', async (t) => {
    const f = await fixture(t);
    const original = fs.open.bind(fs);
    t.mock.method(fs, 'open', async (path, flags, mode) => {
      const handle = await original(path, flags, mode);
      if (resolve(String(path)) !== resolve(join(f.serverRoot, 'dist/src/main.js'))) return handle;
      const stat = handle.stat.bind(handle);
      handle.stat = async (options) => { const value = await stat(options); return Object.assign(Object.create(value), { dev: value.dev + 1n }); };
      return handle;
    });
    if (process.platform === 'win32') await api.sealServerBuild(f.artifact, f.context, f.serverRoot);
    else await assert.rejects(api.sealServerBuild(f.artifact, f.context, f.serverRoot), /ARTIFACT_FILE_CHANGED/);
  });

  test('accepts exactly 32 MiB per emitted file, rejects one byte beyond', async (t) => {
    const f = await fixture(t);
    const path = join(f.serverRoot, 'dist/limit.js');
    await fs.writeFile(path, '');
    await fs.truncate(path, 32 * 1024 * 1024 + 1);
    await assert.rejects(api.sealServerBuild(f.artifact, f.context, f.serverRoot), /ARTIFACT_FILE_LIMIT/);
    await fs.truncate(path, 32 * 1024 * 1024);
    const sealed = await api.sealServerBuild(f.artifact, f.context, f.serverRoot);
    assert.equal(sealed.files.find((file) => file.path === 'dist/limit.js').bytes, 32 * 1024 * 1024);
  });

  test('caps manifest reads at its own 16 MiB limit', async (t) => {
    const f = await fixture(t);
    await api.sealServerBuild(f.artifact, f.context, f.serverRoot);
    await fs.truncate(join(f.artifact, MANIFEST), 16 * 1024 * 1024 + 1);
    await assert.rejects(api.verifyServerBuild(f.artifact, f.context, false, f.serverRoot), /ARTIFACT_FILE_LIMIT/);
  });

  test('caps total payload bytes at 128 MiB before copying', async (t) => {
    const f = await fixture(t);
    for (let index = 0; index < 4; index++) {
      const path = join(f.serverRoot, 'dist', `bulk-${index}.js`);
      await fs.writeFile(path, '');
      await fs.truncate(path, 32 * 1024 * 1024);
    }
    await assert.rejects(api.sealServerBuild(f.artifact, f.context, f.serverRoot), /SERVER_BUILD_ARTIFACT_LIMIT/);
    await assert.rejects(fs.lstat(f.artifact), { code: 'ENOENT' });
  });

  test('caps inventory at 5000 regular files before copying', async (t) => {
    const f = await fixture(t);
    const path = join(f.serverRoot, 'dist/many');
    await fs.mkdir(path);
    for (let start = 0; start < 5001; start += 100) await Promise.all(Array.from({ length: Math.min(100, 5001 - start) }, (_, offset) => fs.writeFile(join(path, `${start + offset}.js`), '')));
    await assert.rejects(api.sealServerBuild(f.artifact, f.context, f.serverRoot), /SERVER_BUILD_ARTIFACT_LIMIT/);
    await assert.rejects(fs.lstat(f.artifact), { code: 'ENOENT' });
  });

  test('rejects forged/duplicate file inventory and noninteger sizes', async (t) => {
    const f = await fixture(t);
    const original = await api.sealServerBuild(f.artifact, f.context, f.serverRoot);
    for (const change of [(m) => m.files.push(m.files[0]), (m) => { m.files[0].bytes = -1; }, (m) => { m.files[0].bytes = 0.5; }, (m) => { m.files[0].sha256 = 'not-a-hash'; }]) {
      const value = structuredClone(original);
      change(value);
      await saveJson(join(f.artifact, MANIFEST), value);
      await assert.rejects(api.verifyServerBuild(f.artifact, f.context, false, f.serverRoot), /INVALID_SERVER_BUILD_MANIFEST/);
    }
  });

  test('captures exact clean HEAD/tree, hashes, runtime and installed version data from an isolated fixture repo', async (t) => {
    const f = await sourceFixture(t);
    assert.deepEqual(await api.readServerBinding(f.serverRoot, { GITHUB_SHA: f.context.releaseSha, GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '1' }), f.context);
    await assert.rejects(api.readServerBinding(f.serverRoot, { GITHUB_SHA: 'f'.repeat(40) }), /CHECKOUT_SHA_MISMATCH/);
    for (const env of [{ GITHUB_RUN_ID: '0' }, { GITHUB_RUN_ATTEMPT: '0' }, { GITHUB_SHA: '' }, { GITHUB_ACTIONS: 'true' }]) await assert.rejects(api.readServerBinding(f.serverRoot, env), /INVALID_SERVER_BUILD_BINDING|CHECKOUT_SHA_MISMATCH/);
    await fs.writeFile(join(f.root, 'untracked-fixture'), 'dirty');
    await assert.rejects(api.readServerBinding(f.serverRoot, {}), /DIRTY_CI_SOURCE/);
    git(f.root, 'add', '--', 'untracked-fixture');
    await assert.rejects(api.readServerBinding(f.serverRoot, {}), /DIRTY_CI_SOURCE/);
  });

  test('local binding defaults and asynchronous environment restoration remain isolated', async (t) => {
    const f = await sourceFixture(t);
    const before = process.env.GITHUB_RUN_ID;
    await temporaryEnv({ GITHUB_SHA: undefined, GITHUB_RUN_ID: undefined, GITHUB_RUN_ATTEMPT: undefined, GITHUB_ACTIONS: undefined }, async () => {
      const value = await api.readServerBinding(f.serverRoot);
      assert.equal(value.runId, 'local');
      assert.equal(value.runAttempt, '1');
    });
    assert.equal(process.env.GITHUB_RUN_ID, before);
    await assert.rejects(temporaryEnv({ GITHUB_RUN_ID: '123' }, async () => { await Promise.resolve(); throw new Error('restore-fixture-env'); }), /restore-fixture-env/);
    assert.equal(process.env.GITHUB_RUN_ID, before);
  });

  test('rejects server/.env presence even when ignored, without opening or reading its contents', async (t) => {
    const f = await sourceFixture(t);
    const path = join(f.serverRoot, '.env');
    await fs.writeFile(path, 'INERT_FIXTURE_ONLY=true\n');
    const original = fs.open.bind(fs);
    t.mock.method(fs, 'open', async (requested, ...args) => {
      assert.notEqual(resolve(String(requested)), resolve(path), '.env contents must not be opened');
      return original(requested, ...args);
    });
    assert.equal(git(f.root, 'status', '--porcelain'), '');
    await assert.rejects(api.readServerBinding(f.serverRoot, {}), /SERVER_ENV_FILE_PRESENT/);
    await assert.rejects(api.sealServerBuild(f.artifact, f.context, f.serverRoot), /SERVER_ENV_FILE_PRESENT/);
  });

  test('CLI rejects invalid actions/arity before touching source and prints only a safe code', async () => {
    for (const args of [[], ['unknown', 'artifact'], ['seal-build'], ['verify-build', 'artifact', 'extra']]) await assert.rejects(api.main(args), /INVALID_SERVER_CI_ARGUMENTS/);
    const { spawnSync } = await import('node:child_process');
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('./server-ci-artifacts.mjs', import.meta.url)), 'unknown', 'artifact'], { encoding: 'utf8', timeout: 15000 });
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.equal(result.stderr, 'INVALID_SERVER_CI_ARGUMENTS\n');
  });
}
