const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const { join } = require('node:path');
const { test } = require('node:test');

const workerPath = join(
  __dirname,
  'fixtures',
  'ai-execution-ledger-worker.cjs',
);
const runId = `a11-ledger-${'a'.repeat(32)}`;
const actor = '11111111-1111-4111-8111-111111111111';
const fixture = {
  E2E_DATABASE_URL:
    'postgresql://e2e:e2e-local-only@127.0.0.1:15432/data_explorer_e2e',
  E2E_REDIS_URL: 'redis://127.0.0.1:16379/15',
};
const helpers = () => require(workerPath);

test('ledger worker requires explicit fixture ports and drops ambient configuration', () => {
  const { createWorkerEnvironment } = helpers();
  const env = createWorkerEnvironment(
    {
      ...fixture,
      PATH: process.env.PATH,
      GEMINI_API_KEY: 'secret-sentinel',
      DATABASE_URL: 'postgresql://customer.example/private',
      NODE_OPTIONS: '--require untrusted-preload',
      AI_EXECUTION_GLOBAL_CONCURRENCY: '999',
    },
    [runId, 'first'],
  );
  assert.equal(env.DATABASE_URL, fixture.E2E_DATABASE_URL);
  assert.equal(env.REDIS_URL, fixture.E2E_REDIS_URL);
  for (const key of [
    'GEMINI_API_KEY',
    'NODE_OPTIONS',
    'NODE_PATH',
    'AI_EXECUTION_GLOBAL_CONCURRENCY',
    'ALLOW_INTERNAL_IPS',
  ]) {
    assert.equal(env[key], undefined, key);
  }
});
for (const source of [
  {},
  { DATABASE_URL: fixture.E2E_DATABASE_URL, REDIS_URL: fixture.E2E_REDIS_URL },
  {
    ...fixture,
    E2E_DATABASE_URL: fixture.E2E_DATABASE_URL.replace('15432', '5432'),
  },
  {
    ...fixture,
    E2E_DATABASE_URL: fixture.E2E_DATABASE_URL.replace(
      '127.0.0.1',
      'db.example.com',
    ),
  },
  {
    ...fixture,
    E2E_DATABASE_URL: fixture.E2E_DATABASE_URL.replace(
      'data_explorer_e2e',
      'customer',
    ),
  },
  { ...fixture, E2E_REDIS_URL: 'redis://127.0.0.1:6379/15' },
  { ...fixture, E2E_REDIS_URL: 'redis://127.0.0.1:16379/0' },
  {
    ...fixture,
    E2E_DATABASE_URL: `${fixture.E2E_DATABASE_URL}?host=private.example`,
  },
])
  test('ledger worker refuses missing or non-fixture stores', () => {
    assert.throws(
      () => helpers().createWorkerEnvironment(source, [runId, 'first']),
      /AI_LEDGER_FIXTURE_INVALID/,
    );
  });
for (const args of [
  [],
  ['main', 'first'],
  [runId, 'third'],
  [runId, 'first', 'extra'],
]) {
  test('ledger worker refuses unbounded or ambiguous launch arguments', () => {
    assert.throws(
      () => helpers().createWorkerEnvironment(fixture, args),
      /AI_LEDGER_FIXTURE_INVALID/,
    );
  });
}
test('IPC accepts only bounded fixture operations and explicit outcomes', () => {
  const { validateCommand } = helpers();
  for (const command of [
    {
      id: 1,
      action: 'begin',
      userId: actor,
      metadata: { requestedModel: 'fixture-model', deadlineAt: 123456 },
    },
    {
      id: 2,
      action: 'attempt',
      generationId: actor,
      plan: { provider: 'fixture', model: 'model' },
    },
    {
      id: 3,
      action: 'finishAttempt',
      attemptId: actor,
      outcome: 'succeeded',
      result: { usage: { promptTokens: 0, completionTokens: null } },
    },
    { id: 4, action: 'finalize', generationId: actor, outcome: 'cancelled' },
    {
      id: 5,
      action: 'feedback',
      generationId: actor,
      userId: actor,
      rating: 'down',
    },
    {
      id: 6,
      action: 'configure',
      limits: {
        AI_EXECUTION_GLOBAL_CONCURRENCY: 32,
        AI_EXECUTION_PER_USER_CONCURRENCY: 2,
      },
    },
    { id: 7, action: 'barrier', stage: 'after-attempt-reservation' },
    { id: 8, action: 'continue', requestId: 7 },
    { id: 9, action: 'fault', mode: 'none' },
    { id: 10, action: 'cleanup' },
  ])
    assert.deepEqual(validateCommand(command), command);
});
for (const command of [
  null,
  [],
  'close',
  {},
  { id: 0, action: 'cleanup' },
  { id: 1, action: 'fetch', url: 'https://provider.example' },
  { id: 1, action: 'begin', userId: '../actor' },
  {
    id: 1,
    action: 'begin',
    userId: actor,
    metadata: { apiKey: 'secret-sentinel' },
  },
  { id: 1, action: 'begin', userId: actor, metadata: { deadlineAt: Infinity } },
  { id: 1, action: 'begin', userId: actor, prompt: 'customer rows' },
  {
    id: 1,
    action: 'attempt',
    generationId: actor,
    plan: { provider: 'fixture', model: 'x'.repeat(201) },
  },
  { id: 1, action: 'finalize', generationId: actor, outcome: 'running' },
  {
    id: 1,
    action: 'finishAttempt',
    attemptId: actor,
    outcome: 'failed',
    result: { usage: { totalTokens: -1 } },
  },
  {
    id: 1,
    action: 'finishAttempt',
    attemptId: actor,
    outcome: 'failed',
    result: { usage: { totalTokens: 2147483648 } },
  },
  {
    id: 1,
    action: 'feedback',
    generationId: actor,
    userId: actor,
    rating: 'approved',
  },
  {
    id: 1,
    action: 'configure',
    limits: { AI_EXECUTION_GLOBAL_CONCURRENCY: 129 },
  },
  { id: 1, action: 'configure', limits: { REDIS_URL: 'redis://private' } },
  { id: 1, action: 'barrier', stage: 'after-provider-dispatch' },
  { id: 1, action: 'fault', mode: 'shutdown-server' },
  { id: 1, action: 'cleanup', extra: 'x'.repeat(65537) },
])
  test('IPC rejects arbitrary commands, payloads and invalid bounds', () => {
    assert.throws(
      () => helpers().validateCommand(command),
      /AI_LEDGER_COMMAND_INVALID/,
    );
  });
test('worker errors expose fixed status/codes, never text, paths or secrets', () => {
  const { errorMetadata } = helpers();
  for (const value of [
    new Error('secret-sentinel C:/private/rows'),
    { code: 'secret-sentinel' },
    { getStatus: () => 503, message: 'customer rows' },
  ]) {
    assert.ok(
      !/secret|private|customer|rows/.test(
        JSON.stringify(errorMetadata(value)),
      ),
    );
  }
  assert.deepEqual(errorMetadata({ code: 'P2004' }), {
    code: 'DB_REJECTED',
    status: null,
  });
  assert.deepEqual(errorMetadata({ getStatus: () => 429 }), {
    code: 'HTTP_429',
    status: 429,
  });
});
test('worker recognizes only structured PostgreSQL check failures without copying adapter messages', () => {
  const { errorMetadata } = helpers();
  assert.deepEqual(
    errorMetadata({
      name: 'DriverAdapterError',
      cause: {
        kind: 'postgres',
        originalCode: '23514',
        originalMessage: 'secret-sentinel',
      },
    }),
    { code: 'DB_CHECK_REJECTED', status: null },
  );
  assert.deepEqual(
    errorMetadata({
      name: 'DriverAdapterError',
      cause: {
        kind: 'postgres',
        originalCode: '08006',
        originalMessage: 'secret-sentinel',
      },
    }),
    { code: 'AI_LEDGER_OPERATION_FAILED', status: null },
  );
});
test('IPC sends have a finite callback deadline and do not leak transport errors', async () => {
  const { sendWithDeadline } = helpers();
  assert.equal(typeof sendWithDeadline, 'function');
  await sendWithDeadline(
    { send: (_value, callback) => callback() },
    { type: 'ready' },
    10,
  );
  await assert.rejects(
    sendWithDeadline({ send: () => {} }, { type: 'ready' }, 10),
    /AI_LEDGER_IPC_TIMEOUT/,
  );
  await assert.rejects(
    sendWithDeadline(
      { send: (_value, callback) => callback(new Error('secret-sentinel')) },
      { type: 'ready' },
      10,
    ),
    /AI_LEDGER_IPC_UNAVAILABLE/,
  );
  await assert.rejects(
    sendWithDeadline({ send: () => {} }, { text: 'x'.repeat(65537) }, 10),
    /AI_LEDGER_WORKER_LIMIT/,
  );
});
test('dependency initialization failure is redacted before any store connection', async () => {
  const preload = `
const { Module } = require('node:module');
const previous = Module._load;
Module._load = function (name, ...args) {
  if (name === 'ts-node') throw new Error('secret-sentinel C:/private/customer');
  return previous.call(this, name, ...args);
};
process.send = () => {};
require(process.argv[1]).main();`;
  const child = spawn(
    process.execPath,
    ['-e', preload, workerPath, runId, 'first'],
    {
      env: { ...fixture, PATH: process.env.PATH },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  let stdout = '',
    stderr = '';
  child.stdout.on('data', (chunk) => {
    stdout += chunk;
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });
  const status = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error('fixture initialization hung'));
    }, 10000);
    child.on('error', reject);
    child.on('exit', (code) => {
      clearTimeout(timeout);
      resolve(code);
    });
  });
  assert.equal(status, 1);
  assert.equal(stdout, '');
  assert.deepEqual(JSON.parse(stderr), {
    code: 'AI_LEDGER_FIXTURE_UNAVAILABLE',
  });
});
test('standalone invalid worker fails before dependencies without echoing input', () => {
  const result = spawnSync(process.execPath, [workerPath, runId, 'first'], {
    env: { PATH: process.env.PATH, GEMINI_API_KEY: 'secret-sentinel' },
    encoding: 'utf8',
    timeout: 10000,
  });
  assert.equal(result.status, 2);
  assert.equal(result.stdout, '');
  assert.deepEqual(JSON.parse(result.stderr), {
    code: 'AI_LEDGER_FIXTURE_INVALID',
  });
});
