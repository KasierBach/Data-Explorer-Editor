const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createE2eEnvironment } = require('./e2e-environment.cjs');

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
