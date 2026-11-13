'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  symlinkSync,
} = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { pathToFileURL } = require('node:url');
const test = require('node:test');
const {
  readProviderEvaluationContinuation,
  runProviderEvaluationProbe,
  runProviderEvaluationLedger,
  isProviderEvaluationFatal,
  createProviderEvaluationDiscoveryScope,
  runProviderEvaluationProbes,
  createProviderEvaluationChat,
  cleanupProviderEvaluationResources,
  durableRecord,
} = require('./fixtures/ai-provider-model-live-runner.cjs');
const {
  createAppModelRoleAdapter,
} = require('./fixtures/ai-model-role-adapter.cjs');

const evaluationUrl = pathToFileURL(
  join(__dirname, '../scripts/ai-eval/model-role-assessment.mjs'),
).href;
const evaluatorUrl = pathToFileURL(
  join(__dirname, '../scripts/ai-eval/evaluator.mjs'),
).href;
const model = {
  provider: 'groq',
  apiModel: 'fixture',
  selectionId: 'groq:fixture',
  label: 'Fixture',
};
const now = Date.parse('2026-11-13T12:00:00.000Z');
const deadlineAt = now + 60_000;

function authority(extra = {}) {
  return {
    kind: 'operator-authorized-multi-provider-evaluation',
    authorizationId: 'synthetic-guard-only',
    maxAttempts: 320,
    spendUsd: 0,
    concurrency: 1,
    operatorFreeAttestation: true,
    excludeDirectGemini: true,
    providers: ['beeknoee', 'groq', 'openrouter', 'cerebras'],
    deadlineAt,
    ...extra,
  };
}

function previousRun({
  attempts = 318,
  offset = 317,
  reportPatch = {},
  authorityPatch = {},
  journal,
} = {}) {
  const directory = mkdtempSync(
    join(tmpdir(), 'data-explorer-provider-previous-'),
  );
  const priorAuthority = authority({
    ...(offset > 0
      ? {
          previousRun: 'synthetic-prior',
          initialAttempts: offset,
          previousReportSha256: 'b'.repeat(64),
        }
      : {}),
    ...authorityPatch,
  });
  const report = {
    kind: 'multi-provider-live-task-assessment',
    formatVersion: 1,
    providerAttempts: attempts,
    previousProviderAttempts: offset,
    thisRunProviderAttempts: attempts - offset,
    attemptLimit: 320,
    concurrency: 1,
    directGeminiExcluded: true,
    cleanupVerified: true,
    failures: [],
    models: [],
    discoveries: [],
    authorizationSha256: createHash('sha256')
      .update(JSON.stringify(priorAuthority))
      .digest('hex'),
    ...reportPatch,
  };
  const bytes = Buffer.from(JSON.stringify(report));
  writeFileSync(join(directory, 'assessment.json'), bytes, { flag: 'wx' });
  writeFileSync(
    join(directory, 'authority.json'),
    JSON.stringify(priorAuthority),
    { flag: 'wx' },
  );
  const rows =
    journal ??
    Array.from({ length: attempts - offset }, (_, index) => ({
      ordinal: offset + index + 1,
    }));
  writeFileSync(
    join(directory, 'attempts.ndjson'),
    rows.map((row) => JSON.stringify(row)).join('\n') + '\n',
    { flag: 'wx' },
  );
  return {
    directory,
    input: authority({
      previousRun: directory,
      previousReportSha256: createHash('sha256').update(bytes).digest('hex'),
      initialAttempts: attempts,
    }),
    close: () => rmSync(directory, { recursive: true, force: true }),
  };
}

function chatServices(
  ai,
  { probe = 'explain-null', providerError, providerResult } = {},
) {
  return createProviderEvaluationChat({
    ai,
    chat: {},
    followup: true,
    getProbe: () => probe,
    getModel: () => model,
    getProviderError: () => providerError,
    getProviderResult: () => providerResult,
  });
}

function stores({
  redisFailure = false,
  dbFailure = false,
  nativeFailure = false,
  disconnectFailure = false,
  redisSyncFailure = false,
} = {}) {
  const calls = [];
  const readbacks = [];
  const actorId = 'owned-actor';
  const actorEmail = 'provider-eval-owned@example.test';
  const ids = ['owned-generation'];
  const prisma = {
    aiGeneration: {
      findMany: async (value) => {
        calls.push(['generations.find', value]);
        if (dbFailure) throw new Error('synthetic DB unavailable');
        return ids.map((id) => ({ id }));
      },
      deleteMany: async (value) => calls.push(['generations.delete', value]),
      count: async (value) => {
        calls.push(['generations.count', value]);
        return dbFailure ? 1 : 0;
      },
    },
    aiGenerationFeedback: {
      deleteMany: async (value) => calls.push(['feedback.delete', value]),
    },
    aiProviderAttempt: {
      deleteMany: async (value) => calls.push(['attempts.delete', value]),
      count: async (value) => {
        calls.push(['attempts.count', value]);
        return 0;
      },
    },
    user: {
      deleteMany: async (value) => calls.push(['actor.delete', value]),
      count: async (value) => {
        calls.push(['actor.count', value]);
        return 0;
      },
    },
    $disconnect: () => {
      calls.push(['prisma.disconnect']);
      if (disconnectFailure) throw new Error('synthetic disconnect failure');
      return Promise.resolve();
    },
  };
  const client = {
    zrem: async (...values) => {
      calls.push(['redis.zrem', ...values]);
      if (redisFailure) throw new Error('synthetic Redis unavailable');
    },
    del: async (...values) => {
      calls.push(['redis.del', ...values]);
      if (redisFailure) throw new Error('synthetic Redis unavailable');
    },
    zcard: async (...values) => {
      calls.push(['redis.zcard', ...values]);
      if (redisFailure) throw new Error('synthetic Redis unavailable');
      return 0;
    },
  };
  const redis = {
    getClient: () => {
      if (redisSyncFailure) throw new Error('synthetic Redis client failure');
      return client;
    },
    onModuleDestroy: async () => calls.push(['redis.disconnect']),
  };
  return {
    calls,
    readbacks,
    options: {
      actorAttempted: true,
      actorId,
      actorEmail,
      prisma,
      redis,
      native: {
        close: async () => {
          calls.push(['native.close']);
          if (nativeFailure) throw new Error('synthetic native failure');
        },
      },
      ledgerContexts: [],
      leaseIds: new Set(ids),
      onReadback: (value) => readbacks.push(value),
    },
  };
}

test('continuation refuses partial tuple instead of regaining the full allowance', () => {
  for (const input of [
    { initialAttempts: 318 },
    { initialAttempts: 0 },
    { previousRun: '' },
    {
      previousRun: '',
      initialAttempts: 318,
      previousReportSha256: 'a'.repeat(64),
    },
    { previousReportSha256: 'a'.repeat(64) },
    { previousRun: 'synthetic', previousReportSha256: 'a'.repeat(64) },
  ])
    assert.throws(
      () => readProviderEvaluationContinuation(authority(input), JSON.parse),
      /MODEL_EVAL_CONTINUATION_INVALID/,
    );
  assert.equal(
    readProviderEvaluationContinuation(authority(), JSON.parse).initialAttempts,
    0,
  );
});

test('continuation retains exact prior count, shared ceiling and absolute deadline', async () => {
  const fixture = previousRun();
  try {
    const result = readProviderEvaluationContinuation(
      fixture.input,
      JSON.parse,
    );
    const { createModelAttemptBudget } = await import(evaluationUrl);
    const admitted = [];
    const budget = createModelAttemptBudget({
      maxAttempts: 320,
      authorizedMaxAttempts: 320,
      initialAttempts: result.initialAttempts,
      deadlineAt,
      now: () => now,
      onAcquire: (ordinal) => admitted.push(ordinal),
    });
    budget.acquire().release();
    budget.acquire().release();
    assert.deepEqual(admitted, [319, 320]);
    assert.throws(() => budget.acquire(), /MODEL_EVALUATION_ATTEMPT_LIMIT/);
    assert.throws(
      () =>
        readProviderEvaluationContinuation(
          { ...fixture.input, deadlineAt: deadlineAt + 1 },
          JSON.parse,
        ),
      /MODEL_EVAL_PREVIOUS_AUTHORITY_MISMATCH/,
    );
  } finally {
    fixture.close();
  }
});

test('continuation refuses inconsistent count, journal, hash and previous authority', () => {
  for (const settings of [
    { reportPatch: { previousProviderAttempts: -1 } },
    { reportPatch: { thisRunProviderAttempts: 2 } },
    { reportPatch: { cleanupVerified: false } },
    { journal: [{ ordinal: 317 }] },
    { authorityPatch: { maxAttempts: 80 } },
    { authorityPatch: { deadlineAt: deadlineAt - 1 } },
  ]) {
    const fixture = previousRun(settings);
    try {
      assert.throws(
        () => readProviderEvaluationContinuation(fixture.input, JSON.parse),
        /MODEL_EVAL_PREVIOUS_/,
      );
    } finally {
      fixture.close();
    }
  }
  const fixture = previousRun();
  try {
    assert.throws(
      () =>
        readProviderEvaluationContinuation(
          { ...fixture.input, previousReportSha256: 'a'.repeat(64) },
          JSON.parse,
        ),
      /MODEL_EVAL_PREVIOUS_REPORT_MISMATCH/,
    );
    assert.throws(
      () =>
        readProviderEvaluationContinuation(
          { ...fixture.input, initialAttempts: 317 },
          JSON.parse,
        ),
      /MODEL_EVAL_PREVIOUS_ATTEMPTS_MISMATCH/,
    );
  } finally {
    fixture.close();
  }
});

test('wrapped fatal admission failure aborts before any later model dispatch', async () => {
  const admitted = [];
  const modelFailures = [];
  const fatal = Object.assign(new Error('synthetic admission'), {
    aiRequestFatal: true,
    cause: Object.assign(new Error('journal'), {
      code: 'MODEL_EVAL_LEDGER_ATTEMPT_BEGIN_FAILED',
    }),
  });
  await assert.rejects(
    runProviderEvaluationProbes(
      [model, { ...model, selectionId: 'groq:other' }],
      [{ id: 'availability' }, { id: 'sql-count' }],
      async (item, probe) => {
        await runProviderEvaluationProbe(
          async () => {
            admitted.push([item.selectionId, probe.id]);
            throw fatal;
          },
          async (error) => modelFailures.push(error),
        );
      },
    ),
    (error) => error === fatal,
  );
  assert.deepEqual(admitted, [['groq:fixture', 'availability']]);
  assert.equal(modelFailures.length, 0);
});

test('nested control and journal write failure are fatal rather than model outcomes', async () => {
  for (const error of [
    new Error('outer', {
      cause: new Error('nested', {
        cause: Object.assign(new Error('control'), { aiRequestFatal: true }),
      }),
    }),
    new Error('outer', {
      cause: Object.assign(new Error('native'), {
        code: 'MODEL_NATIVE_EXECUTION_FAILED',
      }),
    }),
  ]) {
    let classified = false;
    await assert.rejects(
      runProviderEvaluationProbe(
        async () => {
          throw error;
        },
        async () => {
          classified = true;
        },
      ),
      (caught) => caught === error,
    );
    assert.equal(classified, false);
  }
  const directory = mkdtempSync(
    join(tmpdir(), 'data-explorer-provider-journal-'),
  );
  try {
    assert.throws(
      () =>
        durableRecord(join(directory, 'missing', 'attempts.ndjson'), {
          ordinal: 1,
        }),
      (error) =>
        error.aiRequestFatal === true &&
        error.code === 'MODEL_EVAL_JOURNAL_FAILED',
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('ordinary HTTP quota and credit failures remain operational evidence', async () => {
  const failures = [];
  for (const status of [402, 429, 404]) {
    const error = Object.assign(new Error('synthetic provider refusal'), {
      status,
    });
    await runProviderEvaluationProbe(
      async () => {
        throw error;
      },
      async (value) => failures.push(value.status),
    );
  }
  assert.deepEqual(failures, [402, 429, 404]);
});

test('adapter-only fatal errors win over old HTTP failures before subsequent dispatch', async () => {
  const fatal = Object.assign(new Error('synthetic unsettled attempt'), {
    code: 'MODEL_EVAL_DURABLE_ATTEMPT_INVALID',
  });
  const old = Object.assign(new Error('old provider failure'), { status: 429 });
  const chat = chatServices(
    {
      chat: async () => {
        throw fatal;
      },
    },
    { providerError: old },
  );
  const calls = [];
  await assert.rejects(
    runProviderEvaluationProbes(
      [model, { ...model, selectionId: 'groq:other' }],
      [{ id: 'availability' }],
      async (entry) => {
        calls.push(entry.selectionId);
        await runProviderEvaluationProbe(
          () => chat.chat({}),
          () => {},
        );
      },
    ),
    (error) => error === fatal,
  );
  assert.deepEqual(calls, [model.selectionId]);
});

test('discovery shares the absolute scope deadline after slow ledger admission', () => {
  let clock = now;
  const received = [];
  const controller = new AbortController();
  const scope = createProviderEvaluationDiscoveryScope(
    now + 500,
    (options) => {
      received.push(options);
      return {
        signal: controller.signal,
        deadlineAt: Math.min(
          options.deadlineAt ?? Infinity,
          clock + options.timeoutMs,
        ),
        dispose() {},
      };
    },
    () => clock,
  );
  assert.deepEqual(received, [{ timeoutMs: 15000, deadlineAt: now + 500 }]);
  assert.equal(scope.deadlineAt, now + 500);
  clock += 300;
  assert.equal(scope.transportTimeoutMs(), 200);
  clock += 200;
  assert.throws(() => scope.transportTimeoutMs(), /MODEL_EVAL_DEADLINE/);
});

test('discovery cancellation fires at authority expiry instead of a renewed 15-second timeout', async () => {
  const { mock } = require('node:test');
  mock.timers.enable({ apis: ['Date', 'setTimeout'], now });
  try {
    require('ts-node').register({
      transpileOnly: true,
      project: join(__dirname, '../tsconfig.json'),
    });
    const { createAiRequestScope } = require('../src/ai/ai-request-lifecycle');
    const scope = createProviderEvaluationDiscoveryScope(
      now + 500,
      createAiRequestScope,
    );
    assert.equal(scope.signal.aborted, false);
    mock.timers.tick(499);
    assert.equal(scope.signal.aborted, false);
    mock.timers.tick(1);
    assert.equal(scope.signal.aborted, true);
    assert.throws(() => scope.transportTimeoutMs(), /MODEL_EVAL_DEADLINE/);
    scope.dispose();
  } finally {
    mock.timers.reset();
  }
});

test('current fatal failure cannot be replaced by a stale provider error', async () => {
  const fatal = Object.assign(new Error('synthetic ledger failure'), {
    aiRequestFatal: true,
  });
  const chat = chatServices(
    {
      chat: async () => {
        throw fatal;
      },
    },
    { providerError: Object.assign(new Error('old quota'), { status: 429 }) },
  );
  await assert.rejects(chat.chat({}), (error) => error === fatal);
});

test('follow-up Explain preserves unexpected SQL so the existing rubric rejects it', async () => {
  const chat = chatServices(
    {
      chat: async () => ({
        message: 'explanation',
        sql: 'SELECT 1',
        provider: 'groq',
        model: 'fixture',
        providerReportedModel: 'actual-alias',
      }),
    },
    { providerResult: { providerReportedModel: 'other-alias' } },
  );
  const result = await chat.chat({});
  assert.equal(result.sql, 'SELECT 1');
  assert.equal(result.providerReportedModel, 'actual-alias');
  const { assessModelProbe } = await import(evaluationUrl);
  const assessment = await assessModelProbe(
    { id: 'explain-null', rubric: 'independent-review-required' },
    { ...result, terminalVerified: true },
    { cases: [] },
  );
  assert.equal(assessment.verdict, 'observed-failure');
  assert.deepEqual(assessment.reasons, ['UNEXPECTED_QUERY']);
});

test('follow-up Explain retains actual identity instead of echoing the requested model', async () => {
  const chat = chatServices({
    chat: async () => ({
      message: 'explanation',
      provider: 'openrouter',
      model: 'different',
      providerReportedModel: 'different',
    }),
  });
  const result = await chat.chat({});
  assert.equal(result.provider, 'openrouter');
  assert.equal(result.model, 'different');
  const adapter = createAppModelRoleAdapter({
    provider: 'groq',
    apiKey: 'synthetic',
    baseUrl: 'https://api.groq.com/openai/v1',
    deadlineAt: Date.now() + 1000,
    services: {
      chat,
      autocomplete: {},
      assertProvider: async () => {},
      beginExecution: async () => ({
        generationId: 'owned',
        beforeAttempt: async () => {},
        complete: async () => {},
        fail: async () => {},
        release: async () => {},
      }),
    },
  });
  await assert.rejects(
    adapter.runProbe(
      {
        model,
        probe: {
          id: 'explain-null',
          operation: 'chat',
          prompt: 'Explain',
          schema: {},
        },
      },
      {
        acquire() {
          throw new Error('must not admit');
        },
      },
    ),
    /MODEL_EVAL_RESULT_IDENTITY_MISMATCH/,
  );
});

test('Redis cleanup failure cannot prevent owned DB deletion or disconnect', async () => {
  const fixture = stores({ redisFailure: true });
  const failures = await cleanupProviderEvaluationResources(fixture.options);
  for (const name of [
    'feedback.delete',
    'attempts.delete',
    'generations.delete',
    'actor.delete',
    'prisma.disconnect',
    'redis.disconnect',
  ])
    assert.ok(
      fixture.calls.some((call) => call[0] === name),
      name,
    );
  assert.ok(failures.length > 0);
  assert.ok(
    fixture.readbacks.some(
      (row) => row.actors === 0 && row.generations === 0 && row.leases === null,
    ),
  );
  assert.deepEqual(
    fixture.calls.find((call) => call[0] === 'actor.delete')[1],
    { where: { id: 'owned-actor', email: 'provider-eval-owned@example.test' } },
  );
});

test('native and DB failures still attempt independent Redis cleanup and both disconnects', async () => {
  const fixture = stores({ dbFailure: true, nativeFailure: true });
  const failures = await cleanupProviderEvaluationResources(fixture.options);
  assert.ok(fixture.calls.some((call) => call[0] === 'redis.zrem'));
  assert.ok(fixture.calls.some((call) => call[0] === 'prisma.disconnect'));
  assert.ok(fixture.calls.some((call) => call[0] === 'redis.disconnect'));
  assert.ok(
    failures.some((failure) => failure.code === 'MODEL_NATIVE_CLEANUP_FAILED'),
  );
  assert.ok(failures.some((failure) => failure.code.includes('STORE')));
});

test('synchronous disconnect failure cannot skip the other store teardown', async () => {
  const fixture = stores({ disconnectFailure: true });
  const failures = await cleanupProviderEvaluationResources(fixture.options);
  assert.ok(fixture.calls.some((call) => call[0] === 'redis.disconnect'));
  assert.ok(
    failures.some((failure) => failure.code === 'MODEL_EVAL_DISCONNECT_FAILED'),
  );
});

test('clean teardown uses only exact owned ids and verifies all readbacks', async () => {
  const fixture = stores();
  const failures = await cleanupProviderEvaluationResources(fixture.options);
  assert.deepEqual(failures, []);
  assert.deepEqual(fixture.readbacks, [
    { actors: 0, generations: 0, attempts: 0, leases: 0 },
  ]);
  assert.deepEqual(
    fixture.calls.find((call) => call[0] === 'generations.delete')[1],
    { where: { id: { in: ['owned-generation'] }, userId: 'owned-actor' } },
  );
  assert.ok(
    fixture.calls
      .filter((call) => call[0] === 'redis.zrem')
      .every((call) => call[2] === 'owned-generation'),
  );
});

test('new runner import is side-effect-free even with inherited credential sentinels', () => {
  const path = join(__dirname, 'fixtures/ai-provider-model-live-runner.cjs');
  const environment = {
    PATH: process.env.PATH,
    SystemRoot: process.env.SystemRoot,
    WINDIR: process.env.WINDIR,
    BEEKNOEE_API_KEY: 'IMPORT_MUST_NOT_EXPOSE_SENTINEL',
  };
  const result = spawnSync(
    process.execPath,
    [
      '-e',
      `const before = process.env.BEEKNOEE_API_KEY; require(${JSON.stringify(path)}); if (process.env.BEEKNOEE_API_KEY !== before || require.cache[require.resolve('ts-node')] || Object.keys(require.cache).some(path => /prisma.service|redis.service/.test(path))) process.exitCode = 1;`,
    ],
    {
      cwd: join(__dirname, '..'),
      env: environment,
      encoding: 'utf8',
      timeout: 10000,
    },
  );
  assert.ifError(result.error);
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, '');
});

test('invalid continuation is rejected before configuration or store bootstrap', () => {
  const directory = mkdtempSync(
    join(tmpdir(), 'data-explorer-provider-preflight-'),
  );
  const output = join(directory, 'output');
  mkdirSync(output);
  const path = join(directory, 'authority.json');
  writeFileSync(
    path,
    JSON.stringify(
      authority({ deadlineAt: Date.now() + 60_000, initialAttempts: 318 }),
    ),
  );
  try {
    const result = spawnSync(
      process.execPath,
      [
        join(__dirname, 'fixtures/ai-provider-model-live-runner.cjs'),
        join(directory, 'config-must-not-be-read'),
        path,
        output,
      ],
      {
        cwd: join(__dirname, '..'),
        env: {
          PATH: process.env.PATH,
          SystemRoot: process.env.SystemRoot,
          WINDIR: process.env.WINDIR,
        },
        encoding: 'utf8',
        timeout: 10000,
      },
    );
    assert.ifError(result.error);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /MODEL_EVAL_CONTINUATION_INVALID/);
    assert.doesNotMatch(
      result.stderr,
      /ENV_INVALID|FIXTURE|Prisma|config-must-not/,
    );
    assert.equal(readFileSync(join(output, 'attempts.ndjson'), 'utf8'), '');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('journal handles partial writes and fsync failure is fatal with a closed descriptor', () => {
  const written = [];
  let closed = false;
  const record = { ordinal: 1 };
  durableRecord('synthetic-only', record, {
    openSync: () => 17,
    writeSync: (_fd, bytes, offset, count) => {
      const length = Math.min(count, 3);
      written.push(bytes.subarray(offset, offset + length));
      return length;
    },
    fsyncSync: () => {},
    closeSync: () => {
      closed = true;
    },
  });
  assert.equal(
    Buffer.concat(written).toString('utf8'),
    `${JSON.stringify(record)}\n`,
  );
  assert.equal(closed, true);
  closed = false;
  assert.throws(
    () =>
      durableRecord('synthetic-only', record, {
        openSync: () => 17,
        writeSync: (_fd, _bytes, _offset, count) => count,
        fsyncSync: () => {
          throw new Error('synthetic fsync failure');
        },
        closeSync: () => {
          closed = true;
        },
      }),
    (error) =>
      error.code === 'MODEL_EVAL_JOURNAL_FAILED' &&
      isProviderEvaluationFatal(error),
  );
  assert.equal(closed, true);
});

test('failed journal admission cannot dispatch or regain allowance for a later model', async () => {
  const { createModelAttemptBudget } = await import(evaluationUrl);
  const budget = createModelAttemptBudget({
    maxAttempts: 320,
    authorizedMaxAttempts: 320,
    deadlineAt,
    now: () => now,
    onAcquire: (ordinal) =>
      durableRecord(
        'synthetic-only',
        { ordinal },
        {
          openSync: () => {
            throw new Error('synthetic journal unavailable');
          },
        },
      ),
  });
  const calls = [];
  await assert.rejects(
    runProviderEvaluationProbes(
      [model, { ...model, selectionId: 'groq:second' }],
      [{ id: 'availability' }],
      async (item) => {
        calls.push(['admission', item.selectionId]);
        await runProviderEvaluationProbe(
          async () => {
            budget.acquire();
            calls.push(['dispatch']);
          },
          () => {
            throw new Error('fatal must not be classified');
          },
        );
      },
    ),
    /MODEL_EVAL_JOURNAL_FAILED/,
  );
  assert.equal(budget.attempts, 0);
  assert.equal(budget.active, false);
  assert.deepEqual(calls, [['admission', model.selectionId]]);
});

test('bounded and cyclic cause chains fail closed while adapter evidence remains nonfatal', () => {
  const cycle = new Error('synthetic cycle');
  cycle.cause = cycle;
  assert.equal(isProviderEvaluationFatal(cycle), true);
  let nested = new Error('synthetic end');
  for (let index = 0; index < 20; index++)
    nested = new Error('synthetic wrapper', { cause: nested });
  assert.equal(isProviderEvaluationFatal(nested), true);
  const adapter = createAppModelRoleAdapter({
    provider: 'groq',
    apiKey: 'synthetic',
    baseUrl: 'https://api.groq.com/openai/v1',
    deadlineAt: Date.now() + 1000,
    services: {
      chat: {},
      autocomplete: {},
      assertProvider: async () => {},
      beginExecution: async () => {},
    },
  });
  assert.equal(
    isProviderEvaluationFatal(
      Object.assign(new Error('identity'), {
        code: 'MODEL_EVAL_RESULT_IDENTITY_MISMATCH',
      }),
      adapter.isFatalError,
    ),
    false,
  );
  assert.equal(
    isProviderEvaluationFatal(
      Object.assign(new Error('settlement'), {
        code: 'MODEL_EVAL_DURABLE_ATTEMPT_INVALID',
      }),
      adapter.isFatalError,
    ),
    true,
  );
});

test('every discovery ledger operation stays fatal even when storage returns an untagged error', async () => {
  const codes = [
    'MODEL_EVAL_LEDGER_BEGIN_FAILED',
    'MODEL_EVAL_LEDGER_ATTEMPT_BEGIN_FAILED',
    'MODEL_EVAL_LEDGER_ATTEMPT_COMPLETE_FAILED',
    'MODEL_EVAL_LEDGER_COMPLETE_FAILED',
    'MODEL_EVAL_LEDGER_ATTEMPT_FAIL_FAILED',
    'MODEL_EVAL_LEDGER_FAIL_FAILED',
    'MODEL_EVAL_LEDGER_RELEASE_FAILED',
  ];
  for (const code of codes) {
    const calls = [];
    const cause = new Error('synthetic untagged storage failure');
    await assert.rejects(
      runProviderEvaluationProbes(
        [model, { ...model, selectionId: 'groq:other' }],
        [{ id: 'availability' }],
        async (item) => {
          calls.push(item.selectionId);
          await runProviderEvaluationProbe(
            () =>
              runProviderEvaluationLedger(code, () => {
                throw cause;
              }),
            () => {
              throw new Error('must not record a model failure');
            },
          );
        },
      ),
      (error) =>
        error.code === code &&
        error.cause === cause &&
        error.aiRequestFatal === true,
    );
    assert.deepEqual(calls, [model.selectionId]);
  }
});

test('adapter preserves a wrapped fatal policy cause instead of downgrading it', async () => {
  const fatal = Object.assign(new Error('synthetic policy storage failure'), {
    aiRequestFatal: true,
  });
  const wrapped = new Error('outer policy', { cause: fatal });
  let opened = false;
  const adapter = createAppModelRoleAdapter({
    provider: 'groq',
    apiKey: 'synthetic',
    baseUrl: 'https://api.groq.com/openai/v1',
    deadlineAt: Date.now() + 1000,
    services: {
      chat: {},
      autocomplete: {},
      assertProvider: async () => {
        throw wrapped;
      },
      beginExecution: async () => {
        opened = true;
      },
    },
  });
  await assert.rejects(
    adapter.runProbe({ model, probe: { id: 'availability' } }, {}),
    (error) =>
      error === wrapped &&
      isProviderEvaluationFatal(error, adapter.isFatalError),
  );
  assert.equal(opened, false);
});

test('continuation rejects symbolic links and oversized prior artifacts', () => {
  const fixture = previousRun();
  const alias = `${fixture.directory}-alias`;
  try {
    symlinkSync(
      fixture.directory,
      alias,
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    assert.throws(
      () =>
        readProviderEvaluationContinuation(
          { ...fixture.input, previousRun: alias },
          JSON.parse,
        ),
      /MODEL_EVAL_PREVIOUS_REPORT_INVALID/,
    );
    writeFileSync(
      join(fixture.directory, 'assessment.json'),
      'x'.repeat(512 * 1024 + 1),
    );
    assert.throws(
      () => readProviderEvaluationContinuation(fixture.input, JSON.parse),
      /MODEL_EVAL_PREVIOUS_REPORT_INVALID/,
    );
  } finally {
    if (process.platform === 'win32') require('node:fs').unlinkSync(alias);
    else require('node:fs').unlinkSync(alias);
    fixture.close();
  }
});

test('valid first-run journal retains compatibility when continuation offset is absent', () => {
  const fixture = previousRun({ attempts: 1, offset: 0 });
  try {
    const path = join(fixture.directory, 'assessment.json');
    const report = JSON.parse(readFileSync(path, 'utf8'));
    delete report.previousProviderAttempts;
    delete report.thisRunProviderAttempts;
    const bytes = Buffer.from(JSON.stringify(report));
    writeFileSync(path, bytes);
    assert.equal(
      readProviderEvaluationContinuation(
        {
          ...fixture.input,
          previousReportSha256: createHash('sha256')
            .update(bytes)
            .digest('hex'),
        },
        JSON.parse,
      ).initialAttempts,
      1,
    );
  } finally {
    fixture.close();
  }
});

test('readback failure remains unknown and DB deletion failure cannot skip Redis cleanup', async () => {
  const fixture = stores();
  fixture.options.prisma.aiGenerationFeedback.deleteMany = async () => {
    fixture.calls.push(['feedback.delete.failed']);
    throw new Error('synthetic delete failure');
  };
  fixture.options.prisma.user.count = async () => {
    throw new Error('synthetic readback failure');
  };
  const failures = await cleanupProviderEvaluationResources(fixture.options);
  assert.ok(fixture.calls.some((call) => call[0] === 'redis.del'));
  assert.ok(fixture.calls.some((call) => call[0] === 'attempts.delete'));
  assert.ok(fixture.calls.some((call) => call[0] === 'actor.delete'));
  assert.ok(fixture.calls.some((call) => call[0] === 'redis.disconnect'));
  assert.ok(fixture.readbacks.some((row) => row.actors === null));
  assert.ok(
    failures.some(
      (failure) => failure.code === 'MODEL_EVAL_STORE_CLEANUP_FAILED',
    ),
  );
});

test('new runner refuses missing arguments without importing application runtime', () => {
  const path = join(__dirname, 'fixtures/ai-provider-model-live-runner.cjs');
  const result = spawnSync(process.execPath, [path], {
    cwd: join(__dirname, '..'),
    env: {
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
      WINDIR: process.env.WINDIR,
    },
    encoding: 'utf8',
    timeout: 10000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /MODEL_EVAL_RUN_ARGUMENTS_INVALID/);
  assert.doesNotMatch(result.stderr, /api[_-]?key|postgresql|Prisma|ts-node/i);
});
