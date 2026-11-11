'use strict';

const { createHash, randomUUID } = require('node:crypto');
const BEEKNOEE_ORIGIN = 'https://platform.beeknoee.com';
const requireValue = (value, code) => {
  if (!value) throw Object.assign(new Error(code), { code });
};
const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

function providerFromModel(model) {
  return {
    provider: 'beeknoee',
    model: model.apiModel,
    baseUrl: `${BEEKNOEE_ORIGIN}/api/v1`,
  };
}

async function createAttemptExecution(model, budget, services, probe, deadlineAt) {
  const durable = typeof services.beginExecution === 'function'
    ? await services.beginExecution(model, probe, deadlineAt)
    : null;
  const active = new Set();
  let opened = 0;
  let usage = null;
  let generationSettled = false;
  let released = false;
  const releaseGeneration = async () => {
    if (!released) {
      released = true;
      await durable?.release();
    }
  };
  const beforeAttempt = async (plan) => {
    requireValue(plan.provider === 'beeknoee' && plan.model === model.apiModel, 'MODEL_EVAL_PLAN_MISMATCH');
    const lease = budget.acquire();
    let handle;
    try {
      handle = durable ? await durable.beforeAttempt(plan) : null;
    } catch (error) {
      lease.release();
      throw error;
    }
    opened++;
    let settled = false;
    const attempt = {
      attemptId: handle?.attemptId ?? randomUUID(),
      async complete(result = {}) {
        requireValue(!settled, 'MODEL_EVAL_ATTEMPT_ALREADY_SETTLED');
        requireValue(result.provider === 'beeknoee' && result.model === model.apiModel, 'MODEL_EVAL_PLAN_MISMATCH');
        await handle?.complete(result);
        usage = result.usage ?? usage;
        settled = true;
        active.delete(attempt);
        lease.release();
      },
      async fail(outcome = 'failed', result = {}) {
        if (!settled) {
          await handle?.fail(outcome, result);
          usage = result.usage ?? usage;
          settled = true;
          active.delete(attempt);
          lease.release();
        }
      },
    };
    active.add(attempt);
    return attempt;
  };
  const failActive = async (outcome) => {
    for (const attempt of [...active]) await attempt.fail(outcome);
  };
  return {
    execution: {
      generationId: durable?.generationId ?? randomUUID(),
      beforeAttempt,
    },
    async succeed() {
      requireValue(opened > 0, 'MODEL_EVAL_PROVIDER_NOT_DISPATCHED');
      requireValue(active.size === 0, 'MODEL_EVAL_ATTEMPT_UNSETTLED');
      try {
        if (durable) {
          const summary = await durable.complete({ provider: 'beeknoee', model: model.apiModel });
          requireValue(summary.outcome === 'succeeded', 'MODEL_EVAL_GENERATION_NOT_COMPLETED');
          usage = summary.usage ?? usage;
        }
        generationSettled = true;
        return usage;
      } finally {
        await releaseGeneration();
      }
    },
    async fail(error) {
      const outcome = error?.code === 'AI_REQUEST_TIMEOUT' || error?.name === 'TimeoutError'
        ? 'timed_out'
        : error?.name === 'AbortError'
          ? 'cancelled'
          : 'failed';
      try {
        await failActive(outcome);
        if (durable && !generationSettled) await durable.fail(outcome);
        generationSettled = true;
      } finally {
        await releaseGeneration();
      }
    },
  };
}

function createAppModelRoleAdapter({ apiKey, baseUrl, deadlineAt, services, now = Date.now }) {
  requireValue(typeof apiKey === 'string' && apiKey.trim(), 'MODEL_EVAL_CREDENTIAL_MISSING');
  let origin;
  try {
    const url = new URL(baseUrl);
    origin = url.origin;
    requireValue(origin === BEEKNOEE_ORIGIN && url.pathname.replace(/\/$/, '') === '/api/v1', 'MODEL_EVAL_RECIPIENT_MISMATCH');
  } catch (error) {
    if (error?.code) throw error;
    throw Object.assign(new Error('MODEL_EVAL_RECIPIENT_MISMATCH'), { code: 'MODEL_EVAL_RECIPIENT_MISMATCH' });
  }
  requireValue(Number.isSafeInteger(deadlineAt) && deadlineAt > now(), 'MODEL_EVAL_DEADLINE');
  requireValue(
    services &&
      typeof services.assertProvider === 'function' &&
      typeof services.beginExecution === 'function' &&
      services.chat &&
      services.autocomplete,
    'MODEL_EVAL_SERVICES_INVALID',
  );

  const runProbe = async ({ model, probe }, budget) => {
    requireValue(now() < deadlineAt, 'MODEL_EVAL_DEADLINE');
    requireValue(/^beeknoee:[a-z0-9][a-z0-9./-]{0,160}$/.test(model.selectionId) && model.selectionId === `beeknoee:${model.apiModel}`, 'MODEL_EVAL_MODEL_INVALID');
    const plan = providerFromModel(model);
    services.assertProvider(plan);
    const attempt = await createAttemptExecution(model, budget, services, probe, deadlineAt);
    const requestBase = {
      model: model.selectionId,
      fallbackProvider: 'none',
      disabledProviders: ['gemini', 'groq', 'cerebras', 'openrouter'],
      deadlineAt,
      requestScopeKey: JSON.stringify(['model-evaluation', model.apiModel, probe.id]),
      beforeProviderRequest: async () => {
        requireValue(now() < deadlineAt, 'MODEL_EVAL_DEADLINE');
        services.assertProvider(plan);
      },
      beforeProviderAttempt: async (actual) => {
        requireValue(actual.provider === plan.provider && actual.model === plan.model && actual.baseUrl === plan.baseUrl, 'MODEL_EVAL_PLAN_MISMATCH');
        services.assertProvider(actual);
      },
      execution: attempt.execution,
    };
    const startedAt = now();
    let firstChunkAt = null;
    let response;
    try {
      if (probe.operation === 'autocomplete') {
        const message = await services.autocomplete.autocomplete({
          ...requestBase,
          beforeCursor: probe.beforeCursor,
          afterCursor: probe.afterCursor,
          schemaContext: JSON.stringify(probe.schema),
          databaseType: probe.databaseType,
          cacheScope: requestBase.requestScopeKey,
        });
        response = { message, terminalVerified: true, reportedModel: null };
      } else if (probe.operation === 'stream') {
        let done;
        let accumulated = '';
        for await (const event of services.chat.chatStream({
          ...requestBase,
          prompt: probe.prompt,
          schemaContext: JSON.stringify(probe.schema),
          databaseType: probe.databaseType,
          mode: 'fast',
        })) {
          if (event.type === 'chunk') {
            if (firstChunkAt === null) firstChunkAt = now();
            accumulated += event.text;
          } else if (event.type === 'error') {
            throw Object.assign(new Error('MODEL_EVAL_STREAM_ERROR'), { code: 'MODEL_EVAL_STREAM_ERROR' });
          } else if (event.type === 'done') done = event.data;
        }
        requireValue(done && typeof done.message === 'string' && done.provider === 'beeknoee' && done.model === model.apiModel, 'MODEL_EVAL_STREAM_TERMINAL_MISSING');
        response = { message: done.message || accumulated, sql: done.sql, terminalVerified: true, reportedModel: done.providerReportedModel ?? null };
      } else {
        const result = await services.chat.chat({
          ...requestBase,
          prompt: probe.prompt,
          schemaContext: JSON.stringify(probe.schema),
          databaseType: probe.databaseType,
          mode: 'fast',
        });
        requireValue(result && result.provider === 'beeknoee' && result.model === model.apiModel, 'MODEL_EVAL_RESULT_IDENTITY_MISMATCH');
        response = { message: result.message, sql: result.sql, terminalVerified: true, reportedModel: result.providerReportedModel ?? null };
      }
      const usage = await attempt.succeed();
      return {
        ...response,
        usage,
        elapsedMs: Math.max(0, now() - startedAt),
        ttftMs: firstChunkAt === null ? null : Math.max(0, firstChunkAt - startedAt),
        requestSha256: hash({ version: 1, model: model.apiModel, probe, endpoint: plan.baseUrl }),
      };
    } catch (error) {
      await attempt.fail(error);
      throw error;
    }
  };

  return Object.freeze({ runProbe });
}

module.exports = { createAppModelRoleAdapter };
