'use strict';

const { createE2eEnvironment } = require('../e2e-environment.cjs');
const MAX_COMMAND_BYTES = 32 * 1024;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const LIMITS = {
  AI_EXECUTION_GLOBAL_CONCURRENCY: 128,
  AI_EXECUTION_PER_USER_CONCURRENCY: 8,
  AI_EXECUTION_MAX_ATTEMPTS: 8,
};
const FAULTS = [
  'none',
  'acquire-ack-lost',
  'acquire-ack-and-cleanup-lost',
  'generation-ack-lost',
  'attempt-constraint',
  'terminal-constraint',
  'release-unavailable',
];
const STAGES = [
  'after-generation-create',
  'after-lease-acquire',
  'after-attempt-reservation',
];

function requireCommand(value) {
  if (!value) throw new Error('AI_LEDGER_COMMAND_INVALID');
}
function record(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}
function fields(value, allowed, required = []) {
  requireCommand(
    record(value) &&
      Object.keys(value).every((key) => allowed.includes(key)) &&
      required.every((key) => Object.hasOwn(value, key)),
  );
}
function identifier(value, max = 200) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= max &&
    /^[A-Za-z0-9][A-Za-z0-9._/:@-]*$/.test(value)
  );
}
function resultMetadata(value, usageAllowed) {
  if (value === undefined) return;
  fields(
    value,
    usageAllowed ? ['provider', 'model', 'usage'] : ['provider', 'model'],
  );
  for (const [key, max] of [
    ['provider', 64],
    ['model', 200],
  ]) {
    requireCommand(value[key] === undefined || identifier(value[key], max));
  }
  if (usageAllowed && value.usage !== undefined && value.usage !== null) {
    fields(value.usage, ['promptTokens', 'completionTokens', 'totalTokens']);
    requireCommand(
      Object.values(value.usage).every(
        (count) =>
          count === null ||
          (Number.isInteger(count) && count >= 0 && count <= 2_147_483_647),
      ),
    );
  }
}
function validateCommand(command) {
  requireCommand(
    record(command) &&
      Buffer.byteLength(JSON.stringify(command)) <= MAX_COMMAND_BYTES,
  );
  requireCommand(
    Number.isSafeInteger(command.id) && command.id > 0 && command.id <= 10000,
  );
  const common = ['id', 'action'];
  const generation = () =>
    requireCommand(
      typeof command.generationId === 'string' &&
        UUID.test(command.generationId),
    );
  switch (command.action) {
    case 'begin':
      fields(command, [...common, 'userId', 'metadata'], [...common, 'userId']);
      requireCommand(
        typeof command.userId === 'string' && UUID.test(command.userId),
      );
      if (command.metadata !== undefined) {
        fields(command.metadata, [
          'connectionId',
          'database',
          'requestedModel',
          'deadlineAt',
        ]);
        for (const [key, max] of [
          ['connectionId', 128],
          ['database', 256],
          ['requestedModel', 200],
        ]) {
          requireCommand(
            command.metadata[key] === undefined ||
              identifier(command.metadata[key], max),
          );
        }
        requireCommand(
          command.metadata.deadlineAt === undefined ||
            (Number.isSafeInteger(command.metadata.deadlineAt) &&
              command.metadata.deadlineAt > 0),
        );
      }
      break;
    case 'attempt':
      fields(
        command,
        [...common, 'generationId', 'plan'],
        [...common, 'generationId', 'plan'],
      );
      generation();
      fields(command.plan, ['provider', 'model'], ['provider', 'model']);
      requireCommand(
        identifier(command.plan.provider, 64) && identifier(command.plan.model),
      );
      break;
    case 'finishAttempt':
      fields(
        command,
        [...common, 'attemptId', 'outcome', 'result'],
        [...common, 'attemptId', 'outcome'],
      );
      requireCommand(
        typeof command.attemptId === 'string' && UUID.test(command.attemptId),
      );
      requireCommand(
        ['succeeded', 'failed', 'cancelled', 'timed_out'].includes(
          command.outcome,
        ),
      );
      resultMetadata(command.result, true);
      break;
    case 'finalize':
      fields(
        command,
        [...common, 'generationId', 'outcome', 'result'],
        [...common, 'generationId', 'outcome'],
      );
      generation();
      requireCommand(
        ['succeeded', 'failed', 'cancelled', 'timed_out'].includes(
          command.outcome,
        ),
      );
      resultMetadata(command.result, false);
      break;
    case 'release':
      fields(command, [...common, 'generationId'], [...common, 'generationId']);
      generation();
      break;
    case 'feedback':
      fields(
        command,
        [...common, 'generationId', 'userId', 'rating'],
        [...common, 'generationId', 'userId', 'rating'],
      );
      generation();
      requireCommand(
        typeof command.userId === 'string' &&
          UUID.test(command.userId) &&
          ['up', 'down'].includes(command.rating),
      );
      break;
    case 'configure':
      fields(command, [...common, 'limits'], [...common, 'limits']);
      fields(command.limits, Object.keys(LIMITS));
      requireCommand(
        Object.entries(command.limits).every(
          ([key, value]) =>
            Number.isInteger(value) && value > 0 && value <= LIMITS[key],
        ),
      );
      break;
    case 'fault':
      fields(command, [...common, 'mode'], [...common, 'mode']);
      requireCommand(FAULTS.includes(command.mode));
      break;
    case 'barrier':
      fields(command, [...common, 'stage'], [...common, 'stage']);
      requireCommand(STAGES.includes(command.stage));
      break;
    case 'continue':
      fields(command, [...common, 'requestId'], [...common, 'requestId']);
      requireCommand(
        Number.isSafeInteger(command.requestId) &&
          command.requestId > 0 &&
          command.requestId <= 10000,
      );
      break;
    case 'cleanup':
    case 'close':
      fields(command, common, common);
      break;
    default:
      requireCommand(false);
  }
  return command;
}
function createWorkerEnvironment(source, args) {
  try {
    if (
      args.length !== 2 ||
      !/^a11-ledger-[0-9a-f]{32}$/.test(args[0]) ||
      !['first', 'second'].includes(args[1])
    )
      throw new Error();
    const env = createE2eEnvironment(source);
    const postgres = new URL(env.E2E_DATABASE_URL);
    const redis = new URL(env.E2E_REDIS_URL);
    if (
      postgres.port !== '15432' ||
      redis.port !== '16379' ||
      postgres.username !== 'e2e' ||
      redis.username ||
      redis.password
    )
      throw new Error();
    delete env.ALLOW_INTERNAL_IPS;
    return env;
  } catch {
    throw new Error('AI_LEDGER_FIXTURE_INVALID');
  }
}
function errorMetadata(error) {
  const status =
    typeof error?.getStatus === 'function' ? error.getStatus() : null;
  if ([400, 404, 409, 429, 503, 504].includes(status))
    return { code: `HTTP_${status}`, status };
  if (typeof error?.code === 'string' && /^P\d{4}$/.test(error.code))
    return { code: 'DB_REJECTED', status: null };
  if (
    error?.name === 'DriverAdapterError' &&
    error.cause?.kind === 'postgres' &&
    error.cause.originalCode === '23514'
  )
    return { code: 'DB_CHECK_REJECTED', status: null };
  const code = [
    'AI_LEDGER_COMMAND_INVALID',
    'AI_LEDGER_ACTOR_NOT_OWNED',
    'AI_LEDGER_CONTEXT_NOT_OWNED',
    'AI_LEDGER_WORKER_LIMIT',
    'AI_LEDGER_BARRIER_TIMEOUT',
  ].includes(error?.message)
    ? error.message
    : 'AI_LEDGER_OPERATION_FAILED';
  return { code, status: null };
}

function sendWithDeadline(channel, value, timeout = 2000) {
  return new Promise((resolve, reject) => {
    if (Buffer.byteLength(JSON.stringify(value)) > MAX_COMMAND_BYTES) {
      reject(new Error('AI_LEDGER_WORKER_LIMIT'));
      return;
    }
    const timer = setTimeout(
      () => reject(new Error('AI_LEDGER_IPC_TIMEOUT')),
      timeout,
    );
    try {
      channel.send(value, (error) => {
        clearTimeout(timer);
        if (error) reject(new Error('AI_LEDGER_IPC_UNAVAILABLE'));
        else resolve();
      });
    } catch {
      clearTimeout(timer);
      reject(new Error('AI_LEDGER_IPC_UNAVAILABLE'));
    }
  });
}
async function runWorker(env) {
  const { join } = require('node:path');
  const { AsyncLocalStorage } = require('node:async_hooks');
  const requestOwner = new AsyncLocalStorage();
  // Same fixture-only environment hook as setup-env.cjs. Actual DB operations
  // and the adapter remain unchanged; the generated entrypoint cannot read .env.
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
    project: join(__dirname, '../../tsconfig.json'),
  });
  const { Logger } = require('@nestjs/common');
  Logger.overrideLogger([]);
  const { PrismaService } = require('../../src/prisma/prisma.service');
  const {
    AiExecutionLedgerService,
    AI_EXECUTION_LEASE_SCRIPTS,
  } = require('../../src/ai/ai-execution-ledger.service');
  const Redis = require('ioredis');
  const prisma = new PrismaService();
  const redis = new Redis(env.E2E_REDIS_URL, {
    lazyConnect: true,
    connectTimeout: 2000,
    maxRetriesPerRequest: 0,
    retryStrategy: () => null,
  });
  redis.on('error', () => {});
  const runId = process.argv[2];
  const contexts = new Map();
  const attempts = new Map();
  const seen = new Set();
  const pauses = new Map();
  let limits = {};
  let fault = 'none';
  let armedStage;
  let closing = false;
  let cleaning = false;
  let active = 0;
  const operations = new Set();
  let shutdownPending;
  const send = (value) => sendWithDeadline(process, value);
  const pause = async (stage, generationId) => {
    if (armedStage !== stage) return;
    armedStage = undefined;
    const requestId = requestOwner.getStore();
    let timer;
    const waiting = new Promise((resolve, reject) => {
      timer = setTimeout(() => {
        pauses.delete(requestId);
        reject(new Error('AI_LEDGER_BARRIER_TIMEOUT'));
      }, 8000);
      pauses.set(requestId, resolve);
    });
    try {
      await Promise.all([
        send({ type: 'paused', requestId, stage, generationId }),
        waiting,
      ]);
    } finally {
      clearTimeout(timer);
      pauses.delete(requestId);
    }
  };
  const actorOwned = async (userId) => {
    const actor = await prisma.user.findFirst({
      where: { id: userId, email: { startsWith: `${runId}-` } },
      select: { id: true },
    });
    if (!actor) throw new Error('AI_LEDGER_ACTOR_NOT_OWNED');
  };
  const delegate = (target, key, handler) =>
    new Proxy(target, {
      get(object, property) {
        if (property === key) return handler;
        const value = Reflect.get(object, property);
        return typeof value === 'function' ? value.bind(object) : value;
      },
    });
  // Faults wrap acknowledgements or introduce invalid fixture data into a REAL
  // transaction. No maps replace PostgreSQL and no Lua scripts are simulated.
  const store = new Proxy(prisma, {
    get(target, property) {
      if (property === 'aiGeneration')
        return delegate(target.aiGeneration, 'create', async (query) => {
          const row = await target.aiGeneration.create(query);
          await pause('after-generation-create', row.id);
          if (fault === 'generation-ack-lost') {
            fault = 'none';
            throw new Error('Fixture lost acknowledgement');
          }
          return row;
        });
      if (property === '$transaction')
        return async (operation, options) => {
          if (typeof operation !== 'function')
            return target.$transaction(operation, options);
          let reservedGeneration;
          const result = await target.$transaction(async (tx) => {
            const wrapped = new Proxy(tx, {
              get(transaction, name) {
                if (name === 'aiProviderAttempt')
                  return delegate(
                    transaction.aiProviderAttempt,
                    'create',
                    async (query) => {
                      const constraint = fault === 'attempt-constraint';
                      if (constraint) fault = 'none';
                      const result = await transaction.aiProviderAttempt.create(
                        constraint
                          ? { ...query, data: { ...query.data, ordinal: 0 } }
                          : query,
                      );
                      reservedGeneration = query.data.generationId;
                      return result;
                    },
                  );
                if (name === 'aiGeneration')
                  return delegate(
                    transaction.aiGeneration,
                    'update',
                    async (query) => {
                      const constraint = fault === 'terminal-constraint';
                      if (constraint) fault = 'none';
                      return transaction.aiGeneration.update(
                        constraint
                          ? {
                              ...query,
                              data: { ...query.data, attemptCount: 9 },
                            }
                          : query,
                      );
                    },
                  );
                return Reflect.get(transaction, name);
              },
            });
            return operation(wrapped);
          }, options);
          if (reservedGeneration)
            await pause('after-attempt-reservation', reservedGeneration);
          return result;
        };
      const value = Reflect.get(target, property);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  const leaseStore = {
    get status() {
      return redis.status;
    },
    async eval(script, ...args) {
      if (
        script === AI_EXECUTION_LEASE_SCRIPTS.release &&
        ['release-unavailable', 'acquire-ack-and-cleanup-lost'].includes(fault)
      )
        throw new Error('Fixture unavailable release');
      const value = await redis.eval(script, ...args);
      if (script === AI_EXECUTION_LEASE_SCRIPTS.acquire && value === 1)
        await pause('after-lease-acquire', args[5]);
      if (
        script === AI_EXECUTION_LEASE_SCRIPTS.acquire &&
        value === 1 &&
        ['acquire-ack-lost', 'acquire-ack-and-cleanup-lost'].includes(fault)
      ) {
        if (fault === 'acquire-ack-lost') fault = 'none';
        throw new Error('Fixture lost acknowledgement');
      }
      return value;
    },
  };
  const ledger = new AiExecutionLedgerService(
    store,
    { getClient: () => leaseStore },
    { get: (key) => limits[key] },
  );
  const cleanup = async () => {
    fault = 'none';
    armedStage = undefined;
    for (const resume of pauses.values()) resume();
    for (const context of contexts.values()) await context.fail('cancelled');
    contexts.clear();
    attempts.clear();
  };
  const dispatch = async (command) => {
    if (command.action === 'begin') {
      if (contexts.size >= 128) throw new Error('AI_LEDGER_WORKER_LIMIT');
      await actorOwned(command.userId);
      const context = await ledger.begin(
        command.userId,
        'chat',
        command.metadata,
      );
      contexts.set(context.generationId, context);
      return {
        generationId: context.generationId,
        deadlineAt: context.deadlineAt,
      };
    }
    if (command.action === 'configure') {
      if (contexts.size) throw new Error('AI_LEDGER_WORKER_LIMIT');
      limits = { ...command.limits };
      return null;
    }
    if (command.action === 'fault') {
      fault = command.mode;
      return null;
    }
    if (command.action === 'barrier') {
      if (armedStage || pauses.size) throw new Error('AI_LEDGER_WORKER_LIMIT');
      armedStage = command.stage;
      return null;
    }
    if (command.action === 'continue') {
      const resume = pauses.get(command.requestId);
      if (!resume) throw new Error('AI_LEDGER_COMMAND_INVALID');
      resume();
      return null;
    }
    if (command.action === 'cleanup') {
      await cleanup();
      return null;
    }
    if (command.action === 'close') return null;
    if (command.action === 'feedback') {
      await actorOwned(command.userId);
      const generation = await prisma.aiGeneration.findFirst({
        where: {
          id: command.generationId,
          user: { email: { startsWith: `${runId}-` } },
        },
        select: { id: true },
      });
      if (!generation) throw new Error('AI_LEDGER_CONTEXT_NOT_OWNED');
      return ledger.feedback(
        command.userId,
        command.generationId,
        command.rating,
      );
    }
    if (command.action === 'finishAttempt') {
      const attempt = attempts.get(command.attemptId);
      if (!attempt) throw new Error('AI_LEDGER_CONTEXT_NOT_OWNED');
      if (command.outcome === 'succeeded')
        await attempt.complete(command.result);
      else await attempt.fail(command.outcome, command.result);
      return null;
    }
    const context = contexts.get(command.generationId);
    if (!context) throw new Error('AI_LEDGER_CONTEXT_NOT_OWNED');
    if (command.action === 'attempt') {
      const attempt = await context.beforeAttempt(command.plan);
      attempts.set(attempt.attemptId, attempt);
      return { attemptId: attempt.attemptId };
    }
    if (command.action === 'release') {
      await context.release();
      return null;
    }
    return command.outcome === 'succeeded'
      ? context.complete(command.result)
      : context.fail(command.outcome);
  };
  const shutdown = () =>
    (shutdownPending ??= (async () => {
      closing = true;
      armedStage = undefined;
      const hardStop = setTimeout(() => process.exit(1), 10000);
      for (const resume of pauses.values()) resume();
      try {
        await Promise.allSettled([...operations]);
        await cleanup();
      } finally {
        redis.disconnect();
        try {
          await prisma.$disconnect();
          clearTimeout(hardStop);
        } finally {
          hardStop.unref();
          if (process.connected) process.disconnect();
        }
      }
    })());
  try {
    await Promise.all([prisma.$connect(), redis.connect()]);
    process.on('message', (value) => {
      let command;
      try {
        command = validateCommand(value);
        if (
          closing ||
          cleaning ||
          (command.action === 'cleanup' && active !== 0) ||
          seen.has(command.id) ||
          seen.size >= 2048 ||
          active >= 64
        )
          throw new Error('AI_LEDGER_WORKER_LIMIT');
        seen.add(command.id);
        active++;
        if (command.action === 'cleanup') cleaning = true;
        if (command.action === 'close') closing = true;
      } catch (error) {
        void send({
          type: 'result',
          id: Number.isSafeInteger(value?.id) ? value.id : 0,
          ok: false,
          error: errorMetadata(error),
        }).catch(() => {
          process.exitCode = 1;
          void shutdown().catch(() => {});
        });
        return;
      }
      const operation = requestOwner.run(command.id, async () => {
        try {
          await send({
            type: 'result',
            id: command.id,
            ok: true,
            value: await dispatch(command),
          });
        } catch (error) {
          await send({
            type: 'result',
            id: command.id,
            ok: false,
            error: errorMetadata(error),
          });
        } finally {
          active--;
          if (command.action === 'cleanup') cleaning = false;
        }
      });
      operations.add(operation);
      void operation
        .catch(() => {
          process.exitCode = 1;
        })
        .finally(() => {
          operations.delete(operation);
          if (closing || process.exitCode)
            void shutdown().catch(() => {
              process.exitCode = 1;
            });
        });
      if (closing) {
        armedStage = undefined;
        for (const resume of pauses.values()) resume();
      }
    });
    process.once('disconnect', () => {
      void shutdown().catch(() => {
        process.exitCode = 1;
      });
    });
    await send({ type: 'ready', pid: process.pid, label: process.argv[3] });
  } catch {
    await send({
      type: 'initialization-failed',
      code: 'AI_LEDGER_FIXTURE_UNAVAILABLE',
    }).catch(() => {});
    process.exitCode = 1;
    await shutdown();
  }
}

async function main() {
  let env;
  try {
    env = createWorkerEnvironment(process.env, process.argv.slice(2));
  } catch {
    process.stderr.write(
      `${JSON.stringify({ code: 'AI_LEDGER_FIXTURE_INVALID' })}\n`,
    );
    process.exitCode = 2;
    return;
  }
  process.env = env;
  if (typeof process.send !== 'function') {
    process.stderr.write(
      `${JSON.stringify({ code: 'AI_LEDGER_IPC_REQUIRED' })}\n`,
    );
    process.exitCode = 2;
    return;
  }
  const life = setTimeout(() => process.exit(1), 180000);
  life.unref();
  try {
    await runWorker(env);
  } catch {
    process.stderr.write(
      `${JSON.stringify({ code: 'AI_LEDGER_FIXTURE_UNAVAILABLE' })}\n`,
    );
    process.exitCode = 1;
    const terminate = setTimeout(() => process.exit(1), 2500);
    terminate.unref();
    await sendWithDeadline(process, {
      type: 'initialization-failed',
      code: 'AI_LEDGER_FIXTURE_UNAVAILABLE',
    }).catch(() => {});
    if (process.connected) process.disconnect();
  }
}

module.exports = {
  main,
  createWorkerEnvironment,
  validateCommand,
  errorMetadata,
  sendWithDeadline,
};
if (require.main === module) void main();
