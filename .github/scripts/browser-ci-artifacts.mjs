import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cp, lstat, mkdir, open, readdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const SHARD_TOTAL = 4;
export const BROWSER_API_URL = 'http://localhost:3001/api';
export const BROWSER_PROJECTS = Object.freeze(['chromium', 'firefox', 'mobile-chrome', 'mobile-webkit']);
export const PROJECT_LEG_TOTAL = SHARD_TOTAL * BROWSER_PROJECTS.length;
export const PARTITION_STRATEGY = 'cyclic-project-shards-v1';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const CLIENT = join(ROOT, 'client');
const JSON_LIMIT = 32 * 1024 * 1024;
const FILE_LIMIT = 32 * 1024 * 1024;
const TOTAL_LIMIT = 256 * 1024 * 1024;
const SHA = /^[a-f0-9]{40}$/;
const HASH = /^[a-f0-9]{64}$/;
const RUN = /^(?:[1-9][0-9]{0,19}|local)$/;
const REQUIRED_DIST = ['app.html', 'index.html', '.vite/manifest.json', 'public-routes.json', 'sitemap.xml'];
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const requireValue = (value, code) => { if (!value) throw new Error(code); };

export function projectShardIndex(shard, project) {
  requireValue(Number.isInteger(shard) && shard >= 1 && shard <= SHARD_TOTAL, 'INVALID_SHARD_INDEX');
  const ordinal = BROWSER_PROJECTS.indexOf(project);
  requireValue(ordinal >= 0, 'INVALID_BROWSER_PROJECT');
  return (shard - 1 + ordinal) % SHARD_TOTAL + 1;
}

function projectLegs() {
  return Array.from({ length: SHARD_TOTAL }, (_, index) => BROWSER_PROJECTS.map((project) => ({ shard: index + 1, project, nativeShard: projectShardIndex(index + 1, project) }))).flat();
}

function inventoryName(shard, project) {
  projectShardIndex(shard, project);
  return `inventory-${shard}-${project}.json`;
}

function safeRelative(value) {
  requireValue(typeof value === 'string' && value.length <= 512 && !isAbsolute(value) && !/[\\\u0000-\u001f<>:"|?*]/.test(value) && value.split('/').every((part) => part && part !== '.' && part !== '..'), 'UNSAFE_ARTIFACT_PATH');
  return value;
}

async function boundedBytes(path, maximum = FILE_LIMIT) {
  const before = await lstat(path, { bigint: true });
  requireValue(before.isFile() && !before.isSymbolicLink() && before.size <= BigInt(maximum), 'ARTIFACT_FILE_LIMIT');
  const handle = await open(path, 'r');
  try {
    const stat = await handle.stat({ bigint: true });
    requireValue(stat.isFile() && stat.size <= BigInt(maximum) && (process.platform === 'win32' || stat.dev === before.dev) && stat.ino === before.ino, 'ARTIFACT_FILE_CHANGED');
    const size = Number(stat.size);
    const buffer = Buffer.alloc(Math.min(size + 1, maximum + 1));
    let used = 0;
    while (used < buffer.length) {
      const { bytesRead } = await handle.read(buffer, used, buffer.length - used, null);
      if (!bytesRead) break;
      used += bytesRead;
    }
    requireValue(used === size, 'ARTIFACT_FILE_CHANGED');
    return buffer.subarray(0, used);
  } finally { await handle.close(); }
}

export function parseBrowserJson(text) {
  requireValue(typeof text === 'string' && Buffer.byteLength(text) <= JSON_LIMIT, 'REPORT_BYTE_LIMIT');
  let at = 0;
  let nodes = 0;
  const space = () => { while (at < text.length && /[\t\r\n ]/.test(text[at])) at++; };
  const string = () => {
    const start = at++;
    while (at < text.length) {
      const char = text[at++];
      if (char === '\\') { at++; continue; }
      if (char === '"') {
        const value = JSON.parse(text.slice(start, at));
        requireValue(value.length <= 1024 * 1024, 'REPORT_STRING_LIMIT');
        return value;
      }
    }
    throw new Error('INVALID_REPORT_JSON');
  };
  const visit = (depth) => {
    requireValue(depth <= 64 && ++nodes <= 1000000, 'REPORT_STRUCTURE_LIMIT');
    space();
    const char = text[at];
    if (char === '{' || char === '[') {
      const end = char === '{' ? '}' : ']';
      const keys = new Set();
      at++; space();
      if (text[at] === end) { at++; return; }
      while (at < text.length) {
        if (char === '{') {
          requireValue(text[at] === '"', 'INVALID_REPORT_JSON');
          const key = string();
          requireValue(!keys.has(key) && !['__proto__', 'constructor', 'prototype'].includes(key), 'DUPLICATE_OR_UNSAFE_JSON_KEY');
          keys.add(key); space(); requireValue(text[at++] === ':', 'INVALID_REPORT_JSON');
        }
        visit(depth + 1); space();
        if (text[at] === end) { at++; return; }
        requireValue(text[at++] === ',', 'INVALID_REPORT_JSON'); space();
      }
      throw new Error('INVALID_REPORT_JSON');
    }
    if (char === '"') { string(); return; }
    for (const literal of ['true', 'false', 'null']) if (text.startsWith(literal, at)) { at += literal.length; return; }
    const number = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/.exec(text.slice(at));
    requireValue(number && Number.isFinite(Number(number[0])), 'INVALID_REPORT_JSON');
    at += number[0].length;
  };
  visit(0); space(); requireValue(at === text.length, 'INVALID_REPORT_JSON');
  return JSON.parse(text);
}

const json = async (path) => parseBrowserJson((await boundedBytes(path, JSON_LIMIT)).toString('utf8'));
const writeJson = (path, value) => writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx', mode: 0o600 });

export function assertBinding(value) {
  requireValue(value && value.formatVersion === 1 && SHA.test(value.releaseSha) && SHA.test(value.treeSha) && RUN.test(value.runId) && /^[1-9][0-9]{0,5}$/.test(value.runAttempt) && HASH.test(value.lockSha256) && /^v22\.[0-9]+\.[0-9]+$/.test(value.nodeVersion) && /^[0-9]+\.[0-9]+\.[0-9]+$/.test(value.playwrightVersion) && value.apiUrl === BROWSER_API_URL && value.variant === 'browser-mock-preview-v1', 'INVALID_BUILD_BINDING');
}

export async function readBrowserBinding(clientRoot = CLIENT, env = process.env) {
  const sourceRoot = resolve(clientRoot, '..');
  const git = (...args) => execFileSync('git', args, { cwd: sourceRoot, encoding: 'utf8', timeout: 15000 }).trim();
  const releaseSha = git('rev-parse', 'HEAD');
  requireValue(!env.GITHUB_SHA || env.GITHUB_SHA === releaseSha, 'CHECKOUT_SHA_MISMATCH');
  requireValue(git('status', '--porcelain') === '', 'DIRTY_CI_SOURCE');
  const req = createRequire(join(clientRoot, 'package.json'));
  const value = {
    formatVersion: 1, releaseSha, treeSha: git('rev-parse', 'HEAD^{tree}'),
    runId: env.GITHUB_RUN_ID || 'local', runAttempt: env.GITHUB_RUN_ATTEMPT || '1',
    lockSha256: hash(await readFile(join(clientRoot, 'package-lock.json'))),
    nodeVersion: process.version, playwrightVersion: req('playwright/package.json').version,
    apiUrl: BROWSER_API_URL, variant: 'browser-mock-preview-v1',
  };
  assertBinding(value);
  return value;
}

export function assertSameBinding(actual, expected) {
  assertBinding(actual); assertBinding(expected);
  requireValue(Object.keys(expected).every((key) => actual[key] === expected[key]), 'BUILD_SOURCE_OR_RUN_MISMATCH');
}

async function fileInventory(directory) {
  const stat = await lstat(directory);
  requireValue(stat.isDirectory() && !stat.isSymbolicLink(), 'ARTIFACT_DIRECTORY_INVALID');
  const files = [];
  let total = 0;
  const visit = async (folder, prefix = '') => {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      requireValue(!entry.isSymbolicLink(), 'ARTIFACT_SYMLINK');
      const path = safeRelative(`${prefix}${entry.name}`);
      if (entry.isDirectory()) await visit(join(folder, entry.name), `${path}/`);
      else {
        requireValue(entry.isFile() && !/(?:^|\/)\.env(?:\.|$)|(?:^|\/)node_modules(?:\/|$)/.test(path), 'UNSAFE_ARTIFACT_FILE');
        const bytes = await boundedBytes(join(folder, entry.name));
        total += bytes.length;
        requireValue(total <= TOTAL_LIMIT && files.length < 5000, 'BUILD_ARTIFACT_LIMIT');
        files.push({ path, bytes: bytes.length, sha256: hash(bytes) });
      }
    }
  };
  await visit(directory);
  return files.sort((left, right) => left.path.localeCompare(right.path));
}

export function flattenBrowserReport(report) {
  requireValue(report && Array.isArray(report.suites) && Array.isArray(report.errors), 'INVALID_BROWSER_REPORT');
  const rows = [];
  const keys = new Set();
  const visit = (suite, titles, depth) => {
    requireValue(depth <= 32 && Array.isArray(suite.specs) && rows.length <= 10000, 'INVALID_BROWSER_SUITE');
    const path = [...titles, suite.title];
    for (const spec of suite.specs) {
      requireValue(typeof spec.id === 'string' && typeof spec.title === 'string' && Number.isSafeInteger(spec.line) && spec.line > 0 && Number.isSafeInteger(spec.column) && spec.column > 0 && Array.isArray(spec.tests), 'INVALID_BROWSER_SPEC');
      const file = safeRelative(spec.file.replaceAll('\\', '/'));
      requireValue(/\.spec\.ts$/.test(file), 'INVALID_BROWSER_TEST_FILE');
      for (const test of spec.tests) {
        requireValue(BROWSER_PROJECTS.includes(test.projectName) && (test.projectId === undefined || typeof test.projectId === 'string') && Array.isArray(test.results) && Array.isArray(test.annotations), 'INVALID_BROWSER_TEST');
        const key = hash(JSON.stringify([test.projectName, file, spec.line, spec.column, path, spec.title]));
        requireValue(!keys.has(key), 'DUPLICATE_BROWSER_TEST'); keys.add(key);
        rows.push({ key, file, line: spec.line, column: spec.column, project: test.projectName, expectedStatus: test.expectedStatus, status: test.status, results: test.results, annotations: test.annotations });
      }
    }
    for (const child of suite.suites || []) visit(child, path, depth + 1);
  };
  for (const suite of report.suites) visit(suite, [], 0);
  requireValue(rows.length > 0 && rows.length <= 10000, 'EMPTY_BROWSER_INVENTORY');
  return rows.sort((left, right) => left.key.localeCompare(right.key));
}

function assertBrowserInventory(report, context, shard = null, project = null) {
  requireValue(report.errors.length === 0 && report.config?.fullyParallel === true && report.config.workers === 1 && report.config.forbidOnly === true && report.config.maxFailures === 0 && report.config.repeatEach === undefined && !report.config.grepInvert, 'UNSAFE_BROWSER_INVENTORY_CONFIG');
  const actualShard = report.config.shard;
  requireValue(shard === null ? actualShard === null && project === null : actualShard?.current === projectShardIndex(shard, project) && actualShard.total === SHARD_TOTAL, 'WRONG_BROWSER_SHARD');
  requireValue(Array.isArray(report.config.projects) && JSON.stringify(report.config.projects.map((project) => project.name).sort()) === JSON.stringify([...BROWSER_PROJECTS].sort()), 'BROWSER_PROJECT_INVENTORY_MISMATCH');
  requireValue(report.config.projects.every((project) => project.repeatEach === 1 && project.retries === 2 && project.timeout === 60000), 'BROWSER_PROJECT_LIMITS_MISMATCH');
  const rows = flattenBrowserReport(report);
  requireValue(project === null || rows.every((row) => row.project === project), 'BROWSER_PROJECT_SELECTION_MISMATCH');
  requireValue(rows.every((row) => row.results.length === 0 && ['passed', 'skipped'].includes(row.expectedStatus)), 'INVALID_LIST_REPORT');
  assertBinding(context);
  return rows;
}

export function assertIdentityMatch(actual, expected) {
  requireValue(actual.length === expected.length && actual.every((row, index) => row.key === expected[index].key), 'BROWSER_TEST_INVENTORY_MISMATCH');
}

export function assertShardPartition(inventory, shards) {
  requireValue(shards.length === SHARD_TOTAL && shards.every((rows) => rows.length > 0), 'MISSING_BROWSER_SHARD');
  const union = shards.flat().sort((left, right) => left.key.localeCompare(right.key));
  requireValue(new Set(union.map((row) => row.key)).size === union.length, 'OVERLAPPING_BROWSER_SHARDS');
  assertIdentityMatch(union, inventory);
}

function skipCondition(ts, node, project) {
  const browser = project === 'firefox' ? 'firefox' : project === 'mobile-webkit' ? 'webkit' : 'chromium';
  if (ts.isIdentifier(node)) {
    if (node.text === 'isMobile') return project.startsWith('mobile-');
    if (node.text === 'browserName') return browser;
  }
  if (ts.isStringLiteral(node)) return node.text;
  if (ts.isParenthesizedExpression(node)) return skipCondition(ts, node.expression, project);
  if (ts.isBinaryExpression(node)) {
    const left = skipCondition(ts, node.left, project);
    const right = skipCondition(ts, node.right, project);
    if (node.operatorToken.kind === ts.SyntaxKind.BarBarToken) return Boolean(left || right);
    if (node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) return Boolean(left && right);
    if (node.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken) return left !== right;
    if (node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken) return left === right;
  }
  throw new Error('UNREVIEWED_RUNTIME_SKIP_CONDITION');
}

async function skipPolicies(rows, clientRoot = CLIENT) {
  const req = createRequire(join(clientRoot, 'package.json'));
  const ts = req('typescript');
  const sources = new Map();
  const policies = [];
  for (const row of rows) {
    if (!sources.has(row.file)) {
      const requested = resolve(clientRoot, 'e2e', row.file);
      requireValue(requested.startsWith(`${resolve(clientRoot, 'e2e')}${sep}`), 'UNSAFE_TEST_SOURCE');
      const text = (await boundedBytes(requested, 1024 * 1024)).toString('utf8');
      sources.set(row.file, ts.createSourceFile(requested, text, ts.ScriptTarget.Latest, true));
    }
    const source = sources.get(row.file);
    const reasons = [];
    const find = (node) => {
      if (ts.isCallExpression(node)) {
        const location = source.getLineAndCharacterOfPosition(node.getStart(source));
        if (location.line + 1 === row.line && location.character + 1 === row.column) {
          const scan = (child) => {
            if (ts.isCallExpression(child) && child.expression.getText(source) === 'test.skip') {
              const [condition, reason] = child.arguments;
              requireValue(reason && ts.isStringLiteral(reason), 'UNREVIEWED_RUNTIME_SKIP_REASON');
              if (skipCondition(ts, condition, row.project)) reasons.push(reason.text);
            }
            ts.forEachChild(child, scan);
          };
          ts.forEachChild(node, scan);
        }
      }
      ts.forEachChild(node, find);
    };
    find(source);
    if (reasons.length || row.expectedStatus === 'skipped') policies.push({ key: row.key, reasons: [...new Set(reasons)].sort() });
  }
  return policies;
}

export function assessBrowserResults(report, expected, policies) {
  const rows = flattenBrowserReport(report);
  assertIdentityMatch(rows, expected);
  requireValue(report.errors.length === 0, 'BROWSER_GLOBAL_ERROR');
  const counts = { total: rows.length, expected: 0, unexpected: 0, flaky: 0, skipped: 0, retries: 0, timedOutAttempts: 0, interruptedAttempts: 0 };
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    requireValue(['expected', 'unexpected', 'flaky', 'skipped'].includes(row.status), 'UNFINISHED_BROWSER_TEST');
    counts[row.status]++;
    for (const result of row.results) {
      requireValue(['passed', 'failed', 'timedOut', 'skipped', 'interrupted'].includes(result.status) && Number.isSafeInteger(result.retry) && result.retry >= 0 && result.retry <= 2, 'INVALID_BROWSER_ATTEMPT');
      if (result.retry > 0) counts.retries++;
      if (result.status === 'timedOut') counts.timedOutAttempts++;
      if (result.status === 'interrupted') counts.interruptedAttempts++;
    }
    if (row.status === 'skipped') {
      const policy = policies.find((entry) => entry.key === row.key);
      const skip = row.annotations.find((annotation) => annotation.type === 'skip');
      const declared = expected[index].expectedStatus === 'skipped';
      requireValue(declared || (policy && skip && policy.reasons.includes(skip.description)), 'UNEXPECTED_BROWSER_SKIP');
      requireValue(row.expectedStatus === 'skipped' && (declared ? row.results.length <= 1 : row.results.length === 1) && row.results.every((result) => result.status === 'skipped' && result.retry === 0), 'INVALID_SKIPPED_TEST');
    } else {
      requireValue(row.results.length > 0 && row.expectedStatus === expected[index].expectedStatus, 'UNEXECUTED_OR_CHANGED_BROWSER_TEST');
      requireValue(row.results.every((result, retry) => result.status !== 'skipped' && result.retry === retry), 'INVALID_BROWSER_RETRY_SEQUENCE');
      const completed = row.results.filter((result) => result.status !== 'interrupted');
      const expectedAttempts = completed.filter((result) => result.status === row.expectedStatus).length;
      const outcome = completed.length === 0 ? 'skipped' : expectedAttempts === completed.length ? 'expected' : expectedAttempts === 0 ? 'unexpected' : 'flaky';
      requireValue(row.status === outcome, 'BROWSER_ATTEMPT_OUTCOME_MISMATCH');
      if (row.status !== 'unexpected') requireValue(row.results.at(-1).status === row.expectedStatus, 'INVALID_EXPECTED_BROWSER_OUTCOME');
    }
  }
  for (const key of ['expected', 'unexpected', 'flaky', 'skipped']) requireValue(report.stats?.[key] === counts[key], 'BROWSER_REPORT_COUNT_MISMATCH');
  requireValue(Number.isFinite(report.stats.duration) && report.stats.duration >= 0, 'INVALID_BROWSER_DURATION');
  return { rows, counts, durationMs: report.stats.duration, ok: counts.unexpected === 0 && counts.interruptedAttempts === 0 };
}

export function assertUpstreamSuccess(buildResult, shardResult) {
  requireValue(buildResult === 'success' && shardResult === 'success', 'CLIENT_UPSTREAM_NOT_SUCCESSFUL');
}

async function browserInventories(directory, context) {
  const inventory = assertBrowserInventory(await json(join(directory, 'inventory.json')), context);
  const legs = await Promise.all(projectLegs().map(async (leg) => ({ ...leg, rows: assertBrowserInventory(await json(join(directory, inventoryName(leg.shard, leg.project))), context, leg.shard, leg.project) })));
  for (const project of BROWSER_PROJECTS) assertShardPartition(inventory.filter((row) => row.project === project), legs.filter((leg) => leg.project === project).map((leg) => leg.rows));
  const shards = Array.from({ length: SHARD_TOTAL }, (_, index) => legs.filter((leg) => leg.shard === index + 1).flatMap((leg) => leg.rows).sort((left, right) => left.key.localeCompare(right.key)));
  assertShardPartition(inventory, shards);
  return { inventory, legs, shards };
}

export async function sealBuild(directory, context, clientRoot = CLIENT) {
  assertBinding(context);
  requireValue(process.env.VITE_API_URL === BROWSER_API_URL, 'BUILD_API_VARIANT_NOT_EXPLICIT');
  const { inventory } = await browserInventories(directory, context);
  for (const name of REQUIRED_DIST) requireValue((await lstat(join(clientRoot, 'dist', name))).isFile(), 'INCOMPLETE_CLIENT_BUILD');
  await cp(join(clientRoot, 'dist'), join(directory, 'dist'), { recursive: true, errorOnExist: true, force: false });
  const files = await fileInventory(directory);
  const value = { ...context, kind: 'sealed-client-browser-build', partitionStrategy: PARTITION_STRATEGY, files, skipPolicies: await skipPolicies(inventory, clientRoot) };
  await writeJson(join(directory, 'build-manifest.json'), value);
  return value;
}

export async function verifyBuild(directory, context, installed = false, clientRoot = CLIENT) {
  const requested = await realpath(directory);
  requireValue(!(await lstat(directory)).isSymbolicLink(), 'ARTIFACT_DIRECTORY_INVALID');
  const manifest = await json(join(requested, 'build-manifest.json'));
  assertSameBinding(manifest, context);
  requireValue(manifest.kind === 'sealed-client-browser-build' && manifest.partitionStrategy === PARTITION_STRATEGY && Array.isArray(manifest.files) && Array.isArray(manifest.skipPolicies), 'INVALID_BUILD_MANIFEST');
  const actual = (await fileInventory(requested)).filter((file) => file.path !== 'build-manifest.json');
  requireValue(JSON.stringify(actual) === JSON.stringify(manifest.files), 'BUILD_CHECKSUM_OR_INVENTORY_MISMATCH');
  for (const name of ['inventory.json', ...projectLegs().map((leg) => inventoryName(leg.shard, leg.project))]) requireValue(actual.some((file) => file.path === name), 'INCOMPLETE_BROWSER_INVENTORY');
  for (const name of REQUIRED_DIST) requireValue(actual.some((file) => file.path === `dist/${name}`), 'INCOMPLETE_CLIENT_BUILD');
  if (installed) {
    const dist = await fileInventory(join(clientRoot, 'dist'));
    const expected = manifest.files.filter((file) => file.path.startsWith('dist/')).map((file) => ({ ...file, path: file.path.slice(5) }));
    requireValue(JSON.stringify(dist) === JSON.stringify(expected), 'INSTALLED_BUILD_MISMATCH');
  }
  return manifest;
}

export async function recordShard(directory, buildDirectory, context, shard, project, clientRoot = CLIENT) {
  const nativeShard = projectShardIndex(shard, project);
  const build = await verifyBuild(buildDirectory, context, true, clientRoot);
  const reportBytes = await boundedBytes(join(directory, 'results.json'));
  const report = parseBrowserJson(reportBytes.toString('utf8'));
  requireValue(report.config?.shard?.current === nativeShard && report.config.shard.total === SHARD_TOTAL && report.config.workers === 1, 'WRONG_BROWSER_SHARD');
  assertSameBinding(report.config.metadata, context);
  const inventoryBytes = await boundedBytes(join(buildDirectory, inventoryName(shard, project)));
  const expected = assertBrowserInventory(parseBrowserJson(inventoryBytes.toString('utf8')), context, shard, project);
  const assessed = assessBrowserResults(report, expected, build.skipPolicies);
  const blob = await boundedBytes(join(directory, 'blob-report.zip'));
  requireValue(blob.length > 0, 'MISSING_BLOB_REPORT');
  const testStepOutcome = process.env.BROWSER_TEST_OUTCOME;
  requireValue(['success', 'failure'].includes(testStepOutcome), 'UNEXECUTED_BROWSER_SHARD');
  requireValue(/^(?:0|[1-9][0-9]{0,2})$/.test(process.env.BROWSER_TEST_EXIT_CODE || ''), 'BROWSER_EXIT_OUTCOME_MISMATCH');
  const exitCode = Number(process.env.BROWSER_TEST_EXIT_CODE);
  requireValue(exitCode <= 255 && (exitCode === 0) === (testStepOutcome === 'success'), 'BROWSER_EXIT_OUTCOME_MISMATCH');
  const manifest = { ...context, kind: 'browser-project-shard-result', partitionStrategy: PARTITION_STRATEGY, shard, shardTotal: SHARD_TOTAL, project, nativeShard, testStepOutcome, exitCode, inventorySha256: hash(inventoryBytes), reportSha256: hash(reportBytes), blobSha256: hash(blob), counts: assessed.counts, durationMs: assessed.durationMs, ok: assessed.ok };
  await writeJson(join(directory, 'shard-manifest.json'), manifest);
  return manifest;
}

function shardDirectory(directory, context, shard, project) {
  projectShardIndex(shard, project);
  return join(directory, `browser-shard-${context.releaseSha}-${context.runId}-${context.runAttempt}-${shard}`, 'ci-results', project);
}

export async function prepareReports(directory, context, clientRoot = CLIENT) {
  await mkdir(join(clientRoot, 'all-blob-reports'), { recursive: false });
  let copied = 0;
  for (const { shard, project, nativeShard } of projectLegs()) {
    try {
      const source = shardDirectory(directory, context, shard, project);
      const manifest = await json(join(source, 'shard-manifest.json'));
      assertSameBinding(manifest, context);
      requireValue(manifest.kind === 'browser-project-shard-result' && manifest.partitionStrategy === PARTITION_STRATEGY && manifest.shard === shard && manifest.shardTotal === SHARD_TOTAL && manifest.project === project && manifest.nativeShard === nativeShard, 'WRONG_BROWSER_SHARD');
      const bytes = await boundedBytes(join(source, 'blob-report.zip'));
      requireValue(HASH.test(manifest.blobSha256) && bytes.length > 0 && hash(bytes) === manifest.blobSha256, 'BLOB_REPORT_CHECKSUM_MISMATCH');
      await writeFile(join(clientRoot, 'all-blob-reports', `shard-${shard}-${project}.zip`), bytes, { flag: 'wx', mode: 0o600 });
      copied++;
    } catch (error) {
      process.stderr.write(`Shard ${shard} ${project} unavailable for report merge: ${safeCode(error)}\n`);
    }
  }
  requireValue(copied > 0, 'NO_VALID_BLOB_REPORTS');
  return { copied, expected: PROJECT_LEG_TOTAL, partial: copied !== PROJECT_LEG_TOTAL };
}

export async function verifyGate(buildDirectory, shardRoot, mergedPath, context, clientRoot = CLIENT) {
  const build = await verifyBuild(buildDirectory, context, false, clientRoot);
  const { inventory, legs } = await browserInventories(buildDirectory, context);
  const shardRows = Array.from({ length: SHARD_TOTAL }, () => []);
  const counts = [];
  const projectLegDurations = [];
  for (const { shard, project, nativeShard, rows: expected } of legs) {
    const directory = shardDirectory(shardRoot, context, shard, project);
    const manifest = await json(join(directory, 'shard-manifest.json'));
    assertSameBinding(manifest, context);
    requireValue(manifest.kind === 'browser-project-shard-result' && manifest.partitionStrategy === PARTITION_STRATEGY && manifest.shard === shard && manifest.shardTotal === SHARD_TOTAL && manifest.project === project && manifest.nativeShard === nativeShard && manifest.testStepOutcome === 'success' && manifest.exitCode === 0, 'MISSING_OR_FAILED_BROWSER_SHARD');
    requireValue(hash(await boundedBytes(join(buildDirectory, inventoryName(shard, project)))) === manifest.inventorySha256, 'SHARD_INVENTORY_CHECKSUM_MISMATCH');
    const reportBytes = await boundedBytes(join(directory, 'results.json'));
    requireValue(hash(reportBytes) === manifest.reportSha256 && hash(await boundedBytes(join(directory, 'blob-report.zip'))) === manifest.blobSha256, 'SHARD_REPORT_CHECKSUM_MISMATCH');
    const report = parseBrowserJson(reportBytes.toString('utf8'));
    requireValue(report.config?.shard?.current === nativeShard && report.config.shard.total === SHARD_TOTAL && report.config.workers === 1, 'WRONG_BROWSER_SHARD');
    assertSameBinding(report.config.metadata, context);
    const assessed = assessBrowserResults(report, expected, build.skipPolicies);
    requireValue(assessed.ok && manifest.ok === true && JSON.stringify(assessed.counts) === JSON.stringify(manifest.counts) && assessed.durationMs === manifest.durationMs, 'BROWSER_SHARD_NOT_SUCCESSFUL');
    shardRows[shard - 1].push(...assessed.rows); counts.push(assessed.counts);
    projectLegDurations.push({ shard, project, nativeShard, durationMs: assessed.durationMs });
  }
  for (const rows of shardRows) rows.sort((left, right) => left.key.localeCompare(right.key));
  assertShardPartition(inventory, shardRows);
  const mergedReport = await json(mergedPath);
  assertSameBinding(mergedReport.config?.metadata, context);
  const merged = assessBrowserResults(mergedReport, inventory, build.skipPolicies);
  const summed = Object.fromEntries(Object.keys(merged.counts).map((key) => [key, counts.reduce((sum, value) => sum + value[key], 0)]));
  requireValue(merged.ok && JSON.stringify(summed) === JSON.stringify(merged.counts), 'MERGED_BROWSER_RESULT_MISMATCH');
  const outcome = (row) => JSON.stringify({ key: row.key, expectedStatus: row.expectedStatus, status: row.status, attempts: row.results.map((result) => ({ retry: result.retry, status: result.status })), skipReasons: row.annotations.filter((annotation) => annotation.type === 'skip').map((annotation) => annotation.description).sort() });
  const completed = shardRows.flat().sort((left, right) => left.key.localeCompare(right.key));
  requireValue(merged.rows.every((row, index) => outcome(row) === outcome(completed[index])), 'MERGED_BROWSER_TEST_OUTCOME_MISMATCH');
  assertUpstreamSuccess(process.env.CLIENT_BUILD_RESULT, process.env.CLIENT_SHARDS_RESULT);
  const summary = { ...context, kind: 'complete-client-browser-gate', partitionStrategy: PARTITION_STRATEGY, shardTotal: SHARD_TOTAL, workersPerShard: 1, projectLegTotal: PROJECT_LEG_TOTAL, projectLegDurations, counts: merged.counts, durationMs: merged.durationMs, inventorySha256: hash(await boundedBytes(join(buildDirectory, 'inventory.json'))), complete: true };
  await writeJson(join(clientRoot, 'ci-results', 'summary.json'), summary);
  if (process.env.GITHUB_STEP_SUMMARY) await writeFile(process.env.GITHUB_STEP_SUMMARY, `## Browser gate\n\n4 shards × 1 worker; 16 cyclic project legs; complete inventory at \`${context.releaseSha}\`.\n\n${Object.entries(summary.counts).map(([key, value]) => `- ${key}: ${value}`).join('\n')}\n\n${projectLegDurations.map((leg) => `- Shard ${leg.shard}, ${leg.project}, native ${leg.nativeShard}/4: ${(leg.durationMs / 1000).toFixed(1)}s`).join('\n')}\n`, { flag: 'a' });
  return summary;
}

function safeCode(error) {
  return /^[A-Z0-9_]+$/.test(error?.message || '') ? error.message : 'BROWSER_CI_VERIFICATION_FAILED';
}

export async function main(args = process.argv.slice(2)) {
  const [action, directory, extra, merged, project] = args;
  if (action === 'shard-index') {
    requireValue(args.length === 3 && /^[1-4]$/.test(directory || ''), 'INVALID_BROWSER_CI_ARGUMENTS');
    process.stdout.write(`${projectShardIndex(Number(directory), extra)}\n`);
    return;
  }
  const context = await readBrowserBinding();
  requireValue(['seal-build', 'verify-build', 'install-build', 'verify-installed-build', 'record-shard', 'prepare-reports', 'verify-gate'].includes(action) && directory, 'INVALID_BROWSER_CI_ARGUMENTS');
  const path = resolve(directory);
  let result;
  if (action === 'seal-build') result = await sealBuild(path, context);
  else if (action === 'install-build') {
    await verifyBuild(path, context);
    try { await lstat(join(CLIENT, 'dist')); throw new Error('CLIENT_DIST_ALREADY_PRESENT'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    await cp(join(path, 'dist'), join(CLIENT, 'dist'), { recursive: true, force: false, errorOnExist: true });
    result = await verifyBuild(path, context, true);
  } else if (action === 'verify-build' || action === 'verify-installed-build') result = await verifyBuild(path, context, action === 'verify-installed-build');
  else if (action === 'record-shard') result = await recordShard(path, resolve(extra), context, Number(merged), project);
  else if (action === 'prepare-reports') result = await prepareReports(path, context);
  else result = await verifyGate(path, resolve(extra), resolve(merged), context);
  process.stdout.write(JSON.stringify({ action, releaseSha: context.releaseSha, ...(result.counts ? { counts: result.counts } : {}), ...(result.partial !== undefined ? { partial: result.partial } : {}), verified: true }) + '\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch((error) => { process.stderr.write(`${safeCode(error)}\n`); process.exitCode = 1; });
