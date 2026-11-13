'use strict';

const { createHash } = require('node:crypto');
const { lstatSync, readFileSync } = require('node:fs');
const { createAppModelRoleAdapter } = require('./ai-model-role-adapter.cjs');
const forbiddenAuthorityKey = /"((?:\\.|[^"\\])*)"\s*:/g;

function parseAuthority(bytes) {
  const input = bytes.toString('utf8');
  const keys = [];
  try {
    input.replace(forbiddenAuthorityKey, (_match, key) => {
      const decoded = JSON.parse(`"${key}"`);
      if (
        keys.includes(decoded) ||
        ['__proto__', 'prototype', 'constructor'].includes(decoded)
      )
        throw new Error('MODEL_EVAL_AUTHORITY_INVALID');
      keys.push(decoded);
      return _match;
    });
    const value = JSON.parse(input);
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new Error('MODEL_EVAL_AUTHORITY_INVALID');
    return value;
  } catch (error) {
    if (error?.message === 'MODEL_EVAL_AUTHORITY_INVALID') throw error;
    throw new Error('MODEL_EVAL_AUTHORITY_INVALID');
  }
}

function readAuthorization(path, roster) {
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 32 * 1024)
    throw new Error('MODEL_EVAL_AUTHORITY_INVALID');
  const bytes = readFileSync(path);
  const value = parseAuthority(bytes);
  const modelIds = roster.map((item) => item.apiModel);
  if (
    value.provider !== 'beeknoee' ||
    value.recipient !== 'https://platform.beeknoee.com' ||
    !Array.isArray(value.modelIds) ||
    value.modelIds.length !== modelIds.length ||
    new Set(value.modelIds).size !== modelIds.length ||
    modelIds.some((model) => !value.modelIds.includes(model))
  )
    throw new Error('MODEL_EVAL_AUTHORITY_SCOPE_MISMATCH');
  return {
    ...value,
    credentialPresent: true,
    authorizationSha256: createHash('sha256').update(bytes).digest('hex'),
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
  const authorization = readAuthorization(authorizationPath, roster);
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
