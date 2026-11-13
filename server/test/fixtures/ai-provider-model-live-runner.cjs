'use strict';

const { createHash, randomUUID } = require('node:crypto');
const {
  lstatSync,
  readFileSync,
  writeFileSync,
  openSync,
  writeSync,
  fsyncSync,
  closeSync,
} = require('node:fs');
const { join, resolve } = require('node:path');
const { pathToFileURL } = require('node:url');
const {
  createAppModelRoleAdapter,
  MODEL_EVALUATION_ENDPOINTS,
} = require('./ai-model-role-adapter.cjs');
const {
  createDockerNativeExecutor,
  createModelEvaluationEnvironment,
} = require('./ai-model-role-runner.cjs');
const {
  readProviderAssessmentRoster,
  classifyProviderFailure,
} = require('./ai-provider-model-catalog.cjs');

const root = resolve(__dirname, '../..');
const providers = Object.keys(MODEL_EVALUATION_ENDPOINTS);
const maxAttempts = 320;
let stage = 'arguments';
let currentAttempt;
let budget;
let output;
let secretValues = [];

function requireValue(value, code) {
  if (!value)
    throw Object.assign(new Error(code), { code, aiRequestFatal: true });
}

function durableRecord(
  path,
  value,
  io = { openSync, writeSync, fsyncSync, closeSync },
) {
  try {
    const text = JSON.stringify(value);
    requireValue(
      Buffer.byteLength(text) <= 256 * 1024,
      'MODEL_EVAL_RECORD_LIMIT',
    );
    const safe = secretValues.reduce(
      (text, secret) => text.replaceAll(secret, '[REDACTED]'),
      text,
    );
    const bytes = Buffer.from(`${safe}\n`);
    const file = io.openSync(path, 'a', 0o600);
    try {
      let offset = 0;
      while (offset < bytes.length) {
        const written = io.writeSync(
          file,
          bytes,
          offset,
          bytes.length - offset,
        );
        requireValue(
          Number.isSafeInteger(written) &&
            written > 0 &&
            written <= bytes.length - offset,
          'MODEL_EVAL_JOURNAL_WRITE_FAILED',
        );
        offset += written;
      }
      io.fsyncSync(file);
    } finally {
      io.closeSync(file);
    }
  } catch (cause) {
    throw Object.assign(new Error('MODEL_EVAL_JOURNAL_FAILED', { cause }), {
      code: 'MODEL_EVAL_JOURNAL_FAILED',
      aiRequestFatal: true,
    });
  }
}

function readConfiguration(path) {
  const stat = lstatSync(path);
  requireValue(
    stat.isFile() && !stat.isSymbolicLink() && stat.size <= 64 * 1024,
    'MODEL_EVAL_ENV_INVALID',
  );
  const allowed = new Set(
    providers.flatMap((provider) =>
      ['API_KEY', 'BASE_URL', 'CHAT_MODEL'].map(
        (suffix) => `${provider.toUpperCase()}_${suffix}`,
      ),
    ),
  );
  const values = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(
      line,
    );
    if (!match || !allowed.has(match[1])) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    )
      value = value.slice(1, -1);
    values[match[1]] = value;
  }
  for (const provider of providers) {
    const prefix = provider.toUpperCase();
    requireValue(
      typeof values[`${prefix}_API_KEY`] === 'string' &&
        values[`${prefix}_API_KEY`].trim(),
      'MODEL_EVAL_CREDENTIAL_MISSING',
    );
    requireValue(
      values[`${prefix}_BASE_URL`] === MODEL_EVALUATION_ENDPOINTS[provider],
      'MODEL_EVAL_RECIPIENT_MISMATCH',
    );
  }
  secretValues = providers
    .map((provider) => values[`${provider.toUpperCase()}_API_KEY`])
    .filter(Boolean);
  return values;
}

function operationOutcome(error) {
  return error?.name === 'AbortError'
    ? 'cancelled'
    : error?.name === 'TimeoutError' ||
        /timeout|deadline/i.test(error?.message ?? '')
      ? 'timed_out'
      : 'failed';
}

function readProviderEvaluationArtifact(path, maxBytes, code) {
  const stat = lstatSync(path);
  requireValue(
    stat.isFile() &&
      !stat.isSymbolicLink() &&
      stat.size > 0 &&
      stat.size <= maxBytes,
    code,
  );
  return readFileSync(path);
}

function readProviderEvaluationContinuation(authority, parseJson) {
  const fields = ['previousRun', 'previousReportSha256', 'initialAttempts'];
  const present = fields.filter((field) => Object.hasOwn(authority, field));
  if (!present.length) return { previousReport: undefined, initialAttempts: 0 };
  requireValue(
    present.length === fields.length &&
      typeof authority.previousRun === 'string' &&
      authority.previousRun.trim().length > 0 &&
      typeof authority.previousReportSha256 === 'string' &&
      /^[a-f0-9]{64}$/.test(authority.previousReportSha256) &&
      Number.isSafeInteger(authority.initialAttempts) &&
      authority.initialAttempts >= 0 &&
      authority.initialAttempts <= maxAttempts,
    'MODEL_EVAL_CONTINUATION_INVALID',
  );
  const previousDirectory = resolve(authority.previousRun);
  const stat = lstatSync(previousDirectory);
  requireValue(
    stat.isDirectory() && !stat.isSymbolicLink(),
    'MODEL_EVAL_PREVIOUS_REPORT_INVALID',
  );
  const previousBytes = readProviderEvaluationArtifact(
    join(previousDirectory, 'assessment.json'),
    512 * 1024,
    'MODEL_EVAL_PREVIOUS_REPORT_INVALID',
  );
  requireValue(
    createHash('sha256').update(previousBytes).digest('hex') ===
      authority.previousReportSha256,
    'MODEL_EVAL_PREVIOUS_REPORT_MISMATCH',
  );
  const previousReport = parseJson(previousBytes.toString('utf8'));
  const previousAuthorityBytes = readProviderEvaluationArtifact(
    join(previousDirectory, 'authority.json'),
    32 * 1024,
    'MODEL_EVAL_PREVIOUS_AUTHORITY_INVALID',
  );
  const previousAuthority = parseJson(previousAuthorityBytes.toString('utf8'));
  requireValue(
    previousReport.kind === 'multi-provider-live-task-assessment' &&
      previousReport.formatVersion === 1 &&
      previousReport.cleanupVerified === true &&
      Array.isArray(previousReport.failures) &&
      previousReport.failures.length === 0 &&
      previousReport.attemptLimit === maxAttempts &&
      previousReport.concurrency === 1 &&
      previousReport.directGeminiExcluded === true &&
      Array.isArray(previousReport.models) &&
      Array.isArray(previousReport.discoveries),
    'MODEL_EVAL_PREVIOUS_REPORT_INVALID',
  );
  requireValue(
    createHash('sha256').update(previousAuthorityBytes).digest('hex') ===
      previousReport.authorizationSha256 &&
      previousAuthority.authorizationId === authority.authorizationId &&
      previousAuthority.kind === authority.kind &&
      previousAuthority.deadlineAt === authority.deadlineAt &&
      previousAuthority.maxAttempts === maxAttempts &&
      authority.maxAttempts === maxAttempts &&
      previousAuthority.spendUsd === 0 &&
      previousAuthority.concurrency === 1 &&
      previousAuthority.excludeDirectGemini === true &&
      previousAuthority.operatorFreeAttestation === true &&
      Array.isArray(previousAuthority.providers) &&
      previousAuthority.providers.length === providers.length &&
      new Set(previousAuthority.providers).size === providers.length &&
      providers.every((provider) =>
        previousAuthority.providers.includes(provider),
      ),
    'MODEL_EVAL_PREVIOUS_AUTHORITY_MISMATCH',
  );
  const previousJournal = readProviderEvaluationArtifact(
    join(previousDirectory, 'attempts.ndjson'),
    1024 * 1024,
    'MODEL_EVAL_PREVIOUS_ATTEMPTS_INVALID',
  )
    .toString('utf8')
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => parseJson(line));
  const previousOffset = previousReport.previousProviderAttempts ?? 0;
  const previousCount = previousReport.providerAttempts;
  const priorFields = [
    'previousRun',
    'previousReportSha256',
    'initialAttempts',
  ];
  const priorPresent = priorFields.filter((field) =>
    Object.hasOwn(previousAuthority, field),
  );
  requireValue(
    priorPresent.length === 0 ||
      (priorPresent.length === priorFields.length &&
        typeof previousAuthority.previousRun === 'string' &&
        previousAuthority.previousRun.trim().length > 0 &&
        typeof previousAuthority.previousReportSha256 === 'string' &&
        /^[a-f0-9]{64}$/.test(previousAuthority.previousReportSha256) &&
        Number.isSafeInteger(previousAuthority.initialAttempts) &&
        previousAuthority.initialAttempts >= 0 &&
        previousAuthority.initialAttempts <= maxAttempts),
    'MODEL_EVAL_PREVIOUS_AUTHORITY_MISMATCH',
  );
  const priorStart = priorPresent.length
    ? previousAuthority.initialAttempts
    : 0;
  requireValue(
    Number.isSafeInteger(previousOffset) &&
      previousOffset >= 0 &&
      previousOffset === priorStart &&
      Number.isSafeInteger(previousCount) &&
      previousCount > previousOffset &&
      previousCount <= maxAttempts &&
      previousCount === previousOffset + previousJournal.length &&
      previousCount === authority.initialAttempts &&
      (previousReport.thisRunProviderAttempts === undefined ||
        previousReport.thisRunProviderAttempts === previousJournal.length) &&
      previousJournal.every(
        (row, index) => row.ordinal === previousOffset + index + 1,
      ),
    'MODEL_EVAL_PREVIOUS_ATTEMPTS_MISMATCH',
  );
  return { previousReport, initialAttempts: previousCount };
}

function isProviderEvaluationFatal(error, isAdapterFatal = () => false) {
  const seen = new Set();
  let current = error;
  while (current && typeof current === 'object' && !seen.has(current)) {
    if (seen.size >= 16) return true;
    seen.add(current);
    const code = typeof current.code === 'string' ? current.code : '';
    if (
      current.aiRequestFatal === true ||
      isAdapterFatal(current) ||
      /^(?:MODEL_NATIVE_|NATIVE_|MODEL_EVAL_LEDGER_|MODEL_EVAL_JOURNAL_|MODEL_EVALUATION_)/.test(
        code,
      ) ||
      ['MODEL_EVAL_PLAN_MISMATCH', 'MODEL_EVAL_ADAPTER_LEFT_ACTIVE'].includes(
        code,
      )
    )
      return true;
    current = current.cause;
  }
  return Boolean(current && typeof current === 'object');
}

async function runProviderEvaluationProbe(run, onFailure, isAdapterFatal) {
  try {
    return await run();
  } catch (error) {
    if (isProviderEvaluationFatal(error, isAdapterFatal)) throw error;
    await onFailure(error);
  }
}

async function runProviderEvaluationLedger(code, operation) {
  try {
    return await operation();
  } catch (cause) {
    throw Object.assign(new Error(code, { cause }), {
      code,
      aiRequestFatal: true,
    });
  }
}

async function runProviderEvaluationProbes(models, probes, runProbe) {
  for (const model of models) await runProbe(model, probes[0]);
  for (const probe of probes.slice(1))
    for (const model of models) {
      if (probe.targetModels && !probe.targetModels.includes(model.selectionId))
        continue;
      await runProbe(model, probe);
    }
}

function createProviderEvaluationChat({
  ai,
  chat,
  followup,
  getProbe,
  getProviderError,
  getProviderResult,
}) {
  return {
    chat: async (params) => {
      try {
        if (followup && getProbe() === 'explain-null') {
          const result = await ai.chat({
            ...params,
            prompt:
              'Explain PostgreSQL three-valued logic for NULL equality in plain text. State the assumption clearly and do not include any executable statement.',
          });
          return {
            ...result,
            message: result.explanation ?? result.message,
            providerReportedModel:
              result.providerReportedModel ??
              getProviderResult()?.providerReportedModel,
          };
        }
        if (
          followup &&
          ['sql-count', 'mongo-null', 'repair-null', 'missing-phone'].includes(
            getProbe(),
          )
        ) {
          const result = await ai.generateSql({
            ...params,
            query: params.prompt,
          });
          return {
            ...result,
            message: result.explanation,
            providerReportedModel:
              result.providerReportedModel ??
              getProviderResult()?.providerReportedModel,
          };
        }
        return await ai.chat(params);
      } catch (error) {
        throw isProviderEvaluationFatal(error)
          ? error
          : (getProviderError() ?? error);
      }
    },
    chatStream: async function* (params) {
      for await (const event of chat.chatStream(params)) {
        if (event.type === 'error' && getProviderError())
          throw getProviderError();
        yield event;
      }
    },
  };
}

async function cleanupProviderEvaluationResources({
  actorAttempted,
  actorId,
  actorEmail,
  prisma,
  redis,
  native,
  ledgerContexts,
  leaseIds = new Set(),
  onReadback,
}) {
  const failures = [];
  const stage = 'cleanup';
  const attempt = async (code, operation) => {
    try {
      return { ok: true, value: await operation() };
    } catch {
      failures.push({ stage, code });
      return { ok: false, value: null };
    }
  };
  try {
    for (const context of ledgerContexts) {
      await attempt('MODEL_EVAL_LEDGER_CLEANUP_FAILED', () =>
        context.fail('cancelled'),
      );
      await attempt('MODEL_EVAL_LEASE_CLEANUP_FAILED', () => context.release());
    }
    if (native)
      await attempt('MODEL_NATIVE_CLEANUP_FAILED', () => native.close());
    if (actorAttempted) {
      const owned = await attempt('MODEL_EVAL_STORE_CLEANUP_FAILED', () =>
        prisma.aiGeneration.findMany({
          where: { userId: actorId },
          select: { id: true },
        }),
      );
      const ids = owned.ok ? owned.value.map((item) => item.id) : null;
      const ownedLeaseIds = new Set([...leaseIds, ...(ids ?? [])]);
      const userLeaseKey = `ai:{ai-execution}:leases:user:${createHash('sha256').update(actorId).digest('hex')}`;
      const cleanRedis = async () => {
        for (const id of ownedLeaseIds) {
          await attempt('MODEL_EVAL_LEASE_CLEANUP_FAILED', () =>
            redis.getClient().zrem('ai:{ai-execution}:leases:global', id),
          );
          await attempt('MODEL_EVAL_LEASE_CLEANUP_FAILED', () =>
            redis.getClient().zrem(userLeaseKey, id),
          );
          await attempt('MODEL_EVAL_LEASE_CLEANUP_FAILED', () =>
            redis.getClient().del(`ai:{ai-execution}:lease:${id}`),
          );
        }
      };
      const cleanDatabase = async () => {
        if (ids?.length) {
          await attempt('MODEL_EVAL_STORE_CLEANUP_FAILED', () =>
            prisma.aiGenerationFeedback.deleteMany({
              where: { generationId: { in: ids } },
            }),
          );
          await attempt('MODEL_EVAL_STORE_CLEANUP_FAILED', () =>
            prisma.aiProviderAttempt.deleteMany({
              where: { generationId: { in: ids } },
            }),
          );
          await attempt('MODEL_EVAL_STORE_CLEANUP_FAILED', () =>
            prisma.aiGeneration.deleteMany({
              where: { id: { in: ids }, userId: actorId },
            }),
          );
        }
        await attempt('MODEL_EVAL_STORE_CLEANUP_FAILED', () =>
          prisma.user.deleteMany({ where: { id: actorId, email: actorEmail } }),
        );
      };
      await Promise.all([cleanRedis(), cleanDatabase()]);
      const counts = await Promise.all([
        attempt('MODEL_EVAL_CLEANUP_READBACK_FAILED', () =>
          prisma.user.count({ where: { id: actorId } }),
        ),
        attempt('MODEL_EVAL_CLEANUP_READBACK_FAILED', () =>
          prisma.aiGeneration.count({ where: { userId: actorId } }),
        ),
        ids?.length
          ? attempt('MODEL_EVAL_CLEANUP_READBACK_FAILED', () =>
              prisma.aiProviderAttempt.count({
                where: { generationId: { in: ids } },
              }),
            )
          : { ok: ids !== null, value: ids === null ? null : 0 },
        attempt('MODEL_EVAL_CLEANUP_READBACK_FAILED', () =>
          redis.getClient().zcard(userLeaseKey),
        ),
      ]);
      const readback = Object.fromEntries(
        ['actors', 'generations', 'attempts', 'leases'].map((key, index) => [
          key,
          counts[index].ok ? counts[index].value : null,
        ]),
      );
      if (Object.values(readback).some((value) => value !== 0))
        failures.push({ stage, code: 'MODEL_EVAL_CLEANUP_READBACK_FAILED' });
      await attempt('MODEL_EVAL_CLEANUP_READBACK_FAILED', () =>
        onReadback(readback),
      );
    }
  } finally {
    await Promise.all([
      attempt('MODEL_EVAL_DISCONNECT_FAILED', () => prisma.$disconnect()),
      attempt('MODEL_EVAL_DISCONNECT_FAILED', () => redis.onModuleDestroy()),
    ]);
  }
  return failures;
}

async function main() {
  const [envPath, authorityPath, directory] = process.argv.slice(2);
  requireValue(
    envPath && authorityPath && directory && process.argv.length === 5,
    'MODEL_EVAL_RUN_ARGUMENTS_INVALID',
  );
  output = resolve(directory);
  const outStat = lstatSync(output);
  requireValue(
    outStat.isDirectory() &&
      !outStat.isSymbolicLink() &&
      !output.startsWith(resolve(root, '..')),
    'MODEL_EVAL_OUTPUT_INVALID',
  );
  const journal = join(output, 'attempts.ndjson');
  const responses = join(output, 'probe-responses.ndjson');
  const decisions = join(output, 'probe-decisions.ndjson');
  for (const path of [journal, responses, decisions])
    writeFileSync(path, '', { flag: 'wx', mode: 0o600 });
  stage = 'authority';
  const evaluator = await import(
    pathToFileURL(join(root, 'scripts/ai-eval/evaluator.mjs')).href
  );
  const authorityBytes = readProviderEvaluationArtifact(
    authorityPath,
    32 * 1024,
    'MODEL_EVAL_AUTHORITY_INVALID',
  );
  const authority = evaluator.parseBoundedJson(authorityBytes.toString('utf8'));
  requireValue(
    authority.kind === 'operator-authorized-multi-provider-evaluation' &&
      authority.maxAttempts === maxAttempts &&
      authority.spendUsd === 0 &&
      authority.concurrency === 1 &&
      authority.operatorFreeAttestation === true &&
      authority.excludeDirectGemini === true &&
      Array.isArray(authority.providers) &&
      authority.providers.length === providers.length &&
      new Set(authority.providers).size === providers.length &&
      providers.every((provider) => authority.providers.includes(provider)) &&
      Number.isSafeInteger(authority.deadlineAt) &&
      authority.deadlineAt > Date.now(),
    'MODEL_EVAL_AUTHORITY_INVALID',
  );
  const { previousReport, initialAttempts } =
    readProviderEvaluationContinuation(authority, evaluator.parseBoundedJson);
  stage = 'fixture-environment';
  const baseEnvironment = createModelEvaluationEnvironment(process.env, {});
  const values = readConfiguration(envPath);
  process.env = {
    ...baseEnvironment,
    ...values,
    AI_EGRESS_POLICY_JSON: JSON.stringify({
      enabled: true,
      providers,
      origins: providers.map(
        (provider) => new URL(MODEL_EVALUATION_ENDPOINTS[provider]).origin,
      ),
    }),
    AI_PROVIDER_TIMEOUT_MS: '30000',
    AI_STREAM_IDLE_TIMEOUT_MS: '30000',
    AI_EXECUTION_MAX_ATTEMPTS: '8',
  };
  delete process.env.ALLOW_INTERNAL_IPS;
  delete process.env.GEMINI_API_KEY;
  stage = 'runtime';
  const runtimeId = require.resolve('@prisma/client/runtime/client.js');
  require.cache[runtimeId] = require.cache[runtimeId] || {
    exports: require(runtimeId),
  };
  require.cache[runtimeId].exports = {
    ...require(runtimeId),
    warnEnvConflicts: () => {},
  };
  require('ts-node').register({
    transpileOnly: true,
    project: join(root, 'tsconfig.json'),
  });
  const { Logger } = require('@nestjs/common');
  Logger.overrideLogger([]);
  const { ConfigService } = require('@nestjs/config');
  const { PrismaService } = require('../../src/prisma/prisma.service');
  const { RedisService } = require('../../src/redis/redis.service');
  const {
    AiExecutionLedgerService,
  } = require('../../src/ai/ai-execution-ledger.service');
  const {
    AiAccountPolicyService,
  } = require('../../src/ai/ai-account-policy.service');
  const {
    AiEgressPolicyService,
  } = require('../../src/ai/ai-egress-policy.service');
  const {
    AiPromptBuilderService,
  } = require('../../src/ai/ai.prompt-builder.service');
  const {
    AiProviderRunnerService,
  } = require('../../src/ai/ai.provider-runner.service');
  const {
    AiChatCompletionService,
  } = require('../../src/ai/ai.chat-completion.service');
  const {
    AiAutocompleteService,
  } = require('../../src/ai/ai.autocomplete-service');
  const { AiRoutingService } = require('../../src/ai/ai.routing.service');
  const {
    AiCircuitBreakerService,
  } = require('../../src/ai/ai.circuit-breaker.service');
  const {
    FreshnessService,
  } = require('../../src/common/freshness/freshness.service');
  const {
    fetchAiProvider,
    readAiProviderJson,
  } = require('../../src/ai/ai-provider-transport');
  const evaluation = await import(
    pathToFileURL(join(root, 'scripts/ai-eval/model-role-assessment.mjs')).href
  );
  const profile = await import(
    pathToFileURL(join(root, 'scripts/ai-eval/native-fixture-profile.mjs')).href
  );
  const roster = readProviderAssessmentRoster();
  const catalog = evaluator.validateCatalog(
    (
      await evaluator.readJsonArtifact(
        join(root, 'scripts/ai-eval/synthetic-catalog.v1.json'),
      )
    ).data,
  );
  budget = evaluation.createModelAttemptBudget({
    maxAttempts,
    authorizedMaxAttempts: maxAttempts,
    initialAttempts,
    deadlineAt: authority.deadlineAt,
    onAcquire: (ordinal) =>
      durableRecord(journal, {
        ordinal,
        event: 'admitted-before-dispatch',
        at: new Date().toISOString(),
        ...currentAttempt,
      }),
  });
  const config = new ConfigService(process.env);
  const prisma = new PrismaService();
  const redis = new RedisService(config);
  const actorId = randomUUID();
  const actorEmail = `provider-eval-${actorId}@example.test`;
  let actorAttempted = false;
  let native;
  let report;
  const models = [];
  const discoveries = [];
  const ledgerContexts = new Set();
  const leaseIds = new Set();
  const failures = [];
  try {
    stage = 'stores';
    await prisma.$connect();
    redis.onModuleInit();
    await redis.ping();
    actorAttempted = true;
    await prisma.user.create({
      data: {
        id: actorId,
        email: actorEmail,
        aiEnabled: true,
        securityAlerts: false,
      },
    });
    const ledger = new AiExecutionLedgerService(prisma, redis, config);
    const policy = new AiEgressPolicyService(config);
    const account = new AiAccountPolicyService(prisma, config, policy);
    const assertProvider = async (plan) => {
      requireValue(
        providers.includes(plan.provider) &&
          plan.baseUrl === MODEL_EVALUATION_ENDPOINTS[plan.provider],
        'MODEL_EVAL_PLAN_MISMATCH',
      );
      await account.assertEnabled(actorId);
      policy.assertProvider(plan);
      requireValue(Date.now() < authority.deadlineAt, 'MODEL_EVAL_DEADLINE');
    };
    const beginExecution = async (model, probe, deadlineAt) => {
      const task =
        probe.operation === 'autocomplete'
          ? 'autocomplete'
          : probe.role === 'sql'
            ? 'generate_sql'
            : probe.role === 'nosql'
              ? 'generate_mql'
              : probe.role === 'explain'
                ? 'explain_sql'
                : 'chat';
      const context = await ledger.begin(actorId, task, {
        requestedModel: model.apiModel,
        deadlineAt,
      });
      ledgerContexts.add(context);
      leaseIds.add(context.generationId);
      return context;
    };
    stage = 'native-preflight';
    native = createDockerNativeExecutor(process.env.AI_EVAL_RUNNER_CONTAINER);
    for (const id of [
      'sql-count-null',
      'mongo-null-or-missing',
      'sql-null-note',
    ]) {
      const item = catalog.cases.find((item) => item.id === id);
      const actual = await native.execute(
        item.engine,
        item.expected.response.query,
      );
      requireValue(
        evaluator.compareResultBundles(item.expected.result, actual, {
          ordering: 'ordered',
          numericTolerance: catalog.numericPolicy,
        }).equal,
        'MODEL_NATIVE_PREFLIGHT_FAILED',
      );
    }
    stage = 'discovery';
    if (!previousReport)
      for (const provider of providers) {
        currentAttempt = {
          provider,
          model: 'discovery',
          probe: 'provider-model-list',
        };
        const plan = {
          provider,
          model: 'discovery',
          baseUrl: MODEL_EVALUATION_ENDPOINTS[provider],
        };
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);
        let context;
        let lease, handle, response;
        try {
          context = await runProviderEvaluationLedger(
            'MODEL_EVAL_LEDGER_BEGIN_FAILED',
            () =>
              ledger.begin(actorId, 'provider_discovery', {
                requestedModel: 'discovery',
                deadlineAt: Math.min(authority.deadlineAt, Date.now() + 15000),
              }),
          );
          ledgerContexts.add(context);
          leaseIds.add(context.generationId);
          await assertProvider(plan);
          lease = budget.acquire();
          handle = await runProviderEvaluationLedger(
            'MODEL_EVAL_LEDGER_ATTEMPT_BEGIN_FAILED',
            () => context.beforeAttempt({ provider, model: 'discovery' }),
          );
          response = await fetchAiProvider(
            `${plan.baseUrl}/models`,
            {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${values[`${provider.toUpperCase()}_API_KEY`]}`,
              },
              signal: controller.signal,
              redirect: 'manual',
            },
            {
              timeoutMs: 15000,
              maxResponseBytes: 512 * 1024,
              beforeDispatch: () => assertProvider(plan),
            },
          );
          const payload = await readAiProviderJson(response, 512 * 1024);
          if (!response.ok)
            throw Object.assign(new Error('MODEL_EVAL_DISCOVERY_HTTP_FAILED'), {
              code: 'MODEL_EVAL_DISCOVERY_HTTP_FAILED',
              status: response.status,
            });
          requireValue(
            Array.isArray(payload.data) && payload.data.length <= 1000,
            'MODEL_EVAL_DISCOVERY_INVALID',
          );
          const items = payload.data
            .filter(
              (item) =>
                typeof item?.id === 'string' &&
                /^[A-Za-z0-9][A-Za-z0-9._/:@-]{0,199}$/.test(item.id),
            )
            .map((item) => ({
              id: item.id,
              ...(item.architecture ? { architecture: item.architecture } : {}),
              ...(item.pricing ? { pricing: item.pricing } : {}),
              ...(item.active !== undefined ? { active: item.active } : {}),
            }));
          discoveries.push({
            provider,
            status: 'listed-not-inference-proof',
            models: items,
          });
          if (provider === 'cerebras') {
            const ids = new Set([
              values.CEREBRAS_CHAT_MODEL,
              ...items.map((item) => item.id),
            ]);
            for (const id of ids)
              if (
                typeof id === 'string' &&
                /^[A-Za-z0-9][A-Za-z0-9._/:@-]{0,199}$/.test(id)
              )
                roster.push(
                  Object.freeze({
                    provider,
                    apiModel: id,
                    selectionId: `cerebras:${id}`,
                    label: id,
                  }),
                );
          }
          await runProviderEvaluationLedger(
            'MODEL_EVAL_LEDGER_ATTEMPT_COMPLETE_FAILED',
            () => handle.complete({ provider, model: 'discovery' }),
          );
          await runProviderEvaluationLedger(
            'MODEL_EVAL_LEDGER_COMPLETE_FAILED',
            () => context.complete({ provider, model: 'discovery' }),
          );
        } catch (error) {
          if (handle)
            await runProviderEvaluationLedger(
              'MODEL_EVAL_LEDGER_ATTEMPT_FAIL_FAILED',
              () => handle.fail(operationOutcome(error)),
            );
          if (context)
            await runProviderEvaluationLedger(
              'MODEL_EVAL_LEDGER_FAIL_FAILED',
              () => context.fail(operationOutcome(error)),
            );
          if (isProviderEvaluationFatal(error)) throw error;
          const failure =
            response && !response.ok
              ? {
                  status: 'http-failed',
                  httpStatus: response.status,
                  code: 'MODEL_EVAL_DISCOVERY_HTTP_FAILED',
                }
              : classifyProviderFailure(error);
          discoveries.push({ provider, ...failure, models: [] });
          if (provider === 'cerebras') {
            const id = values.CEREBRAS_CHAT_MODEL;
            requireValue(
              typeof id === 'string' &&
                /^[A-Za-z0-9][A-Za-z0-9._/:@-]{0,199}$/.test(id),
              'MODEL_EVAL_ROSTER_INVALID',
            );
            roster.push(
              Object.freeze({
                provider,
                apiModel: id,
                selectionId: `cerebras:${id}`,
                label: id,
              }),
            );
          }
        } finally {
          clearTimeout(timer);
          lease?.release();
          try {
            if (context)
              await runProviderEvaluationLedger(
                'MODEL_EVAL_LEDGER_RELEASE_FAILED',
                () => context.release(),
              );
          } finally {
            if (response?.body && !response.body.locked)
              await response.body.cancel().catch(() => {});
          }
        }
        writeFileSync(
          join(output, `discovery-${provider}.json`),
          JSON.stringify(
            discoveries.filter((item) => item.provider === provider),
            null,
            2,
          ),
          { flag: 'wx', mode: 0o600 },
        );
      }
    if (previousReport) {
      discoveries.push(...previousReport.discoveries);
      roster.splice(
        0,
        roster.length,
        ...previousReport.models
          .filter(
            (model) =>
              ![
                'unavailable',
                'auth-denied',
                'credits-required',
                'rate-limited',
                'unconfigured',
              ].includes(model.operationalStatus) &&
              model.apiModel !== 'gemini-3.1-pro-preview',
          )
          .map(({ provider, apiModel, selectionId, label }) => ({
            provider,
            apiModel,
            selectionId,
            label,
          })),
      );
    }
    if (authority.additionalModels) {
      requireValue(
        previousReport &&
          Array.isArray(authority.additionalModels) &&
          authority.additionalModels.length <= 24,
        'MODEL_EVAL_ROSTER_INVALID',
      );
      for (const model of authority.additionalModels) {
        requireValue(
          providers.includes(model.provider) &&
            typeof model.apiModel === 'string' &&
            /^[A-Za-z0-9][A-Za-z0-9._/:@-]{0,199}$/.test(model.apiModel),
          'MODEL_EVAL_ROSTER_INVALID',
        );
        if (
          !roster.some(
            (entry) =>
              entry.provider === model.provider &&
              entry.apiModel === model.apiModel,
          )
        )
          roster.push(model);
      }
    }
    requireValue(
      roster.length <= 64 &&
        new Set(roster.map((model) => model.selectionId)).size ===
          roster.length,
      'MODEL_EVAL_ROSTER_INVALID',
    );
    writeFileSync(
      join(output, 'frozen-roster.json'),
      JSON.stringify(roster, null, 2),
      { flag: 'wx', mode: 0o600 },
    );
    const prompt = new AiPromptBuilderService();
    const routingBase = new AiRoutingService(config);
    let activeModel;
    let lastProviderError;
    let lastProviderResult;
    const providerRunner = new AiProviderRunnerService(config, prompt);
    const tracedRunner = new Proxy(providerRunner, {
      get(target, name) {
        const method = target[name];
        if (
          name === 'runOpenAiCompatible' ||
          name === 'completeOpenAiCompatibleText'
        )
          return async (...args) => {
            try {
              const value = await method.apply(target, args);
              lastProviderResult = value;
              return value;
            } catch (error) {
              lastProviderError = error;
              throw error;
            }
          };
        if (name === 'streamOpenAiCompatible')
          return async function* (...args) {
            try {
              for await (const event of method.apply(target, args)) {
                if (event.type === 'done') lastProviderResult = event.data;
                yield event;
              }
            } catch (error) {
              lastProviderError = error;
              throw error;
            }
          };
        return typeof method === 'function' ? method.bind(target) : method;
      },
    });
    const exactRouting = {
      buildPlanChain(params) {
        requireValue(
          activeModel &&
            params.model === activeModel.selectionId &&
            params.fallbackProvider === 'none' &&
            params.disabledProviders.includes('gemini'),
          'MODEL_EVAL_PLAN_MISMATCH',
        );
        return {
          routingMode: 'auto',
          routeDecision: routingBase.detectPromptNeeds(
            params.prompt,
            params.context,
            params.schemaContext,
            params.mode,
            params.image,
          ),
          plans: [
            {
              provider: activeModel.provider,
              model: activeModel.apiModel,
              baseUrl: MODEL_EVALUATION_ENDPOINTS[activeModel.provider],
              apiKey: values[`${activeModel.provider.toUpperCase()}_API_KEY`],
            },
          ],
        };
      },
    };
    const cache = new Map();
    const cacheManager = {
      get: async (key) => cache.get(key),
      set: async (key, value) => {
        cache.set(key, value);
      },
    };
    const chat = new AiChatCompletionService(
      cacheManager,
      prompt,
      tracedRunner,
      exactRouting,
      new AiCircuitBreakerService(),
    );
    const autocomplete = new AiAutocompleteService(
      cacheManager,
      tracedRunner,
      exactRouting,
      new FreshnessService(cacheManager),
    );
    const { AiService } = require('../../src/ai/ai.service');
    const ai = new AiService(chat, {}, autocomplete);
    const services = {
      assertProvider,
      beginExecution,
      chat: createProviderEvaluationChat({
        ai,
        chat,
        followup: Boolean(previousReport),
        getProbe: () => currentAttempt.probe,
        getProviderError: () => lastProviderError,
        getProviderResult: () => lastProviderResult,
      }),
      autocomplete: {
        autocomplete: async (params) => {
          const text = await autocomplete.autocomplete(params);
          if (!text && lastProviderError) throw lastProviderError;
          return text;
        },
      },
    };
    stage = 'assessment';
    for (const model of roster)
      models.push({
        ...model,
        operationalStatus: 'not-assessed',
        probes: [],
        capabilities: {
          text: 'not-tested',
          stream: 'not-tested',
          vision: 'not-tested',
          pdf: 'not-tested',
          web: 'not-tested',
        },
        recommendedRoles: [],
        stopped: false,
      });
    const probeModel = async (model, probe) => {
      if (
        model.stopped ||
        budget.attempts >= maxAttempts ||
        Date.now() >= authority.deadlineAt
      )
        return;
      activeModel = model;
      currentAttempt = {
        provider: model.provider,
        model: model.apiModel,
        probe: probe.id,
      };
      lastProviderError = undefined;
      lastProviderResult = undefined;
      const beginAttempts = budget.attempts;
      const startedAt = Date.now();
      const deadlineAt = Math.min(authority.deadlineAt, Date.now() + 45000);
      const adapter = createAppModelRoleAdapter({
        provider: model.provider,
        apiKey: values[`${model.provider.toUpperCase()}_API_KEY`],
        baseUrl: MODEL_EVALUATION_ENDPOINTS[model.provider],
        deadlineAt,
        services,
      });
      const schema =
        catalog.schema[probe.databaseType === 'mongodb' ? 'mongo' : 'sql'];
      const request = {
        ...evaluation.requestForProbe(probe, catalog),
        schema: { entities: schema.entities },
      };
      if (probe.image) request.image = readFileSync(probe.image, 'utf8');
      if (probe.document)
        request.document = evaluator.parseBoundedJson(
          readFileSync(probe.document, 'utf8'),
        );
      if (previousReport && probe.operation === 'autocomplete')
        request.beforeCursor = 'SELECT id FROM orders WHERE note IS NU';
      await runProviderEvaluationProbe(
        async () => {
          const reply = await adapter.runProbe(
            { model, probe: request },
            budget,
          );
          const plain = JSON.parse(JSON.stringify(reply));
          durableRecord(responses, {
            ...currentAttempt,
            at: new Date().toISOString(),
            reply: plain,
          });
          let assessment;
          const aliasNormalized =
            previousReport &&
            model.provider === 'beeknoee' &&
            plain.reportedModel &&
            (model.apiModel.startsWith('bee/') ||
              model.apiModel.startsWith('bee-tok/') ||
              model.apiModel.startsWith('minimax/')) &&
            plain.reportedModel ===
              model.apiModel.slice(model.apiModel.indexOf('/') + 1);
          if (
            plain.reportedModel &&
            plain.reportedModel !== model.apiModel &&
            !aliasNormalized
          ) {
            model.operationalStatus = 'identity-mismatch';
            model.stopped = true;
            assessment = {
              verdict: 'requires-review',
              reasons: ['REPORTED_MODEL_MISMATCH'],
              execution: 'NOT_EXECUTED',
            };
          } else {
            const rubricProbe =
              previousReport && probe.operation === 'autocomplete'
                ? { ...probe, beforeCursor: request.beforeCursor }
                : probe;
            assessment =
              probe.rubric === 'synthetic-fact-only'
                ? {
                    verdict:
                      plain.message.trim() === probe.expectedText
                        ? 'capability-fact-match'
                        : 'capability-fact-failure',
                    reasons: ['SYNTHETIC_FACT_ONLY_NOT_ROLE_ACCURACY'],
                    execution: 'NOT_EXECUTED',
                  }
                : await evaluation.assessModelProbe(
                    rubricProbe,
                    plain,
                    catalog,
                    native.execute,
                  );
            if (probe.capability)
              model.capabilities[probe.capability] =
                assessment.verdict === 'capability-fact-match'
                  ? 'synthetic-fact-tested'
                  : 'synthetic-fact-failure';
            if (probe.id === 'availability') {
              model.operationalStatus = 'reachable';
              model.capabilities.text =
                assessment.verdict === 'format-match'
                  ? 'format-tested-not-role-quality'
                  : 'terminal-response-format-mismatch';
            }
            if (probe.operation === 'stream')
              model.capabilities.stream =
                assessment.verdict === 'format-match'
                  ? 'terminal-tested'
                  : 'terminal-response-format-mismatch';
          }
          const decision = {
            ...currentAttempt,
            ...assessment,
            attempts: budget.attempts - beginAttempts,
            elapsedMs: Date.now() - startedAt,
            ttftMs: plain.ttftMs ?? null,
            reportedModel: plain.reportedModel ?? null,
            usage: plain.usage ?? null,
            requestSha256: plain.requestSha256 ?? null,
            identityEvidence: aliasNormalized
              ? 'provider-reported-prefix-stripped-alias-not-upstream-proof'
              : plain.reportedModel
                ? 'provider-reported-not-upstream-proof'
                : 'not-reported',
          };
          model.probes.push(decision);
          durableRecord(decisions, decision);
        },
        async (error) => {
          let classified = classifyProviderFailure(error);
          const cause = error?.cause;
          if (cause && classified.status === 'operation-failed')
            classified = classifyProviderFailure(cause);
          const decision = {
            ...currentAttempt,
            verdict: 'not-assessed',
            execution: 'NOT_EXECUTED',
            attempts: budget.attempts - beginAttempts,
            elapsedMs: Date.now() - startedAt,
            failure: classified,
          };
          model.probes.push(decision);
          durableRecord(decisions, decision);
          model.operationalStatus = classified.status;
          if (
            probe.id === 'availability' ||
            [
              'auth-denied',
              'credits-required',
              'rate-limited',
              'unavailable',
              'unconfigured',
            ].includes(classified.status)
          )
            model.stopped = true;
        },
        adapter.isFatalError,
      );
      process.stdout.write(
        JSON.stringify({
          provider: model.provider,
          model: model.apiModel,
          probe: probe.id,
          attempts: budget.attempts,
          verdict: model.probes.at(-1)?.verdict,
          status: model.operationalStatus,
        }) + '\n',
      );
      requireValue(!budget.active, 'MODEL_EVAL_ADAPTER_LEFT_ACTIVE');
    };
    const probeRoster = authority.probes ?? evaluation.MODEL_ROLE_PROBES;
    requireValue(
      Array.isArray(probeRoster) &&
        probeRoster.length >= 1 &&
        probeRoster.length <= 12 &&
        probeRoster[0].id === 'availability',
      'MODEL_EVAL_PROBES_INVALID',
    );
    await runProviderEvaluationProbes(models, probeRoster, probeModel);
    for (const model of models) {
      const required = {
        sql: ['sql-count', 'repair-null'],
        nosql: ['mongo-null'],
        autocomplete: ['autocomplete-null'],
      };
      model.roles = [
        'assistant',
        'sql',
        'nosql',
        'explain',
        'autocomplete',
      ].map((role) => {
        const probes = model.probes.filter(
          (probe) =>
            probeRoster.find((item) => item.id === probe.probe)?.role === role,
        );
        const complete =
          required[role]?.every((id) =>
            probes.some(
              (probe) =>
                probe.probe === id && probe.verdict === 'observed-match',
            ),
          ) ?? false;
        const verdict =
          model.operationalStatus === 'identity-mismatch'
            ? 'requires-review'
            : probes.some((probe) => probe.verdict === 'observed-failure')
              ? 'observed-failure'
              : complete
                ? 'observed-match'
                : probes.some(
                      (probe) =>
                        probe.verdict === 'requires-review' ||
                        probe.verdict === 'observed-match',
                    )
                  ? 'requires-review'
                  : 'not-assessed';
        return {
          role,
          samples: probes.filter((probe) =>
            ['observed-match', 'observed-failure', 'requires-review'].includes(
              probe.verdict,
            ),
          ).length,
          verdict,
        };
      });
      model.recommendedRoles = model.roles
        .filter((role) => role.verdict === 'observed-match')
        .map((role) => role.role);
      model.recommendationLevel = model.recommendedRoles.length
        ? 'provisional-small-sample'
        : 'not-assessed';
      delete model.stopped;
    }
    report = {
      formatVersion: 1,
      kind: 'multi-provider-live-task-assessment',
      evaluatedAt: new Date().toISOString(),
      authorizationSha256: createHash('sha256')
        .update(authorityBytes)
        .digest('hex'),
      attemptLimit: maxAttempts,
      providerAttempts: budget.attempts,
      previousProviderAttempts: previousReport?.providerAttempts ?? 0,
      thisRunProviderAttempts:
        budget.attempts - (previousReport?.providerAttempts ?? 0),
      previousReportSha256: authority.previousReportSha256 ?? null,
      concurrency: 1,
      directGeminiExcluded: true,
      roster,
      discoveries,
      models,
      probeRosterSha256: profile.digest(probeRoster),
      semanticModelAccuracy: 'NOT_ASSESSED',
      cost: null,
      costEvidence: 'OPERATOR_ATTESTED_FREE_NOT_PROVIDER_BILLING_PROOF',
      deploymentAuthorized: false,
      certification: 'NOT_CERTIFIED',
      limitations: [
        'Fixed synthetic small-sample tasks; not expert-adjudicated or blind benchmark.',
        'Only fingerprint-pinned SQL/Mongo proposals execute; non-pinned equivalents require review.',
        'Exact evaluation routing is injected; app prompt, parsing, lifecycle and pinned transport are reused.',
        'No model role preference is automatically saved.',
        'Provider-reported alias does not prove upstream identity.',
        'Missing usage or cost is not zero; no paid plugins or direct Gemini API are invoked.',
        'Vision/PDF/web capability is not inferred from names.',
      ],
    };
    writeFileSync(
      join(output, 'assessment-before-cleanup.json'),
      JSON.stringify(report, null, 2),
      { flag: 'wx', mode: 0o600 },
    );
  } catch (error) {
    failures.push({
      stage,
      code:
        typeof error?.code === 'string' && /^[A-Z0-9_]{1,100}$/.test(error.code)
          ? error.code
          : 'MODEL_EVAL_RUN_FAILED',
      attempts: budget?.attempts ?? 0,
    });
    durableRecord(join(output, 'run-failures.ndjson'), failures.at(-1));
  } finally {
    stage = 'cleanup';
    failures.push(
      ...(await cleanupProviderEvaluationResources({
        actorAttempted,
        actorId,
        actorEmail,
        prisma,
        redis,
        native,
        ledgerContexts,
        leaseIds,
        onReadback: (readback) =>
          durableRecord(join(output, 'cleanup.ndjson'), {
            at: new Date().toISOString(),
            ...readback,
          }),
      })),
    );
  }
  stage = 'report';
  if (report) {
    report.cleanupVerified = failures.length === 0;
    report.failures = failures;
    const payload = JSON.stringify(report, null, 2);
    writeFileSync(join(output, 'assessment.json'), payload, {
      flag: 'wx',
      mode: 0o600,
    });
    process.stdout.write(
      JSON.stringify({
        status: failures.length ? 'completed-with-errors' : 'completed',
        attempts: budget.attempts,
        models: models.length,
        reportSha256: createHash('sha256').update(payload).digest('hex'),
      }) + '\n',
    );
  } else {
    process.stderr.write(
      JSON.stringify({
        status: 'failed',
        stage,
        attempts: budget?.attempts ?? 0,
        failures,
      }) + '\n',
    );
  }
  if (failures.length) process.exitCode = 1;
}

module.exports = {
  readProviderEvaluationContinuation,
  runProviderEvaluationProbe,
  runProviderEvaluationLedger,
  isProviderEvaluationFatal,
  runProviderEvaluationProbes,
  createProviderEvaluationChat,
  cleanupProviderEvaluationResources,
  durableRecord,
};

if (require.main === module)
  main().catch((error) => {
    if (output) {
      try {
        durableRecord(join(output, 'run-failures.ndjson'), {
          stage,
          code: 'MODEL_EVAL_BOOTSTRAP_FAILED',
          attempts: budget?.attempts ?? 0,
        });
      } catch {}
    }
    process.stderr.write(
      JSON.stringify({
        code:
          typeof error?.code === 'string' &&
          /^MODEL_[A-Z0-9_]+$/.test(error.code)
            ? error.code
            : 'MODEL_EVAL_BOOTSTRAP_FAILED',
        stage,
        attempts: budget?.attempts ?? 0,
      }) + '\n',
    );
    process.exitCode = 1;
  });
