'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  createAppModelRoleAdapter,
} = require('./fixtures/ai-model-role-adapter.cjs');

const model = {
  selectionId: 'beeknoee:bee/gemini-3.8-flash',
  apiModel: 'bee/gemini-3.8-flash',
  label: 'Gemini 3.8 Flash (Bee)',
};
const probe = {
  id: 'availability',
  role: 'assistant',
  operation: 'chat',
  prompt: 'Reply with exactly SMOKE_ACK.',
  beforeCursor: '',
  afterCursor: '',
  databaseType: 'postgres',
  language: 'en',
  schema: { orders: { id: 'integer' } },
  rubric: 'format-only-not-task-quality',
};
function budget() {
  let attempts = 0;
  let active = false;
  return {
    get attempts() {
      return attempts;
    },
    get active() {
      return active;
    },
    acquire() {
      assert.equal(active, false);
      active = true;
      attempts++;
      let done = false;
      return {
        release() {
          if (!done) {
            done = true;
            active = false;
          }
        },
      };
    },
  };
}
function services(overrides = {}) {
  const durable = {
    generationId: 'fixture-generation',
    beforeAttempt: async () => ({
      attemptId: 'durable-attempt',
      complete: async () => {},
      fail: async () => {},
    }),
    complete: async () => ({ outcome: 'succeeded', usage: null }),
    fail: async () => ({ outcome: 'failed', usage: null }),
    release: async () => {},
  };
  const chat = {
    chat: async (params) => {
      const plan = {
        provider: 'beeknoee',
        model: model.apiModel,
        baseUrl: 'https://platform.beeknoee.com/api/v1',
      };
      await params.beforeProviderAttempt(plan);
      const attempt = await params.execution.beforeAttempt(plan);
      await attempt.complete({
        provider: plan.provider,
        model: plan.model,
        usage: { promptTokens: 2, completionTokens: 1, totalTokens: 3 },
      });
      return {
        message: 'SMOKE_ACK',
        provider: 'beeknoee',
        model: model.apiModel,
        routingMode: 'auto',
        usage: { promptTokens: 2, completionTokens: 1, totalTokens: 3 },
      };
    },
    chatStream: async function* () {},
  };
  return {
    chat,
    autocomplete: { autocomplete: async () => '' },
    assertProvider: () => {},
    beginExecution: async () => durable,
    ...overrides,
  };
}

test('chat probes use exact Beeknoee selection with no fallback and one settled attempt', async () => {
  const calls = [];
  const fixture = services();
  const original = fixture.chat.chat;
  fixture.chat.chat = async (params) => {
    calls.push(params);
    return original(params);
  };
  const adapter = createAppModelRoleAdapter({
    apiKey: 'secret-not-reported',
    baseUrl: 'https://platform.beeknoee.com/api/v1',
    deadlineAt: Date.now() + 30_000,
    services: fixture,
  });
  const limit = budget();
  const result = await adapter.runProbe({ model, probe }, limit);
  assert.equal(result.message, 'SMOKE_ACK');
  assert.equal(result.reportedModel, null);
  assert.deepEqual(result.usage, {
    promptTokens: 2,
    completionTokens: 1,
    totalTokens: 3,
  });
  assert.equal(limit.attempts, 1);
  assert.equal(limit.active, false);
  assert.match(result.requestSha256, /^[0-9a-f]{64}$/);
  assert.equal(calls[0].model, model.selectionId);
  assert.equal(calls[0].fallbackProvider, 'none');
  assert.deepEqual(calls[0].disabledProviders.sort(), [
    'cerebras',
    'gemini',
    'groq',
    'openrouter',
  ]);
  assert.ok(!JSON.stringify(result).includes('secret-not-reported'));
});

test('stream probes require a done event and retain first-chunk timing separately', async () => {
  const fixture = services();
  fixture.chat.chatStream = async function* (params) {
    const plan = {
      provider: 'beeknoee',
      model: model.apiModel,
      baseUrl: 'https://platform.beeknoee.com/api/v1',
    };
    await params.beforeProviderAttempt(plan);
    const attempt = await params.execution.beforeAttempt(plan);
    yield { type: 'chunk', text: 'SMOKE_' };
    await attempt.complete({ provider: plan.provider, model: plan.model });
    yield {
      type: 'done',
      data: {
        message: 'SMOKE_ACK',
        provider: 'beeknoee',
        model: model.apiModel,
        routingMode: 'auto',
      },
    };
  };
  const adapter = createAppModelRoleAdapter({
    apiKey: 'secret',
    baseUrl: 'https://platform.beeknoee.com/api/v1',
    deadlineAt: Date.now() + 30_000,
    services: fixture,
  });
  const result = await adapter.runProbe(
    { model, probe: { ...probe, operation: 'stream' } },
    budget(),
  );
  assert.equal(result.terminalVerified, true);
  assert.equal(result.message, 'SMOKE_ACK');
  assert.equal(typeof result.ttftMs, 'number');
});

test('missing stream terminal evidence fails without substituting a role result', async () => {
  const fixture = services();
  fixture.chat.chatStream = async function* () {
    yield { type: 'chunk', text: 'partial' };
  };
  const adapter = createAppModelRoleAdapter({
    apiKey: 'secret',
    baseUrl: 'https://platform.beeknoee.com/api/v1',
    deadlineAt: Date.now() + 30_000,
    services: fixture,
  });
  await assert.rejects(
    adapter.runProbe(
      { model, probe: { ...probe, operation: 'stream' } },
      budget(),
    ),
    /MODEL_EVAL_STREAM_TERMINAL_MISSING/,
  );
});

test('policy and plan mismatches fail before the provider operation is credited', async () => {
  let invoked = false;
  const fixture = services({
    assertProvider: () => {
      throw Object.assign(new Error('denied SECRET'), { status: 403 });
    },
  });
  fixture.chat.chat = async () => {
    invoked = true;
    return { message: 'unexpected' };
  };
  const adapter = createAppModelRoleAdapter({
    apiKey: 'secret',
    baseUrl: 'https://platform.beeknoee.com/api/v1',
    deadlineAt: Date.now() + 30_000,
    services: fixture,
  });
  await assert.rejects(
    adapter.runProbe({ model, probe }, budget()),
    (error) =>
      error.code === 'MODEL_EVAL_POLICY_DENIED' && !adapter.isFatalError(error),
  );
  assert.equal(invoked, false);
});

test('awaits asynchronous policy refusal before creating an execution or provider request', async () => {
  let began = false;
  let invoked = false;
  const fixture = services({
    assertProvider: async () => {
      await Promise.resolve();
      throw Object.assign(new Error('async denied SECRET'), { status: 403 });
    },
    beginExecution: async () => {
      began = true;
      throw new Error('must not begin');
    },
  });
  fixture.chat.chat = async () => {
    invoked = true;
    return { message: 'unexpected' };
  };
  const adapter = createAppModelRoleAdapter({
    apiKey: 'secret',
    baseUrl: 'https://platform.beeknoee.com/api/v1',
    deadlineAt: Date.now() + 30_000,
    services: fixture,
  });
  await assert.rejects(
    adapter.runProbe({ model, probe }, budget()),
    (error) =>
      error.code === 'MODEL_EVAL_POLICY_DENIED' && !adapter.isFatalError(error),
  );
  assert.equal(began, false);
  assert.equal(invoked, false);
});

test('ledger settlement failures are fatal instead of becoming model capability evidence', async () => {
  const fixture = services({
    beginExecution: async () => ({
      generationId: 'fixture-generation',
      beforeAttempt: async () => ({
        attemptId: 'fixture-attempt',
        complete: async () => {},
        fail: async () => {
          throw new Error('private ledger failure');
        },
      }),
      complete: async () => ({ outcome: 'succeeded', usage: null }),
      fail: async () => ({ outcome: 'failed', usage: null }),
      release: async () => {},
    }),
  });
  fixture.chat.chat = async (params) => {
    const plan = {
      provider: 'beeknoee',
      model: model.apiModel,
      baseUrl: 'https://platform.beeknoee.com/api/v1',
    };
    await params.beforeProviderAttempt(plan);
    await params.execution.beforeAttempt(plan);
    throw Object.assign(new Error('provider denied'), { status: 403 });
  };
  const adapter = createAppModelRoleAdapter({
    apiKey: 'secret',
    baseUrl: 'https://platform.beeknoee.com/api/v1',
    deadlineAt: Date.now() + 30_000,
    services: fixture,
  });
  await assert.rejects(
    adapter.runProbe({ model, probe }, budget()),
    (error) =>
      error.code === 'MODEL_EVAL_LEDGER_ATTEMPT_FAIL_FAILED' &&
      adapter.isFatalError(error),
  );
});
test('autocomplete probes preserve exact role model and owned request hooks', async () => {
  let received;
  const fixture = services({
    autocomplete: {
      autocomplete: async (params) => {
        received = params;
        const plan = {
          provider: 'beeknoee',
          model: model.apiModel,
          baseUrl: 'https://platform.beeknoee.com/api/v1',
        };
        await params.beforeProviderAttempt(plan);
        const attempt = await params.execution.beforeAttempt(plan);
        await attempt.complete({ provider: plan.provider, model: plan.model });
        return 'ULL';
      },
    },
  });
  const adapter = createAppModelRoleAdapter({
    apiKey: 'secret',
    baseUrl: 'https://platform.beeknoee.com/api/v1',
    deadlineAt: Date.now() + 30_000,
    services: fixture,
  });
  const result = await adapter.runProbe(
    {
      model,
      probe: {
        ...probe,
        operation: 'autocomplete',
        beforeCursor: 'SELECT id FROM orders WHERE note IS N',
        afterCursor: ' ORDER BY id ASC',
      },
    },
    budget(),
  );
  assert.equal(result.message, 'ULL');
  assert.equal(received.model, model.selectionId);
  assert.equal(received.fallbackProvider, 'none');
  assert.ok(received.execution);
  assert.equal(typeof received.beforeProviderAttempt, 'function');
});

test('adapter refuses absent or incomplete durable ledger capability', () => {
  const absent = services();
  delete absent.beginExecution;
  assert.throws(
    () =>
      createAppModelRoleAdapter({
        apiKey: 'secret',
        baseUrl: 'https://platform.beeknoee.com/api/v1',
        deadlineAt: Date.now() + 1_000,
        services: absent,
      }),
    /MODEL_EVAL_SERVICES_INVALID/,
  );
});

test('adapter refuses an incomplete durable execution before dispatch', async () => {
  const fixture = services({
    beginExecution: async () => ({
      generationId: 'fixture-generation',
      beforeAttempt: async () => undefined,
      complete: async () => ({ outcome: 'succeeded', usage: null }),
      fail: async () => ({ outcome: 'failed', usage: null }),
      release: async () => {},
    }),
  });
  const adapter = createAppModelRoleAdapter({
    apiKey: 'secret',
    baseUrl: 'https://platform.beeknoee.com/api/v1',
    deadlineAt: Date.now() + 30_000,
    services: fixture,
  });
  await assert.rejects(
    adapter.runProbe({ model, probe }, budget()),
    /MODEL_EVAL_DURABLE_ATTEMPT_INVALID/,
  );
});
test('adapter refuses absent credentials, paid-looking endpoints and expired runs', () => {
  assert.throws(
    () =>
      createAppModelRoleAdapter({
        apiKey: '',
        baseUrl: 'https://platform.beeknoee.com/api/v1',
        deadlineAt: Date.now() + 1_000,
        services: services(),
      }),
    /MODEL_EVAL_CREDENTIAL_MISSING/,
  );
  assert.throws(
    () =>
      createAppModelRoleAdapter({
        apiKey: 'secret',
        baseUrl: 'https://example.com/v1',
        deadlineAt: Date.now() + 1_000,
        services: services(),
      }),
    /MODEL_EVAL_RECIPIENT_MISMATCH/,
  );
  assert.throws(
    () =>
      createAppModelRoleAdapter({
        apiKey: 'secret',
        baseUrl: 'https://platform.beeknoee.com/api/v1',
        deadlineAt: Date.now() - 1,
        services: services(),
      }),
    /MODEL_EVAL_DEADLINE/,
  );
});
