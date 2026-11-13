const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createE2eEnvironment } = require('./e2e-environment.cjs');
const {
  cleanupRateLimitFixture,
  trackRateLimitKeys,
} = require('./fixtures/rate-limit-cleanup.cjs');

const fixture = {
  E2E_DATABASE_URL: 'postgresql://e2e:e2e@127.0.0.1:15432/data_explorer_e2e',
  E2E_REDIS_URL: 'redis://127.0.0.1:16379/15',
};

test('only explicit local fixture endpoints are accepted; ordinary env is never a fallback', () => {
  for (const source of [
    {},
    {
      DATABASE_URL: fixture.E2E_DATABASE_URL,
      REDIS_URL: fixture.E2E_REDIS_URL,
    },
    {
      ...fixture,
      E2E_DATABASE_URL: 'postgresql://e2e:e2e@db.example.com/data_explorer_e2e',
    },
    {
      ...fixture,
      E2E_DATABASE_URL: 'postgresql://e2e:e2e@127.0.0.1/customer_data',
    },
    { ...fixture, E2E_REDIS_URL: 'redis://cache.example.com/15' },
    { ...fixture, E2E_REDIS_URL: 'redis://127.0.0.1:16379/0' },
    {
      ...fixture,
      E2E_DATABASE_URL: `${fixture.E2E_DATABASE_URL}?host=prod.example.com`,
    },
  ]) {
    assert.throws(() => createE2eEnvironment(source), /E2E_/);
  }
});

test('native runner identity is optional, bounded and never grants a host-network fallback', () => {
  const name = 'ai-eval-82d7308f7e2e45a08ad826f5863f9e6d-eval-runner-1';
  assert.equal(
    createE2eEnvironment(fixture).AI_EVAL_RUNNER_CONTAINER,
    undefined,
  );
  assert.equal(
    createE2eEnvironment({ ...fixture, AI_EVAL_RUNNER_CONTAINER: name })
      .AI_EVAL_RUNNER_CONTAINER,
    name,
  );
  for (const invalid of [
    '',
    'production-db',
    'ai-eval-123-eval-runner-1;curl',
    '../runner',
    `ai-eval-${'a'.repeat(81)}-eval-runner-1`,
  ]) {
    assert.throws(
      () =>
        createE2eEnvironment({ ...fixture, AI_EVAL_RUNNER_CONTAINER: invalid }),
      /AI_EVAL_RUNNER_CONTAINER/,
    );
  }
});

test('drops inherited provider credentials, preload options and production config', () => {
  const env = createE2eEnvironment({
    ...fixture,
    PATH: 'fixture-path',
    DATABASE_URL: 'postgresql://production',
    REDIS_URL: 'redis://production',
    MAIL_USER: 'real@example.com',
    MAIL_PASS: 'real-secret',
    GEMINI_API_KEY: 'real-secret',
    OPENROUTER_API_KEY: 'real-secret',
    MOMO_SECRET_KEY: 'real-secret',
    FUTURE_PROVIDER_KEY: 'real-secret',
    NODE_OPTIONS: '--require unsafe-preload',
  });
  assert.equal(env.NODE_ENV, 'test');
  assert.equal(env.DATABASE_URL, fixture.E2E_DATABASE_URL);
  assert.equal(env.REDIS_URL, fixture.E2E_REDIS_URL);
  assert.equal(env.PATH, 'fixture-path');
  for (const key of [
    'MAIL_USER',
    'MAIL_PASS',
    'GEMINI_API_KEY',
    'OPENROUTER_API_KEY',
    'MOMO_SECRET_KEY',
    'FUTURE_PROVIDER_KEY',
    'NODE_OPTIONS',
  ]) {
    assert.equal(env[key], undefined, key);
  }
  assert.equal(Buffer.byteLength(env.ENCRYPTION_KEY), 32);
});

test('rate-limit fixture tracks exact native keys before dispatch without scanning', async () => {
  const owned = new Set();
  const calls = [];
  const client = {
    keys() {
      assert.fail('Fixture cleanup must not discover unrelated keys');
    },
    async call(...args) {
      calls.push(args);
      return [1, 60000, 0, 0];
    },
  };
  const restore = trackRateLimitKeys(client, owned);
  await client.call(
    'eval',
    'fixture-script',
    2,
    '{abc:default}:hits',
    '{abc:default}:blocked',
    'default',
  );
  assert.deepEqual([...owned], ['{abc:default}:hits', '{abc:default}:blocked']);
  assert.equal(calls.length, 1);
  restore();
  await client.call('get', 'not-owned');
  assert.equal(owned.size, 2);
});

test('rate-limit teardown deletes only owned keys and closes both apps after a rejection', async () => {
  const calls = [];
  const owned = new Set(['{owned:default}:hits', '{owned:default}:blocked']);
  const client = {
    del: async (...keys) => {
      calls.push(['del', ...keys]);
      throw new Error('Synthetic lost Redis reply');
    },
    disconnect: () => calls.push(['disconnect']),
  };
  await assert.rejects(
    cleanupRateLimitFixture({
      client,
      keys: owned,
      apps: ['first', 'second'],
      closeApp: async (app) => {
        calls.push(['close', app]);
        if (app === 'first') throw new Error('Synthetic close failure');
      },
    }),
    /R10_FIXTURE_CLEANUP_FAILED/,
  );
  assert.deepEqual(calls, [
    ['del', '{owned:default}:hits', '{owned:default}:blocked'],
    ['disconnect'],
    ['close', 'first'],
    ['close', 'second'],
  ]);
  assert.equal(owned.size, 2);
});

test('rate-limit teardown bounds a silent Redis command without bypassing app cleanup', async () => {
  const calls = [];
  await assert.rejects(
    cleanupRateLimitFixture({
      client: {
        del: () => new Promise(() => {}),
        disconnect: () => calls.push('disconnect'),
      },
      keys: new Set(['{owned:default}:hits']),
      apps: ['first', 'second'],
      closeApp: async (app) => calls.push(app),
      timeoutMs: 20,
    }),
    /R10_FIXTURE_CLEANUP_FAILED/,
  );
  assert.deepEqual(calls, ['disconnect', 'first', 'second']);
});

test('rate-limit teardown clears ownership only after confirmed deletion', async () => {
  const keys = new Set(['{owned:default}:hits']);
  const deleted = [];
  const closed = [];
  await cleanupRateLimitFixture({
    client: {
      del: async (...names) => deleted.push(...names),
      disconnect: () => closed.push('redis'),
    },
    keys,
    apps: ['first', 'second'],
    closeApp: async (app) => closed.push(app),
  });
  assert.deepEqual(deleted, ['{owned:default}:hits']);
  assert.equal(keys.size, 0);
  assert.deepEqual(closed, ['redis', 'first', 'second']);
});
