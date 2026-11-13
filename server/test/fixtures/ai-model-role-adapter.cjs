'use strict';

const { createHash } = require('node:crypto');
const MODEL_EVALUATION_ENDPOINTS = Object.freeze({
  beeknoee: 'https://platform.beeknoee.com/api/v1',
  groq: 'https://api.groq.com/openai/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  cerebras: 'https://api.cerebras.ai/v1',
});
const FATAL_EVALUATION_CODES = new Set([
  'MODEL_EVAL_ATTEMPT_ALREADY_SETTLED',
  'MODEL_EVAL_DEADLINE',
  'MODEL_EVAL_DURABLE_ATTEMPT_INVALID',
  'MODEL_EVAL_DURABLE_EXECUTION_INVALID',
  'MODEL_EVAL_GENERATION_NOT_COMPLETED',
  'MODEL_EVAL_PLAN_MISMATCH',
  'MODEL_EVAL_PROVIDER_NOT_DISPATCHED',
  'MODEL_EVAL_STREAM_ERROR',
  'MODEL_EVAL_ATTEMPT_UNSETTLED',
  'MODEL_EVALUATION_ATTEMPT_LIMIT',
  'MODEL_EVALUATION_BUSY',
  'MODEL_EVALUATION_DEADLINE',
]);
const OPERATION_EVIDENCE_CODES = new Set([
  'MODEL_EVAL_POLICY_DENIED',
  'MODEL_EVAL_RESULT_IDENTITY_MISMATCH',
  'MODEL_EVAL_STREAM_TERMINAL_MISSING',
]);
const controlError = (code) => Object.assign(new Error(code), { code });
const wrapControl = (code, error) => {
  if (isFatalModelEvaluationError(error)) return error;
  return controlError(code);
};
const requireValue = (value, code) => {
  if (!value) throw Object.assign(new Error(code), { code });
};
const hash = (value) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

function providerFromModel(model) {
  const provider = model.provider ?? 'beeknoee';
  requireValue(
    Object.hasOwn(MODEL_EVALUATION_ENDPOINTS, provider),
    'MODEL_EVAL_PROVIDER_INVALID',
  );
  return {
    provider,
    model: model.apiModel,
    baseUrl: MODEL_EVALUATION_ENDPOINTS[provider],
  };
}

async function createAttemptExecution(
  model,
  budget,
  services,
  probe,
  deadlineAt,
) {
  const expectedProvider = model.provider ?? 'beeknoee';
  let durable;
  try {
    durable = await services.beginExecution(model, probe, deadlineAt);
  } catch (error) {
    throw wrapControl('MODEL_EVAL_LEDGER_BEGIN_FAILED', error);
  }
  requireValue(
    durable &&
      typeof durable.generationId === 'string' &&
      typeof durable.beforeAttempt === 'function' &&
      typeof durable.complete === 'function' &&
      typeof durable.fail === 'function' &&
      typeof durable.release === 'function',
    'MODEL_EVAL_DURABLE_EXECUTION_INVALID',
  );
  const active = new Set();
  let opened = 0;
  let usage = null;
  let generationSettled = false;
  let released = false;
  const releaseGeneration = async () => {
    if (!released) {
      released = true;
      try {
        await durable.release();
      } catch (error) {
        released = false;
        throw wrapControl('MODEL_EVAL_LEDGER_RELEASE_FAILED', error);
      }
    }
  };
  const beforeAttempt = async (plan) => {
    requireValue(
      plan.provider === expectedProvider && plan.model === model.apiModel,
      'MODEL_EVAL_PLAN_MISMATCH',
    );
    const lease = budget.acquire();
    let handle;
    try {
      handle = await durable.beforeAttempt(plan);
      requireValue(
        handle &&
          typeof handle.attemptId === 'string' &&
          typeof handle.complete === 'function' &&
          typeof handle.fail === 'function',
        'MODEL_EVAL_DURABLE_ATTEMPT_INVALID',
      );
    } catch (error) {
      lease.release();
      throw wrapControl('MODEL_EVAL_LEDGER_ATTEMPT_BEGIN_FAILED', error);
    }
    opened++;
    let settled = false;
    const attempt = {
      attemptId: handle.attemptId,
      async complete(result = {}) {
        requireValue(!settled, 'MODEL_EVAL_ATTEMPT_ALREADY_SETTLED');
        requireValue(
          result.provider === expectedProvider &&
            result.model === model.apiModel,
          'MODEL_EVAL_PLAN_MISMATCH',
        );
        try {
          await handle.complete(result);
        } catch (error) {
          throw wrapControl('MODEL_EVAL_LEDGER_ATTEMPT_COMPLETE_FAILED', error);
        }
        usage = result.usage ?? usage;
        settled = true;
        active.delete(attempt);
        lease.release();
      },
      async fail(outcome = 'failed', result = {}) {
        if (!settled) {
          try {
            await handle.fail(outcome, result);
          } catch (error) {
            throw wrapControl('MODEL_EVAL_LEDGER_ATTEMPT_FAIL_FAILED', error);
          }
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
      generationId: durable.generationId,
      beforeAttempt,
    },
    async succeed() {
      requireValue(opened > 0, 'MODEL_EVAL_PROVIDER_NOT_DISPATCHED');
      requireValue(active.size === 0, 'MODEL_EVAL_ATTEMPT_UNSETTLED');
      try {
        let summary;
        try {
          summary = await durable.complete({
            provider: expectedProvider,
            model: model.apiModel,
          });
        } catch (error) {
          throw wrapControl('MODEL_EVAL_LEDGER_COMPLETE_FAILED', error);
        }
        requireValue(
          summary.outcome === 'succeeded',
          'MODEL_EVAL_GENERATION_NOT_COMPLETED',
        );
        usage = summary.usage ?? usage;
        generationSettled = true;
        return usage;
      } finally {
        await releaseGeneration();
      }
    },
    async fail(error) {
      const outcome =
        error?.code === 'AI_REQUEST_TIMEOUT' || error?.name === 'TimeoutError'
          ? 'timed_out'
          : error?.name === 'AbortError'
            ? 'cancelled'
            : 'failed';
      try {
        await failActive(outcome);
        if (!generationSettled)
          try {
            await durable.fail(outcome);
          } catch (error) {
            throw wrapControl('MODEL_EVAL_LEDGER_FAIL_FAILED', error);
          }
        generationSettled = true;
      } finally {
        await releaseGeneration();
      }
    },
  };
}

function isFatalModelEvaluationError(error) {
  const seen = new Set();
  let current = error;
  while (current && typeof current === 'object' && !seen.has(current)) {
    if (seen.size >= 16) return true;
    seen.add(current);
    if (
      current.aiRequestFatal === true ||
      (typeof current.code === 'string' &&
        !OPERATION_EVIDENCE_CODES.has(current.code) &&
        (FATAL_EVALUATION_CODES.has(current.code) ||
          current.code.startsWith('MODEL_EVAL_LEDGER_') ||
          current.code.startsWith('MODEL_EVAL_JOURNAL_')))
    )
      return true;
    current = current.cause;
  }
  return Boolean(current && typeof current === 'object');
}

function createAppModelRoleAdapter({
  apiKey,
  baseUrl,
  deadlineAt,
  services,
  provider = 'beeknoee',
  now = Date.now,
}) {
  requireValue(
    typeof apiKey === 'string' && apiKey.trim(),
    'MODEL_EVAL_CREDENTIAL_MISSING',
  );
  try {
    const url = new URL(baseUrl);
    requireValue(
      Object.hasOwn(MODEL_EVALUATION_ENDPOINTS, provider) &&
        url.toString().replace(/\/$/, '') ===
          MODEL_EVALUATION_ENDPOINTS[provider],
      'MODEL_EVAL_RECIPIENT_MISMATCH',
    );
  } catch (error) {
    if (error?.code) throw error;
    throw Object.assign(new Error('MODEL_EVAL_RECIPIENT_MISMATCH'), {
      code: 'MODEL_EVAL_RECIPIENT_MISMATCH',
    });
  }
  requireValue(
    Number.isSafeInteger(deadlineAt) && deadlineAt > now(),
    'MODEL_EVAL_DEADLINE',
  );
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
    requireValue(
      typeof model.apiModel === 'string' &&
        /^[A-Za-z0-9][A-Za-z0-9._/:@-]{0,199}$/.test(model.apiModel) &&
        (model.provider ?? 'beeknoee') === provider &&
        typeof model.selectionId === 'string' &&
        (provider === 'beeknoee'
          ? model.selectionId === `beeknoee:${model.apiModel}`
          : provider === 'groq'
            ? model.selectionId === `groq:${model.apiModel}`
            : provider === 'openrouter'
              ? model.selectionId === model.apiModel &&
                model.apiModel.endsWith(':free')
              : model.selectionId === `cerebras:${model.apiModel}`),
      'MODEL_EVAL_MODEL_INVALID',
    );
    const plan = providerFromModel(model);
    try {
      await services.assertProvider(plan);
    } catch (error) {
      throw wrapControl('MODEL_EVAL_POLICY_DENIED', error);
    }
    const attempt = await createAttemptExecution(
      model,
      budget,
      services,
      probe,
      deadlineAt,
    );
    const requestBase = {
      model: model.selectionId,
      fallbackProvider: 'none',
      disabledProviders: [
        'gemini',
        'groq',
        'cerebras',
        'openrouter',
        'beeknoee',
      ].filter((value) => value !== provider),
      deadlineAt,
      requestScopeKey: JSON.stringify([
        'model-evaluation',
        provider,
        model.apiModel,
        probe.id,
      ]),
      beforeProviderRequest: async () => {
        requireValue(now() < deadlineAt, 'MODEL_EVAL_DEADLINE');
        try {
          await services.assertProvider(plan);
        } catch (error) {
          throw wrapControl('MODEL_EVAL_POLICY_DENIED', error);
        }
      },
      beforeProviderAttempt: async (actual) => {
        requireValue(
          actual.provider === plan.provider &&
            actual.model === plan.model &&
            actual.baseUrl === plan.baseUrl,
          'MODEL_EVAL_PLAN_MISMATCH',
        );
        try {
          await services.assertProvider(actual);
        } catch (error) {
          throw wrapControl('MODEL_EVAL_POLICY_DENIED', error);
        }
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
          image: probe.image,
          document: probe.document,
          mode: 'fast',
        })) {
          if (event.type === 'chunk') {
            if (firstChunkAt === null) firstChunkAt = now();
            accumulated += event.text;
          } else if (event.type === 'error') {
            throw Object.assign(new Error('MODEL_EVAL_STREAM_ERROR'), {
              code: 'MODEL_EVAL_STREAM_ERROR',
            });
          } else if (event.type === 'done') done = event.data;
        }
        requireValue(
          done &&
            typeof done.message === 'string' &&
            done.provider === provider &&
            done.model === model.apiModel,
          'MODEL_EVAL_STREAM_TERMINAL_MISSING',
        );
        response = {
          message: done.message || accumulated,
          sql: done.sql,
          terminalVerified: true,
          reportedModel: done.providerReportedModel ?? null,
        };
      } else {
        const result = await services.chat.chat({
          ...requestBase,
          prompt: probe.prompt,
          schemaContext: JSON.stringify(probe.schema),
          databaseType: probe.databaseType,
          image: probe.image,
          document: probe.document,
          mode: 'fast',
        });
        requireValue(
          result &&
            result.provider === provider &&
            result.model === model.apiModel,
          'MODEL_EVAL_RESULT_IDENTITY_MISMATCH',
        );
        response = {
          message: result.message,
          sql: result.sql,
          terminalVerified: true,
          reportedModel: result.providerReportedModel ?? null,
        };
      }
      const usage = await attempt.succeed();
      return {
        ...response,
        usage,
        elapsedMs: Math.max(0, now() - startedAt),
        ttftMs:
          firstChunkAt === null ? null : Math.max(0, firstChunkAt - startedAt),
        requestSha256: hash({
          version: 1,
          model: model.apiModel,
          probe,
          endpoint: plan.baseUrl,
        }),
      };
    } catch (error) {
      try {
        await attempt.fail(error);
      } catch (settlementError) {
        if (
          settlementError &&
          typeof settlementError === 'object' &&
          !settlementError.code
        )
          settlementError.code = 'MODEL_EVAL_LEDGER_SETTLEMENT_FAILED';
        throw settlementError;
      }
      throw error;
    }
  };

  return Object.freeze({ runProbe, isFatalError: isFatalModelEvaluationError });
}

module.exports = {
  createAppModelRoleAdapter,
  isFatalModelEvaluationError,
  MODEL_EVALUATION_ENDPOINTS,
};
