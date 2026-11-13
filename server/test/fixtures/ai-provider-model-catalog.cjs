'use strict';

const { readFileSync } = require('node:fs');
const { join, resolve } = require('node:path');
const ts = require('typescript');
const { MODEL_EVALUATION_ENDPOINTS } = require('./ai-model-role-adapter.cjs');

const workspace = resolve(__dirname, '../../..');

function literalProperty(node, name) {
  const property = node.properties.find(
    (item) => ts.isPropertyAssignment(item) && item.name.getText() === name,
  );
  return property && ts.isStringLiteral(property.initializer)
    ? property.initializer.text
    : undefined;
}

function arrayDeclaration(file, name) {
  let found;
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText() === name) {
      let value = node.initializer;
      if (value && ts.isAsExpression(value)) value = value.expression;
      if (value && ts.isArrayLiteralExpression(value)) found = value;
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  if (!found) throw new Error('MODEL_EVAL_ROSTER_INVALID');
  return found;
}

function readSource(path) {
  const source = readFileSync(path, 'utf8');
  if (Buffer.byteLength(source) > 64 * 1024)
    throw new Error('MODEL_EVAL_ROSTER_INVALID');
  return ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
}

function readModelObjects(array, provider) {
  return array.elements.map((entry) => {
    if (!ts.isObjectLiteralExpression(entry))
      throw new Error('MODEL_EVAL_ROSTER_INVALID');
    const selectionId = literalProperty(entry, 'id');
    const label = literalProperty(entry, 'label');
    if (!selectionId || !label) throw new Error('MODEL_EVAL_ROSTER_INVALID');
    const apiModel =
      provider === 'openrouter'
        ? selectionId
        : selectionId.slice(`${provider}:`.length);
    if (
      !/^[A-Za-z0-9][A-Za-z0-9._/:@-]{0,199}$/.test(apiModel) ||
      (provider !== 'openrouter' && !selectionId.startsWith(`${provider}:`)) ||
      (provider === 'openrouter' && !apiModel.endsWith(':free'))
    )
      throw new Error('MODEL_EVAL_ROSTER_INVALID');
    return { provider, selectionId, apiModel, label };
  });
}

function readProviderAssessmentRoster() {
  const folder = join(workspace, 'client/src/presentation/modules/Query');
  const beeknoee = readSource(join(folder, 'beeknoeeModelCatalog.ts'));
  const catalog = readSource(join(folder, 'assistantModelCatalog.ts'));
  const groups = arrayDeclaration(catalog, 'BUILT_IN_MODEL_GROUPS');
  const result = readModelObjects(
    arrayDeclaration(beeknoee, 'BEEKNOEE_MODELS'),
    'beeknoee',
  );
  for (const group of groups.elements) {
    if (!ts.isObjectLiteralExpression(group))
      throw new Error('MODEL_EVAL_ROSTER_INVALID');
    const name = literalProperty(group, 'group');
    const provider =
      name === 'Groq (Fast & Free)'
        ? 'groq'
        : name === 'OpenRouter (Free)'
          ? 'openrouter'
          : undefined;
    if (!provider) continue;
    const items = group.properties.find(
      (item) =>
        ts.isPropertyAssignment(item) && item.name.getText() === 'items',
    );
    if (!items || !ts.isArrayLiteralExpression(items.initializer))
      throw new Error('MODEL_EVAL_ROSTER_INVALID');
    result.push(...readModelObjects(items.initializer, provider));
  }
  if (
    result.length !== 30 ||
    new Set(result.map((entry) => entry.selectionId)).size !== result.length
  )
    throw new Error('MODEL_EVAL_ROSTER_INVALID');
  return result.map((entry) => Object.freeze(entry));
}

function classifyProviderFailure(error) {
  const chain = [];
  for (
    let current = error;
    current && chain.length < 6;
    current = current.cause
  )
    chain.push(current);
  const status = chain
    .map((item) => item.status ?? item.statusCode)
    .find(Number.isInteger);
  const code = chain
    .map((item) => item.code ?? item.reason)
    .find((value) => typeof value === 'string');
  const text = chain.map((item) => item.message ?? '').join(' ');
  const state =
    status === 401 || status === 403
      ? 'auth-denied'
      : status === 429
        ? 'rate-limited'
        : status === 402
          ? 'credits-required'
          : status === 404
            ? 'unavailable'
            : status === 400 || status === 415 || status === 422
              ? 'request-rejected'
              : /timeout|timed out|deadline/i.test(text)
                ? 'timeout'
                : /not configured/i.test(text)
                  ? 'unconfigured'
                  : /partial|finish|response|structured|content|output|terminal/i.test(
                        text,
                      )
                    ? 'invalid-output'
                    : 'operation-failed';
  return {
    status: state,
    httpStatus: status ?? null,
    code:
      typeof code === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(code)
        ? code
        : null,
  };
}

module.exports = {
  classifyProviderFailure,
  readProviderAssessmentRoster,
  MODEL_EVALUATION_ENDPOINTS,
};
