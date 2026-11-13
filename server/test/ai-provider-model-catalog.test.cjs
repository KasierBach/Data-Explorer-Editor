'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  readProviderAssessmentRoster,
  MODEL_EVALUATION_ENDPOINTS,
  classifyProviderFailure,
} = require('./fixtures/ai-provider-model-catalog.cjs');
const {
  createAppModelRoleAdapter,
} = require('./fixtures/ai-model-role-adapter.cjs');

const roster = readProviderAssessmentRoster();

test('multi-provider roster covers every built-in model except direct Gemini', () => {
  assert.equal(roster.length, 30);
  assert.equal(
    roster.filter((model) => model.provider === 'beeknoee').length,
    12,
  );
  assert.equal(roster.filter((model) => model.provider === 'groq').length, 5);
  assert.equal(
    roster.filter((model) => model.provider === 'openrouter').length,
    13,
  );
  assert.ok(roster.every((model) => model.provider !== 'gemini'));
  assert.ok(roster.some((model) => model.apiModel === 'bee/gemini-4-argon'));
});

test('each authorized provider keeps exact plan payload ledger and no-fallback identity', async () => {
  for (const provider of Object.keys(MODEL_EVALUATION_ENDPOINTS)) {
    const apiModel =
      provider === 'openrouter' ? 'vendor/fixture:free' : 'fixture-model';
    const model = {
      provider,
      apiModel,
      selectionId:
        provider === 'openrouter' ? apiModel : `${provider}:${apiModel}`,
      label: 'Fixture',
    };
    const expected = {
      provider,
      model: apiModel,
      baseUrl: MODEL_EVALUATION_ENDPOINTS[provider],
    };
    let admitted = 0;
    let complete = 0;
    const services = {
      assertProvider: async (plan) => assert.deepEqual(plan, expected),
      beginExecution: async () => ({
        generationId: 'fixture-generation',
        beforeAttempt: async (plan) => {
          assert.equal(plan.provider, provider);
          assert.equal(plan.model, apiModel);
          return {
            attemptId: 'fixture-attempt',
            complete: async () => {
              complete++;
            },
            fail: async () => {},
          };
        },
        complete: async () => ({ outcome: 'succeeded', usage: null }),
        fail: async () => {},
        release: async () => {},
      }),
      chat: {
        chat: async (params) => {
          assert.equal(params.fallbackProvider, 'none');
          assert.ok(params.disabledProviders.includes('gemini'));
          assert.ok(!params.disabledProviders.includes(provider));
          assert.equal(params.databaseType, 'postgres');
          await params.beforeProviderAttempt(expected);
          const handle = await params.execution.beforeAttempt({
            provider,
            model: apiModel,
          });
          await handle.complete({ provider, model: apiModel });
          return { message: 'SMOKE_ACK', provider, model: apiModel };
        },
      },
      autocomplete: {},
    };
    const adapter = createAppModelRoleAdapter({
      provider,
      apiKey: 'synthetic',
      baseUrl: expected.baseUrl,
      deadlineAt: Date.now() + 1000,
      services,
    });
    const result = await adapter.runProbe(
      {
        model,
        probe: {
          id: 'availability',
          operation: 'chat',
          prompt: 'SMOKE_ACK',
          schema: {},
          databaseType: 'postgres',
        },
      },
      {
        acquire: () => {
          admitted++;
          return { release() {} };
        },
      },
    );
    assert.equal(result.message, 'SMOKE_ACK');
    assert.equal(admitted, 1);
    assert.equal(complete, 1);
  }
});

test('multi-provider adapters refuse Gemini and mismatched recipients before dispatch', () => {
  for (const provider of ['gemini', 'zhipu', 'custom'])
    assert.throws(
      () =>
        createAppModelRoleAdapter({
          provider,
          apiKey: 'synthetic',
          baseUrl: 'https://generativelanguage.googleapis.com',
          deadlineAt: Date.now() + 1000,
          services: {},
        }),
      /MODEL_EVAL_RECIPIENT_MISMATCH/,
    );
});

test('provider failure classifications follow original causes and never repeat secrets', () => {
  const failure = new Error('Application failure', {
    cause: Object.assign(new Error('SECRET provider text'), { status: 402 }),
  });
  const classified = classifyProviderFailure(failure);
  assert.equal(classified.status, 'credits-required');
  assert.equal(classified.httpStatus, 402);
  assert.ok(!JSON.stringify(classified).includes('SECRET'));
});
