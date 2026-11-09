#!/usr/bin/env node
// Isolated, dependency-free fixture evaluator. Nothing here executes SQL, Mongo,
// JavaScript from artifacts, provider calls, or database calls.
import { lstat, open, realpath } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';

export const EVALUATOR_VERSION = 'a12-local-offline-v2';
export const LIMITS = Object.freeze({ bytes: 2 * 1024 * 1024, depth: 24, nodes: 50000, string: 16000, cases: 1000, rows: 200, columns: 32 });
const TYPES = new Set(['integer', 'number', 'string', 'boolean', 'datetime']);
const SPLITS = new Set(['dev', 'calibration', 'holdout']);
const MODES = new Set(['exact-response', 'result-bundle']);
const SAFE_ID = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/;
const FIELD = /^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/;
const SOURCE = /^[a-zA-Z_][a-zA-Z0-9_]*\.[a-zA-Z_][a-zA-Z0-9_]*$/;
const REASONS = new Set(['MISSING_SCHEMA_FIELD', 'UNSUPPORTED_OPERATION', 'MISSING_TIME_CONTEXT']);
const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const MONGO_STAGES = new Set(['$match', '$project', '$sort', '$group', '$limit', '$unwind', '$count', '$addFields', '$lookup']);
const DEFAULT_POLICY = Object.freeze({ ordering: 'ordered', numericTolerance: { absolute: 0, relative: 0, rationale: 'Exact by default; no numeric, string, identifier, or null coercion.' } });

export class EvaluationError extends Error {
  constructor(code) { super(code); this.name = 'EvaluationError'; this.code = code; }
}
function requireCondition(condition, code) { if (!condition) throw new EvaluationError(code); }
function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype; }
function fields(value, required, optional = []) {
  requireCondition(object(value), 'INVALID_OBJECT');
  requireCondition(required.every((key) => Object.hasOwn(value, key)), 'MISSING_FIELD');
  requireCondition(Object.keys(value).every((key) => required.includes(key) || optional.includes(key)), 'UNEXPECTED_FIELD');
}
function text(value, max = LIMITS.string) { return typeof value === 'string' && value.length > 0 && value.length <= max; }
function id(value) { return typeof value === 'string' && SAFE_ID.test(value); }
function unique(values) { return new Set(values).size === values.length; }
function sha256(value) { return createHash('sha256').update(value).digest('hex'); }

// Scan before JSON.parse: limits and duplicate/dangerous object keys are checked
// without a reviver silently accepting the last of two contradictory values.
export function parseBoundedJson(input) {
  requireCondition(typeof input === 'string', 'INVALID_JSON_INPUT');
  requireCondition(Buffer.byteLength(input, 'utf8') <= LIMITS.bytes, 'JSON_BYTE_LIMIT');
  let position = 0;
  let nodes = 0;
  function whitespace() { while (position < input.length && /[\t\n\r ]/.test(input[position])) position++; }
  function stringToken() {
    const start = position++;
    let closed = false;
    while (position < input.length) {
      const character = input[position++];
      if (character === '\\') { position++; continue; }
      if (character === '"') { closed = true; break; }
    }
    requireCondition(closed, 'INVALID_JSON');
    let value;
    try { value = JSON.parse(input.slice(start, position)); } catch { throw new EvaluationError('INVALID_JSON'); }
    requireCondition(value.length <= LIMITS.string, 'JSON_STRING_LIMIT');
    return value;
  }
  function visit(depth) {
    requireCondition(depth <= LIMITS.depth, 'JSON_DEPTH_LIMIT');
    requireCondition(++nodes <= LIMITS.nodes, 'JSON_NODE_LIMIT');
    whitespace();
    const character = input[position];
    if (character === '{') {
      position++; whitespace();
      const keys = new Set();
      if (input[position] === '}') { position++; return; }
      while (position < input.length) {
        requireCondition(input[position] === '"', 'INVALID_JSON');
        const key = stringToken();
        requireCondition(!FORBIDDEN_KEYS.has(key), 'FORBIDDEN_JSON_KEY');
        requireCondition(!keys.has(key), 'DUPLICATE_JSON_KEY');
        keys.add(key); whitespace();
        requireCondition(input[position++] === ':', 'INVALID_JSON');
        visit(depth + 1); whitespace();
        if (input[position] === '}') { position++; return; }
        requireCondition(input[position++] === ',', 'INVALID_JSON'); whitespace();
      }
      throw new EvaluationError('INVALID_JSON');
    }
    if (character === '[') {
      position++; whitespace();
      if (input[position] === ']') { position++; return; }
      while (position < input.length) {
        visit(depth + 1); whitespace();
        if (input[position] === ']') { position++; return; }
        requireCondition(input[position++] === ',', 'INVALID_JSON');
      }
      throw new EvaluationError('INVALID_JSON');
    }
    if (character === '"') { stringToken(); return; }
    for (const literal of ['true', 'false', 'null']) {
      if (input.startsWith(literal, position)) { position += literal.length; return; }
    }
    const number = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(input.slice(position));
    requireCondition(number !== null && Number.isFinite(Number(number[0])), 'INVALID_JSON');
    position += number[0].length;
  }
  visit(0); whitespace();
  requireCondition(position === input.length, 'INVALID_JSON');
  try { return JSON.parse(input); } catch { throw new EvaluationError('INVALID_JSON'); }
}

export function assertLocalJsonPath(value) {
  requireCondition(text(value, 4096), 'INVALID_ARTIFACT_PATH');
  requireCondition(!/^(?:\\\\|\/\/)/.test(value), 'NETWORK_PATH_REFUSED');
  const drive = /^[a-zA-Z]:[\\/]/.test(value);
  requireCondition(!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value) || drive, 'URL_OR_SCHEME_REFUSED');
  const remainder = drive ? value.slice(2) : value;
  requireCondition(!/[<>:"|?*\u0000-\u001f]/.test(remainder), 'INVALID_ARTIFACT_PATH');
  const segments = value.replace(/\\/g, '/').split('/');
  requireCondition(!segments.includes('..'), 'PATH_TRAVERSAL_REFUSED');
  const name = segments.at(-1);
  requireCondition(typeof name === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]*\.json$/i.test(name), 'UNSAFE_ARTIFACT_FILENAME');
  requireCondition(!/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name), 'UNSAFE_ARTIFACT_FILENAME');
  return resolve(value);
}

async function readBoundedBytes(filePath, jsonPath = true) {
  const requested = jsonPath ? assertLocalJsonPath(filePath) : filePath;
  let handle;
  try {
    const before = await lstat(requested);
    requireCondition(before.isFile() && !before.isSymbolicLink(), 'ARTIFACT_NOT_REGULAR_FILE');
    const canonical = await realpath(requested);
    if (jsonPath) assertLocalJsonPath(canonical);
    handle = await open(canonical, 'r');
    const stat = await handle.stat();
    requireCondition(stat.isFile(), 'ARTIFACT_NOT_REGULAR_FILE');
    requireCondition(stat.size <= LIMITS.bytes, 'JSON_BYTE_LIMIT');
    // Bounded even if a file grows after stat; never readFile an unbounded input.
    const buffer = Buffer.alloc(LIMITS.bytes + 1);
    let used = 0;
    while (used < buffer.length) {
      const { bytesRead } = await handle.read(buffer, used, buffer.length - used, null);
      if (bytesRead === 0) break;
      used += bytesRead;
    }
    requireCondition(used <= LIMITS.bytes, 'JSON_BYTE_LIMIT');
    return buffer.subarray(0, used);
  } catch (error) {
    if (error instanceof EvaluationError) throw error;
    throw new EvaluationError('ARTIFACT_READ_FAILED'); // Never leak an OS message/path.
  } finally { if (handle) await handle.close(); }
}
export async function readJsonArtifact(filePath) {
  const bytes = await readBoundedBytes(filePath);
  let decoded;
  try { decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { throw new EvaluationError('INVALID_UTF8'); }
  return { data: parseBoundedJson(decoded), metadata: { bytes: bytes.length, sha256: sha256(bytes) } };
}

export function validateComparisonPolicy(policy = DEFAULT_POLICY) {
  fields(policy, ['ordering', 'numericTolerance']);
  requireCondition(['ordered', 'unordered'].includes(policy.ordering), 'INVALID_ORDERING');
  fields(policy.numericTolerance, ['absolute', 'relative', 'rationale']);
  const { absolute, relative, rationale } = policy.numericTolerance;
  // Small caps are comparator safety bounds, NOT proposed product quality gates.
  requireCondition(typeof absolute === 'number' && Number.isFinite(absolute) && absolute >= 0 && absolute <= 1e-6, 'UNSAFE_NUMERIC_TOLERANCE');
  requireCondition(typeof relative === 'number' && Number.isFinite(relative) && relative >= 0 && relative <= 1e-9, 'UNSAFE_NUMERIC_TOLERANCE');
  requireCondition(text(rationale, 1000), 'MISSING_TOLERANCE_RATIONALE');
  return policy;
}
function cellValid(value, column) {
  if (value === null) return column.nullable;
  if (column.type === 'integer') return Number.isSafeInteger(value);
  if (column.type === 'number') return typeof value === 'number' && Number.isFinite(value) && (!Number.isInteger(value) || Number.isSafeInteger(value));
  if (column.type === 'string') return typeof value === 'string' && value.length <= LIMITS.string;
  if (column.type === 'boolean') return typeof value === 'boolean';
  if (column.type === 'datetime') {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
  }
  return false;
}
export function validateResultBundle(bundle) {
  fields(bundle, ['columns', 'rows']);
  requireCondition(Array.isArray(bundle.columns) && bundle.columns.length > 0 && bundle.columns.length <= LIMITS.columns, 'INVALID_COLUMNS');
  for (const column of bundle.columns) {
    fields(column, ['name', 'type', 'nullable']);
    requireCondition(typeof column.name === 'string' && FIELD.test(column.name) && TYPES.has(column.type) && typeof column.nullable === 'boolean', 'INVALID_COLUMN');
  }
  requireCondition(unique(bundle.columns.map((column) => column.name)), 'DUPLICATE_COLUMN');
  requireCondition(Array.isArray(bundle.rows) && bundle.rows.length <= LIMITS.rows, 'INVALID_ROWS');
  for (const row of bundle.rows) {
    requireCondition(Array.isArray(row) && row.length === bundle.columns.length && row.every((value, index) => cellValid(value, bundle.columns[index])), 'INVALID_ROW_TYPE_OR_WIDTH');
  }
  return bundle;
}
function sameJson(left, right) {
  if (left === right) return true;
  if (Array.isArray(left) && Array.isArray(right)) return left.length === right.length && left.every((value, index) => sameJson(value, right[index]));
  if (object(left) && object(right)) {
    const keys = Object.keys(left);
    return keys.length === Object.keys(right).length && keys.every((key) => Object.hasOwn(right, key) && sameJson(left[key], right[key]));
  }
  return false;
}

export function compareResultBundles(expected, actual, policy = DEFAULT_POLICY) {
  validateComparisonPolicy(policy);
  try { validateResultBundle(expected); } catch { throw new EvaluationError('INVALID_EXPECTED_RESULT'); }
  try { validateResultBundle(actual); } catch (error) { return { equal: false, issues: [{ code: error instanceof EvaluationError ? error.code : 'INVALID_ACTUAL_RESULT' }] }; }
  if (!sameJson(expected.columns, actual.columns)) return { equal: false, issues: [{ code: 'COLUMN_CONTRACT_MISMATCH' }] };
  if (expected.rows.length !== actual.rows.length) return { equal: false, issues: [{ code: 'ROW_COUNT_MISMATCH' }] };
  function rowsEqual(left, right) {
    return left.every((value, index) => {
      const other = right[index];
      if (value === other) return true;
      if (expected.columns[index].type !== 'number' || value === null || other === null) return false;
      const { absolute, relative } = policy.numericTolerance;
      return Math.abs(value - other) <= absolute + relative * Math.max(Math.abs(value), Math.abs(other));
    });
  }
  if (policy.ordering === 'ordered') {
    const row = expected.rows.findIndex((values, index) => !rowsEqual(values, actual.rows[index]));
    return row === -1 ? { equal: true, issues: [] } : { equal: false, issues: [{ code: 'ORDERED_ROW_MISMATCH', row }] };
  }
  // One-to-one bipartite matching preserves duplicate multiplicities. Greedy
  // matching is incorrect when tolerance creates overlapping candidate sets.
  const candidates = expected.rows.map((row) => actual.rows.flatMap((other, index) => rowsEqual(row, other) ? [index] : []));
  const owner = Array(actual.rows.length).fill(-1);
  function augment(expectedIndex, seen) {
    for (const actualIndex of candidates[expectedIndex]) {
      if (seen[actualIndex]) continue;
      seen[actualIndex] = true;
      if (owner[actualIndex] === -1 || augment(owner[actualIndex], seen)) { owner[actualIndex] = expectedIndex; return true; }
    }
    return false;
  }
  const equal = expected.rows.every((_, index) => augment(index, Array(actual.rows.length).fill(false)));
  return { equal, issues: equal ? [] : [{ code: 'ROW_MULTISET_MISMATCH' }] };
}

function validateResponse(response, engine, includeMetadata) {
  fields(response, ['kind', 'query', 'sources', 'reasonCode', ...(includeMetadata ? ['metadata'] : [])]);
  requireCondition(['answer', 'abstain'].includes(response.kind), 'INVALID_RESPONSE_KIND');
  requireCondition(Array.isArray(response.sources) && response.sources.length <= 64 && response.sources.every((source) => typeof source === 'string' && SOURCE.test(source)) && unique(response.sources), 'INVALID_SOURCES');
  if (response.kind === 'abstain') {
    requireCondition(response.query === null && response.sources.length === 0 && REASONS.has(response.reasonCode), 'INVALID_ABSTENTION');
  } else {
    requireCondition(response.reasonCode === null, 'INVALID_ANSWER_REASON');
    if (engine === 'sql') {
      requireCondition(text(response.query) && /^SELECT\b/i.test(response.query), 'INVALID_SQL_FIXTURE_QUERY');
      // This is only an envelope constraint, not a SQL parser/security guarantee.
    } else {
      fields(response.query, ['collection', 'pipeline']);
      requireCondition(typeof response.query.collection === 'string' && FIELD.test(response.query.collection), 'INVALID_COLLECTION');
      requireCondition(Array.isArray(response.query.pipeline) && response.query.pipeline.length > 0 && response.query.pipeline.length <= 50, 'INVALID_PIPELINE');
      for (const stage of response.query.pipeline) {
        requireCondition(object(stage) && Object.keys(stage).length === 1 && MONGO_STAGES.has(Object.keys(stage)[0]), 'UNSUPPORTED_MONGO_STAGE');
      }
    }
  }
  if (includeMetadata) {
    fields(response.metadata, ['datasetVersion', 'schemaVersion', 'promptVersion', 'execution']);
    requireCondition(Object.values(response.metadata).every((value) => text(value, 80)), 'INVALID_RESPONSE_METADATA');
  }
}
function grounded(source, engine, catalog) {
  const [entity, field] = source.split('.');
  return Object.hasOwn(catalog.schema[engine].entities, entity) && Object.hasOwn(catalog.schema[engine].entities[entity], field);
}

export function validateCatalog(catalog) {
  fields(catalog, ['formatVersion', 'datasetVersion', 'schemaVersion', 'promptVersion', 'reviewStatus', 'evidenceStatus', 'declaredSupportedCohorts', 'splitPolicy', 'responseMetadata', 'numericPolicy', 'schema', 'sourceFixtures', 'cases']);
  requireCondition(catalog.formatVersion === 1 && [catalog.datasetVersion, catalog.schemaVersion, catalog.promptVersion].every(id), 'INVALID_CATALOG_VERSION');
  requireCondition(catalog.reviewStatus === 'AUTHOR_DRAFT_NOT_EXPERT_REVIEWED' && catalog.evidenceStatus === 'INSUFFICIENT_EVIDENCE', 'UNSUPPORTED_EVIDENCE_CLAIM');
  requireCondition(Array.isArray(catalog.declaredSupportedCohorts) && catalog.declaredSupportedCohorts.length > 0 && catalog.declaredSupportedCohorts.every((value) => /^(sql|mongo)\/(en|vi)$/.test(value)) && unique(catalog.declaredSupportedCohorts), 'INVALID_COHORTS');
  fields(catalog.splitPolicy, ['default', 'holdoutUse', 'blind']);
  requireCondition(catalog.splitPolicy.default === 'dev' && catalog.splitPolicy.holdoutUse === 'EXPLICIT_EVALUATION_ONLY_NO_TUNING' && catalog.splitPolicy.blind === false, 'INVALID_SPLIT_POLICY');
  fields(catalog.responseMetadata, ['datasetVersion', 'schemaVersion', 'promptVersion', 'execution']);
  requireCondition(['datasetVersion', 'schemaVersion', 'promptVersion'].every((key) => catalog.responseMetadata[key] === catalog[key]) && catalog.responseMetadata.execution === 'NOT_EXECUTED', 'INVALID_METADATA_CONTRACT');
  fields(catalog.numericPolicy, ['absolute', 'relative', 'rationale']);
  validateComparisonPolicy({ ordering: 'ordered', numericTolerance: catalog.numericPolicy });
  fields(catalog.schema, ['sql', 'mongo']);
  fields(catalog.sourceFixtures, ['sql', 'mongo']);
  for (const engine of ['sql', 'mongo']) {
    fields(catalog.schema[engine], ['dialect', 'entities']);
    requireCondition(text(catalog.schema[engine].dialect, 200) && object(catalog.schema[engine].entities) && Object.keys(catalog.schema[engine].entities).length > 0, 'INVALID_SCHEMA');
    for (const [entity, definitions] of Object.entries(catalog.schema[engine].entities)) {
      requireCondition(FIELD.test(entity) && object(definitions) && Object.keys(definitions).length > 0 && Object.entries(definitions).every(([field, definition]) => FIELD.test(field) && text(definition, 80)), 'INVALID_SCHEMA_ENTITY');
    }
    requireCondition(object(catalog.sourceFixtures[engine]), 'INVALID_SOURCE_FIXTURES');
    for (const [entity, rows] of Object.entries(catalog.sourceFixtures[engine])) {
      requireCondition(Object.hasOwn(catalog.schema[engine].entities, entity) && Array.isArray(rows) && rows.length <= LIMITS.rows && rows.every((row) => object(row) && Object.keys(row).every((field) => Object.hasOwn(catalog.schema[engine].entities[entity], field))), 'UNGROUNDED_SOURCE_FIXTURE');
    }
  }
  requireCondition(Array.isArray(catalog.cases) && catalog.cases.length > 0 && catalog.cases.length <= LIMITS.cases, 'INVALID_CASES');
  requireCondition(unique(catalog.cases.map((item) => item?.id)) && unique(catalog.cases.map((item) => item?.semanticId)), 'DUPLICATE_CASE_OR_SEMANTIC_ID');
  for (const item of catalog.cases) {
    fields(item, ['id', 'semanticId', 'engine', 'language', 'split', 'prompt', 'conditions', 'expected'], ['comparison']);
    requireCondition(id(item.id) && id(item.semanticId) && ['sql', 'mongo'].includes(item.engine) && ['en', 'vi'].includes(item.language) && SPLITS.has(item.split) && catalog.declaredSupportedCohorts.includes(`${item.engine}/${item.language}`), 'INVALID_CASE_ID_OR_COHORT');
    requireCondition(text(item.prompt) && Array.isArray(item.conditions) && item.conditions.length > 0 && item.conditions.every((condition) => text(condition, 1000)), 'MISSING_EXPECTED_CONDITIONS');
    fields(item.expected, ['response', 'result']);
    validateResponse(item.expected.response, item.engine, false);
    requireCondition(item.expected.response.sources.every((source) => grounded(source, item.engine, catalog)), 'UNGROUNDED_EXPECTED_SOURCE');
    if (item.engine === 'mongo' && item.expected.response.kind === 'answer') requireCondition(Object.hasOwn(catalog.schema.mongo.entities, item.expected.response.query.collection), 'UNGROUNDED_EXPECTED_COLLECTION');
    if (item.expected.response.kind === 'answer') validateResultBundle(item.expected.result);
    else requireCondition(item.expected.result === null, 'ABSTENTION_HAS_RESULT');
    if (item.comparison) validateComparisonPolicy(item.comparison);
  }
  return catalog;
}
export function validateOutputs(artifact, catalog) {
  fields(artifact, ['formatVersion', 'datasetVersion', 'origin', 'outputs']);
  requireCondition(artifact.formatVersion === 1 && artifact.datasetVersion === catalog.datasetVersion, 'OUTPUT_VERSION_MISMATCH');
  requireCondition(['AUTHOR_SYNTHETIC_PRERECORDED', 'USER_SUPPLIED_UNVERIFIED'].includes(artifact.origin), 'UNSUPPORTED_OUTPUT_ORIGIN');
  requireCondition(Array.isArray(artifact.outputs) && artifact.outputs.length <= LIMITS.cases, 'INVALID_OUTPUTS');
  const cases = new Map(catalog.cases.map((item) => [item.id, item]));
  const seen = new Set();
  for (const output of artifact.outputs) {
    fields(output, ['caseId', 'response', 'result']);
    requireCondition(id(output.caseId) && cases.has(output.caseId), 'UNKNOWN_OUTPUT_CASE');
    requireCondition(!seen.has(output.caseId), 'DUPLICATE_OUTPUT_CASE'); seen.add(output.caseId);
    validateResponse(output.response, cases.get(output.caseId).engine, true);
    // Invalid result values become per-case failures, not trusted producer scores.
  }
  return artifact;
}

function queryFixtureEqual(expected, actual, engine) {
  if (!sameJson(expected, actual)) return false;
  if (engine !== 'mongo' || expected === null) return true;
  // JSON object key order is normally irrelevant, but Mongo compound $sort
  // key order changes its precedence and must remain part of an exact fixture.
  return expected.pipeline.every((stage, index) => !Object.hasOwn(stage, '$sort') ||
    (object(stage.$sort) && object(actual.pipeline[index].$sort) && sameJson(Object.keys(stage.$sort), Object.keys(actual.pipeline[index].$sort))));
}
export function evaluateCase(item, output, catalog, mode = 'exact-response') {
  requireCondition(MODES.has(mode), 'INVALID_MODE');
  const base = { caseId: item.id, cohort: `${item.engine}/${item.language}`, split: item.split, execution: 'not-executed', queryAssessment: mode === 'exact-response' ? 'EXACT_FIXTURE_ONLY' : 'NOT_EVALUATED_IN_RESULT_BUNDLE_MODE' };
  if (!output) return { ...base, outcome: 'unevaluated', reasons: ['MISSING_OUTPUT'], resultAssessment: 'NOT_EVALUATED' };
  try {
    fields(output, ['caseId', 'response', 'result']);
    requireCondition(output.caseId === item.id, 'OUTPUT_CASE_MISMATCH');
    validateResponse(output.response, item.engine, true);
  } catch (error) {
    return { ...base, outcome: 'fail', reasons: [error instanceof EvaluationError ? error.code : 'INVALID_OUTPUT'], resultAssessment: 'NOT_EVALUATED' };
  }
  const expected = item.expected.response;
  const actual = output.response;
  const reasons = [];
  if (!sameJson(actual.metadata, catalog.responseMetadata)) reasons.push('METADATA_CONTRACT_MISMATCH');
  if (!actual.sources.every((source) => grounded(source, item.engine, catalog))) reasons.push('UNGROUNDED_SOURCE');
  if (!sameJson([...actual.sources].sort(), [...expected.sources].sort())) reasons.push('SOURCES_CONTRACT_MISMATCH');
  if (item.engine === 'mongo' && actual.kind === 'answer' && !Object.hasOwn(catalog.schema.mongo.entities, actual.query.collection)) reasons.push('UNGROUNDED_COLLECTION');
  if (actual.kind !== expected.kind) reasons.push(actual.kind === 'abstain' ? 'UNEXPECTED_ABSTENTION' : 'EXPECTED_ABSTENTION');
  if (actual.reasonCode !== expected.reasonCode) reasons.push('REASON_CODE_MISMATCH');
  if (mode === 'exact-response' && !queryFixtureEqual(expected.query, actual.query, item.engine)) reasons.push('QUERY_FIXTURE_MISMATCH');
  if (expected.kind === 'abstain') {
    if (output.result !== null) reasons.push('ABSTENTION_HAS_RESULT');
    return { ...base, outcome: reasons.length ? 'fail' : 'abstain', reasons, resultAssessment: 'NOT_APPLICABLE_EXPECTED_ABSTENTION' };
  }
  if (output.result === null) {
    return { ...base, outcome: reasons.length ? 'fail' : 'unevaluated', reasons: [...reasons, 'MISSING_RESULT_BUNDLE'], resultAssessment: 'NOT_EVALUATED' };
  }
  const policy = item.comparison ?? { ordering: 'ordered', numericTolerance: catalog.numericPolicy };
  const result = compareResultBundles(item.expected.result, output.result, policy);
  reasons.push(...result.issues.map((issue) => issue.code));
  return { ...base, outcome: reasons.length ? 'fail' : 'pass', reasons, resultAssessment: result.equal ? 'PROVIDED_FIXTURE_BUNDLES_MATCH' : 'PROVIDED_FIXTURE_BUNDLES_DIFFER' };
}
function counts() { return { total: 0, pass: 0, fail: 0, abstain: 0, unevaluated: 0, 'not-executed': 0 }; }
function addCount(bucket, item) { bucket.total++; bucket[item.outcome]++; bucket['not-executed']++; }

export async function runEvaluation({ catalogPath, outputsPath, split = 'dev', allowHoldout = false, mode = 'exact-response' }) {
  const started = performance.now();
  requireCondition(SPLITS.has(split) && MODES.has(mode), 'INVALID_SPLIT_OR_MODE');
  requireCondition(split !== 'holdout' || allowHoldout === true, 'HOLDOUT_REQUIRES_EXPLICIT_OPT_IN');
  const catalogArtifact = await readJsonArtifact(catalogPath);
  const catalog = validateCatalog(catalogArtifact.data);
  const outputArtifact = outputsPath === undefined ? null : await readJsonArtifact(outputsPath);
  const outputs = outputArtifact ? validateOutputs(outputArtifact.data, catalog) : null;
  const selected = catalog.cases.filter((item) => item.split === split);
  requireCondition(selected.length > 0, 'EMPTY_SELECTED_SPLIT');
  const byId = new Map((outputs?.outputs ?? []).map((output) => [output.caseId, output]));
  const caseResults = selected.map((item) => evaluateCase(item, byId.get(item.id), catalog, mode));
  const total = counts();
  const cohortCounts = new Map(catalog.declaredSupportedCohorts.map((cohort) => [cohort, { cohort, ...counts() }]));
  for (const item of caseResults) { addCount(total, item); addCount(cohortCounts.get(item.cohort), item); }
  const code = await readBoundedBytes(fileURLToPath(import.meta.url), false);
  const entries = [{ role: 'catalog', sha256: catalogArtifact.metadata.sha256 }, { role: 'evaluator', sha256: sha256(code) }];
  if (outputArtifact) entries.push({ role: 'outputs', sha256: outputArtifact.metadata.sha256 });
  entries.sort((left, right) => left.role.localeCompare(right.role, 'en'));
  const tree = sha256(entries.map((entry) => `${entry.role}\0${entry.sha256}\n`).join(''));
  return {
    formatVersion: 1, evaluatorVersion: EVALUATOR_VERSION,
    evaluationStatus: 'LOCAL_FIXTURE_CHECK_NOT_ACCURACY_CERTIFICATION',
    evidenceStatus: catalog.evidenceStatus, reviewStatus: catalog.reviewStatus,
    datasetVersion: catalog.datasetVersion, schemaVersion: catalog.schemaVersion, promptVersion: catalog.promptVersion,
    catalogSize: catalog.cases.length, uniqueDeclaredSemanticCases: new Set(catalog.cases.map((item) => item.semanticId)).size,
    split, splitCounts: Object.fromEntries([...SPLITS].map((value) => [value, catalog.cases.filter((item) => item.split === value).length])),
    holdoutPolicy: { optIn: split === 'holdout', blind: false, tuningPermitted: split !== 'holdout', note: 'Public author fixtures are not a blind benchmark; changing a holdout after inspection retires that holdout version.' },
    mode, outputOrigin: outputs?.origin ?? 'NO_OUTPUTS_PROVIDED',
    complete: total.unevaluated === 0, fixtureChecksSucceeded: total.fail === 0 && total.unevaluated === 0,
    totals: total, cohorts: [...cohortCounts.values()], caseResults,
    databaseExecution: 'NOT_EXECUTED', semanticQueryAccuracy: 'NOT_ASSESSED',
    resultEquivalence: 'Compares supplied result bundles only; their relationship to query text is unverified.',
    qualityThresholds: { status: 'PROPOSAL_ONLY_NOT_CERTIFIED', releaseGateEnforced: false },
    usageCoverage: { status: 'UNAVAILABLE', providerCalls: 0, tokens: null, cost: null, currency: null, reason: 'No authentic provider usage or billing evidence.' },
    providerLatencyMs: null, localEvaluatorRuntimeMs: Number((performance.now() - started).toFixed(3)),
    artifacts: { catalog: catalogArtifact.metadata, outputs: outputArtifact?.metadata ?? null },
    tree: { algorithm: 'sha256', scope: 'Input artifacts and evaluator source, NOT a repository Git tree or authenticity signature', serialization: 'Sorted role + NUL + hex content SHA-256 + LF', entries, sha256: tree },
  };
}

export function parseCliArgs(args) {
  requireCondition(Array.isArray(args) && args.length <= 12, 'INVALID_CLI_ARGUMENTS');
  const result = { split: 'dev', mode: 'exact-response', allowHoldout: false };
  const seen = new Set();
  const keys = { '--catalog': 'catalogPath', '--outputs': 'outputsPath', '--split': 'split', '--mode': 'mode' };
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    requireCondition(!seen.has(flag), 'DUPLICATE_CLI_ARGUMENT'); seen.add(flag);
    if (flag === '--help') { requireCondition(args.length === 1, 'INVALID_CLI_ARGUMENTS'); return { help: true }; }
    if (flag === '--allow-holdout') { result.allowHoldout = true; continue; }
    requireCondition(Object.hasOwn(keys, flag), 'UNKNOWN_CLI_ARGUMENT');
    const value = args[++index];
    requireCondition(text(value, 4096) && !value.startsWith('--'), 'MISSING_CLI_ARGUMENT_VALUE');
    result[keys[flag]] = value;
  }
  requireCondition(result.catalogPath !== undefined, 'CATALOG_PATH_REQUIRED');
  assertLocalJsonPath(result.catalogPath);
  if (result.outputsPath !== undefined) assertLocalJsonPath(result.outputsPath);
  requireCondition(SPLITS.has(result.split) && MODES.has(result.mode), 'INVALID_SPLIT_OR_MODE');
  requireCondition(!result.allowHoldout || result.split === 'holdout', 'HOLDOUT_OPT_IN_WITHOUT_HOLDOUT');
  return result;
}
export async function cli(args, write = (value) => process.stdout.write(value)) {
  try {
    const options = parseCliArgs(args);
    if (options.help) {
      write('Local offline fixture evaluator (Node 18+).\n--catalog local.json [--outputs local.json] [--split dev|calibration|holdout] [--mode exact-response|result-bundle] [--allow-holdout]\nDefaults: dev, exact-response. No artifact writes or query/provider execution. Exit: 0 fixture matches, 1 failed/incomplete, 2 invalid input.\n');
      return 0;
    }
    const report = await runEvaluation(options);
    write(`${JSON.stringify(report, null, 2)}\n`);
    return report.fixtureChecksSucceeded ? 0 : 1;
  } catch (error) {
    write(`${JSON.stringify({ error: { code: error instanceof EvaluationError ? error.code : 'EVALUATOR_INTERNAL_ERROR' } })}\n`);
    return 2;
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = await cli(process.argv.slice(2));
