import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import {
  LIMITS, EVALUATOR_VERSION, EvaluationError, parseBoundedJson, assertLocalJsonPath,
  readJsonArtifact, validateCatalog, validateOutputs, validateResultBundle,
  validateComparisonPolicy, compareResultBundles, evaluateCase,
  runEvaluation, parseCliArgs, cli,
} from './evaluator.mjs';

const catalogPath = fileURLToPath(new URL('./synthetic-catalog.v1.json', import.meta.url));
const outputsPath = fileURLToPath(new URL('./prerecorded-outputs.v1.json', import.meta.url));
const catalog = validateCatalog((await readJsonArtifact(catalogPath)).data);
const frozen = validateOutputs((await readJsonArtifact(outputsPath)).data, catalog);
const clone = (value) => structuredClone(value);
const issue = (code) => (error) => error instanceof EvaluationError && error.code === code;
const policy = (ordering = 'ordered', absolute = 0, relative = 0) => ({ ordering, numericTolerance: { absolute, relative, rationale: 'Test-only numeric roundoff allowance; no coercion.' } });
const bundle = (type, rows, nullable = false) => ({ columns: [{ name: 'value', type, nullable }], rows });
const item = (id) => catalog.cases.find((entry) => entry.id === id);
const output = (id) => clone(frozen.outputs.find((entry) => entry.caseId === id));

// Only local in-memory fixtures and read-only artifacts. No subprocesses,
// temporary files, DB engines, network calls, dependencies, or providers.
test('bounded JSON accepts bilingual text, arrays, escapes and primitives', () => {
  assert.deepEqual(parseBoundedJson('{"prompt":"Tiếng Việt / English \\"quoted\\"", "values":[null,true,false,1.5,-2e1]}'), { prompt: 'Tiếng Việt / English "quoted"', values: [null, true, false, 1.5, -20] });
  assert.equal(parseBoundedJson(' 42 \n'), 42);
});
test('malformed, non-JSON and non-finite tokens fail closed', () => {
  for (const value of ['', '{', '[1,]', '{"x":1,}', '{"x" 1}', 'undefined', 'NaN', '01', '1e999', 'true false', '"\n"', '(()=>1)()']) assert.throws(() => parseBoundedJson(value), issue('INVALID_JSON'));
});
test('duplicate keys including escaped aliases cannot counterfeit a pass', () => {
  for (const value of ['{"pass":false,"pass":true}', '{"x":1,"\\u0078":2}', '{"a":{"pass":false,"pass":true}}']) assert.throws(() => parseBoundedJson(value), issue('DUPLICATE_JSON_KEY'));
});
test('prototype and constructor artifact keys are refused', () => {
  for (const key of ['__proto__', 'constructor', 'prototype']) assert.throws(() => parseBoundedJson(`{"${key}":{}}`), issue('FORBIDDEN_JSON_KEY'));
});
test('JSON byte, string, depth and node budgets are bounded', () => {
  assert.throws(() => parseBoundedJson(' '.repeat(LIMITS.bytes + 1)), issue('JSON_BYTE_LIMIT'));
  assert.throws(() => parseBoundedJson(JSON.stringify('x'.repeat(LIMITS.string + 1))), issue('JSON_STRING_LIMIT'));
  assert.throws(() => parseBoundedJson('['.repeat(LIMITS.depth + 2) + '0' + ']'.repeat(LIMITS.depth + 2)), issue('JSON_DEPTH_LIMIT'));
  assert.throws(() => parseBoundedJson('[' + Array(LIMITS.nodes).fill('0').join(',') + ']'), issue('JSON_NODE_LIMIT'));
});
test('local safe filenames only; network, traversal and command paths refused', () => {
  assert.equal(typeof assertLocalJsonPath(catalogPath), 'string');
  for (const value of ['https://example.com/output.json', 'file:///tmp/output.json', '//server/share/output.json', '\\\\server\\share\\output.json', '../outputs.json', 'folder/../outputs.json', 'input.json;whoami', 'input.js', 'a/CON.json', 'a/out.json:stream', 'a/$(calc).json']) assert.throws(() => assertLocalJsonPath(value), EvaluationError);
});
test('CLI accepts artifact paths, never exec/eval and never duplicate flags', () => {
  assert.deepEqual(parseCliArgs(['--catalog', catalogPath]), { split: 'dev', mode: 'exact-response', allowHoldout: false, catalogPath });
  for (const args of [[], ['--catalog'], ['--eval', '1+1'], ['--command', 'calc'], ['--catalog', catalogPath, '--catalog', catalogPath], ['--catalog', catalogPath, '--split', 'all'], ['--catalog', catalogPath, '--allow-holdout']]) assert.throws(() => parseCliArgs(args), EvaluationError);
});
test('column names, position, declared type and nullability are exact contracts', () => {
  const expected = { columns: [{ name: 'id', type: 'integer', nullable: false }, { name: 'amount', type: 'number', nullable: true }], rows: [[1, 2]] };
  for (const change of [
    (actual) => actual.columns[0].name = 'other',
    (actual) => actual.columns.reverse(),
    (actual) => actual.columns[1].type = 'integer',
    (actual) => actual.columns[1].nullable = false,
  ]) { const actual = clone(expected); change(actual); assert.equal(compareResultBundles(expected, actual).equal, false); }
});
test('numeric strings, unsafe integers, booleans and row width are not coerced', () => {
  for (const invalid of [bundle('integer', [['1']]), bundle('integer', [[true]]), bundle('integer', [[1.1]]), bundle('integer', [[Number.MAX_SAFE_INTEGER + 1]]), bundle('number', [[Infinity]]), bundle('integer', [[1, 2]])]) assert.throws(() => validateResultBundle(invalid), issue('INVALID_ROW_TYPE_OR_WIDTH'));
  const expected = bundle('number', [[1]]);
  assert.equal(compareResultBundles(expected, bundle('number', [['1']])).equal, false);
});
test('duplicate column names and excessive row counts fail validation', () => {
  const invalid = bundle('integer', [[1]]); invalid.columns.push(clone(invalid.columns[0]));
  assert.throws(() => validateResultBundle(invalid), issue('DUPLICATE_COLUMN'));
  assert.throws(() => validateResultBundle(bundle('integer', Array(LIMITS.rows + 1).fill([1]))), issue('INVALID_ROWS'));
});
test('NULL is not zero or empty; forbidden null differs from empty result', () => {
  assert.equal(compareResultBundles(bundle('number', [[null]], true), bundle('number', [[0]], true)).equal, false);
  assert.equal(compareResultBundles(bundle('string', [[null]], true), bundle('string', [['']], true)).equal, false);
  assert.equal(compareResultBundles(bundle('number', [[null]], true), bundle('number', [], true)).equal, false);
  assert.throws(() => validateResultBundle(bundle('number', [[null]])), issue('INVALID_ROW_TYPE_OR_WIDTH'));
});
test('ordered rows reject reordering; unordered rows preserve duplicate multiplicity', () => {
  const expected = bundle('string', [['A'], ['B'], ['A']]);
  assert.equal(compareResultBundles(expected, bundle('string', [['B'], ['A'], ['A']])).equal, false);
  assert.equal(compareResultBundles(expected, bundle('string', [['B'], ['A'], ['A']]), policy('unordered')).equal, true);
  assert.equal(compareResultBundles(expected, bundle('string', [['A'], ['B'], ['B']]), policy('unordered')).equal, false);
  assert.equal(compareResultBundles(expected, bundle('string', [['A'], ['B']]), policy('unordered')).equal, false);
});
test('numeric tolerance is small, documented and number-column-only', () => {
  const expected = bundle('number', [[6]]);
  assert.equal(compareResultBundles(expected, bundle('number', [[6 + 5e-10]]), policy('ordered', 1e-9, 1e-12)).equal, true);
  assert.equal(compareResultBundles(expected, bundle('number', [[5]]), policy('ordered', 1e-9, 1e-12)).equal, false);
  assert.equal(compareResultBundles(expected, bundle('number', [[6 + 5e-10]])).equal, false);
  assert.equal(compareResultBundles(bundle('integer', [[1]]), bundle('integer', [[2]]), policy('ordered', 1e-6, 1e-9)).equal, false);
  assert.throws(() => validateComparisonPolicy(policy('ordered', 0.5)), issue('UNSAFE_NUMERIC_TOLERANCE'));
  const missingRationale = policy(); missingRationale.numericTolerance.rationale = '';
  assert.throws(() => validateComparisonPolicy(missingRationale), issue('MISSING_TOLERANCE_RATIONALE'));
});
test('unordered numeric tolerance uses non-greedy one-to-one matching', () => {
  // Expected 0 can match either row, expected 2e-7 can match only 1e-7.
  // A greedy matcher fails even though a complete matching exists.
  assert.equal(compareResultBundles(bundle('number', [[0], [2e-7]]), bundle('number', [[1e-7], [-1e-7]]), policy('unordered', 1.1e-7)).equal, true);
});
test('datetime values require valid canonical UTC milliseconds', () => {
  assert.doesNotThrow(() => validateResultBundle(bundle('datetime', [['2025-01-01T00:00:00.000Z']])));
  for (const value of ['2025-01-01T00:00:00-05:00', '2025-02-30T00:00:00.000Z', '2025-01-01', '2025-01-01T00:00:00Z']) assert.throws(() => validateResultBundle(bundle('datetime', [[value]])), issue('INVALID_ROW_TYPE_OR_WIDTH'));
});
test('catalog has 24 distinct declared semantics, no locale duplication, and honest labels', () => {
  assert.equal(catalog.cases.length, 24);
  assert.equal(new Set(catalog.cases.map((entry) => entry.semanticId)).size, 24);
  assert.equal(catalog.reviewStatus, 'AUTHOR_DRAFT_NOT_EXPERT_REVIEWED');
  assert.equal(catalog.evidenceStatus, 'INSUFFICIENT_EVIDENCE');
  assert.deepEqual(catalog.declaredSupportedCohorts, ['sql/en', 'sql/vi', 'mongo/en', 'mongo/vi']);
  assert.deepEqual(['en', 'vi'].map((language) => catalog.cases.filter((entry) => entry.language === language).length), [12, 12]);
  for (const engine of ['sql', 'mongo']) assert.deepEqual(['en', 'vi'].map((language) => catalog.cases.filter((entry) => entry.engine === engine && entry.language === language).length), [6, 6]);
  assert.deepEqual(['dev', 'calibration', 'holdout'].map((split) => catalog.cases.filter((entry) => entry.split === split).length), [12, 6, 6]);
  const duplicate = clone(catalog); duplicate.cases[1].semanticId = duplicate.cases[0].semanticId;
  assert.throws(() => validateCatalog(duplicate), issue('DUPLICATE_CASE_OR_SEMANTIC_ID'));
});
test('unsupported, missing and undeclared case languages fail closed', () => {
  for (const language of ['', 'zh', 'fr', 'VI', null, 42]) {
    const invalid = clone(catalog); invalid.cases[0].language = language;
    assert.throws(() => validateCatalog(invalid), issue('INVALID_CASE_ID_OR_COHORT'));
  }
  const missing = clone(catalog); delete missing.cases[0].language;
  assert.throws(() => validateCatalog(missing), issue('MISSING_FIELD'));
  for (const cohort of ['sql/zh', 'mongo/zh', 'sql/fr', 'mongo/VI']) {
    const invalid = clone(catalog); invalid.declaredSupportedCohorts.push(cohort);
    assert.throws(() => validateCatalog(invalid), issue('INVALID_COHORTS'));
  }
  const undeclared = clone(catalog); undeclared.declaredSupportedCohorts = undeclared.declaredSupportedCohorts.filter((cohort) => cohort !== 'mongo/vi');
  assert.throws(() => validateCatalog(undeclared), issue('INVALID_CASE_ID_OR_COHORT'));
});
test('locale revision synchronizes all author-prerecorded metadata without upgrading evidence', () => {
  assert.equal(EVALUATOR_VERSION, 'a12-local-offline-v2');
  assert.equal(catalog.datasetVersion, 'synthetic-curated-24.en-vi.v2');
  assert.equal(catalog.promptVersion, 'author-fixture-prompts.en-vi.v2');
  assert.equal(catalog.schemaVersion, 'synthetic-commerce.v1');
  assert.equal(frozen.datasetVersion, catalog.datasetVersion);
  assert.equal(frozen.origin, 'AUTHOR_SYNTHETIC_PRERECORDED');
  assert.equal(frozen.outputs.length, 24);
  assert.equal(catalog.responseMetadata.execution, 'NOT_EXECUTED');
  for (const entry of frozen.outputs) assert.deepEqual(entry.response.metadata, catalog.responseMetadata);
});
test('expected schema hallucinations and certified evidence claims are refused', () => {
  const hallucination = clone(catalog); hallucination.cases[0].expected.response.sources.push('orders.phone');
  assert.throws(() => validateCatalog(hallucination), issue('UNGROUNDED_EXPECTED_SOURCE'));
  const certified = clone(catalog); certified.reviewStatus = 'EXPERT_APPROVED';
  assert.throws(() => validateCatalog(certified), issue('UNSUPPORTED_EVIDENCE_CLAIM'));
});
test('artifact duplicate ids, unknown ids, stale versions and producer pass flags are refused', () => {
  const duplicate = clone(frozen); duplicate.outputs.push(clone(duplicate.outputs[0]));
  assert.throws(() => validateOutputs(duplicate, catalog), issue('DUPLICATE_OUTPUT_CASE'));
  const unknown = clone(frozen); unknown.outputs[0].caseId = 'invented-case';
  assert.throws(() => validateOutputs(unknown, catalog), issue('UNKNOWN_OUTPUT_CASE'));
  const stale = clone(frozen); stale.datasetVersion = 'synthetic-curated-24.v1';
  assert.throws(() => validateOutputs(stale, catalog), issue('OUTPUT_VERSION_MISMATCH'));
  const pass = clone(frozen); pass.outputs[0].pass = true;
  assert.throws(() => validateOutputs(pass, catalog), issue('UNEXPECTED_FIELD'));
});
test('frozen default development fixture run is 8 pass, 4 abstain, never executed', async () => {
  const report = await runEvaluation({ catalogPath, outputsPath });
  assert.deepEqual(report.totals, { total: 12, pass: 8, fail: 0, abstain: 4, unevaluated: 0, 'not-executed': 12 });
  assert.equal(report.evaluatorVersion, EVALUATOR_VERSION);
  assert.equal(report.datasetVersion, 'synthetic-curated-24.en-vi.v2');
  assert.equal(report.promptVersion, 'author-fixture-prompts.en-vi.v2');
  assert.deepEqual(report.cohorts.map((entry) => entry.cohort), ['sql/en', 'sql/vi', 'mongo/en', 'mongo/vi']);
  assert.equal(report.fixtureChecksSucceeded, true);
  assert.equal(report.split, 'dev');
  assert.equal(report.caseResults.some((entry) => entry.split === 'holdout'), false);
  for (const cohort of report.cohorts) assert.deepEqual(cohort, { cohort: cohort.cohort, total: 3, pass: 2, fail: 0, abstain: 1, unevaluated: 0, 'not-executed': 3 });
});
test('calibration selects only six cases without holdout tuning exposure', async () => {
  const report = await runEvaluation({ catalogPath, outputsPath, split: 'calibration' });
  assert.equal(report.totals.total, 6); assert.equal(report.totals.pass, 6);
  assert.equal(report.caseResults.every((entry) => entry.split === 'calibration'), true);
});
test('holdout evaluation requires explicit opt-in and never claims blindness', async () => {
  await assert.rejects(runEvaluation({ catalogPath, outputsPath, split: 'holdout' }), issue('HOLDOUT_REQUIRES_EXPLICIT_OPT_IN'));
  const report = await runEvaluation({ catalogPath, outputsPath, split: 'holdout', allowHoldout: true });
  assert.deepEqual(report.totals, { total: 6, pass: 5, fail: 0, abstain: 1, unevaluated: 0, 'not-executed': 6 });
  assert.equal(report.holdoutPolicy.blind, false); assert.equal(report.holdoutPolicy.tuningPermitted, false);
});
test('missing outputs are unevaluated/not-executed and a non-success exit, not pass', async () => {
  const report = await runEvaluation({ catalogPath });
  assert.deepEqual(report.totals, { total: 12, pass: 0, fail: 0, abstain: 0, unevaluated: 12, 'not-executed': 12 });
  assert.equal(report.fixtureChecksSucceeded, false); assert.equal(report.complete, false);
  assert.equal(await cli(['--catalog', catalogPath], () => {}), 1);
});
test('missing result bundle cannot pass; partial and empty output artifacts are validly incomplete', () => {
  const incomplete = output('sql-null-note'); incomplete.result = null;
  assert.equal(evaluateCase(item(incomplete.caseId), incomplete, catalog).outcome, 'unevaluated');
  const sparse = clone(frozen); sparse.outputs = []; assert.doesNotThrow(() => validateOutputs(sparse, catalog));
  assert.equal(evaluateCase(item('sql-null-note'), undefined, catalog).outcome, 'unevaluated');
});
test('counterfeit producer pass cannot hide wrong rows or an unexpected field', () => {
  const bad = output('sql-null-note'); bad.result.rows = [[999]];
  assert.equal(evaluateCase(item(bad.caseId), bad, catalog).outcome, 'fail');
  bad.pass = true;
  assert.deepEqual(evaluateCase(item(bad.caseId), bad, catalog).reasons, ['UNEXPECTED_FIELD']);
});
test('sources and metadata are checked, not trusted evidence', () => {
  const badSources = output('sql-null-note'); badSources.response.sources.push('orders.phone');
  assert.equal(evaluateCase(item(badSources.caseId), badSources, catalog).outcome, 'fail');
  assert.ok(evaluateCase(item(badSources.caseId), badSources, catalog).reasons.includes('UNGROUNDED_SOURCE'));
  const badMetadata = output('sql-null-note'); badMetadata.response.metadata.execution = 'EXECUTED';
  assert.ok(evaluateCase(item(badMetadata.caseId), badMetadata, catalog).reasons.includes('METADATA_CONTRACT_MISMATCH'));
  const reordered = output('sql-null-note'); reordered.response.sources.reverse();
  assert.equal(evaluateCase(item(reordered.caseId), reordered, catalog).outcome, 'pass');
});
test('unexpected abstention fails; expected abstention has a separate outcome', () => {
  const id = 'sql-null-note'; const abstention = output(id);
  abstention.response = { ...abstention.response, kind: 'abstain', query: null, sources: [], reasonCode: 'MISSING_SCHEMA_FIELD' }; abstention.result = null;
  assert.equal(evaluateCase(item(id), abstention, catalog).outcome, 'fail');
  assert.equal(evaluateCase(item('sql-missing-phone'), output('sql-missing-phone'), catalog).outcome, 'abstain');
  const wrongReason = output('sql-missing-phone'); wrongReason.response.reasonCode = 'MISSING_TIME_CONTEXT';
  assert.equal(evaluateCase(item(wrongReason.caseId), wrongReason, catalog).outcome, 'fail');
});
test('exact SQL fixtures are not semantic accuracy; bundle mode marks query as unevaluated', () => {
  const changed = output('sql-null-note'); changed.response.query = 'SELECT id FROM orders WHERE note IS NULL ORDER BY id';
  assert.equal(evaluateCase(item(changed.caseId), changed, catalog).outcome, 'fail');
  const result = evaluateCase(item(changed.caseId), changed, catalog, 'result-bundle');
  assert.equal(result.outcome, 'pass');
  assert.equal(result.queryAssessment, 'NOT_EVALUATED_IN_RESULT_BUNDLE_MODE');
  assert.equal(result.execution, 'not-executed');
});
test('Mongo compound sort field order remains semantically significant in exact fixtures', () => {
  const changed = output('mongo-compound-sort-limit'); changed.response.query.pipeline[0].$sort = { id: -1, region: 1 };
  assert.ok(evaluateCase(item(changed.caseId), changed, catalog).reasons.includes('QUERY_FIXTURE_MISMATCH'));
});
test('unsupported Mongo write stages are rejected without any execution', () => {
  const changed = output('mongo-region-sum'); changed.response.query.pipeline.push({ $out: 'persisted' });
  assert.throws(() => validateOutputs({ ...frozen, outputs: [changed] }, catalog), issue('UNSUPPORTED_MONGO_STAGE'));
});
test('hand-derived fixture conditions agree with the tiny local source records', () => {
  // Basic JS arithmetic/checks, NOT SQL/Mongo execution or an independent oracle.
  const orders = catalog.sourceFixtures.sql.orders;
  assert.deepEqual(orders.filter((row) => row.note === null).map((row) => [row.id]), item('sql-null-note').expected.result.rows);
  const amounts = orders.filter((row) => row.amount !== null).map((row) => row.amount);
  assert.equal(amounts.reduce((sum, value) => sum + value, 0) / amounts.length, 6);
  const invoices = catalog.sourceFixtures.mongo.invoices;
  assert.deepEqual(invoices.filter((row) => !Object.hasOwn(row, 'label') || row.label === null).map((row) => [row.id]), item('mongo-null-or-missing').expected.result.rows);
  assert.equal(invoices.flatMap((row) => row.tags).filter((tag) => tag === 'red').length, 4);
  assert.deepEqual(orders.filter((row) => row.created_at >= '2024-12-31T05:00:00.000Z' && row.created_at < '2025-01-01T05:00:00.000Z').map((row) => [row.id]), item('sql-new-york-day').expected.result.rows);
});
test('hash metadata is reproducible and measures only local evaluator runtime', async () => {
  const first = await runEvaluation({ catalogPath, outputsPath });
  const second = await runEvaluation({ catalogPath, outputsPath });
  assert.equal(first.tree.sha256, second.tree.sha256);
  assert.match(first.artifacts.catalog.sha256, /^[a-f0-9]{64}$/);
  const digest = createHash('sha256').update(first.tree.entries.map((entry) => `${entry.role}\0${entry.sha256}\n`).join('')).digest('hex');
  assert.equal(first.tree.sha256, digest);
  assert.equal(first.usageCoverage.status, 'UNAVAILABLE'); assert.equal(first.usageCoverage.cost, null); assert.equal(first.usageCoverage.tokens, null);
  assert.equal(first.providerLatencyMs, null); assert.equal(first.databaseExecution, 'NOT_EXECUTED');
  assert.equal(first.qualityThresholds.releaseGateEnforced, false);
  assert.equal(Number.isFinite(first.localEvaluatorRuntimeMs) && first.localEvaluatorRuntimeMs >= 0, true);
  assert.deepEqual(await readJsonArtifact(outputsPath), await readJsonArtifact(outputsPath));
});
test('CLI returns match/incomplete/invalid codes and redacts paths and payloads', async () => {
  let written = '';
  const write = (value) => { written += value; };
  assert.equal(await cli(['--catalog', catalogPath, '--outputs', outputsPath], write), 0);
  assert.equal(written.includes(catalogPath), false); assert.equal(written.includes('SELECT '), false);
  written = '';
  assert.equal(await cli(['--catalog', catalogPath, '--outputs', fileURLToPath(new URL('./missing-secret-token.json', import.meta.url))], write), 2);
  assert.equal(written.includes('secret-token'), false); assert.equal(JSON.parse(written).error.code, 'ARTIFACT_READ_FAILED');
  written = '';
  assert.equal(await cli(['--catalog', catalogPath, '--outputs', 'https://secret.example/key.json'], write), 2);
  assert.equal(written.includes('secret.example'), false);
  written = ''; assert.equal(await cli(['--help'], write), 0); assert.ok(written.includes('No artifact writes'));
});
