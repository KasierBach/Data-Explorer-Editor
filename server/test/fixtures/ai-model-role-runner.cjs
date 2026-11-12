'use strict';

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { createHash, randomUUID } = require('node:crypto');
const {
  appendFileSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} = require('node:fs');
const { createInterface } = require('node:readline');
const { join, resolve } = require('node:path');
const { pathToFileURL } = require('node:url');

const root = resolve(__dirname, '../..');
let modelEvalStage = 'arguments';
let modelEvalFailureStage;
const stages = new Set([
  'arguments',
  'config',
  'runtime',
  'prisma-runtime',
  'typescript-runtime',
  'application-imports',
  'import-prisma',
  'import-redis',
  'import-ledger',
  'import-provider',
  'import-services',
  'import-egress-policy',
  'import-account-policy',
  'import-live-adapter',
  'import-evaluator',
  'construct-config',
  'construct-prisma',
  'construct-redis',
  'stores',
  'preflight',
  'native',
  'assessment',
  'cleanup',
  'report',
]);
const requireValue = (value, code) => {
  if (!value) throw Object.assign(new Error(code), { code });
};

function prepareReportOutput(reportPath) {
  const reportDirectory = resolve(reportPath, '..');
  requireValue(
    reportDirectory !== root &&
      reportDirectory !== resolve(root, '..') &&
      !reportDirectory.startsWith(`${resolve(root, '..')}\\`) &&
      !reportDirectory.startsWith(`${resolve(root, '..')}/`),
    'MODEL_EVAL_REPORT_PATH_INVALID',
  );
  mkdirSync(reportDirectory, { recursive: true, mode: 0o700 });
  const journalPath = join(reportDirectory, 'attempt-journal.ndjson');
  writeFileSync(journalPath, '', { flag: 'wx', mode: 0o600 });
  return {
    reportDirectory,
    journalPath,
  };
}

function appendAttemptJournal(journalPath, ordinal, now = Date.now) {
  appendFileSync(
    journalPath,
    `${JSON.stringify({ ordinal, admittedAt: new Date(now()).toISOString() })}\n`,
    { flag: 'a', mode: 0o600 },
  );
}

function publishReport(reportPath, payload) {
  writeFileSync(reportPath, payload, { flag: 'wx', mode: 0o600 });
}

function selectFailureStage(originalStage, cleanupFailed) {
  return cleanupFailed ? 'cleanup' : originalStage;
}

async function cleanupRunResources({
  nativeFixture,
  actorCreated,
  actorId,
  actorEmail,
  prisma,
  redis,
}) {
  let failed = false;
  try {
    if (nativeFixture) await nativeFixture.close();
  } catch {
    failed = true;
  }
  try {
    if (actorCreated) {
      const generations = await prisma.aiGeneration.findMany({
        where: { userId: actorId },
        select: { id: true },
      });
      const ids = generations.map((item) => item.id);
      if (ids.length) {
        await prisma.aiGenerationFeedback.deleteMany({
          where: { generationId: { in: ids } },
        });
        await prisma.aiProviderAttempt.deleteMany({
          where: { generationId: { in: ids } },
        });
        await prisma.aiGeneration.deleteMany({
          where: { id: { in: ids }, userId: actorId },
        });
      }
      await prisma.user.deleteMany({
        where: { id: actorId, email: actorEmail },
      });
    }
  } catch {
    failed = true;
  } finally {
    const settlements = await Promise.allSettled([
      prisma.$disconnect(),
      redis.onModuleDestroy(),
    ]);
    if (settlements.some((item) => item.status === 'rejected')) failed = true;
  }
  if (failed)
    throw Object.assign(new Error('MODEL_EVAL_CLEANUP_FAILED'), {
      code: 'MODEL_EVAL_CLEANUP_FAILED',
    });
}

function readEnvFile(path) {
  const stat = lstatSync(path);
  requireValue(
    stat.isFile() && !stat.isSymbolicLink() && stat.size <= 64 * 1024,
    'MODEL_EVAL_ENV_INVALID',
  );
  const result = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(
      line,
    );
    if (!match) continue;
    if (
      ![
        'BEEKNOEE_API_KEY',
        'BEEKNOEE_BASE_URL',
        'BEEKNOEE_CHAT_MODEL',
      ].includes(match[1])
    )
      continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    )
      value = value.slice(1, -1);
    result[match[1]] = value;
  }
  return result;
}

function installRuntimeEnvironment(values) {
  const allowed = {
    NODE_ENV: 'test',
    DATABASE_URL: process.env.E2E_DATABASE_URL,
    REDIS_URL: process.env.E2E_REDIS_URL,
    E2E_DATABASE_URL: process.env.E2E_DATABASE_URL,
    E2E_REDIS_URL: process.env.E2E_REDIS_URL,
    AI_KILL_SWITCH: 'false',
    AI_EGRESS_POLICY_JSON: JSON.stringify({
      enabled: true,
      providers: ['beeknoee'],
      origins: ['https://platform.beeknoee.com'],
    }),
    BEEKNOEE_API_KEY: values.BEEKNOEE_API_KEY,
    BEEKNOEE_BASE_URL: values.BEEKNOEE_BASE_URL,
    BEEKNOEE_CHAT_MODEL: values.BEEKNOEE_CHAT_MODEL,
    AI_EVAL_RUNNER_CONTAINER: process.env.AI_EVAL_RUNNER_CONTAINER,
    AI_EXECUTION_PER_USER_CONCURRENCY: '1',
    AI_EXECUTION_GLOBAL_CONCURRENCY: '1',
    AI_EXECUTION_MAX_ATTEMPTS: '8',
    AI_PROVIDER_TIMEOUT_MS: '30000',
    AI_STREAM_IDLE_TIMEOUT_MS: '30000',
    PRISMA_HIDE_UPDATE_MESSAGE: 'true',
    CHECKPOINT_DISABLE: '1',
  };
  for (const key of [
    'PATH',
    'Path',
    'SystemRoot',
    'SYSTEMROOT',
    'WINDIR',
    'ComSpec',
    'COMSPEC',
    'TEMP',
    'TMP',
    'TMPDIR',
    'HOME',
    'USERPROFILE',
    'LOCALAPPDATA',
    'APPDATA',
  ]) {
    if (process.env[key] !== undefined) allowed[key] = process.env[key];
  }
  process.env = allowed;
}

function createDockerNativeExecutor(containerName) {
  requireValue(
    typeof containerName === 'string' &&
      /^ai-eval-[a-z0-9-]{8,80}-eval-runner-1$/.test(containerName),
    'MODEL_NATIVE_CONTAINER_INVALID',
  );
  const child = spawn(
    'docker',
    [
      'exec',
      '-i',
      containerName,
      'node',
      '/workspace/server/scripts/ai-eval/model-native-worker.mjs',
    ],
    {
      cwd: root,
      env: {
        PATH: process.env.PATH,
        SystemRoot: process.env.SystemRoot,
        WINDIR: process.env.WINDIR,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    },
  );
  const pending = new Map();
  let sequence = 0;
  let readyResolve;
  let readyReject;
  const ready = new Promise((resolve, reject) => {
    readyResolve = resolve;
    readyReject = reject;
  });
  const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
  lines.on('line', (line) => {
    let value;
    try {
      requireValue(
        Buffer.byteLength(line) <= 1024 * 1024,
        'MODEL_NATIVE_RESPONSE_INVALID',
      );
      value = JSON.parse(line);
    } catch {
      const error = new Error('MODEL_NATIVE_RESPONSE_INVALID');
      readyReject(error);
      for (const owner of pending.values()) {
        clearTimeout(owner.timer);
        owner.reject(error);
      }
      pending.clear();
      child.kill();
      return;
    }
    if (value?.type === 'ready') {
      readyResolve();
      return;
    }
    const id = value?.id;
    if (
      !Number.isSafeInteger(id) ||
      id < 1 ||
      id > 1000 ||
      typeof value?.ok !== 'boolean' ||
      (value.ok === true && !Object.hasOwn(value, 'value')) ||
      (value.ok === false &&
        (!value.error ||
          typeof value.error !== 'object' ||
          typeof value.error.code !== 'string' ||
          !/^(?:MODEL|NATIVE)_[A-Z0-9_]+$/.test(value.error.code)))
    ) {
      readyReject(new Error('MODEL_NATIVE_RESPONSE_INVALID'));
      for (const owner of pending.values()) {
        clearTimeout(owner.timer);
        owner.reject(new Error('MODEL_NATIVE_RESPONSE_INVALID'));
      }
      pending.clear();
      child.kill();
      return;
    }
    const owner = pending.get(id);
    if (!owner) {
      readyReject(new Error('MODEL_NATIVE_RESPONSE_INVALID'));
      for (const owner of pending.values()) {
        clearTimeout(owner.timer);
        owner.reject(new Error('MODEL_NATIVE_RESPONSE_INVALID'));
      }
      pending.clear();
      child.kill();
      return;
    }
    pending.delete(id);
    clearTimeout(owner.timer);
    if (value.ok === true) owner.resolve(value.value);
    else
      owner.reject(
        Object.assign(new Error('MODEL_NATIVE_REQUEST_FAILED'), value.error),
      );
  });
  child.once('error', () =>
    readyReject(new Error('MODEL_NATIVE_WORKER_FAILED')),
  );
  child.once('exit', () => {
    readyReject(new Error('MODEL_NATIVE_WORKER_FAILED'));
    for (const owner of pending.values()) {
      clearTimeout(owner.timer);
      owner.reject(new Error('MODEL_NATIVE_WORKER_EXITED'));
    }
    pending.clear();
  });
  const call = async (command) => {
    let readyTimer;
    try {
      await Promise.race([
        ready,
        new Promise((_, reject) => {
          readyTimer = setTimeout(() => {
            child.kill();
            reject(new Error('MODEL_NATIVE_WORKER_TIMEOUT'));
          }, 30_000);
        }),
      ]);
    } finally {
      clearTimeout(readyTimer);
    }
    const id = ++sequence;
    const result = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        child.kill();
        reject(new Error('MODEL_NATIVE_REQUEST_TIMEOUT'));
      }, 15_000);
      pending.set(id, { resolve, reject, timer });
    });
    child.stdin.write(`${JSON.stringify({ id, ...command })}\n`);
    return result;
  };
  return {
    async execute(engine, query) {
      const { queryDigest, NATIVE_CASES } = await import(
        pathToFileURL(join(root, 'scripts/ai-eval/native-fixture-profile.mjs'))
          .href
      );
      const hash = queryDigest(query);
      const profile = NATIVE_CASES.find(
        (item) => item.engine === engine && item.querySha256 === hash,
      );
      requireValue(
        profile &&
          ['sql-count-null', 'mongo-null-or-missing', 'sql-null-note'].includes(
            profile.caseId,
          ),
        'MODEL_NATIVE_QUERY_NOT_ALLOWED',
      );
      return call({ action: 'execute', caseId: profile.caseId });
    },
    async close() {
      if (child.exitCode !== null || child.signalCode !== null) return;
      try {
        await call({ action: 'close' });
      } finally {
        child.stdin.end();
      }
    },
  };
}

async function main() {
  const [envPath, authorityPath, reportPath] = process.argv.slice(2);
  requireValue(
    envPath && authorityPath && reportPath && process.argv.length === 5,
    'MODEL_EVAL_RUN_ARGUMENTS_INVALID',
  );
  modelEvalStage = 'config';
  const { journalPath } = prepareReportOutput(reportPath);
  const values = readEnvFile(envPath);
  requireValue(
    values.BEEKNOEE_API_KEY?.trim(),
    'MODEL_EVAL_CREDENTIAL_MISSING',
  );
  requireValue(
    values.BEEKNOEE_BASE_URL?.trim() === 'https://platform.beeknoee.com/api/v1',
    'MODEL_EVAL_RECIPIENT_MISMATCH',
  );
  installRuntimeEnvironment(values);
  modelEvalStage = 'runtime';

  modelEvalStage = 'prisma-runtime';
  const runtimeId = require.resolve('@prisma/client/runtime/client.js');
  require.cache[runtimeId] = require.cache[runtimeId] || {
    exports: require(runtimeId),
  };
  require.cache[runtimeId].exports = {
    ...require(runtimeId),
    warnEnvConflicts: () => {},
  };
  modelEvalStage = 'typescript-runtime';
  require('ts-node').register({
    transpileOnly: true,
    project: join(root, 'tsconfig.json'),
  });
  modelEvalStage = 'application-imports';
  const { Logger } = require('@nestjs/common');
  Logger.overrideLogger([]);
  const { ConfigService } = require('@nestjs/config');
  modelEvalStage = 'import-prisma';
  const { PrismaService } = require('../../src/prisma/prisma.service');
  modelEvalStage = 'import-redis';
  const { RedisService } = require('../../src/redis/redis.service');
  modelEvalStage = 'import-ledger';
  const {
    AiExecutionLedgerService,
  } = require('../../src/ai/ai-execution-ledger.service');
  modelEvalStage = 'import-provider';
  const {
    AiPromptBuilderService,
  } = require('../../src/ai/ai.prompt-builder.service');
  const {
    AiProviderRunnerService,
  } = require('../../src/ai/ai.provider-runner.service');
  const { AiRoutingService } = require('../../src/ai/ai.routing.service');
  const {
    AiChatCompletionService,
  } = require('../../src/ai/ai.chat-completion.service');
  const {
    AiCircuitBreakerService,
  } = require('../../src/ai/ai.circuit-breaker.service');
  const {
    AiAutocompleteService,
  } = require('../../src/ai/ai.autocomplete-service');
  const {
    FreshnessService,
  } = require('../../src/common/freshness/freshness.service');
  modelEvalStage = 'import-services';
  modelEvalStage = 'import-egress-policy';
  const {
    AiEgressPolicyService,
  } = require('../../src/ai/ai-egress-policy.service');
  modelEvalStage = 'import-account-policy';
  const {
    AiAccountPolicyService,
  } = require('../../src/ai/ai-account-policy.service');
  modelEvalStage = 'import-live-adapter';
  const { createLiveModelRoleAdapter } = require('./ai-model-role-live.cjs');
  modelEvalStage = 'import-evaluator';
  const evaluation = await import(
    pathToFileURL(join(root, 'scripts/ai-eval/model-role-assessment.mjs')).href
  );

  modelEvalStage = 'construct-config';
  const config = new ConfigService(process.env);
  modelEvalStage = 'construct-prisma';
  const prisma = new PrismaService();
  modelEvalStage = 'construct-redis';
  const redis = new RedisService(config);
  let nativeFixture;
  const actorId = randomUUID();
  const actorEmail = `model-eval-${actorId}@example.test`;
  let actorCreated = false;
  let report;
  let payload;
  let failureStage;
  try {
    modelEvalStage = 'stores';
    await prisma.$connect();
    redis.onModuleInit();
    await redis.ping();
    await prisma.user.create({
      data: {
        id: actorId,
        email: actorEmail,
        aiEnabled: true,
        securityAlerts: false,
      },
    });
    actorCreated = true;
    const ledger = new AiExecutionLedgerService(prisma, redis, config);
    const prompt = new AiPromptBuilderService();
    const providerRunner = new AiProviderRunnerService(config, prompt);
    const routing = new AiRoutingService(config);
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
      providerRunner,
      routing,
      new AiCircuitBreakerService(),
    );
    const autocomplete = new AiAutocompleteService(
      cacheManager,
      providerRunner,
      routing,
      new FreshnessService(cacheManager),
    );
    const policy = new AiEgressPolicyService(config);
    const accountPolicy = new AiAccountPolicyService(prisma, config, policy);
    const roster = await evaluation.readBeeknoeeAssessmentRoster();
    const { authorization, adapter } = createLiveModelRoleAdapter({
      roster,
      apiKey: values.BEEKNOEE_API_KEY,
      baseUrl: values.BEEKNOEE_BASE_URL,
      authorizationPath: authorityPath,
      services: {
        chat,
        autocomplete,
        assertProvider: async (plan) => {
          await accountPolicy.assertEnabled(actorId);
          policy.assertProvider(plan);
        },
        beginExecution: async (model, probe, deadlineAt) => {
          const task =
            probe.role === 'autocomplete'
              ? 'autocomplete'
              : probe.role === 'nosql'
                ? 'generate_mql'
                : probe.role === 'explain'
                  ? 'explain_sql'
                  : probe.role === 'sql'
                    ? 'generate_sql'
                    : 'chat';
          return ledger.begin(actorId, task, {
            requestedModel: model.apiModel,
            deadlineAt,
          });
        },
      },
    });
    const preflight = evaluation.assessModelEvaluationPreflight(
      authorization,
      roster,
      Date.now(),
    );
    modelEvalStage = 'preflight';
    requireValue(
      preflight.allowed,
      `MODEL_EVAL_PREFLIGHT_BLOCKED_${preflight.reasons.join('_')}`,
    );
    modelEvalStage = 'native';
    nativeFixture = createDockerNativeExecutor(
      process.env.AI_EVAL_RUNNER_CONTAINER,
    );
    modelEvalStage = 'assessment';
    report = await evaluation.runModelRoleAssessment({
      roster,
      authorization,
      adapter,
      nativeExecutor: nativeFixture.execute,
      maxAttempts: 80,
      onAttempt: (ordinal) => appendAttemptJournal(journalPath, ordinal),
    });
    payload = JSON.stringify(report, null, 2) + '\n';
    requireValue(
      Buffer.byteLength(payload) <= 1024 * 1024,
      'MODEL_EVAL_REPORT_TOO_LARGE',
    );
  } catch (error) {
    failureStage = modelEvalStage;
    modelEvalFailureStage = failureStage;
    throw error;
  } finally {
    if (!failureStage) failureStage = modelEvalStage;
    modelEvalStage = 'cleanup';
    try {
      await cleanupRunResources({
        nativeFixture,
        actorCreated,
        actorId,
        actorEmail,
        prisma,
        redis,
      });
    } catch (error) {
      modelEvalFailureStage = selectFailureStage(failureStage, true);
      throw error;
    }
  }
  modelEvalStage = 'report';
  requireValue(report && payload, 'MODEL_EVAL_REPORT_UNAVAILABLE');
  publishReport(reportPath, payload);
  process.stdout.write(
    JSON.stringify({
      status: 'completed',
      providerAttempts: report.providerAttempts,
      models: report.models.map((model) => ({
        selectionId: model.selectionId,
        operationalStatus: model.operationalStatus,
        recommendationLevel: model.recommendationLevel,
        recommendedRoles: model.recommendedRoles,
      })),
      reportSha256: createHash('sha256').update(payload).digest('hex'),
    }) + '\n',
  );
}

module.exports = {
  appendAttemptJournal,
  cleanupRunResources,
  prepareReportOutput,
  publishReport,
  selectFailureStage,
};

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(
      JSON.stringify({
        code:
          typeof error?.code === 'string' &&
          /^MODEL_[A-Z0-9_]+$/.test(error.code)
            ? error.code
            : typeof error?.message === 'string' &&
                /^MODEL_[A-Z0-9_]+$/.test(error.message)
              ? error.message
              : 'MODEL_EVAL_RUN_FAILED',
        stage: stages.has(modelEvalFailureStage ?? modelEvalStage)
          ? (modelEvalFailureStage ?? modelEvalStage)
          : 'unknown',
      }) + '\n',
    );
    process.exitCode = 1;
  });
}
