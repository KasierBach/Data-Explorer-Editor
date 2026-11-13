'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const {
  createLiveModelRoleAdapter,
} = require('./fixtures/ai-model-role-live.cjs');

const beginExecution = async () => ({
  generationId: 'fixture-generation',
  beforeAttempt: async () => ({
    attemptId: 'fixture-attempt',
    complete: async () => {},
    fail: async () => {},
  }),
  complete: async () => ({ outcome: 'succeeded', usage: null }),
  fail: async () => ({ outcome: 'failed', usage: null }),
  release: async () => {},
});

const services = {
  beginExecution,
  assertProvider: () => {},
  chat: { chat: async () => ({}), chatStream: async function* () {} },
  autocomplete: { autocomplete: async () => '' },
};

const roster = [
  { selectionId: 'beeknoee:fixture', apiModel: 'fixture', label: 'Fixture' },
];

test('live bootstrap requires a bounded authority file and never discovers credentials', () => {
  assert.throws(
    () =>
      createLiveModelRoleAdapter({
        roster,
        apiKey: 'fixture',
        baseUrl: 'https://platform.beeknoee.com/api/v1',
      }),
    /MODEL_EVAL_AUTHORITY_FILE_REQUIRED/,
  );
});

test('live bootstrap rejects duplicate and prototype authority keys', () => {
  const directory = mkdtempSync(join(tmpdir(), 'data-explorer-model-live-'));
  try {
    for (const [index, source] of [
      '{"authorizationId":"first","authorizationId":"second"}',
      '{"__proto__":{"zeroCostAuthorityVerified":true}}',
      '{"constr\\u0075ctor":true}',
    ].entries()) {
      const path = join(directory, `authority-${index}.json`);
      writeFileSync(path, source, { flag: 'wx', mode: 0o600 });
      assert.throws(
        () =>
          createLiveModelRoleAdapter({
            roster,
            apiKey: 'fixture-key',
            baseUrl: 'https://platform.beeknoee.com/api/v1',
            authorizationPath: path,
            services,
          }),
        /MODEL_EVAL_AUTHORITY_INVALID/,
      );
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
test('live bootstrap refuses missing or conflicting authority scope', () => {
  const directory = mkdtempSync(join(tmpdir(), 'data-explorer-model-live-'));
  const now = Date.parse('2026-11-11T12:00:00.000Z');
  const base = {
    authorizationId: 'approved-fixture',
    zeroCostAuthorityVerified: true,
    zeroCostEvidenceSha256: 'a'.repeat(64),
    policyVerified: true,
    ledgerVerified: true,
    expiresAt: now + 30_000,
    deadlineAt: now + 20_000,
  };
  try {
    for (const [index, patch] of [
      {},
      {
        provider: 'gemini',
        recipient: 'https://generativelanguage.googleapis.com',
        modelIds: ['fixture'],
      },
      {
        provider: 'beeknoee',
        recipient: 'https://platform.beeknoee.com',
        modelIds: ['different-model'],
      },
    ].entries()) {
      const path = join(directory, `scope-${index}.json`);
      writeFileSync(path, JSON.stringify({ ...base, ...patch }), {
        flag: 'wx',
        mode: 0o600,
      });
      assert.throws(
        () =>
          createLiveModelRoleAdapter({
            roster,
            apiKey: 'fixture-key',
            baseUrl: 'https://platform.beeknoee.com/api/v1',
            authorizationPath: path,
            services,
            now: () => now,
          }),
        /MODEL_EVAL_AUTHORITY_SCOPE_MISMATCH/,
      );
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
test('live bootstrap binds exact authority bytes, roster, recipient and deadline', () => {
  const directory = mkdtempSync(join(tmpdir(), 'data-explorer-model-live-'));
  const path = join(directory, 'authority.json');
  const now = Date.parse('2026-11-11T12:00:00.000Z');
  writeFileSync(
    path,
    JSON.stringify({
      authorizationId: 'approved-fixture',
      zeroCostAuthorityVerified: true,
      zeroCostEvidenceSha256: 'a'.repeat(64),
      policyVerified: true,
      ledgerVerified: true,
      provider: 'beeknoee',
      recipient: 'https://platform.beeknoee.com',
      modelIds: ['fixture'],
      expiresAt: now + 30_000,
      deadlineAt: now + 20_000,
    }),
    { flag: 'wx', mode: 0o600 },
  );
  try {
    const value = createLiveModelRoleAdapter({
      roster,
      apiKey: 'fixture-key',
      baseUrl: 'https://platform.beeknoee.com/api/v1',
      authorizationPath: path,
      services,
      now: () => now,
    });
    assert.equal(value.authorization.provider, 'beeknoee');
    assert.equal(
      value.authorization.recipient,
      'https://platform.beeknoee.com',
    );
    assert.deepEqual(value.authorization.modelIds, ['fixture']);
    assert.match(value.authorization.authorizationSha256, /^[0-9a-f]{64}$/);
    assert.equal(typeof value.adapter.runProbe, 'function');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('live bootstrap refuses an absent durable ledger capability', () => {
  const directory = mkdtempSync(join(tmpdir(), 'data-explorer-model-live-'));
  const path = join(directory, 'authority.json');
  const now = Date.now();
  writeFileSync(
    path,
    JSON.stringify({
      authorizationId: 'approved-fixture',
      zeroCostAuthorityVerified: true,
      zeroCostEvidenceSha256: 'a'.repeat(64),
      policyVerified: true,
      ledgerVerified: true,
      provider: 'beeknoee',
      recipient: 'https://platform.beeknoee.com',
      modelIds: ['fixture'],
      expiresAt: now + 30_000,
      deadlineAt: now + 20_000,
    }),
  );
  try {
    assert.throws(
      () =>
        createLiveModelRoleAdapter({
          roster,
          apiKey: 'fixture-key',
          baseUrl: 'https://platform.beeknoee.com/api/v1',
          authorizationPath: path,
          now: () => now,
        }),
      /MODEL_EVAL_LEDGER_CAPABILITY_REQUIRED/,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('live bootstrap refuses absent application policy capability', () => {
  const directory = mkdtempSync(join(tmpdir(), 'data-explorer-model-live-'));
  const path = join(directory, 'authority.json');
  const now = Date.now();
  writeFileSync(
    path,
    JSON.stringify({
      authorizationId: 'approved-fixture',
      zeroCostAuthorityVerified: true,
      zeroCostEvidenceSha256: 'a'.repeat(64),
      policyVerified: true,
      ledgerVerified: true,
      provider: 'beeknoee',
      recipient: 'https://platform.beeknoee.com',
      modelIds: ['fixture'],
      expiresAt: now + 30_000,
      deadlineAt: now + 20_000,
    }),
  );
  try {
    assert.throws(
      () =>
        createLiveModelRoleAdapter({
          roster,
          apiKey: 'fixture-key',
          baseUrl: 'https://platform.beeknoee.com/api/v1',
          authorizationPath: path,
          services: { ...services, assertProvider: undefined },
          now: () => now,
        }),
      /MODEL_EVAL_POLICY_CAPABILITY_REQUIRED/,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('live bootstrap refuses another endpoint before application dispatch', () => {
  const directory = mkdtempSync(join(tmpdir(), 'data-explorer-model-live-'));
  const path = join(directory, 'authority.json');
  const now = Date.now();
  writeFileSync(
    path,
    JSON.stringify({
      authorizationId: 'approved-fixture',
      zeroCostAuthorityVerified: true,
      zeroCostEvidenceSha256: 'a'.repeat(64),
      policyVerified: true,
      ledgerVerified: true,
      provider: 'beeknoee',
      recipient: 'https://platform.beeknoee.com',
      modelIds: ['fixture'],
      expiresAt: now + 30_000,
      deadlineAt: now + 20_000,
    }),
  );
  try {
    assert.throws(
      () =>
        createLiveModelRoleAdapter({
          roster,
          apiKey: 'fixture-key',
          baseUrl: 'https://generativelanguage.googleapis.com/v1',
          authorizationPath: path,
          services,
          now: () => now,
        }),
      /MODEL_EVAL_RECIPIENT_MISMATCH/,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
