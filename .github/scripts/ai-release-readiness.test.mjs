import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { CHECKS, MAX_AGE_MS, assessReadiness, createVitestFileReport, localPath, normalizeTap, normalizeTestJson, parseManifestJson, validateReleaseSha } from './ai-release-readiness.mjs';

const script = fileURLToPath(new URL('./ai-release-readiness.mjs', import.meta.url));
const START = '2026-11-09T12:00:00.000Z';
const END = '2026-11-09T12:05:00.000Z';
const SHA = 'a'.repeat(40);
const TREE = 'b'.repeat(40);
const HASH = 'c'.repeat(64);
const packageBindings = { server: { packageSha256: 'd'.repeat(64), lockSha256: 'e'.repeat(64) }, client: { packageSha256: '8'.repeat(64), lockSha256: '9'.repeat(64) } };
function fixture(source = 'local') {
  const common = { status: 'passed', exitCode: 0, reason: 'OK', startedAt: START, completedAt: END, evidenceSha256: HASH };
  const manifest = {
    formatVersion: 1, releaseSha: SHA, source, runId: source === 'ci' ? '12345' : null, runAttempt: source === 'ci' ? '1' : null,
    startedAt: START, completedAt: END, nodeVersion: 'v22.15.0',
    git: { headSha: SHA, treeSha: TREE, dirtyBefore: false, dirtyAfter: false }, networkIsolation: 'ISOLATED',
    policy: { killSwitch: true, egressDefaultDeny: true, credentialsForwarded: false, envFilesPresent: false },
    packages: ['server', 'client'].map((id) => ({ id, ...common, ...packageBindings[id] })),
    checks: CHECKS.map((check) => ({ id: check.id, ...common, results: check.kind === 'command' ? null : { total: 2, passed: 2, failed: 0, skipped: 0, todo: 0, cancelled: 0, suites: check.kind === 'json' ? check.suites.length : 0 }, requiredSuitesMatched: check.suites?.length ?? 0 })),
  };
  const context = { releaseSha: SHA, headSha: SHA, treeSha: TREE, dirty: false, packageBindings: structuredClone(packageBindings), now: Date.parse(END) + 1000, source, runId: manifest.runId, runAttempt: manifest.runAttempt, githubSha: source === 'ci' ? SHA : null };
  return { manifest, context };
}
function assess(change, source = 'local') {
  const { manifest, context } = fixture(source);
  change(manifest, context);
  return assessReadiness(manifest, context);
}
function blocked(change, source = 'local') {
  const report = assess(change, source);
  assert.equal(report.verification.level, 'BLOCKED');
  assert.equal(report.deploymentAuthorized, false);
  assert.equal(report.certification, 'NOT_CERTIFIED');
  assert.ok(report.verification.reasons.length > 0);
  assert.ok(Object.values(report.gates).every((gate) => gate.level === 'BLOCKED'));
  return report;
}

for (const source of ['local', 'ci']) test(`complete ${source} metadata verifies checks, never release gates`, () => {
  const { manifest, context } = fixture(source);
  const report = assessReadiness(manifest, context);
  assert.equal(report.verification.level, source === 'ci' ? 'VERIFIED_CI' : 'VERIFIED_LOCAL');
  assert.equal(report.checks.length, CHECKS.length);
  assert.equal(report.packages.length, 2);
  assert.equal(report.manifestSha256.length, 64);
  assert.equal(report.deploymentAuthorized, false);
  assert.equal(report.certification, 'NOT_CERTIFIED');
  assert.deepEqual(Object.keys(report.gates), ['G0', 'G1', 'G2', 'G3', 'G4a', 'G4b']);
  assert.ok(Object.values(report.gates).every((gate) => gate.level === 'BLOCKED' && gate.reasons.length > 0));
});
test('local replay of a CI declaration cannot grant VERIFIED_CI', () => {
  const { manifest, context } = fixture('ci'); context.source = 'local';
  assert.equal(assessReadiness(manifest, context).verification.level, 'VERIFIED_LOCAL');
});

for (const [name, change] of [
  ['missing manifest', (_m, c) => { c.releaseSha = null; }],
  ['short SHA', (m) => { m.releaseSha = SHA.slice(0, 7); }],
  ['uppercase SHA', (m) => { m.releaseSha = SHA.toUpperCase(); }],
  ['different release', (m) => { m.releaseSha = TREE; }],
  ['different HEAD', (_m, c) => { c.headSha = TREE; }],
  ['different Git tree', (_m, c) => { c.treeSha = SHA; }],
  ['dirty before', (m) => { m.git.dirtyBefore = true; }],
  ['dirty after', (m) => { m.git.dirtyAfter = true; }],
  ['dirty verifier tree', (_m, c) => { c.dirty = true; }],
  ['missing dirty flag', (m) => { delete m.git.dirtyBefore; }],
  ['string false dirty flag', (m) => { m.git.dirtyBefore = 'false'; }],
  ['stale manifest', (_m, c) => { c.now = Date.parse(START) + MAX_AGE_MS + 1; }],
  ['future manifest', (_m, c) => { c.now = Date.parse(END) - 1; }],
  ['reversed timestamps', (m) => { m.startedAt = '2026-11-09T12:06:00.000Z'; }],
  ['noncanonical timestamp', (m) => { m.startedAt = '2026-11-09T12:00:00Z'; }],
  ['invalid calendar timestamp', (m) => { m.startedAt = '2026-02-30T12:00:00.000Z'; }],
  ['overlong run', (m) => { m.startedAt = '2026-11-09T10:00:00.000Z'; }],
  ['result before run', (m) => { m.checks[0].startedAt = '2026-11-09T11:59:59.000Z'; }],
  ['result after run', (m) => { m.checks[0].completedAt = '2026-11-09T12:05:01.000Z'; }],
  ['missing checks', (m) => { delete m.checks; }],
  ['empty checks', (m) => { m.checks = []; }],
  ['omitted check', (m) => { m.checks.pop(); }],
  ['duplicate check', (m) => { m.checks[1] = structuredClone(m.checks[0]); }],
  ['unknown check', (m) => { m.checks[0].id = 'all-green'; }],
  ['missing check result', (m) => { m.checks[0].results = null; }],
  ['zero tests', (m) => { m.checks[0].results.total = 0; m.checks[0].results.passed = 0; }],
  ['inconsistent counts', (m) => { m.checks[0].results.total++; }],
  ['negative count', (m) => { m.checks[0].results.failed = -1; }],
  ['string counts', (m) => { m.checks[0].results.passed = '2'; }],
  ['missing count', (m) => { delete m.checks[0].results.cancelled; }],
  ['failed assertion hidden under pass', (m) => { m.checks[0].results.passed--; m.checks[0].results.failed++; }],
  ['skipped assertion hidden under pass', (m) => { m.checks[0].results.passed--; m.checks[0].results.skipped++; }],
  ['todo hidden under pass', (m) => { m.checks[0].results.passed--; m.checks[0].results.todo++; }],
  ['cancelled hidden under pass', (m) => { m.checks[0].results.passed--; m.checks[0].results.cancelled++; }],
  ['failed command hidden under pass', (m) => { m.checks[0].exitCode = 1; }],
  ['missing exit code', (m) => { m.checks[0].exitCode = null; }],
  ['counterfeit pass reason', (m) => { m.checks[0].reason = 'NOT_RUN'; }],
  ['missing evidence hash', (m) => { m.checks[0].evidenceSha256 = null; }],
  ['invalid evidence hash', (m) => { m.checks[0].evidenceSha256 = '../secret'; }],
  ['missing required DTO/SSE suites', (m) => { m.checks.find((c) => c.id === 'server-ai-jest').requiredSuitesMatched--; }],
  ['missing focused client suite', (m) => { m.checks.find((c) => c.id === 'client-ai-vitest').requiredSuitesMatched--; }],
  ['missing packages', (m) => { m.packages = []; }],
  ['duplicate package', (m) => { m.packages[1] = structuredClone(m.packages[0]); }],
  ['unknown package', (m) => { m.packages[0].id = 'private-path'; }],
  ['failed install hidden under pass', (m) => { m.packages[0].exitCode = 1; }],
  ['missing package digest', (m) => { m.packages[0].packageSha256 = null; }],
  ['changed lock file', (_m, c) => { c.packageBindings.server.lockSha256 = HASH; }],
  ['unverified network', (m) => { m.networkIsolation = 'UNVERIFIED'; }],
  ['kill switch off', (m) => { m.policy.killSwitch = false; }],
  ['egress enabled', (m) => { m.policy.egressDefaultDeny = false; }],
  ['credentials forwarded', (m) => { m.policy.credentialsForwarded = true; }],
  ['real env files', (m) => { m.policy.envFilesPresent = true; }],
  ['unsupported Node', (m) => { m.nodeVersion = 'v18.20.0'; }],
  ['counterfeit certification', (m) => { m.certified = true; }],
  ['counterfeit G4 approval', (m) => { m.gates = { G4a: 'approved', G4b: 'approved' }; }],
  ['injected command', (m) => { m.checks[0].command = 'curl https://invalid.example'; }],
  ['malicious publisher data', (m) => { m.prompt = 'sk-secret-sentinel D:/private/customer-data'; }],
]) test(`${name} cannot pass`, () => { blocked(change); });

test('absent and primitive manifests cannot pass', () => {
  const { context } = fixture();
  for (const value of [null, undefined, true, [], 'passed']) assert.equal(assessReadiness(value, context).verification.level, 'BLOCKED');
});
for (const id of CHECKS.map((check) => check.id)) test(`${id}: failed or skipped never passes`, () => {
  for (const status of ['failed', 'skipped']) {
    const report = blocked((m) => {
      const entry = m.checks.find((check) => check.id === id);
      Object.assign(entry, { status, exitCode: status === 'failed' ? 1 : null, reason: status === 'failed' ? 'COMMAND_FAILED' : 'NOT_RUN', evidenceSha256: status === 'failed' ? HASH : null, results: null, requiredSuitesMatched: 0 });
    });
    assert.ok(report.verification.reasons.includes(status === 'failed' ? 'CHECK_FAILED' : 'CHECK_SKIPPED'));
    assert.equal(report.checks.find((check) => check.id === id).status, status);
  }
});
for (const id of ['server', 'client']) test(`${id}: failed or skipped package blocks`, () => {
  for (const status of ['failed', 'skipped']) blocked((m) => {
    Object.assign(m.packages.find((pkg) => pkg.id === id), { status, reason: 'PACKAGE_BLOCKED', exitCode: status === 'failed' ? 1 : null, evidenceSha256: status === 'failed' ? HASH : null });
  });
});
for (const [name, change] of [
  ['CI source spoof', (m) => { m.source = 'local'; m.runId = null; m.runAttempt = null; }],
  ['CI SHA spoof', (_m, c) => { c.githubSha = TREE; }],
  ['different run id', (_m, c) => { c.runId = '999'; }],
  ['different run attempt', (_m, c) => { c.runAttempt = '2'; }],
  ['missing run id', (m) => { m.runId = null; }],
]) test(`${name} cannot pass`, () => { blocked(change, 'ci'); });

for (const input of ['', 'main', 'HEAD', SHA.slice(0, 8), SHA.toUpperCase(), `${SHA};curl`, '0'.repeat(39)]) test(`invalid release SHA ${input.length} is refused`, () => {
  assert.throws(() => validateReleaseSha(input));
});
test('only exact lowercase 40-character SHA is accepted', () => { assert.equal(validateReleaseSha(SHA), SHA); });
for (const input of [
  '{"status":"failed","status":"passed"}',
  '{"releaseSha":"bad","release\\u0053ha":"good"}',
  '{"nested":{"__proto__":{"approved":true}}}',
  '{"constructor":{}}', '{"prototype":{}}', '{"value":1e999}', '{"status":NaN}', '{"x":1,}', '{} trailing',
  '['.repeat(14) + '0' + ']'.repeat(14), '{"data":"' + 'x'.repeat(257) + '"}', ' '.repeat(128 * 1024 + 1),
]) test('malicious or bounded JSON input is refused', () => { assert.throws(() => parseManifestJson(input)); });
test('strict JSON parser accepts the exact metadata schema', () => {
  const { manifest, context } = fixture();
  assert.equal(assessReadiness(parseManifestJson(JSON.stringify(manifest)), context).verification.level, 'VERIFIED_LOCAL');
});
test('rejected manifest never republishes secrets, paths or arbitrary keys', () => {
  const report = blocked((m) => { m.checks[0].output = 'sk-secret-sentinel C:/private/customer-data rows'; });
  const text = JSON.stringify(report);
  assert.ok(!/secret-sentinel|private|customer-data|rows/.test(text));
  assert.equal(report.manifestSha256, null);
  assert.deepEqual(report.checks, []);
});

const tap = 'TAP version 13\n1..2\nok 1 - first\nok 2 - second\n# tests 2\n# suites 0\n# pass 2\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n';
test('Node TAP normalizer retains exact counts only', () => {
  assert.deepEqual(normalizeTap(tap).results, { total: 2, suites: 0, passed: 2, failed: 0, cancelled: 0, skipped: 0, todo: 0 });
  assert.equal(normalizeTap(tap).allPassed, true);
  assert.throws(() => normalizeTap(tap.replace('ok 1 - first', 'not ok 1 - first')), /CONTRADICTORY_TAP_COUNTS/);
  assert.throws(() => normalizeTap(tap.replace('ok 1 - first', 'ok 1 - first # SKIP')), /CONTRADICTORY_TAP_COUNTS/);
});
for (const input of ['', tap.replace('# tests 2', '# tests 0'), tap.replace('# pass 2', '# pass 3'), tap.replace('# todo 0\n', ''), `${tap}# pass 2\n`]) test('missing or contradictory TAP cannot be treated as success', () => { assert.throws(() => normalizeTap(input)); });
function jsonReporter() {
  return { success: true, numTotalTests: 2, numPassedTests: 2, numFailedTests: 0, numPendingTests: 0, numTodoTests: 0, numTotalTestSuites: 2, numPassedTestSuites: 2, numFailedTestSuites: 0, numPendingTestSuites: 0, testResults: [
    { name: '/private/repo/src/first.spec.ts', status: 'passed', assertionResults: [{ status: 'passed', title: 'secret test title' }] },
    { name: 'C:\\private\\repo\\src\\second.spec.ts', status: 'passed', assertionResults: [{ status: 'passed', title: 'customer rows' }] },
  ] };
}
test('Jest/Vitest report normalizes counts and matched suites without paths or names', () => {
  const result = normalizeTestJson(jsonReporter(), ['src/first.spec.ts', 'src/second.spec.ts']);
  assert.equal(result.allPassed, true); assert.equal(result.requiredSuitesMatched, 2);
  assert.ok(!/private|secret|customer/.test(JSON.stringify(result)));
});
for (const status of ['failed', 'pending', 'skipped', 'todo']) test(`reporter ${status} cannot claim all passed`, () => {
  const report = jsonReporter(); report.testResults[0].assertionResults[0].status = status; report.numPassedTests--;
  report.numFailedTests = status === 'failed' ? 1 : 0; report.numPendingTests = ['pending', 'skipped'].includes(status) ? 1 : 0; report.numTodoTests = status === 'todo' ? 1 : 0;
  if (status === 'failed') {
    report.testResults[0].status = 'failed'; report.numPassedTestSuites--; report.numFailedTestSuites++;
  }
  assert.equal(normalizeTestJson(report).allPassed, false);
});
for (const [name, change] of [
  ['missing report', () => null], ['empty report', () => ({})], ['no tests', (r) => { r.testResults = []; return r; }],
  ['duplicate suites', (r) => { r.testResults[1] = structuredClone(r.testResults[0]); return r; }],
  ['contradictory total', (r) => { r.numTotalTests++; return r; }],
  ['unknown assertion status', (r) => { r.testResults[0].assertionResults[0].status = 'certified'; return r; }],
]) test(`${name} JSON reporter is rejected`, () => { assert.throws(() => normalizeTestJson(change(jsonReporter()))); });
test('a missing required suite is explicit, never silently equivalent', () => {
  assert.equal(normalizeTestJson(jsonReporter(), ['src/absent.spec.ts']).requiredSuitesMatched, 0);
});

test('JSON suite accounting exactly matches the file inventory', () => {
  const report = jsonReporter();
  assert.equal(normalizeTestJson(report, [], ['src/first.spec.ts', 'src/second.spec.ts']).allPassed, true);
});
for (const [name, change] of [
  ['zero declared suites with passing file inventory', (r) => { r.numTotalTestSuites = 0; r.numPassedTestSuites = 0; }],
  ['too many declared suites', (r) => { r.numTotalTestSuites++; r.numPassedTestSuites++; }],
  ['suite categories do not add up', (r) => { r.numPassedTestSuites--; }],
  ['wrong failed suite category', (r) => { r.numPassedTestSuites--; r.numFailedTestSuites++; }],
  ['wrong pending suite category', (r) => { r.numPassedTestSuites--; r.numPendingTestSuites++; }],
  ['failed assertion in passed suite', (r) => { r.testResults[0].assertionResults[0].status = 'failed'; r.numPassedTests--; r.numFailedTests++; }],
  ['declared skips absent from assertions', (r) => { r.numPendingTests++; }],
  ['declared todo absent from assertions', (r) => { r.numTodoTests++; }],
  ['runtime suite error on passed inventory', (r) => { r.numRuntimeErrorTestSuites = 1; }],
]) test(`contradictory JSON: ${name} is refused`, () => {
  const report = jsonReporter(); change(report);
  assert.throws(() => normalizeTestJson(report));
});
for (const expected of [['src/first.spec.ts'], ['src/first.spec.ts', 'src/second.spec.ts', 'src/omitted.spec.ts'], ['src/first.spec.ts', 'src/first.spec.ts'], []]) test('omitted, unexpected or duplicate expected-file inventory is refused', () => {
  assert.throws(() => normalizeTestJson(jsonReporter(), [], expected));
});
test('Jest focused file with pending assertion is valid but never passed', () => {
  const report = jsonReporter();
  report.testResults[0].status = 'focused'; report.testResults[0].assertionResults[0].status = 'pending';
  report.numPassedTests--; report.numPendingTests++;
  assert.equal(normalizeTestJson(report).allPassed, false);
});
for (const [name, input] of [
  ['summary only', tap.replace(/^TAP version 13\n|^1\.\.2\n|^ok .+\n/gm, '')],
  ['header and summary only', tap.replace(/^1\.\.2\n|^ok .+\n/gm, '')],
  ['missing plan', tap.replace('1..2\n', '')],
  ['wrong plan length', tap.replace('1..2', '1..3')],
  ['duplicate plan', tap + '1..2\n'],
  ['plan starts at two', tap.replace('1..2', '2..3')],
  ['malformed plan', tap.replace('1..2', '1...2')],
  ['zero plan', tap.replace('1..2', '1..0')],
  ['missing test point', tap.replace('ok 2 - second\n', '')],
  ['duplicate point', tap.replace('ok 2 - second', 'ok 1 - second')],
  ['out-of-order point', tap.replace('ok 1 - first', 'ok 2 - first')],
  ['malformed point', tap.replace('ok 1 - first', 'ok zero - first')],
  ['point after trailing plan', tap.replace('1..2\n', '') + '1..2\nok 3 - extra\n'],
  ['orphan nested points', tap.replace('ok 1 - first\n', '    ok 1 - nested\n    1..1\n')],
  ['nested missing plan', tap.replace('ok 1 - first\n', '    ok 1 - nested\nok 1 - first\n')],
  ['nested wrong plan', tap.replace('ok 1 - first\n', '    ok 1 - nested\n    1..2\nok 1 - first\n')],
  ['invalid indentation', tap.replace('ok 1 - first', '  ok 1 - first')],
  ['bail out', tap + 'Bail out! stopped\n'],
  ['duplicate summary', tap + '# tests 2\n'],
  ['contradictory suite total', tap.replace('# suites 0', '# suites 1')],
  ['malformed summary', tap.replace('# tests 2', '# tests zero')],
  ['unterminated diagnostic', tap.replace('ok 1 - first\n', 'ok 1 - first\n  ---\n    type: test\n')],
]) test(`invalid TAP: ${name} is refused`, () => { assert.throws(() => normalizeTap(input)); });
test('TAP trailing plan and CRLF are supported', () => {
  assert.equal(normalizeTap(tap.replace('1..2\n', '') + '1..2\n').allPassed, true);
  assert.equal(normalizeTap(tap.replace(/\n/g, '\r\n')).allPassed, true);
});
const nestedTap = 'TAP version 13\n# Subtest: suite\n    # Subtest: nested\n    ok 1 - nested\n      ---\n        type: test\n      ...\n    1..1\nok 1 - suite\n  ---\n    type: suite\n  ...\n1..1\n# tests 1\n# suites 1\n# pass 1\n# fail 0\n# skipped 0\n# todo 0\n# cancelled 0\n';
test('nested Node TAP counts test and describe suite separately', () => {
  const parsed = normalizeTap(nestedTap);
  assert.equal(parsed.allPassed, true); assert.equal(parsed.results.total, 1); assert.equal(parsed.results.suites, 1);
});
test('nested skipped assertion and failed describe suite never pass', () => {
  const parsed = normalizeTap(nestedTap.replace('ok 1 - nested', 'ok 1 - nested # SKIP').replace('# pass 1', '# pass 0').replace('# skipped 0', '# skipped 1'));
  assert.equal(parsed.allPassed, false);
  assert.equal(normalizeTap(nestedTap.replace('\nok 1 - suite', '\nnot ok 1 - suite')).allPassed, false);
});
function vitestModules(status = 'pass') {
  const assertion = { type: 'test', mode: status === 'skip' || status === 'todo' ? status : 'run', result: status === 'skip' || status === 'todo' ? undefined : { state: status } };
  return [{ task: { type: 'suite', filepath: '/private/repo/src/first.test.ts', mode: 'run', result: { state: status === 'fail' ? 'fail' : 'pass' }, tasks: [
    { type: 'suite', mode: 'run', result: { state: status === 'fail' ? 'fail' : 'pass' }, tasks: [assertion] },
  ] } }];
}
test('Vitest adapter reports exact files, not nested describe count; no payload leakage', () => {
  const report = createVitestFileReport(vitestModules());
  assert.equal(report.numTotalTestSuites, 1); assert.equal(report.numPassedTestSuites, 1);
  assert.equal(normalizeTestJson(report, [], ['src/first.test.ts']).allPassed, true);
  assert.ok(!/private|first\.test/.test(JSON.stringify(normalizeTestJson(report))));
});
for (const status of ['fail', 'skip', 'todo', 'run', 'queued']) test(`Vitest adapter ${status} cannot pass`, () => {
  assert.equal(normalizeTestJson(createVitestFileReport(vitestModules(status))).allPassed, false);
});
test('Vitest unhandled error cannot produce a passing report', () => {
  assert.equal(normalizeTestJson(createVitestFileReport(vitestModules(), [new Error('private payload')])).allPassed, false);
});
test('Vitest adapter refuses zero tests, duplicate modules and unknown task states', () => {
  assert.throws(() => createVitestFileReport([]));
  const files = vitestModules(); assert.throws(() => createVitestFileReport([...files, ...files]));
  files[0].task.tasks = []; assert.throws(() => createVitestFileReport(files));
  assert.throws(() => createVitestFileReport(vitestModules('certified')));
});
test('full package test:ci commands have no file, test-name or path filters', () => {
  const server = CHECKS.find((check) => check.id === 'server-ai-jest');
  const client = CHECKS.find((check) => check.id === 'client-ai-vitest');
  assert.deepEqual(server.args, ['run', 'test:ci', '--', '--json', '--coverage=false']);
  assert.deepEqual(client.args, ['run', 'test:ci', '--', '--reporter=../.github/scripts/ai-release-readiness.mjs']);
  for (const check of [server, client]) assert.ok(check.args.every((arg) => !/testPath|testName|passWithNoTests|\.test\.|\.spec\./.test(arg)));
});

for (const path of ['https://private.example/manifest.json', '//server/share/manifest.json', '\\\\server\\share\\manifest.json', '../private.json', 'safe/../private.json', 'file:///private.json', 'nul.json', 'bad\nname.json', 'manifest.txt']) test('network, traversal, device or unsafe manifest path refused', () => { assert.throws(() => localPath(path, true)); });
test('plain local JSON path accepted without echoing it', () => { assert.ok(localPath(join(tmpdir(), 'safe-manifest.json'), true)); });

test('CLI invalid flags and missing artifacts fail with redacted metadata only', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'ai-a16-tests-'));
  try {
    const malicious = join(folder, 'malicious.json');
    await writeFile(malicious, '{"status":"failed","status":"passed","key":"sk-secret-sentinel"}');
    for (const args of [[], ['run', '--release-sha', 'main'], ['check', '--release-sha', SHA, '--manifest', join(folder, 'private-missing.json')], ['check', '--release-sha', SHA, '--manifest', malicious], ['check', '--release-sha', SHA, '--manifest', malicious, '--approve-G4a', 'true']]) {
      const result = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', timeout: 10000 });
      assert.equal(result.status, 2);
      const output = `${result.stdout}${result.stderr}`;
      assert.ok(!output.includes(folder) && !/private-missing|secret-sentinel|approve-G4a/.test(output));
      assert.equal(JSON.parse(result.stderr).verification.level, 'BLOCKED');
    }
  } finally { await rm(folder, { recursive: true, force: true }); }
});
test('blocked collector lists all skips and publishes only redacted failure metadata', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'ai-a16-blocked-test-'));
  try {
    const result = spawnSync(process.execPath, [script, 'run', '--release-sha', SHA, '--out-dir', folder], { encoding: 'utf8', timeout: 10000 });
    assert.equal(result.status, 1);
    const report = JSON.parse(result.stdout);
    assert.equal(report.verification.level, 'BLOCKED');
    assert.equal(report.manifestSha256, null);
    assert.equal(report.checks.length, CHECKS.length);
    assert.ok(report.checks.every((check) => check.status === 'skipped' && check.exitCode === null));
    assert.ok(report.packages.every((pkg) => pkg.status === 'skipped'));
    const published = await readFile(join(folder, 'readiness.json'), 'utf8');
    assert.deepEqual(JSON.parse(published), report);
    assert.ok(!published.includes(folder) && !/Data Explorer|Admin|postgres:|sk-secret/.test(published));
    await assert.rejects(readFile(join(folder, 'manifest.json')));
  } finally { await rm(folder, { recursive: true, force: true }); }
});
test('workflow enables only bounded loopback inside its fail-closed child namespace', async () => {
  const workflow = await readFile(new URL('../workflows/ai-hardening.yml', import.meta.url), 'utf8');
  const child = /unshare --user --map-root-user --net sh -eu -c '([\s\S]*?)' ai-a16/.exec(workflow)?.[1];
  assert.ok(child);
  assert.match(child, /timeout 5s ip link set dev lo up/);
  assert.ok(child.indexOf('ip link set dev lo up') < child.indexOf('exec node'));
  assert.equal((workflow.match(/ip link set/g) ?? []).length, 1);
  assert.ok(!/eth\d|enp\w|--net=host|\|\|\s*true/.test(child));
  assert.match(child, /--release-sha "\$1" --out-dir "\$2"/);
});
test('workflow has scoped verification triggers and metadata-only artifact publication', async () => {
  const workflow = await readFile(new URL('../workflows/ai-hardening.yml', import.meta.url), 'utf8');
  assert.match(workflow, /pull_request:/); assert.match(workflow, /push:/); assert.match(workflow, /branches: \[main\]/);
  assert.match(workflow, /persist-credentials: false/); assert.match(workflow, /contents: read/);
  assert.match(workflow, /unshare --user --map-root-user --net/);
  assert.match(workflow, /--ignore-scripts/); assert.match(workflow, /AI_KILL_SWITCH: 'true'/);
  assert.match(workflow, /AI_EGRESS_POLICY_JSON: '\{"enabled":false\}'/);
  assert.match(workflow, /ai-hardening-\$\{\{ github\.sha \}\}/);
  assert.match(workflow, /readiness\.json/); assert.match(workflow, /manifest\.json/);
  assert.ok(!/secrets\.|pull_request_target|workflow_run:|schedule:|id-token:\s*write|packages:\s*write|environment:\s*production|deploy-render|migrate deploy|playwright install/.test(workflow));
  const uploads = workflow.split(/- name: Upload /).slice(1).join('\n');
  assert.ok(!/path:\s*\||coverage\/|\.log\b|test-results\/|\*\.json/.test(uploads));
  assert.match(workflow, /AI_A16_SERVER_SETUP:/);
  assert.match(workflow, /AI_A16_CLIENT_SETUP:/);
});
