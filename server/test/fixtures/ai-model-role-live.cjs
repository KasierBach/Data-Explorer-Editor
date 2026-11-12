'use strict';

const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { createAppModelRoleAdapter } = require('./ai-model-role-adapter.cjs');

function readAuthorization(path, roster, now) {
  const bytes = readFileSync(path);
  if (bytes.length > 32 * 1024) throw new Error('MODEL_EVAL_AUTHORITY_TOO_LARGE');
  const value = JSON.parse(bytes.toString('utf8'));
  return {
    ...value,
    credentialPresent: true,
    provider: 'beeknoee',
    recipient: 'https://platform.beeknoee.com',
    modelIds: roster.map((item) => item.apiModel),
    authorizationSha256: createHash('sha256').update(bytes).digest('hex'),
    loadedAt: now,
  };
}

function createLiveModelRoleAdapter({
  roster,
  apiKey,
  baseUrl,
  authorizationPath,
  services,
  now = Date.now,
}) {
  if (!authorizationPath) throw new Error('MODEL_EVAL_AUTHORITY_FILE_REQUIRED');
  const authorization = readAuthorization(authorizationPath, roster, now());
  if (!services || typeof services.beginExecution !== 'function')
    throw new Error('MODEL_EVAL_LEDGER_CAPABILITY_REQUIRED');
  if (typeof services.assertProvider !== 'function')
    throw new Error('MODEL_EVAL_POLICY_CAPABILITY_REQUIRED');
  if (!services.chat || !services.autocomplete)
    throw new Error('MODEL_EVAL_APPLICATION_CAPABILITY_REQUIRED');
  return {
    authorization,
    adapter: createAppModelRoleAdapter({
      apiKey,
      baseUrl,
      deadlineAt: authorization.deadlineAt,
      services,
      now,
    }),
  };
}

module.exports = { createLiveModelRoleAdapter };
