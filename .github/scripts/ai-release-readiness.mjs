import { createHash } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { lstat, mkdir, mkdtemp, open, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { networkInterfaces, tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const FORMAT_VERSION = 1;
export const MAX_AGE_MS = 6 * 60 * 60 * 1000;
const MAX_RUN_MS = 60 * 60 * 1000;
const MAX_JSON_BYTES = 128 * 1024;
const MAX_REPORT_BYTES = 8 * 1024 * 1024;
const SHA = /^[a-f0-9]{40}$/;
const HASH = /^[a-f0-9]{64}$/;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const REASONS = new Set(['OK', 'NOT_RUN', 'PREFLIGHT_BLOCKED', 'PACKAGE_BLOCKED', 'COMMAND_FAILED', 'COMMAND_START_FAILED', 'TIMED_OUT', 'OUTPUT_LIMIT', 'INVALID_REPORT', 'TEST_FAILURE_OR_SKIP']);
const STATUSES = new Set(['passed', 'failed', 'skipped']);
// Required files remain coverage minima, never runner filters. Both test:ci
// commands execute their complete configured package suite.
const CLIENT_SUITES = Object.freeze([
  'src/core/services/AiService.test.ts',
  'src/core/services/AiChatService.test.ts',
  'src/core/services/aiPreferences.test.ts',
  'src/core/services/aiAccountPolicy.test.ts',
  'src/core/services/aiQueryFix.test.ts',
  'src/core/services/store/slices/aiChatSlice.test.ts',
  'src/presentation/hooks/aiChatReplay.test.ts',
  'src/presentation/hooks/useAiChat.test.tsx',
  'src/presentation/components/code-editor/useAiGhostText.test.tsx',
  'src/presentation/components/Dialogs/DestructiveQueryDialog.ai-policy.test.tsx',
  'src/presentation/modules/Layout/AppShell.ai-actions.test.tsx',
  'src/presentation/modules/Layout/NoSqlShell.ai-actions.test.tsx',
  'src/presentation/modules/Layout/ProfileDialog/components/AiConfigTab.test.tsx',
  'src/presentation/modules/Query/AiAssistant.test.tsx',
  'src/presentation/modules/Query/AiMessageBubble.test.tsx',
  'src/presentation/modules/Query/QueryEditor.ai-policy.test.tsx',
  'src/presentation/modules/Query/components/AiQueryBox.test.tsx',
  'src/presentation/modules/Query/aiProviderStatus.test.ts',
  'src/presentation/modules/NoSqlExplorer/components/NoSqlAiQueryBox.test.tsx',
]);
const SERVER_SUITES = Object.freeze([
  'src/app.controller.spec.ts',
  'src/ai/ai-http-lifecycle.spec.ts',
  'src/ai/ai-request-lifecycle.spec.ts',
  'src/ai/dto/ai-chat.dto.spec.ts',
  'src/ai/dto/generate-sql.dto.spec.ts',
  'src/ai/ai-account-policy.service.spec.ts',
  'src/ai/ai-egress-policy.service.spec.ts',
  'src/ai/ai-provider-connection.service.spec.ts',
  'src/ai/ai.provider-runner.service.spec.ts',
  'src/ai/ai.chat.service.spec.ts',
  'src/ai/ai.circuit-breaker.service.spec.ts',
]);

// Fixed commands only: manifests cannot supply commands, test filters or paths.
export const CHECKS = Object.freeze([
  { id: 'readiness-node', package: null, kind: 'tap', args: ['--test', '--test-reporter=tap', '.github/scripts/ai-release-readiness.test.mjs'] },
  { id: 'offline-evaluator', package: null, kind: 'tap', args: ['--test', '--test-reporter=tap', 'server/scripts/ai-eval/evaluator.test.mjs'] },
  { id: 'server-prisma-generate', package: 'server', kind: 'command', args: ['run', 'prisma:generate'] },
  { id: 'server-typecheck', package: 'server', kind: 'command', args: ['run', 'typecheck'] },
  { id: 'server-lint', package: 'server', kind: 'command', args: ['run', 'lint'] },
  { id: 'server-ai-jest', package: 'server', kind: 'json', suites: SERVER_SUITES, args: ['run', 'test:ci', '--', '--json', '--coverage=false'] },
  { id: 'client-app-typecheck', package: 'client', kind: 'command', args: ['exec', '--offline', '--', 'tsc', '--project', 'tsconfig.app.json', '--noEmit'] },
  { id: 'client-tools-typecheck', package: 'client', kind: 'command', args: ['exec', '--offline', '--', 'tsc', '--project', 'tsconfig.node.json', '--noEmit'] },
  { id: 'client-browser-typecheck', package: 'client', kind: 'command', args: ['run', 'typecheck:browser'] },
  { id: 'client-lint', package: 'client', kind: 'command', args: ['run', 'lint'] },
  { id: 'client-ai-vitest', package: 'client', kind: 'json', suites: CLIENT_SUITES, args: ['run', 'test:ci', '--', '--reporter=../.github/scripts/ai-release-readiness.mjs'] },
].map((check) => Object.freeze({ ...check, args: Object.freeze(check.args) })));

export class ReadinessError extends Error {
  constructor(code) { super(code); this.name = 'ReadinessError'; this.code = code; }
}
function requireValue(condition, code) { if (!condition) throw new ReadinessError(code); }
function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype; }
function fields(value, keys) {
  requireValue(object(value) && keys.every((key) => Object.hasOwn(value, key)) && Object.keys(value).every((key) => keys.includes(key)), 'INVALID_FIELDS');
}
function integer(value) { return Number.isSafeInteger(value) && value >= 0 && value <= 10000000; }
function hash(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
export function validateReleaseSha(value) { requireValue(typeof value === 'string' && SHA.test(value), 'EXACT_SHA_REQUIRED'); return value; }
function timestamp(value) {
  requireValue(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value, 'INVALID_TIMESTAMP');
  return Date.parse(value);
}

// Duplicate keys (including escaped aliases) cannot overwrite a failed result.
function strictJson(input, limit, stringLimit, depthLimit) {
  requireValue(typeof input === 'string' && Buffer.byteLength(input) <= limit, 'JSON_LIMIT');
  let at = 0;
  let nodes = 0;
  function space() { while (/[\t\r\n ]/.test(input[at] ?? '') && at < input.length) at++; }
  function string() {
    const start = at++;
    let closed = false;
    while (at < input.length) {
      const char = input[at++];
      if (char === '\\') { at++; continue; }
      if (char === '"') { closed = true; break; }
    }
    requireValue(closed, 'INVALID_JSON');
    let value;
    try { value = JSON.parse(input.slice(start, at)); } catch { throw new ReadinessError('INVALID_JSON'); }
    requireValue(value.length <= stringLimit, 'JSON_LIMIT');
    return value;
  }
  function visit(depth) {
    requireValue(depth <= depthLimit && ++nodes <= 250000, 'JSON_LIMIT');
    space();
    const char = input[at];
    if (char === '{' || char === '[') {
      const end = char === '{' ? '}' : ']';
      const keys = new Set();
      at++; space();
      if (input[at] === end) { at++; return; }
      while (at < input.length) {
        if (char === '{') {
          requireValue(input[at] === '"', 'INVALID_JSON');
          const key = string();
          requireValue(!['__proto__', 'prototype', 'constructor'].includes(key), 'FORBIDDEN_KEY');
          requireValue(!keys.has(key), 'DUPLICATE_KEY'); keys.add(key);
          space(); requireValue(input[at++] === ':', 'INVALID_JSON');
        }
        visit(depth + 1); space();
        if (input[at] === end) { at++; return; }
        requireValue(input[at++] === ',', 'INVALID_JSON'); space();
      }
      throw new ReadinessError('INVALID_JSON');
    }
    if (char === '"') { string(); return; }
    for (const literal of ['true', 'false', 'null']) {
      if (input.startsWith(literal, at)) { at += literal.length; return; }
    }
    const number = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(input.slice(at));
    requireValue(number !== null && Number.isFinite(Number(number[0])), 'INVALID_JSON'); at += number[0].length;
  }
  visit(0); space(); requireValue(at === input.length, 'INVALID_JSON');
  try { return JSON.parse(input); } catch { throw new ReadinessError('INVALID_JSON'); }
}
export function parseManifestJson(input) { return strictJson(input, MAX_JSON_BYTES, 256, 12); }

export function normalizeTap(input) {
  requireValue(typeof input === 'string' && Buffer.byteLength(input) <= MAX_REPORT_BYTES, 'INVALID_REPORT');
  const lines = input.replace(/\r\n/g, '\n').split('\n');
  requireValue(lines.shift() === 'TAP version 13', 'INVALID_TAP_HEADER');
  const frames = [{ indent: 0, points: [], plan: null, child: null }];
  const stack = [frames[0]];
  const summary = {};
  const labels = { tests: 'total', pass: 'passed', fail: 'failed', skipped: 'skipped', todo: 'todo', cancelled: 'cancelled', suites: 'suites' };
  let diagnostic = null;
  let lastPoint = null;
  let lastPointIndent = null;
  function finish(frame) {
    requireValue(frame.plan !== null && frame.plan.count === frame.points.length && frame.points.length > 0 && frame.child === null, 'INVALID_TAP_PLAN');
  }
  function frameAt(indent) {
    requireValue(indent % 4 === 0, 'INVALID_TAP_INDENT');
    while (stack.at(-1).indent > indent) { finish(stack.pop()); }
    if (stack.at(-1).indent < indent) {
      const parent = stack.at(-1);
      requireValue(indent === parent.indent + 4 && parent.child === null && !(parent.plan?.trailing), 'INVALID_TAP_NESTING');
      const child = { indent, points: [], plan: null, child: null };
      parent.child = child; stack.push(child); frames.push(child);
    }
    requireValue(stack.at(-1).indent === indent, 'INVALID_TAP_INDENT');
    return stack.at(-1);
  }
  for (const line of lines) {
    if (diagnostic !== null) {
      if (line === `${' '.repeat(diagnostic.indent)}...`) { diagnostic = null; continue; }
      requireValue(line.trim() === '' || line.startsWith(' '.repeat(diagnostic.indent + 2)), 'INVALID_TAP_DIAGNOSTIC');
      const kind = /^\s*type: ['"]?(test|suite)['"]?$/.exec(line);
      if (kind) { requireValue(!diagnostic.point.typeSeen, 'INVALID_TAP_DIAGNOSTIC'); diagnostic.point.type = kind[1]; diagnostic.point.typeSeen = true; }
      if (/^\s*failureType: ['"]?cancelledByParent['"]?$/.test(line)) diagnostic.point.status = 'cancelled';
      continue;
    }
    if (line.trim() === '') continue;
    requireValue(!line.includes('\t'), 'INVALID_TAP_INDENT');
    const yaml = /^( *)---$/.exec(line);
    if (yaml) {
      requireValue(lastPoint !== null && !lastPoint.diagnosticSeen && yaml[1].length === lastPointIndent + 2, 'INVALID_TAP_DIAGNOSTIC');
      lastPoint.diagnosticSeen = true; diagnostic = { indent: yaml[1].length, point: lastPoint }; continue;
    }
    const comment = /^( *)# (.*)$/.exec(line);
    if (comment) {
      const count = /^(tests|pass|fail|skipped|todo|cancelled|suites) (\d+)$/.exec(comment[2]);
      if (count) {
        requireValue(comment[1].length === 0 && !Object.hasOwn(summary, labels[count[1]]) && integer(Number(count[2])), 'INVALID_TAP_SUMMARY');
        summary[labels[count[1]]] = Number(count[2]);
      } else requireValue(!/^(tests|pass|fail|skipped|todo|cancelled|suites)\b/.test(comment[2]), 'INVALID_TAP_SUMMARY');
      continue;
    }
    const point = /^( *)(not ok|ok) ([1-9]\d*)(?: - (.*))?$/.exec(line);
    if (point) {
      const frame = frameAt(point[1].length);
      requireValue(!frame.plan?.trailing && Number(point[3]) === frame.points.length + 1 && integer(Number(point[3])) && (!frame.plan || Number(point[3]) <= frame.plan.count), 'INVALID_TAP_POINT');
      const directive = /(?<!\\)#[ \t]*(SKIP|TODO)\b/i.exec(point[4] ?? '');
      const status = directive ? (directive[1].toUpperCase() === 'SKIP' ? 'skipped' : 'todo') : point[2] === 'ok' ? 'passed' : 'failed';
      const entry = { status, type: 'test', typeSeen: false, diagnosticSeen: false, children: frame.child };
      frame.child = null; frame.points.push(entry); lastPoint = entry; lastPointIndent = frame.indent; continue;
    }
    const plan = /^( *)(\d+)\.\.(\d+)$/.exec(line);
    if (plan) {
      const frame = frameAt(plan[1].length);
      const count = Number(plan[3]);
      requireValue(plan[2] === '1' && integer(count) && count > 0 && frame.plan === null && frame.child === null && frame.points.length <= count, 'INVALID_TAP_PLAN');
      frame.plan = { count, trailing: frame.points.length > 0 }; lastPoint = null; continue;
    }
    throw new ReadinessError(/^\s*Bail out!/i.test(line) ? 'TAP_BAIL_OUT' : 'INVALID_TAP_STRUCTURE');
  }
  requireValue(diagnostic === null, 'INVALID_TAP_DIAGNOSTIC');
  while (stack.length > 1) finish(stack.pop());
  finish(frames[0]);
  const results = { total: 0, passed: 0, failed: 0, skipped: 0, todo: 0, cancelled: 0, suites: 0 };
  const points = frames.flatMap((frame) => frame.points);
  for (const point of points) {
    if (point.type === 'suite') { results.suites++; continue; }
    results.total++; results[point.status]++;
  }
  validateCounts(results); validateCounts(summary);
  requireValue(Object.keys(results).every((key) => summary[key] === results[key]), 'CONTRADICTORY_TAP_COUNTS');
  return { results, requiredSuitesMatched: 0, allPassed: results.passed === results.total && points.every((point) => point.status === 'passed') };
}
function validateCounts(results) {
  fields(results, ['total', 'passed', 'failed', 'skipped', 'todo', 'cancelled', 'suites']);
  requireValue(Object.values(results).every(integer) && results.total > 0 && results.total === results.passed + results.failed + results.skipped + results.todo + results.cancelled, 'INVALID_COUNTS');
}
export function normalizeTestJson(report, requiredSuites = [], expectedFiles = null) {
  requireValue(object(report) && typeof report.success === 'boolean' && Array.isArray(report.testResults) && report.testResults.length > 0, 'INVALID_REPORT');
  for (const key of ['numTotalTests', 'numPassedTests', 'numFailedTests', 'numPendingTests', 'numTotalTestSuites', 'numPassedTestSuites', 'numFailedTestSuites', 'numPendingTestSuites']) requireValue(integer(report[key]), 'INVALID_REPORT');
  for (const key of ['numTodoTests', 'numRuntimeErrorTestSuites']) requireValue(report[key] === undefined || integer(report[key]), 'INVALID_REPORT');
  requireValue(report.numTotalTestSuites === report.testResults.length && report.numTotalTestSuites === report.numPassedTestSuites + report.numFailedTestSuites + report.numPendingTestSuites, 'CONTRADICTORY_SUITE_COUNTS');
  const results = { total: 0, passed: 0, failed: 0, skipped: 0, todo: 0, cancelled: 0, suites: report.testResults.length };
  const suiteCounts = { passed: 0, failed: 0, pending: 0 };
  const names = new Set();
  for (const suite of report.testResults) {
    requireValue(object(suite) && typeof suite.name === 'string' && suite.name.length > 0 && Array.isArray(suite.assertionResults) && ['passed', 'failed', 'focused', 'pending', 'skipped', 'todo'].includes(suite.status), 'INVALID_REPORT');
    const name = suite.name.replace(/\\/g, '/');
    requireValue(!names.has(name), 'INVALID_REPORT'); names.add(name);
    // Jest calls an otherwise passing file with unexecuted tests "focused".
    suiteCounts[suite.status === 'failed' ? 'failed' : ['passed', 'focused'].includes(suite.status) ? 'passed' : 'pending']++;
    for (const assertion of suite.assertionResults) {
      requireValue(object(assertion) && ['passed', 'failed', 'pending', 'skipped', 'todo'].includes(assertion.status), 'INVALID_REPORT');
      results.total++;
      results[assertion.status === 'pending' ? 'skipped' : assertion.status]++;
    }
    if (suite.assertionResults.some((assertion) => assertion.status === 'failed')) requireValue(suite.status === 'failed', 'CONTRADICTORY_SUITE_STATUS');
  }
  validateCounts(results);
  requireValue(report.numTotalTests === results.total && report.numPassedTests === results.passed && report.numFailedTests === results.failed && report.numPendingTests === results.skipped && (report.numTodoTests ?? 0) === results.todo, 'CONTRADICTORY_TEST_COUNTS');
  requireValue(report.numPassedTestSuites === suiteCounts.passed && report.numFailedTestSuites === suiteCounts.failed && report.numPendingTestSuites === suiteCounts.pending && (report.numRuntimeErrorTestSuites ?? 0) <= suiteCounts.failed, 'CONTRADICTORY_SUITE_COUNTS');
  if (expectedFiles !== null) {
    requireValue(Array.isArray(expectedFiles) && expectedFiles.length > 0 && new Set(expectedFiles).size === expectedFiles.length && expectedFiles.every((name) => typeof name === 'string'), 'INVALID_EXPECTED_INVENTORY');
    requireValue(names.size === expectedFiles.length && expectedFiles.every((expected) => [...names].filter((name) => name === expected || name.endsWith(`/${expected}`)).length === 1) && [...names].every((name) => expectedFiles.some((expected) => name === expected || name.endsWith(`/${expected}`))), 'TEST_FILE_INVENTORY_MISMATCH');
  }
  const allPassed = report.success && results.passed === results.total && suiteCounts.passed === results.suites && report.testResults.every((suite) => suite.status === 'passed' && suite.assertionResults.length > 0);
  const requiredSuitesMatched = requiredSuites.filter((required) => [...names].some((name) => name === required || name.endsWith(`/${required}`))).length;
  return { results, requiredSuitesMatched, allPassed };
}

// Vitest's native JSON counts nested describe tasks as suites, but testResults
// contains files only. Emit a private file-level report so counts are exact and
// every nested failure/skip is retained without trusting impossible totals.
export function createVitestFileReport(testModules, errors = []) {
  requireValue(Array.isArray(testModules) && testModules.length > 0 && Array.isArray(errors), 'INVALID_REPORT');
  const testResults = [];
  const names = new Set();
  for (const module of testModules) {
    const file = module?.task;
    requireValue(object(file) && file.type === 'suite' && typeof file.filepath === 'string' && file.filepath.length > 0 && !names.has(file.filepath), 'INVALID_REPORT');
    names.add(file.filepath);
    const assertionResults = [];
    let fileStatus = 'passed';
    let visited = 0;
    function walk(task, depth = 0) {
      requireValue(object(task) && depth <= 64 && ++visited <= 1000000 && ['suite', 'test'].includes(task.type), 'INVALID_REPORT');
      const state = task.mode === 'only' ? 'only' : task.result?.state ?? task.mode;
      const status = { pass: 'passed', fail: 'failed', skip: 'skipped', todo: 'todo', run: 'pending', queued: 'pending', only: 'pending' }[state];
      requireValue(status !== undefined, 'INVALID_REPORT');
      if (status === 'failed') fileStatus = 'failed';
      else if (status !== 'passed' && fileStatus !== 'failed') fileStatus = 'pending';
      if (task.type === 'test') assertionResults.push({ status });
      else {
        requireValue(Array.isArray(task.tasks), 'INVALID_REPORT');
        for (const child of task.tasks) walk(child, depth + 1);
      }
    }
    walk(file);
    if (assertionResults.length === 0) fileStatus = 'failed';
    testResults.push({ name: file.filepath, status: fileStatus, assertionResults });
  }
  const assertions = testResults.flatMap((file) => file.assertionResults);
  const count = (status) => assertions.filter((assertion) => assertion.status === status).length;
  const report = {
    success: errors.length === 0 && testResults.every((file) => file.status === 'passed'),
    numTotalTestSuites: testResults.length,
    numPassedTestSuites: testResults.filter((file) => file.status === 'passed').length,
    numFailedTestSuites: testResults.filter((file) => file.status === 'failed').length,
    numPendingTestSuites: testResults.filter((file) => file.status === 'pending').length,
    numTotalTests: assertions.length, numPassedTests: count('passed'), numFailedTests: count('failed'),
    numPendingTests: count('pending') + count('skipped'), numTodoTests: count('todo'), testResults,
  };
  normalizeTestJson(report);
  return report;
}
export default class A16VitestReporter {
  onInit(context) { this.context = context; }
  async onTestRunEnd(testModules, errors = []) {
    const report = createVitestFileReport(testModules, errors);
    const output = this.context?.config?.outputFile;
    requireValue(typeof output === 'string', 'REPORT_OUTPUT_REQUIRED');
    await writeFile(localPath(output, true), JSON.stringify(report), { mode: 0o600 });
  }
}
async function configuredTestFiles(packageId) {
  const result = [];
  const base = join(ROOT, packageId);
  async function visit(folder) {
    const entries = await readdir(join(base, folder), { withFileTypes: true });
    for (const entry of entries) {
      const path = `${folder}/${entry.name}`;
      requireValue(!entry.isSymbolicLink(), 'UNSAFE_TEST_INVENTORY');
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile() && (packageId === 'server' ? /\.spec\.ts$/ : /\.test\.(?:ts|tsx)$/).test(entry.name)) result.push(path);
    }
  }
  await visit('src');
  requireValue(result.length > 0, 'EMPTY_TEST_INVENTORY');
  return result.sort();
}

function validateRecord(record, started, completed) {
  requireValue(STATUSES.has(record.status) && REASONS.has(record.reason), 'INVALID_STATUS');
  requireValue(record.exitCode === null || (Number.isInteger(record.exitCode) && record.exitCode >= 0 && record.exitCode <= 255), 'INVALID_EXIT_CODE');
  const begin = timestamp(record.startedAt);
  const end = timestamp(record.completedAt);
  requireValue(begin >= started && end >= begin && end <= completed, 'INVALID_RESULT_TIMESTAMP');
  requireValue(record.evidenceSha256 === null || (typeof record.evidenceSha256 === 'string' && HASH.test(record.evidenceSha256)), 'INVALID_EVIDENCE_HASH');
  if (record.status === 'skipped') requireValue(record.exitCode === null && record.reason !== 'OK' && record.evidenceSha256 === null, 'FORGED_RESULT');
  if (record.status === 'failed') requireValue(record.reason !== 'OK', 'FORGED_RESULT');
  if (record.status === 'passed') requireValue(record.exitCode === 0 && record.reason === 'OK' && typeof record.evidenceSha256 === 'string' && HASH.test(record.evidenceSha256), 'FORGED_RESULT');
}
export function validateManifest(manifest, context) {
  fields(manifest, ['formatVersion', 'releaseSha', 'source', 'runId', 'runAttempt', 'startedAt', 'completedAt', 'nodeVersion', 'git', 'networkIsolation', 'policy', 'packages', 'checks']);
  requireValue(manifest.formatVersion === FORMAT_VERSION, 'INVALID_VERSION');
  validateReleaseSha(context.releaseSha); validateReleaseSha(manifest.releaseSha);
  fields(manifest.git, ['headSha', 'treeSha', 'dirtyBefore', 'dirtyAfter']);
  requireValue(SHA.test(manifest.git.headSha) && SHA.test(manifest.git.treeSha) && typeof manifest.git.dirtyBefore === 'boolean' && typeof manifest.git.dirtyAfter === 'boolean', 'INVALID_GIT_STATE');
  requireValue(manifest.releaseSha === context.releaseSha && manifest.git.headSha === context.headSha && context.headSha === context.releaseSha && manifest.git.treeSha === context.treeSha, 'RELEASE_SHA_MISMATCH');
  requireValue(!manifest.git.dirtyBefore && !manifest.git.dirtyAfter && context.dirty === false, 'DIRTY_TREE');
  requireValue(['local', 'ci'].includes(manifest.source) && ['local', 'ci'].includes(context.source), 'INVALID_SOURCE');
  requireValue(typeof manifest.nodeVersion === 'string' && /^v(?:2[2-9]|[3-9]\d)\.\d+\.\d+$/.test(manifest.nodeVersion), 'UNSUPPORTED_NODE');
  if (manifest.source === 'ci') requireValue(typeof manifest.runId === 'string' && /^\d{1,20}$/.test(manifest.runId) && typeof manifest.runAttempt === 'string' && /^\d{1,6}$/.test(manifest.runAttempt), 'INVALID_CI_BINDING');
  else requireValue(manifest.runId === null && manifest.runAttempt === null, 'INVALID_CI_BINDING');
  if (context.source === 'ci') requireValue(manifest.source === 'ci' && context.runId === manifest.runId && context.runAttempt === manifest.runAttempt && context.githubSha === context.releaseSha, 'INVALID_CI_BINDING');
  const started = timestamp(manifest.startedAt);
  const completed = timestamp(manifest.completedAt);
  requireValue(Number.isFinite(context.now) && started <= completed && completed <= context.now && context.now - started <= MAX_AGE_MS && completed - started <= MAX_RUN_MS, 'STALE_OR_FUTURE_MANIFEST');
  requireValue(['ISOLATED', 'UNVERIFIED'].includes(manifest.networkIsolation), 'INVALID_NETWORK_STATE');
  fields(manifest.policy, ['killSwitch', 'egressDefaultDeny', 'credentialsForwarded', 'envFilesPresent']);
  requireValue(manifest.policy.killSwitch === true && manifest.policy.egressDefaultDeny === true && manifest.policy.credentialsForwarded === false && manifest.policy.envFilesPresent === false && manifest.networkIsolation === 'ISOLATED', 'OFFLINE_BOUNDARY_UNVERIFIED');
  requireValue(Array.isArray(manifest.packages) && manifest.packages.length === 2 && new Set(manifest.packages.map((entry) => entry.id)).size === 2, 'MISSING_OR_DUPLICATE_PACKAGE');
  for (const entry of manifest.packages) {
    fields(entry, ['id', 'status', 'exitCode', 'reason', 'startedAt', 'completedAt', 'evidenceSha256', 'packageSha256', 'lockSha256']);
    requireValue(['server', 'client'].includes(entry.id), 'UNKNOWN_PACKAGE'); validateRecord(entry, started, completed);
    for (const key of ['packageSha256', 'lockSha256']) {
      requireValue(entry[key] === null || (typeof entry[key] === 'string' && HASH.test(entry[key])), 'INVALID_PACKAGE_HASH');
      requireValue(context.packageBindings?.[entry.id]?.[key] === entry[key], 'PACKAGE_BINDING_MISMATCH');
      if (entry.status === 'passed') requireValue(typeof entry[key] === 'string', 'MISSING_PACKAGE_BINDING');
    }
  }
  requireValue(Array.isArray(manifest.checks) && manifest.checks.length === CHECKS.length && new Set(manifest.checks.map((entry) => entry.id)).size === CHECKS.length, 'MISSING_OR_DUPLICATE_CHECK');
  for (const entry of manifest.checks) {
    fields(entry, ['id', 'status', 'exitCode', 'reason', 'startedAt', 'completedAt', 'evidenceSha256', 'results', 'requiredSuitesMatched']);
    const definition = CHECKS.find((check) => check.id === entry.id);
    requireValue(definition !== undefined, 'UNKNOWN_CHECK'); validateRecord(entry, started, completed);
    requireValue(integer(entry.requiredSuitesMatched) && entry.requiredSuitesMatched <= (definition.suites?.length ?? 0), 'INVALID_SUITE_COVERAGE');
    if (definition.kind === 'command') requireValue(entry.results === null && entry.requiredSuitesMatched === 0, 'INVALID_COMMAND_RESULT');
    else if (entry.results !== null) validateCounts(entry.results);
    if (entry.status === 'passed' && definition.kind !== 'command') requireValue(entry.results !== null && entry.results.passed === entry.results.total && entry.results.failed === 0 && entry.results.skipped === 0 && entry.results.todo === 0 && entry.results.cancelled === 0 && entry.requiredSuitesMatched === (definition.suites?.length ?? 0) && (definition.kind !== 'json' || entry.results.suites >= entry.requiredSuitesMatched), 'TEST_FAILURE_OR_SKIP');
    if (entry.status === 'passed' && definition.package) requireValue(manifest.packages.find((pkg) => pkg.id === definition.package)?.status === 'passed', 'PACKAGE_NOT_PASSED');
  }
  return manifest;
}

const EXTERNAL_GATES = Object.freeze({
  G0: ['ACCOUNTABLE_SCOPE_AND_DECISION_APPROVAL_REQUIRED'],
  G1: ['OWNED_DB_OWNERSHIP_LEASE_AND_ATOMICITY_EVIDENCE_REQUIRED', 'AFFECTED_BROWSER_AND_MANUAL_UI_EVIDENCE_REQUIRED'],
  G2: ['PROVIDER_DATA_RECIPIENT_AUTHORIZATION_REQUIRED', 'DEPLOYMENT_POLICY_AND_TRANSPORT_VERIFICATION_REQUIRED'],
  G3: ['REVIEWED_SEMANTIC_GROUND_TRUTH_REQUIRED', 'PRODUCTION_BUDGET_RESERVATION_RECONCILIATION_REQUIRED', 'PRIVACY_RETENTION_ACCEPTANCE_REQUIRED'],
  G4a: ['FINAL_TREE_REQUIRED_CI_AND_MANUAL_GATES_REQUIRED', 'MIGRATION_AUTHORIZATION_AND_COMPATIBILITY_REQUIRED', 'REAL_KILL_SWITCH_AND_ROLLBACK_DRILL_REQUIRED', 'NAMED_PILOT_OWNER_SCOPE_BUDGET_AND_LAUNCH_AUTHORIZATION_REQUIRED'],
  G4b: ['G4A_AND_G3_ACCEPTANCE_REQUIRED', 'MEASURED_A18_PILOT_OUTCOMES_REQUIRED', 'REPRESENTATIVE_SCALE_OPERATIONS_EVIDENCE_REQUIRED', 'EXACT_RELEASE_PRODUCTION_EXPANSION_SIGNOFF_REQUIRED'],
});
export function assessReadiness(manifest, context) {
  const report = { formatVersion: FORMAT_VERSION, releaseSha: typeof context.releaseSha === 'string' && SHA.test(context.releaseSha) ? context.releaseSha : null, evaluatedAt: new Date(context.now).toISOString(), verification: { level: 'BLOCKED', reasons: [] }, manifestSha256: null, packages: [], checks: [], gates: Object.fromEntries(Object.entries(EXTERNAL_GATES).map(([gate, reasons]) => [gate, { level: 'BLOCKED', reasons: [...reasons] }])), deploymentAuthorized: false, certification: 'NOT_CERTIFIED' };
  try { validateManifest(manifest, context); }
  catch (error) { report.verification.reasons = [error instanceof ReadinessError ? error.code : 'INVALID_MANIFEST']; return report; }
  report.manifestSha256 = hash(JSON.stringify(manifest));
  report.packages = manifest.packages.map(({ id, status, exitCode }) => ({ id, status, exitCode }));
  report.checks = manifest.checks.map(({ id, status, exitCode, reason, results, requiredSuitesMatched }) => ({ id, status, exitCode, reason, results, requiredSuitesMatched }));
  if (manifest.packages.some((entry) => entry.status !== 'passed')) report.verification.reasons.push('PACKAGE_NOT_PASSED');
  if (manifest.checks.some((entry) => entry.status === 'failed')) report.verification.reasons.push('CHECK_FAILED');
  if (manifest.checks.some((entry) => entry.status === 'skipped')) report.verification.reasons.push('CHECK_SKIPPED');
  if (report.verification.reasons.length === 0) report.verification.level = context.source === 'ci' ? 'VERIFIED_CI' : 'VERIFIED_LOCAL';
  return report;
}

export function localPath(value, json = false) {
  requireValue(typeof value === 'string' && value.length > 0 && value.length <= 4096 && !/^(?:\\\\|\/\/)/.test(value), 'UNSAFE_LOCAL_PATH');
  const drive = /^[a-zA-Z]:[\\/]/.test(value);
  requireValue(!/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(value) || drive, 'UNSAFE_LOCAL_PATH');
  requireValue(!/[<>:"|?*\u0000-\u001f]/.test(drive ? value.slice(2) : value) && !value.replace(/\\/g, '/').split('/').includes('..'), 'UNSAFE_LOCAL_PATH');
  const name = value.replace(/\\/g, '/').split('/').at(-1);
  requireValue(!/^(?:con|prn|aux|nul|com\d|lpt\d)(?:\.|$)/i.test(name), 'UNSAFE_LOCAL_PATH');
  if (json) requireValue(/^[a-zA-Z0-9][a-zA-Z0-9._-]*\.json$/.test(name), 'UNSAFE_LOCAL_PATH');
  return resolve(value);
}
async function boundedFile(path, maxBytes) {
  let handle;
  try {
    const info = await lstat(path);
    requireValue(info.isFile() && !info.isSymbolicLink() && info.size <= maxBytes, 'UNSAFE_INPUT_FILE');
    handle = await open(path, 'r');
    const bytes = Buffer.alloc(maxBytes + 1);
    let used = 0;
    while (used < bytes.length) {
      const result = await handle.read(bytes, used, bytes.length - used, null);
      if (!result.bytesRead) break; used += result.bytesRead;
    }
    requireValue(used <= maxBytes, 'JSON_LIMIT');
    return bytes.subarray(0, used);
  } catch (error) { throw error instanceof ReadinessError ? error : new ReadinessError('INPUT_READ_FAILED'); }
  finally { if (handle) await handle.close(); }
}
function decode(bytes) { try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { throw new ReadinessError('INVALID_UTF8'); } }
function git(args) {
  try { return execFileSync('git', ['-C', ROOT, ...args], { encoding: 'utf8', timeout: 10000, maxBuffer: MAX_REPORT_BYTES, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0' } }).trim(); }
  catch { throw new ReadinessError('GIT_INSPECTION_FAILED'); }
}
async function repositoryContext(releaseSha) {
  const packageBindings = {};
  for (const id of ['server', 'client']) {
    packageBindings[id] = {};
    for (const [key, file] of [['packageSha256', 'package.json'], ['lockSha256', 'package-lock.json']]) {
      try { packageBindings[id][key] = hash(await boundedFile(join(ROOT, id, file), MAX_REPORT_BYTES)); } catch { packageBindings[id][key] = null; }
    }
  }
  const ci = process.env.GITHUB_ACTIONS === 'true';
  return { releaseSha, headSha: git(['rev-parse', '--verify', 'HEAD']), treeSha: git(['rev-parse', 'HEAD^{tree}']), dirty: git(['status', '--porcelain=v1', '--untracked-files=all']) !== '', packageBindings, now: Date.now(), source: ci ? 'ci' : 'local', githubSha: ci ? process.env.GITHUB_SHA : null, runId: ci ? process.env.GITHUB_RUN_ID : null, runAttempt: ci ? process.env.GITHUB_RUN_ATTEMPT : null };
}
async function envFilesPresent() {
  for (const folder of [ROOT, join(ROOT, 'server'), join(ROOT, 'client')]) {
    const names = await readdir(folder);
    if (names.some((name) => (name === '.env' || name.startsWith('.env.')) && !['.env.example', '.env.template', '.env.sample'].includes(name))) return true;
  }
  return false;
}
function isolatedNetwork() {
  // No provider/DNS probe is sent. The workflow creates a fresh network namespace.
  return process.platform === 'linux' && Object.values(networkInterfaces()).flat().every((entry) => entry.internal);
}
function childEnvironment(scratch) {
  const env = { PATH: process.env.PATH, HOME: scratch, XDG_CONFIG_HOME: scratch, TMPDIR: scratch, TMP: scratch, TEMP: scratch, CI: 'true', NODE_ENV: 'test', AI_KILL_SWITCH: 'true', AI_EGRESS_POLICY_JSON: '{"enabled":false}', NO_COLOR: '1', NPM_CONFIG_OFFLINE: 'true', NPM_CONFIG_AUDIT: 'false', NPM_CONFIG_FUND: 'false', NPM_CONFIG_USERCONFIG: join(scratch, 'npm-user.config'), NPM_CONFIG_GLOBALCONFIG: join(scratch, 'npm-global.config'), PRISMA_HIDE_UPDATE_MESSAGE: 'true', CHECKPOINT_DISABLE: '1', PRISMA_GENERATE_SKIP_AUTOINSTALL: '1' };
  // Provider credentials, GitHub tokens, NODE_OPTIONS and real DB URLs are absent.
  return env;
}
function execute(command, args, cwd, env) {
  return new Promise((done) => {
    const output = [];
    let bytes = 0;
    let reason = null;
    let child;
    function stop(code) {
      reason ??= code;
      try { process.kill(-child.pid, 'SIGKILL'); } catch { child?.kill('SIGKILL'); }
    }
    try { child = spawn(command, args, { cwd, env, shell: false, detached: true, stdio: ['ignore', 'pipe', 'pipe'] }); }
    catch { done({ exitCode: null, reason: 'COMMAND_START_FAILED', stdout: Buffer.alloc(0) }); return; }
    const timer = setTimeout(() => stop('TIMED_OUT'), 5 * 60 * 1000);
    child.stdout.on('data', (chunk) => { bytes += chunk.length; if (bytes <= MAX_REPORT_BYTES) output.push(chunk); else stop('OUTPUT_LIMIT'); });
    child.stderr.on('data', (chunk) => { bytes += chunk.length; if (bytes > MAX_REPORT_BYTES) stop('OUTPUT_LIMIT'); });
    child.on('error', () => { reason = 'COMMAND_START_FAILED'; });
    child.on('close', (exitCode) => { clearTimeout(timer); done({ exitCode, reason: reason ?? (exitCode === 0 ? 'OK' : 'COMMAND_FAILED'), stdout: Buffer.concat(output) }); });
  });
}
function skipped(id, reason, bindings) {
  const time = new Date().toISOString();
  const record = { id, status: 'skipped', exitCode: null, reason, startedAt: time, completedAt: time, evidenceSha256: null };
  return bindings ? { ...record, ...bindings } : { ...record, results: null, requiredSuitesMatched: 0 };
}
async function collect(releaseSha) {
  const before = await repositoryContext(releaseSha);
  const startedAt = new Date(before.now).toISOString();
  const envPresent = await envFilesPresent();
  const isolated = isolatedNetwork();
  const preflight = !before.dirty && before.headSha === releaseSha && isolated && !envPresent && (before.source !== 'ci' || (before.githubSha === releaseSha && /^\d+$/.test(before.runId ?? '') && /^\d+$/.test(before.runAttempt ?? '')));
  const manifest = { formatVersion: FORMAT_VERSION, releaseSha, source: before.source, runId: before.runId, runAttempt: before.runAttempt, startedAt, completedAt: startedAt, nodeVersion: process.version, git: { headSha: before.headSha, treeSha: before.treeSha, dirtyBefore: before.dirty, dirtyAfter: before.dirty }, networkIsolation: isolated ? 'ISOLATED' : 'UNVERIFIED', policy: { killSwitch: true, egressDefaultDeny: true, credentialsForwarded: false, envFilesPresent: envPresent }, packages: [], checks: [] };
  const scratch = await mkdtemp(join(tmpdir(), 'ai-a16-private-'));
  try {
    await writeFile(join(scratch, 'npm-user.config'), '', { mode: 0o600 });
    await writeFile(join(scratch, 'npm-global.config'), '', { mode: 0o600 });
    const env = childEnvironment(scratch);
    for (const id of ['server', 'client']) {
      const bindings = before.packageBindings[id];
      const setupPassed = before.source !== 'ci' || (process.env[`AI_A16_${id.toUpperCase()}_SETUP`] === 'success' && (id !== 'server' || process.env.AI_A16_PRISMA_SETUP === 'success'));
      if (!preflight || Object.values(bindings).some((value) => value === null)) { manifest.packages.push(skipped(id, 'PREFLIGHT_BLOCKED', bindings)); continue; }
      if (!setupPassed) { manifest.packages.push(skipped(id, 'PACKAGE_BLOCKED', bindings)); continue; }
      const begin = new Date().toISOString();
      const result = await execute('npm', ['ls', '--depth=0', '--json', '--offline'], join(ROOT, id), env);
      let status = result.reason === 'OK' ? 'passed' : 'failed';
      let reason = result.reason;
      try {
        const data = strictJson(decode(result.stdout), MAX_REPORT_BYTES, 256 * 1024, 32);
        if (!object(data) || !object(data.dependencies) || (data.problems !== undefined && (!Array.isArray(data.problems) || data.problems.length !== 0)) || Object.values(data.dependencies).some((dependency) => !object(dependency) || dependency.missing || dependency.invalid || dependency.extraneous || (dependency.problems?.length ?? 0) > 0)) { status = 'failed'; reason = 'INVALID_REPORT'; }
      } catch { status = 'failed'; if (reason === 'OK') reason = 'INVALID_REPORT'; }
      manifest.packages.push({ id, status, exitCode: result.exitCode, reason, startedAt: begin, completedAt: new Date().toISOString(), evidenceSha256: hash(result.stdout), ...bindings });
    }
    for (const check of CHECKS) {
      if (!preflight || (check.package && manifest.packages.find((pkg) => pkg.id === check.package)?.status !== 'passed')) { manifest.checks.push(skipped(check.id, preflight ? 'PACKAGE_BLOCKED' : 'PREFLIGHT_BLOCKED')); continue; }
      const begin = new Date().toISOString();
      const reportPath = join(scratch, `${check.id}.json`);
      let expectedFiles = null;
      if (check.kind === 'json') {
        try { expectedFiles = await configuredTestFiles(check.package); }
        catch {
          manifest.checks.push({ id: check.id, status: 'failed', exitCode: null, reason: 'INVALID_REPORT', startedAt: begin, completedAt: new Date().toISOString(), evidenceSha256: null, results: null, requiredSuitesMatched: 0 });
          continue;
        }
      }
      const args = [...check.args];
      if (check.kind === 'json') args.push(`--outputFile=${reportPath}`);
      const result = await execute(check.package ? 'npm' : process.execPath, args, check.package ? join(ROOT, check.package) : ROOT, env);
      let status = result.reason === 'OK' ? 'passed' : 'failed';
      let reason = result.reason;
      let results = null;
      let requiredSuitesMatched = 0;
      let evidence = result.stdout;
      if (check.kind !== 'command') {
        try {
          const normalized = check.kind === 'tap' ? normalizeTap(decode(evidence)) : normalizeTestJson(strictJson(decode(evidence = await boundedFile(reportPath, MAX_REPORT_BYTES)), MAX_REPORT_BYTES, 256 * 1024, 32), check.suites, expectedFiles);
          results = normalized.results; requiredSuitesMatched = normalized.requiredSuitesMatched;
          if (results.passed !== results.total || requiredSuitesMatched !== (check.suites?.length ?? 0) || normalized.allPassed === false) { status = 'failed'; if (reason === 'OK') reason = 'TEST_FAILURE_OR_SKIP'; }
        } catch { status = 'failed'; if (reason === 'OK') reason = 'INVALID_REPORT'; }
      }
      manifest.checks.push({ id: check.id, status, exitCode: result.exitCode, reason, startedAt: begin, completedAt: new Date().toISOString(), evidenceSha256: hash(evidence), results, requiredSuitesMatched });
    }
  } finally { await rm(scratch, { recursive: true, force: true }); }
  const after = await repositoryContext(releaseSha);
  // A HEAD/tree mutation during checks is also a failed final-tree binding.
  manifest.git.dirtyAfter = after.dirty || before.headSha !== after.headSha || before.treeSha !== after.treeSha;
  manifest.completedAt = new Date(after.now).toISOString();
  const report = assessReadiness(manifest, after);
  if (report.manifestSha256 === null) {
    // Collector-owned records are already redacted. Show skips on a dirty/unisolated
    // run without publishing its invalid manifest or trusting imported input.
    report.packages = manifest.packages.map(({ id, status, exitCode }) => ({ id, status, exitCode }));
    report.checks = manifest.checks.map(({ id, status, exitCode, reason, results, requiredSuitesMatched }) => ({ id, status, exitCode, reason, results, requiredSuitesMatched }));
  }
  return { manifest, report };
}
async function outputDirectory(value) {
  const requested = localPath(value);
  const root = await realpath(ROOT);
  const lexical = relative(root, requested);
  requireValue(lexical.startsWith(`..${sep}`) || isAbsolute(lexical), 'OUTPUT_MUST_BE_OUTSIDE_REPOSITORY');
  await mkdir(requested, { recursive: true, mode: 0o700 });
  requireValue(!(await lstat(requested)).isSymbolicLink(), 'UNSAFE_LOCAL_PATH');
  const canonical = localPath(await realpath(requested));
  const rel = relative(root, canonical);
  requireValue(rel.startsWith(`..${sep}`) || isAbsolute(rel), 'OUTPUT_MUST_BE_OUTSIDE_REPOSITORY');
  return canonical;
}
export async function main(argv = process.argv.slice(2)) {
  try {
    requireValue(['run', 'check'].includes(argv[0]) && argv.length % 2 === 1, 'INVALID_ARGUMENTS');
    const options = {};
    for (let index = 1; index < argv.length; index += 2) {
      const key = argv[index];
      requireValue(['--release-sha', '--manifest', '--out-dir'].includes(key) && !Object.hasOwn(options, key) && typeof argv[index + 1] === 'string', 'INVALID_ARGUMENTS'); options[key] = argv[index + 1];
    }
    const releaseSha = validateReleaseSha(options['--release-sha']);
    requireValue(argv[0] === 'check' ? typeof options['--manifest'] === 'string' : options['--manifest'] === undefined, 'INVALID_ARGUMENTS');
    requireValue(argv[0] !== 'run' || typeof options['--out-dir'] === 'string', 'INVALID_ARGUMENTS');
    // Validate publication location before executing any check.
    const outDir = options['--out-dir'] ? await outputDirectory(options['--out-dir']) : null;
    let manifest;
    let report;
    if (argv[0] === 'run') ({ manifest, report } = await collect(releaseSha));
    else {
      const path = localPath(options['--manifest'], true);
      localPath(await realpath(path), true);
      manifest = parseManifestJson(decode(await boundedFile(path, MAX_JSON_BYTES)));
      report = assessReadiness(manifest, await repositoryContext(releaseSha));
    }
    if (outDir) {
      // Only validated schema metadata is published. Invalid input is never copied.
      if (report.manifestSha256 !== null) await writeFile(join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
      await writeFile(join(outDir, 'readiness.json'), `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    }
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return report.verification.level === 'BLOCKED' ? 1 : 0;
  } catch (error) {
    const code = error instanceof ReadinessError ? error.code : 'INPUT_OR_OUTPUT_FAILED';
    process.stderr.write(`${JSON.stringify({ formatVersion: FORMAT_VERSION, verification: { level: 'BLOCKED', reasons: [code] }, deploymentAuthorized: false, certification: 'NOT_CERTIFIED' })}\n`);
    return 2;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) process.exitCode = await main();
