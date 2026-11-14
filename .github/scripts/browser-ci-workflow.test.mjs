import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// Read contracts only: never import the Playwright configs, start a server, or
// execute the artifact CLI. Artifact/result rejection has its own unit suite.
const root = fileURLToPath(new URL('../../', import.meta.url));
const serverRequire = createRequire(resolve(root, 'server/package.json'));
const { load } = serverRequire('js-yaml');
const ts = serverRequire('typescript');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const workflow = load(read('.github/workflows/ci.yml'));
const jobs = workflow.jobs;
const browserJobIds = ['client-checks-build', 'client-browser', 'client'];
const helper = '../.github/scripts/browser-ci-artifacts.mjs';
const apiUrl = 'http://localhost:3001/api';
const buildPath = '$RUNNER_TEMP/browser-build';
const shardPath = '$RUNNER_TEMP/browser-shards';
const runIdentity = '${{github.sha}}-${{github.run_id}}-${{github.run_attempt}}';
const asArray = (value) => value === undefined ? [] : Array.isArray(value) ? value : [value];
const sorted = (value) => [...asArray(value)].sort();
const expressions = (value) => String(value ?? '').trim().replace(/\$\{\{\s*([\s\S]*?)\s*\}\}/g, (_, body) => `\${{${body.replace(/\s+/g, '')}}}`);
const condition = (value) => expressions(value).replace(/^\$\{\{([\s\S]*)\}\}$/, '$1').replace(/\s+/g, '');
const runtimePath = (value) => expressions(value).replaceAll('${{runner.temp}}', '$RUNNER_TEMP').replaceAll('${RUNNER_TEMP}', '$RUNNER_TEMP').replace(/\/$/, '');

function one(values, description) {
  assert.equal(values.length, 1, `Expected exactly one ${description}, found ${values.length}`);
  return values[0];
}

function words(line) {
  return (expressions(line).match(/(?:[^\s'\"]+|'[^']*'|\"[^\"]*\")+/g) ?? [])
    .map((word) => word.replace(/'([^']*)'|\"([^\"]*)\"/g, (_, single, double) => single ?? double));
}

function sequenceAt(actual, expected) {
  return actual.findIndex((_, index) => expected.every((word, offset) => actual[index + offset] === word));
}

function commands(job) {
  return job.steps.flatMap((step, index) => (step.run ?? '').split(/\r?\n/)
    .filter((line) => line.trim() && !line.trim().startsWith('#'))
    // A deploy command can be captured in an assignment's $(...) expression.
    // Inspect that command as well, without executing any shell code.
    .flatMap((line) => [line, ...line.matchAll(/\$\(([^()]*)\)/g)].map((part) => typeof part === 'string' ? part : part[1]))
    .map((line) => ({ step, index, line, words: words(line) })));
}

const matchingCommands = (job, ...sequence) => commands(job).filter((command) => sequenceAt(command.words, sequence) >= 0);
const command = (job, ...sequence) => one(matchingCommands(job, ...sequence), sequence.join(' '));
const actions = (job, name) => job.steps.filter((step) => step.uses?.split('@')[0] === name);
const action = (job, name) => one(actions(job, name), name);
const artifact = (job, name) => one(actions(job, 'actions/upload-artifact').filter((step) => expressions(step.with?.name).startsWith(`${name}-`)), `${name} upload`);
const workingDirectory = (job, step) => step['working-directory'] ?? job.defaults?.run?.['working-directory'];

function requiredStep(step) {
  assert.ok(step['continue-on-error'] === undefined || step['continue-on-error'] === false, 'Required steps must preserve failures');
  assert.ok(step.if === undefined || condition(step.if) === 'success()', 'Required producer steps must not have conditional skips');
}

function playwrightOptions(entry) {
  const at = sequenceAt(entry.words, ['playwright', 'test']);
  assert.ok(at >= 0);
  const args = entry.words.slice(at + 2);
  const options = {};
  for (let index = 0; index < args.length; index++) {
    const word = args[index];
    assert.ok(word.startsWith('--'), `Browser inventory must not be narrowed by positional arguments: ${word}`);
    const equal = word.indexOf('=');
    const key = equal < 0 ? word.slice(2) : word.slice(2, equal);
    assert.ok(!Object.hasOwn(options, key), `Duplicate Playwright option: ${key}`);
    options[key] = equal >= 0 ? word.slice(equal + 1) : key === 'list' ? true : args[++index];
  }
  return options;
}

function nodes(source, predicate) {
  const found = [];
  const visit = (node) => {
    if (predicate(node)) found.push(node);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

function parseSource(path) {
  const source = ts.createSourceFile(path, read(path), ts.ScriptTarget.Latest, true);
  assert.equal(source.parseDiagnostics.length, 0, `${path} must parse without executing it`);
  return source;
}

function member(node) {
  if (ts.isIdentifier(node)) return node.text;
  if (ts.isPropertyAccessExpression(node)) return `${member(node.expression)}.${node.name.text}`;
  return undefined;
}

function property(object, name) {
  assert.ok(ts.isObjectLiteralExpression(object), 'Expected a literal configuration object');
  return one(object.properties.filter((entry) => ts.isPropertyAssignment(entry) && entry.name.text === name), `${name} configuration property`).initializer;
}

function literal(node) {
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(literal);
  if (ts.isObjectLiteralExpression(node)) return Object.fromEntries(node.properties.map((entry) => {
    assert.ok(ts.isPropertyAssignment(entry), 'Configuration values must be statically inspectable');
    return [entry.name.text, literal(entry.initializer)];
  }));
  assert.fail(`Expected a literal, found ${ts.SyntaxKind[node.kind]}`);
}

function config(path) {
  const source = parseSource(path);
  const exported = one(source.statements.filter(ts.isExportAssignment), `${path} default export`);
  assert.ok(ts.isCallExpression(exported.expression));
  assert.equal(member(exported.expression.expression), 'defineConfig');
  return { source, exported, call: exported.expression, object: exported.expression.arguments.at(-1) };
}

const base = config('client/playwright.config.ts');
const ci = config('client/playwright.ci.config.ts');
const merge = config('client/playwright.merge.config.ts');
const fullStack = config('client/playwright.full-stack.config.ts');
const clientPackage = JSON.parse(read('client/package.json'));

function device(project) {
  const use = property(project, 'use');
  const spread = one(use.properties.filter(ts.isSpreadAssignment), 'device preset');
  assert.ok(ts.isElementAccessExpression(spread.expression));
  assert.equal(member(spread.expression.expression), 'devices');
  return literal(spread.expression.argumentExpression);
}

function stringValues(value) {
  if (typeof value === 'string') return [value];
  return value && typeof value === 'object' ? Object.values(value).flatMap(stringValues) : [];
}

test('CI remains an unfiltered main/PR workflow with read-only browser jobs and no new install or secret surface', () => {
  assert.equal(workflow.name, 'CI');
  assert.deepEqual(sorted(Object.keys(workflow.on)), ['pull_request', 'push']);
  for (const event of ['pull_request', 'push']) assert.deepEqual(workflow.on[event], { branches: ['main'] });
  assert.deepEqual(workflow.permissions, { contents: 'read' });
  assert.deepEqual(sorted(Object.keys(jobs)), ['client', 'client-browser', 'client-checks-build', 'containers', 'full-stack', 'server']);
  assert.equal(workflow.concurrency['cancel-in-progress'], true);
  for (const id of browserJobIds) {
    const job = jobs[id];
    assert.equal(job['runs-on'], 'ubuntu-latest');
    assert.ok(Number.isInteger(job['timeout-minutes']) && job['timeout-minutes'] > 0);
    assert.equal(job.services, undefined);
    assert.equal(job.environment, undefined);
    assert.equal(job.container, undefined);
    assert.ok(job.permissions === undefined || JSON.stringify(job.permissions) === JSON.stringify(workflow.permissions));
    assert.ok(job['continue-on-error'] === undefined || job['continue-on-error'] === false);
    assert.equal(action(job, 'actions/checkout').with['persist-credentials'], false);
    const node = action(job, 'actions/setup-node').with;
    assert.equal(String(node['node-version']), '22');
    assert.equal(node.cache, 'npm');
    assert.equal(node['cache-dependency-path'], 'client/package-lock.json');
    for (const step of job.steps) {
      assert.ok(step['continue-on-error'] === undefined || step['continue-on-error'] === false);
      if (step.uses) assert.ok(['actions/checkout', 'actions/setup-node', 'actions/upload-artifact', 'actions/download-artifact'].includes(step.uses.split('@')[0]));
      if (step.run) assert.equal(workingDirectory(job, step), 'client');
    }
    for (const entry of commands(job)) {
      assert.equal(sequenceAt(entry.words, ['npm', 'install']), -1);
      assert.equal(sequenceAt(entry.words, ['npm', 'add']), -1);
      assert.equal(sequenceAt(entry.words, ['yarn', 'add']), -1);
      assert.equal(sequenceAt(entry.words, ['pnpm', 'add']), -1);
    }
    assert.ok(stringValues(job).every((value) => !value.includes('secrets.')), 'Browser jobs must not acquire secrets');
  }
  assert.ok(stringValues(workflow.env).every((value) => !value.includes('secrets.')));
});

test('Client checks retain lint, full coverage, prerender and exactly one explicitly bound build before sealing', () => {
  const job = jobs['client-checks-build'];
  assert.equal(job.needs, undefined);
  assert.equal(job.strategy, undefined);
  const checks = ['lint', 'test:cov', 'test:prerender', 'build'].map((script) => {
    const entry = command(job, 'npm', 'run', script);
    assert.deepEqual(entry.words, ['npm', 'run', script], `${script} must remain complete and unfiltered`);
    requiredStep(entry.step);
    return entry;
  });
  assert.ok(checks.every((entry, index) => index === 0 || checks[index - 1].index < entry.index));
  assert.equal(checks.at(-1).step.env.VITE_API_URL, apiUrl);
  assert.equal(command(job, 'node', '../.github/scripts/npm-audit.mjs').words.length, 2);
  assert.deepEqual(command(job, 'npm', 'ci').words, ['npm', 'ci']);
  const seal = command(job, 'node', helper, 'seal-build');
  requiredStep(seal.step);
  assert.equal(seal.step.env.VITE_API_URL, apiUrl);
  assert.ok(checks.at(-1).index < seal.index);
  assert.ok(seal.index < job.steps.indexOf(artifact(job, 'browser-build')));
  const unit = artifact(job, 'client-unit-verification');
  assert.equal(condition(unit.if), 'always()');
  assert.equal(unit.with.path, 'client/coverage/');
  assert.equal(unit.with['if-no-files-found'], 'error');
  for (const id of ['client-browser', 'client']) {
    assert.equal(matchingCommands(jobs[id], 'npm', 'run', 'build').length, 0);
    assert.equal(matchingCommands(jobs[id], 'vite', 'build').length, 0);
  }
});

test('Four non-fail-fast browser shards run one worker and the complete default project selection', () => {
  const job = jobs['client-browser'];
  assert.deepEqual(job.strategy, { 'fail-fast': false, 'max-parallel': 4, matrix: { shardIndex: [1, 2, 3, 4] } });
  assert.deepEqual(asArray(job.needs), ['client-checks-build']);
  assert.equal(job.if, undefined);
  const run = command(job, 'playwright', 'test');
  requiredStep(run.step);
  assert.ok(run.step.id, 'The test outcome must have a stable step identity');
  assert.deepEqual(run.words.slice(0, 4), ['npx', '--no-install', 'playwright', 'test']);
  assert.deepEqual(playwrightOptions(run), { config: 'playwright.ci.config.ts', shard: '${{matrix.shardIndex}}/4', workers: '1' });
  const install = command(job, 'playwright', 'install');
  assert.deepEqual(install.words, ['npx', '--no-install', 'playwright', 'install', '--with-deps', 'chromium', 'firefox', 'webkit']);
  assert.ok(install.index < run.index);
  assert.equal(literal(property(ci.object, 'workers')), 1);
  assert.equal(jobs.client.strategy, undefined);
});

test('CI inherits all four unchanged browser projects, default safety settings and browser typecheck coverage', () => {
  assert.equal(ci.call.arguments.length, 1, 'Use one spread configuration so Playwright cannot concatenate the inherited build server');
  const inherited = one(ci.object.properties.filter(ts.isSpreadAssignment), 'base configuration spread');
  assert.equal(member(inherited.expression), 'baseConfig');
  const imported = one(ci.source.statements.filter((node) => ts.isImportDeclaration(node) && node.importClause?.name?.text === 'baseConfig'), 'base Playwright import');
  assert.equal(literal(imported.moduleSpecifier), './playwright.config');
  const overrideNames = ci.object.properties.filter(ts.isPropertyAssignment).map((entry) => entry.name.text);
  for (const name of ['projects', 'testDir', 'testMatch', 'testIgnore', 'grep', 'grepInvert', 'retries', 'forbidOnly', 'fullyParallel', 'use']) assert.ok(!overrideNames.includes(name), `CI must inherit ${name}`);
  assert.equal(literal(property(base.object, 'testDir')), './e2e');
  assert.equal(literal(property(base.object, 'workers')), 1);
  assert.equal(literal(property(base.object, 'fullyParallel')), true);
  assert.equal(member(property(base.object, 'forbidOnly')), 'isCi');
  const retries = property(base.object, 'retries');
  assert.ok(ts.isConditionalExpression(retries));
  assert.equal(member(retries.condition), 'isCi');
  assert.equal(literal(retries.whenTrue), 2);
  assert.equal(literal(retries.whenFalse), 0);
  const isCi = one(nodes(base.source, (node) => ts.isVariableDeclaration(node) && node.name.text === 'isCi'), 'CI safety flag').initializer;
  assert.ok(ts.isCallExpression(isCi));
  assert.equal(member(isCi.expression), 'Boolean');
  assert.equal(member(isCi.arguments[0]), 'process.env.CI');
  const projects = property(base.object, 'projects').elements;
  const expected = [
    ['chromium', 'Desktop Chrome', 'testIgnore', '/mobile-workspace\\.spec\\.ts/'],
    ['firefox', 'Desktop Firefox', 'testIgnore', '/mobile-workspace\\.spec\\.ts/'],
    ['mobile-chrome', 'Pixel 7', 'testMatch', '/(?:mobile-workspace|public-pages)\\.spec\\.ts/'],
    ['mobile-webkit', 'iPhone 13', 'testMatch', '/(?:mobile-workspace|public-pages)\\.spec\\.ts/'],
  ];
  assert.equal(projects.length, expected.length);
  projects.forEach((project, index) => {
    const [name, preset, filter, pattern] = expected[index];
    assert.equal(literal(property(project, 'name')), name);
    assert.equal(device(project), preset);
    assert.equal(property(project, filter).text, pattern);
  });
  const checker = parseSource('client/scripts/typecheck-browser-tests.mjs');
  const sources = one(nodes(checker, (node) => ts.isCallExpression(node) && member(node.expression) === 'sources.push' && node.arguments.every(ts.isStringLiteralLike)), 'browser config typecheck registration');
  assert.deepEqual(sorted(sources.arguments.map(literal)), sorted(['playwright.config.ts', 'playwright.ci.config.ts', 'playwright.merge.config.ts', 'playwright.full-stack.config.ts']));
  const collected = nodes(checker, (node) => ts.isCallExpression(node) && member(node.expression) === 'collectTypeScript' && ts.isCallExpression(node.arguments[0]) && member(node.arguments[0].expression) === 'join');
  assert.deepEqual(sorted(collected.map((call) => literal(call.arguments[0].arguments[1]))), ['e2e', 'full-stack']);
});

test('Every inventory is frozen from the same complete source selection before the build artifact is sealed', () => {
  const job = jobs['client-checks-build'];
  const inventories = matchingCommands(job, 'playwright', 'test');
  assert.equal(inventories.length, 2, 'Freeze a full inventory and a four-way shard inventory loop, not a magic test count');
  const options = inventories.map(playwrightOptions);
  for (const selection of options) {
    assert.equal(selection.list, true);
    assert.equal(selection.reporter, 'json');
    assert.ok(selection.workers === undefined || selection.workers === '1');
    assert.ok(selection.config === undefined || selection.config === 'playwright.ci.config.ts');
    assert.ok(Object.keys(selection).every((key) => ['list', 'reporter', 'workers', 'config', 'shard'].includes(key)));
  }
  assert.equal(options[0].shard, undefined);
  assert.equal(options[1].shard, '$shard/4');
  const seal = command(job, 'node', helper, 'seal-build');
  assert.ok(inventories.every((entry) => entry.index === seal.index));
  assert.ok(seal.words.at(-1) === '$out');
  const lines = commands({ steps: [seal.step] });
  assert.ok(lines.some((entry) => entry.words.includes(`out=${buildPath}`)));
  assert.ok(lines.some((entry) => entry.words.map((word) => word.replace(/;$/, '')).join(' ') === 'for shard in 1 2 3 4 do'));
  assert.ok(inventories[0].words.includes('PLAYWRIGHT_JSON_OUTPUT_FILE=$out/inventory.json'));
  assert.ok(inventories[1].words.includes('PLAYWRIGHT_JSON_OUTPUT_FILE=$out/inventory-$shard.json'));
  assert.equal(seal.step.shell, 'bash');
  assert.ok(lines.some((entry) => sequenceAt(entry.words, ['set', '-euo', 'pipefail']) === 0));
});

test('Preview verifies the installed sealed source binding and never rebuilds or changes the mock API variant', () => {
  const originalServer = literal(property(base.object, 'webServer'));
  const previewServer = literal(property(ci.object, 'webServer'));
  assert.deepEqual(previewServer.env, originalServer.env);
  assert.deepEqual(previewServer.env, { VITE_API_URL: apiUrl });
  assert.deepEqual(words(previewServer.command), ['npm', 'run', 'preview', '--', '--host', '127.0.0.1', '--port', '4173']);
  for (const name of ['url', 'reuseExistingServer', 'timeout']) assert.deepEqual(previewServer[name], originalServer[name]);
  assert.equal(clientPackage.scripts.preview, 'vite preview');
  assert.equal(literal(property(base.object, 'use')).baseURL, previewServer.url);
  const binding = property(ci.object, 'metadata');
  assert.ok(ts.isIdentifier(binding));
  const context = one(nodes(ci.source, (node) => ts.isVariableDeclaration(node) && node.name.text === binding.text), 'source binding declaration');
  assert.ok(ts.isAwaitExpression(context.initializer));
  assert.equal(member(context.initializer.expression.expression), 'readBrowserBinding');
  const verify = one(nodes(ci.source, (node) => ts.isCallExpression(node) && member(node.expression) === 'verifyBuild'), 'installed build verification');
  assert.equal(member(verify.arguments[1]), binding.text);
  assert.equal(literal(verify.arguments[2]), true);
  assert.ok(verify.end < ci.exported.pos, 'The source binding must be checked before configuring the browser runner');
  const requested = one(nodes(ci.source, (node) => ts.isVariableDeclaration(node) && node.name.text === member(verify.arguments[0])), 'artifact environment binding');
  assert.equal(member(requested.initializer), 'process.env.BROWSER_BUILD_ARTIFACT');
  assert.ok(nodes(ci.source, (node) => ts.isThrowStatement(node)).some((node) => ts.isNewExpression(node.expression) && node.expression.arguments?.some((argument) => ts.isStringLiteral(argument) && argument.text === 'BROWSER_BUILD_ARTIFACT_REQUIRED')));
  const job = jobs['client-browser'];
  const install = command(job, 'node', helper, 'install-build');
  assert.deepEqual(install.words, ['node', helper, 'install-build', buildPath]);
  requiredStep(install.step);
  const run = command(job, 'playwright', 'test');
  assert.ok(install.index < run.index);
  assert.equal(runtimePath(run.step.env.BROWSER_BUILD_ARTIFACT), buildPath);
  for (const id of browserJobIds) {
    for (const env of [jobs[id].env, ...jobs[id].steps.map((step) => step.env)]) {
      if (env && Object.hasOwn(env, 'VITE_API_URL')) assert.equal(env.VITE_API_URL, apiUrl);
    }
  }
});

test('Build and report artifacts are SHA/run/attempt scoped and downloads cannot silently select or flatten other runs', () => {
  const built = artifact(jobs['client-checks-build'], 'browser-build');
  const shard = artifact(jobs['client-browser'], 'browser-shard');
  assert.equal(expressions(built.with.name), `browser-build-${runIdentity}`);
  assert.equal(expressions(shard.with.name), `browser-shard-${runIdentity}-\${{matrix.shardIndex}}`);
  assert.equal(runtimePath(built.with.path), buildPath);
  assert.equal(built.with['include-hidden-files'], true);
  for (const id of browserJobIds) {
    for (const upload of actions(jobs[id], 'actions/upload-artifact')) {
      assert.ok(expressions(upload.with.name).includes(runIdentity), 'Every browser artifact must bind source, run and attempt');
      assert.equal(upload.with['if-no-files-found'], 'error');
      assert.ok(Number.isInteger(upload.with['retention-days']) && upload.with['retention-days'] > 0);
    }
  }
  for (const id of ['client-browser', 'client']) {
    const download = one(actions(jobs[id], 'actions/download-artifact').filter((step) => step.with.name), `${id} exact build download`);
    assert.equal(expressions(download.with.name), expressions(built.with.name));
    assert.equal(runtimePath(download.with.path), buildPath);
    assert.deepEqual(sorted(Object.keys(download.with)), ['name', 'path']);
    requiredStep(download);
  }
  const reports = one(actions(jobs.client, 'actions/download-artifact').filter((step) => step.with.pattern), 'same-run shard download');
  assert.equal(expressions(reports.with.pattern), `browser-shard-${runIdentity}-*`);
  assert.equal(runtimePath(reports.with.path), shardPath);
  assert.ok(reports.with['merge-multiple'] === undefined || reports.with['merge-multiple'] === false, 'Preserve each shard artifact directory');
  assert.ok(Object.keys(reports.with).every((key) => ['pattern', 'path', 'merge-multiple'].includes(key)), 'No cross-repository, token, run-id or artifact-id fallback');
});

test('Each shard records its actual outcome with source-bound JSON/blob evidence and merge is diagnostics-only', () => {
  const reporters = literal(property(ci.object, 'reporter'));
  assert.deepEqual(reporters, [['github'], ['json', { outputFile: 'ci-results/results.json' }], ['blob', { outputFile: 'ci-results/blob-report.zip' }]]);
  const job = jobs['client-browser'];
  const run = command(job, 'playwright', 'test');
  const record = command(job, 'node', helper, 'record-shard');
  assert.ok(run.index < record.index);
  assert.deepEqual(record.words, ['node', helper, 'record-shard', dirname(reporters[1][1].outputFile).replaceAll('\\', '/'), buildPath, '${{matrix.shardIndex}}']);
  assert.equal(condition(record.step.if), `always()&&steps.${run.step.id}.outcome!='skipped'`);
  assert.equal(expressions(record.step.env.BROWSER_TEST_OUTCOME), `\${{steps.${run.step.id}.outcome}}`);
  const upload = artifact(job, 'browser-shard');
  assert.equal(condition(upload.if), 'always()');
  assert.deepEqual(sorted(upload.with.path.trim().split(/\s+/)), ['client/ci-results/', 'client/test-results/']);
  assert.ok(read('.github/scripts/browser-ci-artifacts.mjs').includes('`browser-shard-${context.releaseSha}-${context.runId}-${context.runAttempt}-${shard}`, \'ci-results\''), 'Consumers must read the ci-results directory retained by the upload common ancestor');
  assert.ok(record.index < job.steps.indexOf(upload));
  assert.equal(merge.call.arguments.length, 1);
  assert.deepEqual(merge.object.properties.map((entry) => entry.name.text), ['reporter']);
  assert.deepEqual(literal(property(merge.object, 'reporter')), [['html', { outputFolder: 'playwright-report', open: 'never' }], ['json', { outputFile: 'ci-results/merged-results.json' }]]);
  const prepare = command(jobs.client, 'node', helper, 'prepare-reports');
  assert.deepEqual(prepare.words, ['node', helper, 'prepare-reports', shardPath]);
  const merged = command(jobs.client, 'playwright', 'merge-reports');
  assert.deepEqual(merged.words, ['npx', '--no-install', 'playwright', 'merge-reports', '--config=playwright.merge.config.ts', 'all-blob-reports']);
  assert.ok(prepare.index < merged.index);
  assert.equal(matchingCommands(jobs.client, 'playwright', 'test').length, 0, 'The stable gate must not replace missing reports with a rerun');
});

test('Stable Client always runs an unskippable strict final gate with both producer results and complete report inputs', () => {
  const job = jobs.client;
  assert.equal(job.name, 'Client');
  assert.deepEqual(sorted(job.needs), ['client-browser', 'client-checks-build']);
  assert.equal(condition(job.if), 'always()');
  assert.equal(job.strategy, undefined);
  const gate = command(job, 'node', helper, 'verify-gate');
  assert.equal(condition(gate.step.if), 'always()', 'Failed setup, missing shards or partial diagnostic merges must not skip the final required checks');
  assert.ok(gate.step['continue-on-error'] === undefined || gate.step['continue-on-error'] === false);
  assert.deepEqual(Object.fromEntries(Object.entries(gate.step.env).map(([key, value]) => [key, expressions(value)])), {
    CLIENT_BUILD_RESULT: '${{needs.client-checks-build.result}}',
    CLIENT_SHARDS_RESULT: '${{needs.client-browser.result}}',
  });
  assert.deepEqual(gate.words, ['node', helper, 'verify-gate', buildPath, shardPath, literal(property(merge.object, 'reporter'))[1][1].outputFile], 'No success fallback, swallowed exit code or alternate inventory');
  assert.equal(gate.step.run.trim().split(/\r?\n/).length, 1);
  const merged = command(job, 'playwright', 'merge-reports');
  assert.ok(merged.index < gate.index);
  assert.ok(job.steps.slice(gate.index + 1).every((step) => step.uses?.split('@')[0] === 'actions/upload-artifact'), 'Strict verification is the final executable gate, not merely a diagnostic');
  const uploaded = artifact(job, 'client-verification');
  assert.equal(condition(uploaded.if), 'always()');
  assert.deepEqual(sorted(uploaded.with.path.trim().split(/\s+/)), ['client/ci-results/', 'client/playwright-report/']);
});

test('Browser helper and workflow changes trigger the maintained offline guards on main and PRs', () => {
  const offline = load(read('.github/workflows/ai-hardening.yml'));
  for (const event of ['pull_request', 'push']) {
    assert.deepEqual(offline.on[event].branches, ['main']);
    for (const path of ['.github/scripts/browser-ci*.mjs', '.github/scripts/browser-ci*.d.mts', '.github/workflows/ci.yml']) {
      assert.ok(offline.on[event].paths.includes(path), `Offline checks must cover ${event} changes to ${path}`);
    }
  }
});

test('Server and native replay checks preserve their separate fixtures and exact ownership-aware cleanup', () => {
  const job = jobs.server;
  assert.equal(job.name, 'Server');
  assert.equal(job.needs, undefined);
  assert.equal(job.strategy, undefined);
  assert.equal(job.if, undefined);
  assert.equal(job.defaults.run['working-directory'], 'server');
  assert.deepEqual(job.env, {
    DATABASE_URL: 'postgresql://e2e:e2e-local-only@127.0.0.1:15432/data_explorer_e2e',
    E2E_DATABASE_URL: 'postgresql://e2e:e2e-local-only@127.0.0.1:15432/data_explorer_e2e',
    E2E_REDIS_URL: 'redis://127.0.0.1:16379/15',
    COMPOSE_PROJECT_NAME: 'data-explorer-server-${{ github.run_id }}',
    AI_EVAL_RUNNER_CONTAINER: 'ai-eval-ci-${{ github.run_id }}-${{ github.run_attempt }}-eval-runner-1',
  });
  for (const script of ['prisma:generate', 'typecheck', 'lint', 'test:cov', 'build']) requiredStep(command(job, 'npm', 'run', script).step);
  const offline = command(job, 'node', '--test');
  for (const path of ['scripts/prisma-generate-safe.test.mjs', 'test/ai-execution-ledger-worker.test.cjs', 'scripts/ai-eval/native-replay.test.mjs', 'scripts/ai-eval/model-role-assessment.test.mjs', 'scripts/ai-eval/model-native-worker.test.mjs', 'test/ai-model-role-adapter.test.cjs', 'test/ai-model-role-live.test.cjs', 'test/ai-model-role-runner.test.cjs', 'test/ai-provider-model-catalog.test.cjs', 'test/ai-provider-model-live-runner.test.cjs']) assert.ok(offline.words.includes(path), `Retain ${path}`);
  const fixture = command(job, 'docker', 'compose', '-f', 'test/compose.e2e.yml', '-f', 'test/compose.r03.yml', 'up');
  assert.ok(offline.index < fixture.index);
  assert.deepEqual(fixture.words, ['docker', 'compose', '-f', 'test/compose.e2e.yml', '-f', 'test/compose.r03.yml', 'up', '-d', '--wait']);
  const native = command(job, 'docker', 'compose', '--project-name', '$project', '-f', 'test/compose.ai-eval.yml', 'up');
  assert.ok(fixture.index < native.index);
  assert.equal(native.step.id, 'native-eval-fixtures');
  assert.equal(native.step['timeout-minutes'], 4);
  assert.deepEqual(native.words, ['docker', 'compose', '--project-name', '$project', '-f', 'test/compose.ai-eval.yml', 'up', '--detach', '--wait', '--wait-timeout', '150']);
  const nativeLines = commands({ steps: [native.step] });
  const probe = one(nativeLines.filter((entry) => sequenceAt(entry.words, ['test', '-z']) === 0), 'native ownership probe');
  assert.ok(probe.line.includes('label=com.docker.compose.project=$project'));
  const owned = one(nativeLines.filter((entry) => entry.words[0] === 'printf' && entry.words[1] === 'owned=true\\n'), 'ownership output');
  assert.deepEqual(owned.words.slice(2), ['>>', '$GITHUB_OUTPUT']);
  assert.ok(nativeLines.indexOf(probe) < nativeLines.indexOf(owned));
  assert.ok(nativeLines.indexOf(owned) < nativeLines.findIndex((entry) => entry.line === native.line));
  const cleanup = command(job, 'docker', 'compose', '--project-name', '$project', '-f', 'test/compose.ai-eval.yml', 'down');
  assert.equal(condition(cleanup.step.if), "always()&&steps.native-eval-fixtures.outputs.owned=='true'");
  assert.equal(cleanup.step['timeout-minutes'], 3);
  assert.deepEqual(cleanup.words, ['docker', 'compose', '--project-name', '$project', '-f', 'test/compose.ai-eval.yml', 'down', '--volumes', '--remove-orphans']);
  for (const step of [native.step, cleanup.step]) {
    const lines = commands({ steps: [step] });
    assert.equal(step.shell, 'bash');
    assert.ok(lines.some((entry) => entry.words.includes('project=ai-eval-ci-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}')));
    assert.ok(lines.some((entry) => sequenceAt(entry.words, ['set', '-euo', 'pipefail']) === 0));
  }
  const e2e = command(job, 'npm', 'run', 'test:e2e');
  assert.equal(e2e.step.shell, 'bash');
  assert.equal(e2e.step['timeout-minutes'], 10);
  assert.deepEqual(e2e.step.env, { TMPDIR: '${{ runner.temp }}' });
  assert.ok(words(e2e.step.run).includes('pipefail'));
  assert.deepEqual(e2e.words, ['npm', 'run', 'test:e2e', '--', '--detectOpenHandles', '--json', '--outputFile=e2e-results.json', '2>&1', '|', 'tee', 'e2e.log']);
  requiredStep(e2e.step);
  const remove = command(job, 'docker', 'compose', '-f', 'test/compose.e2e.yml', '-f', 'test/compose.r03.yml', 'down');
  assert.equal(condition(remove.step.if), 'always()');
  assert.deepEqual(remove.words.slice(-3), ['down', '--volumes', '--remove-orphans']);
  assert.ok(e2e.index < cleanup.index && e2e.index < remove.index);
});

test('Full-stack remains a one-worker Client/Server dependent gate and container publication stays behind all gates', () => {
  const job = jobs['full-stack'];
  assert.equal(job.name, 'Full-stack browser');
  assert.deepEqual(sorted(job.needs), ['client', 'server']);
  assert.equal(job.if, undefined);
  assert.equal(job.strategy, undefined);
  assert.equal(job.env.COMPOSE_PROJECT_NAME, 'data-explorer-browser-${{ github.run_id }}');
  assert.equal(literal(property(fullStack.object, 'workers')), 1);
  assert.equal(literal(property(fullStack.object, 'fullyParallel')), false);
  assert.equal(literal(property(fullStack.object, 'retries')), 0);
  assert.equal(literal(property(fullStack.object, 'testDir')), './full-stack');
  const projects = property(fullStack.object, 'projects').elements;
  assert.equal(projects.length, 1);
  assert.equal(literal(property(projects[0], 'name')), 'full-stack-chromium');
  assert.equal(device(projects[0]), 'Desktop Chrome');
  assert.deepEqual(words(clientPackage.scripts['test:full-stack']), ['playwright', 'test', '--config', 'playwright.full-stack.config.ts']);
  const run = command(job, 'npm', 'run', 'test:full-stack');
  assert.deepEqual(run.words, ['npm', 'run', 'test:full-stack', '2>&1', '|', 'tee', 'full-stack.log']);
  assert.equal(run.step.shell, 'bash');
  assert.ok(words(run.step.run).includes('pipefail'));
  requiredStep(run.step);
  command(job, 'npm', 'run', 'typecheck:browser');
  const up = command(job, 'docker', 'compose', '-f', 'server/test/compose.e2e.yml', 'up');
  const down = command(job, 'docker', 'compose', '-f', 'server/test/compose.e2e.yml', 'down');
  assert.ok(up.index < run.index && run.index < down.index);
  assert.equal(condition(down.step.if), 'always()');
  assert.deepEqual(down.words.slice(-3), ['down', '--volumes', '--remove-orphans']);
  const containers = jobs.containers;
  assert.deepEqual(sorted(containers.needs), ['client', 'full-stack', 'server']);
  assert.equal(containers.if, undefined);
  assert.deepEqual(containers.permissions, { contents: 'read', packages: 'write' });
  const images = matchingCommands(containers, 'docker', 'build');
  assert.equal(images.length, 2);
  assert.ok(images[0].words.includes('VITE_API_URL=$api_url'));
  assert.ok(images[0].words.includes('$image_prefix/client:${GITHUB_SHA}'));
  assert.ok(images[1].words.includes('$image_prefix/server:${GITHUB_SHA}'));
  assert.ok(images[0].step.env.PRODUCTION_API_URL.includes('vars.PRODUCTION_API_URL'));
  assert.equal(actions(containers, 'actions/download-artifact').length, 0, 'Production images must not use the mock browser build');
  const scans = actions(containers, 'aquasecurity/trivy-action');
  assert.equal(scans.length, 2);
  for (const scan of scans) {
    assert.equal(String(scan.with['exit-code']), '1');
    assert.equal(scan.with.severity, 'HIGH,CRITICAL');
  }
  const publish = command(containers, 'docker', 'push', '$IMAGE_PREFIX/client:${GITHUB_SHA}');
  assert.equal(condition(publish.step.if), "github.event_name=='push'");
  assert.ok(scans.every((step) => containers.steps.indexOf(step) < publish.index));
});

test('Production workflows still deploy only a successful CI main push and check out the exact verified SHA', () => {
  const verifiedSha = '${{github.event.workflow_run.head_sha}}';
  for (const [path, id] of [['.github/workflows/deploy-frontend.yml', 'deploy-vercel'], ['.github/workflows/deploy-production.yml', 'deploy-render']]) {
    const deployment = load(read(path));
    assert.deepEqual(deployment.on, { workflow_run: { workflows: ['CI'], types: ['completed'], branches: ['main'] } });
    assert.deepEqual(deployment.permissions, { contents: 'read' });
    assert.equal(deployment.concurrency['cancel-in-progress'], false);
    assert.deepEqual(Object.keys(deployment.jobs), [id]);
    const job = deployment.jobs[id];
    assert.equal(job.environment, 'production');
    assert.deepEqual(sorted(condition(job.if).split('&&')), sorted([
      "github.event.workflow_run.conclusion=='success'",
      "github.event.workflow_run.event=='push'",
      "github.event.workflow_run.head_branch=='main'",
    ]));
    assert.equal(expressions(action(job, 'actions/checkout').with.ref), verifiedSha);
    assert.equal(actions(job, 'actions/download-artifact').length, 0);
    if (id === 'deploy-render') {
      const deploy = command(job, 'node', '.github/scripts/deploy-render.mjs');
      assert.equal(expressions(deploy.step.env.COMMIT_SHA), verifiedSha);
      assert.equal(expressions(deploy.step.env.RENDER_DEPLOY_HOOK_URL), '${{secrets.RENDER_DEPLOY_HOOK_URL}}');
    } else {
      const build = command(job, 'vercel@59.6.2', 'build');
      const deploy = command(job, 'vercel@59.6.2', 'deploy');
      assert.ok(build.words.includes('VITE_API_URL=$api_url'));
      assert.ok(build.words.includes('--prod'));
      assert.ok(deploy.words.includes('--prebuilt') && deploy.words.includes('--prod'));
      assert.ok(build.index < deploy.index);
      assert.deepEqual(sorted(Object.keys(job.env)), ['PRODUCTION_API_URL', 'VERCEL_ORG_ID', 'VERCEL_PROJECT_ID', 'VERCEL_TOKEN']);
    }
  }
});
