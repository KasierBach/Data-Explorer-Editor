import { fork, type ChildProcess } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import Redis from 'ioredis';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  AI_EXECUTION_LEASE_SCRIPTS,
  type AiExecutionSummary,
} from '../src/ai/ai-execution-ledger.service';
import { AiQualityService } from '../src/ai-quality/ai-quality.service';

const runId = `a11-ledger-${randomUUID().replace(/-/g, '')}`;
const globalKey = 'ai:{ai-execution}:leases:global';
const workerPath = join(
  __dirname,
  'fixtures',
  'ai-execution-ledger-worker.cjs',
);
const fixtureRequire = createRequire(__filename);
const { createWorkerEnvironment } = fixtureRequire(
  './fixtures/ai-execution-ledger-worker.cjs',
) as {
  createWorkerEnvironment(
    source: NodeJS.ProcessEnv,
    args: string[],
  ): NodeJS.ProcessEnv;
};
type BeginResult = { generationId: string; deadlineAt: number };
type AttemptResult = { attemptId: string };
type Reply = {
  type?: string;
  id?: number;
  ok?: boolean;
  value?: unknown;
  error?: { code: string; status: number | null };
  requestId?: number;
  generationId?: string;
  stage?: string;
  pid?: number;
};

/** IPC controls fixture capabilities only; real PostgreSQL/Lua own the state. */
class LedgerFixtureWorker {
  readonly child: ChildProcess;
  private sequence = 0;
  private pending = new Map<
    number,
    { resolve(value: unknown): void; reject(error: Error): void }
  >();
  private paused = new Map<
    number,
    { resolve(value: string): void; reject(error: Error): void }
  >();
  private ready: Promise<number>;

  constructor(label: 'first' | 'second') {
    this.child = fork(workerPath, [runId, label], {
      cwd: join(__dirname, '..'),
      env: createWorkerEnvironment(process.env, [runId, label]),
      execArgv: [],
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    });
    this.ready = new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Ledger fixture did not initialize')),
        10000,
      );
      const initialized = (value: Reply) => {
        if (value.type === 'ready' && value.pid === this.child.pid) {
          clearTimeout(timer);
          this.child.off('message', initialized);
          resolve(value.pid!);
        } else if (value.type === 'initialization-failed') {
          clearTimeout(timer);
          reject(new Error('Ledger fixture stores unavailable'));
        }
      };
      this.child.on('message', initialized);
      this.child.once('error', () => {
        clearTimeout(timer);
        reject(new Error('Ledger fixture failed to launch'));
      });
      this.child.once('exit', () => {
        clearTimeout(timer);
        reject(new Error('Ledger fixture exited before ready'));
      });
    });
    this.child.on('message', (message: Reply) => {
      if (
        message.type === 'paused' &&
        typeof message.requestId === 'number' &&
        typeof message.generationId === 'string'
      ) {
        this.paused.get(message.requestId)?.resolve(message.generationId);
        return;
      }
      if (message.type !== 'result' || typeof message.id !== 'number') return;
      const owner = this.pending.get(message.id);
      if (!owner) return;
      this.pending.delete(message.id);
      if (message.ok === true) owner.resolve(message.value);
      else
        owner.reject(
          Object.assign(
            new Error('Ledger fixture operation rejected'),
            message.error,
          ),
        );
    });
    this.child.once('exit', () => {
      for (const owner of [...this.pending.values(), ...this.paused.values()])
        owner.reject(new Error('Ledger fixture exited'));
      this.pending.clear();
      this.paused.clear();
    });
  }

  start() {
    return this.ready;
  }
  alive() {
    return this.child.exitCode === null && this.child.signalCode === null;
  }
  post<T>(command: Record<string, unknown>, waitAtBarrier = false) {
    const id = ++this.sequence;
    let pauseTimer: NodeJS.Timeout | undefined;
    const paused = waitAtBarrier
      ? new Promise<string>((resolve, reject) => {
          pauseTimer = setTimeout(
            () => reject(new Error('Ledger fixture barrier expired')),
            10000,
          );
          this.paused.set(id, { resolve, reject });
        }).finally(() => {
          clearTimeout(pauseTimer);
          this.paused.delete(id);
        })
      : undefined;
    const result = new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('Ledger fixture command expired'));
      }, 12000);
      this.pending.set(id, {
        resolve(value) {
          clearTimeout(timer);
          resolve(value);
        },
        reject(error) {
          clearTimeout(timer);
          reject(error);
        },
      });
      this.child.send({ ...command, id }, (error) => {
        if (error)
          this.pending
            .get(id)
            ?.reject(new Error('Ledger fixture IPC unavailable'));
      });
    }) as Promise<T>;
    return { id, result, paused };
  }
  call<T = null>(command: Record<string, unknown>) {
    return this.post<T>(command).result;
  }
  async stop(abrupt = false) {
    if (!this.alive()) return;
    const exited = once(this.child, 'exit');
    if (abrupt) this.child.kill('SIGKILL');
    else {
      try {
        await this.call({ action: 'close' });
      } catch {
        this.child.kill('SIGKILL');
      }
    }
    const deadline = setTimeout(() => this.child.kill('SIGKILL'), 5000);
    try {
      await exited;
    } finally {
      clearTimeout(deadline);
    }
  }
}

const leaseKeys = (generationId: string, userId: string) => [
  globalKey,
  `ai:{ai-execution}:leases:user:${createHash('sha256').update(userId).digest('hex')}`,
  `ai:{ai-execution}:lease:${generationId}`,
];

/** Real fixture stores, no provider requests or production recovery claims. */
describe('A11 native ledger atomicity across independent processes', () => {
  let prisma: PrismaService;
  let redis: Redis;
  let first: LedgerFixtureWorker;
  let second: LedgerFixtureWorker;
  let initialized = false;
  const actors = new Set<string>();
  const pendingLeaseCleanup = new Map<string, { id: string; userId: string }>();
  const directLeases = new Map<string, { userId: string; token: string }>();
  const actor = async () => {
    if (actors.size >= 64)
      throw new Error('Ledger fixture actor bound exceeded');
    const id = randomUUID();
    actors.add(id);
    await prisma.user.create({
      data: {
        id,
        email: `${runId}-${id}@example.test`,
        aiEnabled: true,
        securityAlerts: false,
      },
    });
    return id;
  };
  const begin = (
    worker: LedgerFixtureWorker,
    userId: string,
    milliseconds = 20000,
  ) =>
    worker.call<BeginResult>({
      action: 'begin',
      userId,
      metadata: {
        requestedModel: 'fixture-model',
        deadlineAt: Date.now() + milliseconds,
      },
    });
  const attempt = (worker: LedgerFixtureWorker, generationId: string) =>
    worker.call<AttemptResult>({
      action: 'attempt',
      generationId,
      plan: { provider: 'fixture-planned', model: 'fixture-model' },
    });
  const finalize = (
    worker: LedgerFixtureWorker,
    generationId: string,
    outcome = 'succeeded',
  ) =>
    worker.call<AiExecutionSummary>({
      action: 'finalize',
      generationId,
      outcome,
    });
  const waitFor = async (condition: () => Promise<boolean>, timeout = 6000) => {
    const until = Date.now() + timeout;
    while (!(await condition())) {
      if (Date.now() >= until)
        throw new Error('Ledger fixture condition expired');
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  };
  const cleanup = async () => {
    const errors: unknown[] = [];
    const phase = async (operation: () => Promise<unknown>) => {
      try {
        await operation();
      } catch (error) {
        errors.push(error);
      }
    };
    for (const worker of [first, second])
      if (worker?.alive()) {
        await phase(async () => {
          try {
            await worker.call({ action: 'cleanup' });
          } catch (error) {
            await worker.stop(true);
            throw error;
          }
        });
      }
    if (redis?.status === 'ready') {
      for (const [generationId, lease] of directLeases) {
        await phase(async () => {
          const keys = leaseKeys(generationId, lease.userId);
          await redis.eval(
            AI_EXECUTION_LEASE_SCRIPTS.release,
            3,
            ...keys,
            lease.token,
            generationId,
          );
          await redis.zrem(keys[0], generationId);
          await redis.zrem(keys[1], generationId);
          directLeases.delete(generationId);
        });
      }
    } else if (directLeases.size)
      errors.push(new Error('Ledger fixture Redis cleanup unavailable'));
    const ids = [...actors];
    let generations: Array<{ id: string; userId: string }> = [];
    if (prisma && ids.length) {
      await phase(async () => {
        generations = await prisma.aiGeneration.findMany({
          where: {
            userId: { in: ids },
            user: { email: { startsWith: `${runId}-` } },
          },
          select: { id: true, userId: true },
          take: 257,
        });
        if (generations.length > 256)
          throw new Error('Ledger fixture generation bound exceeded');
        for (const generation of generations) {
          if (
            pendingLeaseCleanup.size >= 256 &&
            !pendingLeaseCleanup.has(generation.id)
          )
            throw new Error('Ledger fixture cleanup bound exceeded');
          pendingLeaseCleanup.set(generation.id, generation);
        }
      });
      if (generations.length <= 256 && redis?.status === 'ready') {
        for (const generation of pendingLeaseCleanup.values())
          await phase(async () => {
            const keys = leaseKeys(generation.id, generation.userId);
            const token = await redis.get(keys[2]);
            if (token)
              await redis.eval(
                AI_EXECUTION_LEASE_SCRIPTS.release,
                3,
                ...keys,
                token,
                generation.id,
              );
            await redis.zrem(keys[0], generation.id);
            await redis.zrem(keys[1], generation.id);
            pendingLeaseCleanup.delete(generation.id);
          });
      } else if (generations.length || pendingLeaseCleanup.size)
        errors.push(new Error('Ledger fixture Redis cleanup unavailable'));
      if (generations.length <= 256) {
        const generationIds = generations.map((generation) => generation.id);
        const owned = {
          id: { in: generationIds },
          userId: { in: ids },
          user: { email: { startsWith: `${runId}-` } },
        };
        await phase(() =>
          prisma.aiGenerationFeedback.deleteMany({
            where: { generationId: { in: generationIds }, userId: { in: ids } },
          }),
        );
        await phase(() =>
          prisma.aiProviderAttempt.deleteMany({
            where: { generationId: { in: generationIds }, generation: owned },
          }),
        );
        await phase(() => prisma.aiGeneration.deleteMany({ where: owned }));
        await phase(async () => {
          await prisma.user.deleteMany({
            where: { id: { in: ids }, email: { startsWith: `${runId}-` } },
          });
          if (!errors.length) actors.clear();
        });
      }
    }
    if (errors.length)
      throw new AggregateError(errors, 'Ledger fixture cleanup failed');
  };
  const assertLease = async (
    generationId: string,
    userId: string,
    maximum = 90000,
  ) => {
    const keys = leaseKeys(generationId, userId);
    const [token, ttl, globalExpiry, userExpiry] = await Promise.all([
      redis.get(keys[2]),
      redis.pttl(keys[2]),
      redis.zscore(keys[0], generationId),
      redis.zscore(keys[1], generationId),
    ]);
    expect(token).toMatch(/^[0-9a-f-]{36}$/);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(maximum);
    expect(globalExpiry).not.toBeNull();
    expect(userExpiry).toBe(globalExpiry);
    expect(Number(globalExpiry)).toBeGreaterThan(Date.now());
  };

  beforeAll(async () => {
    const env = createWorkerEnvironment(process.env, [runId, 'first']);
    expect(process.env.DATABASE_URL).toBe(env.E2E_DATABASE_URL);
    redis = new Redis(env.E2E_REDIS_URL!, {
      lazyConnect: true,
      connectTimeout: 2000,
      maxRetriesPerRequest: 0,
      retryStrategy: () => null,
    });
    redis.on('error', () => {});
    prisma = new PrismaService();
    await Promise.all([prisma.$connect(), redis.connect()]);
    const db = await prisma.$queryRaw<
      Array<{ database: string }>
    >`SELECT current_database()::text AS database`;
    expect(db).toEqual([{ database: 'data_explorer_e2e' }]);
    expect(await redis.zcard(globalKey)).toBe(0);
    const [cursor, keys] = await redis.scan(
      '0',
      'MATCH',
      'ai:{ai-execution}:lease:*',
      'COUNT',
      1000,
    );
    expect(cursor).toBe('0');
    expect(keys).toEqual([]);
    first = new LedgerFixtureWorker('first');
    second = new LedgerFixtureWorker('second');
    const pids = await Promise.all([first.start(), second.start()]);
    expect(new Set([...pids, process.pid]).size).toBe(3);
    initialized = true;
  }, 20000);
  beforeEach(async () => {
    if (!initialized) throw new Error('Ledger fixture initialization failed');
    expect(await redis.zcard(globalKey)).toBe(0);
    await Promise.all(
      [first, second].map((worker) =>
        worker.call({ action: 'configure', limits: {} }),
      ),
    );
  });
  afterEach(async () => {
    await cleanup();
    if (redis?.status === 'ready') expect(await redis.zcard(globalKey)).toBe(0);
  });
  afterAll(async () => {
    const stopped = await Promise.allSettled([first?.stop(), second?.stop()]);
    const errors: unknown[] = stopped.flatMap((result) =>
      result.status === 'rejected' ? [result.reason] : [],
    );
    try {
      await cleanup();
    } catch (error) {
      errors.push(error);
    } finally {
      redis?.disconnect();
      try {
        await prisma?.$disconnect();
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length)
      throw new AggregateError(errors, 'Ledger fixture teardown failed');
  });

  it('admits exactly two per actor through real Lua under cross-process races', async () => {
    const userId = await actor();
    for (let round = 0; round < 3; round++) {
      const outcomes = await Promise.allSettled(
        Array.from({ length: 6 }, (_, index) =>
          begin(index % 2 ? first : second, userId),
        ),
      );
      expect(
        outcomes.filter((result) => result.status === 'fulfilled'),
      ).toHaveLength(2);
      const refused = outcomes.filter((result) => result.status === 'rejected');
      expect(refused).toHaveLength(4);
      for (const result of refused)
        expect(result.reason).toMatchObject({ code: 'HTTP_429', status: 429 });
      expect(await redis.zcard(globalKey)).toBe(2);
      expect(await redis.zcard(leaseKeys('', userId)[1])).toBe(2);
      for (const result of outcomes)
        if (result.status === 'fulfilled') {
          await assertLease(result.value.generationId, userId);
          expect(
            await prisma.aiGeneration.findUnique({
              where: { id: result.value.generationId },
              select: { userId: true, outcome: true },
            }),
          ).toEqual({ userId, outcome: 'running' });
        }
      await Promise.all(
        [first, second].map((worker) => worker.call({ action: 'cleanup' })),
      );
    }
    expect(
      await prisma.aiGeneration.count({
        where: { userId, outcome: 'rejected' },
      }),
    ).toBe(12);
    expect(
      await prisma.aiProviderAttempt.count({
        where: { generation: { userId } },
      }),
    ).toBe(0);
  });

  it('enforces the default global 32 cap across independent users and processes', async () => {
    const users = await Promise.all(Array.from({ length: 40 }, () => actor()));
    const outcomes = await Promise.allSettled(
      users.map((userId, index) => begin(index % 2 ? first : second, userId)),
    );
    expect(
      outcomes.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(32);
    expect(
      outcomes.filter((result) => result.status === 'rejected'),
    ).toHaveLength(8);
    expect(await redis.zcard(globalKey)).toBe(32);
    expect(
      await prisma.aiGeneration.count({
        where: { userId: { in: users }, outcome: 'rejected' },
      }),
    ).toBe(8);
    for (const [index, result] of outcomes.entries()) {
      expect(await redis.zcard(leaseKeys('', users[index])[1])).toBe(
        result.status === 'fulfilled' ? 1 : 0,
      );
      if (result.status === 'rejected')
        expect(result.reason).toMatchObject({ code: 'HTTP_429', status: 429 });
      else {
        await assertLease(result.value.generationId, users[index]);
        expect(
          await prisma.aiGeneration.findUnique({
            where: { id: result.value.generationId },
            select: { userId: true, outcome: true },
          }),
        ).toEqual({ userId: users[index], outcome: 'running' });
      }
    }
  }, 15000);

  it('does not let stale tokens check or release a replacement lease', async () => {
    const userId = await actor();
    const generationId = randomUUID();
    const keys = leaseKeys(generationId, userId);
    const oldToken = randomUUID();
    const newToken = randomUUID();
    directLeases.set(generationId, { userId, token: oldToken });
    expect(
      await redis.eval(
        AI_EXECUTION_LEASE_SCRIPTS.acquire,
        3,
        ...keys,
        oldToken,
        generationId,
        500,
        2,
        32,
      ),
    ).toBe(1);
    expect(
      await redis.eval(
        AI_EXECUTION_LEASE_SCRIPTS.check,
        3,
        ...keys,
        newToken,
        generationId,
      ),
    ).toBe(0);
    expect(
      await redis.eval(
        AI_EXECUTION_LEASE_SCRIPTS.release,
        3,
        ...keys,
        newToken,
        generationId,
      ),
    ).toBe(0);
    expect(await redis.get(keys[2])).toBe(oldToken);
    await waitFor(async () => (await redis.exists(keys[2])) === 0);
    expect(
      await redis.eval(
        AI_EXECUTION_LEASE_SCRIPTS.acquire,
        3,
        ...keys,
        newToken,
        generationId,
        2000,
        2,
        32,
      ),
    ).toBe(1);
    directLeases.set(generationId, { userId, token: newToken });
    expect(
      await redis.eval(
        AI_EXECUTION_LEASE_SCRIPTS.release,
        3,
        ...keys,
        oldToken,
        generationId,
      ),
    ).toBe(0);
    expect(await redis.get(keys[2])).toBe(newToken);
    expect(await redis.zcard(globalKey)).toBe(1);
  });

  it('rolls back an increment and attempt insert when a real DB constraint fails', async () => {
    const userId = await actor();
    const generation = await begin(first, userId);
    await first.call({ action: 'fault', mode: 'attempt-constraint' });
    await expect(attempt(first, generation.generationId)).rejects.toMatchObject(
      { code: 'DB_CHECK_REJECTED' },
    );
    expect(
      await prisma.aiGeneration.findUnique({
        where: { id: generation.generationId },
        select: { attemptCount: true, outcome: true },
      }),
    ).toEqual({ attemptCount: 0, outcome: 'running' });
    expect(
      await prisma.aiProviderAttempt.count({
        where: { generationId: generation.generationId },
      }),
    ).toBe(0);
    const next = await attempt(first, generation.generationId);
    expect(
      await prisma.aiProviderAttempt.findUnique({
        where: { id: next.attemptId },
        select: { ordinal: true },
      }),
    ).toEqual({ ordinal: 1 });
  });

  it('keeps eight unique attempt ordinals and refuses a ninth without dispatch', async () => {
    const generation = await begin(first, await actor());
    const attempts = await Promise.all(
      Array.from({ length: 8 }, () => attempt(first, generation.generationId)),
    );
    expect(new Set(attempts.map((result) => result.attemptId)).size).toBe(8);
    await expect(attempt(first, generation.generationId)).rejects.toMatchObject(
      { code: 'HTTP_409' },
    );
    expect(
      (
        await prisma.aiProviderAttempt.findMany({
          where: { generationId: generation.generationId },
          orderBy: { ordinal: 'asc' },
          select: { ordinal: true },
        })
      ).map((row) => row.ordinal),
    ).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    const summary = await finalize(first, generation.generationId);
    expect(summary).toMatchObject({
      attemptCount: 8,
      measuredAttemptCount: 0,
      usage: null,
      usageCoverage: 'unavailable',
    });
    expect(
      await prisma.aiProviderAttempt.count({
        where: { generationId: generation.generationId, outcome: 'running' },
      }),
    ).toBe(0);
  });

  it('does not return a dispatch handle after a committed reservation loses its lease', async () => {
    const userId = await actor();
    const generation = await begin(first, userId);
    await first.call({ action: 'barrier', stage: 'after-attempt-reservation' });
    const operation = first.post<AttemptResult>(
      {
        action: 'attempt',
        generationId: generation.generationId,
        plan: { provider: 'fixture', model: 'fixture' },
      },
      true,
    );
    const checked = operation.result.catch((error) => error);
    expect(await operation.paused).toBe(generation.generationId);
    expect(
      await prisma.aiProviderAttempt.count({
        where: { generationId: generation.generationId },
      }),
    ).toBe(1);
    const keys = leaseKeys(generation.generationId, userId);
    const token = await redis.get(keys[2]);
    expect(token).toBeTruthy();
    await redis.eval(
      AI_EXECUTION_LEASE_SCRIPTS.release,
      3,
      ...keys,
      token!,
      generation.generationId,
    );
    await first.call({ action: 'continue', requestId: operation.id });
    expect(await checked).toMatchObject({ code: 'HTTP_503' });
    expect(
      await finalize(first, generation.generationId, 'failed'),
    ).toMatchObject({ attemptCount: 1, measuredAttemptCount: 0, usage: null });
  });

  it('persists BigInt observed subtotals and first-terminal outcome without deriving missing totals', async () => {
    const userId = await actor();
    const generation = await begin(first, userId);
    const max = 2147483647;
    for (const usage of [
      { promptTokens: max, completionTokens: 0, totalTokens: max },
      { promptTokens: max, completionTokens: 2, totalTokens: null },
      null,
    ]) {
      const current = await attempt(first, generation.generationId);
      await first.call({
        action: 'finishAttempt',
        attemptId: current.attemptId,
        outcome: 'succeeded',
        result: { provider: 'fixture-actual', model: 'actual-model', usage },
      });
      await first.call({
        action: 'finishAttempt',
        attemptId: current.attemptId,
        outcome: 'failed',
        result: {
          usage: { promptTokens: 99, completionTokens: 99, totalTokens: 198 },
        },
      });
    }
    const summary = await finalize(first, generation.generationId);
    expect(summary).toMatchObject({
      outcome: 'succeeded',
      provider: 'fixture-actual',
      model: 'actual-model',
      attemptCount: 3,
      measuredAttemptCount: 2,
      usageCoverage: 'partial',
      costCoverage: 'unavailable',
      usage: {
        promptTokens: 4294967294,
        completionTokens: 2,
        totalTokens: max,
      },
    });
    expect(await finalize(first, generation.generationId, 'cancelled')).toEqual(
      summary,
    );
    const row = await prisma.aiGeneration.findUniqueOrThrow({
      where: { id: generation.generationId },
    });
    expect(row.promptTokens).toBe(4294967294n);
    expect(row.totalTokens).toBe(BigInt(max));
    const other = await new AiQualityService(prisma).getUserUsage(userId, 1);
    expect(other).toMatchObject({
      generations: 1,
      tokens: {
        promptTokens: 4294967294,
        completionTokens: 2,
        totalTokens: max,
        attempts: 3,
        measuredAttempts: 2,
        unmeasuredAttempts: 1,
        usageCoverage: 'partial',
        observedOnly: true,
        costCoverage: 'unavailable',
      },
    });
  });

  it.each(['zero', 'unavailable'] as const)(
    'preserves measured %s accounting on real storage',
    async (kind) => {
      const userId = await actor();
      const generation = await begin(second, userId);
      const current = await attempt(second, generation.generationId);
      await second.call({
        action: 'finishAttempt',
        attemptId: current.attemptId,
        outcome: 'succeeded',
        result: {
          usage:
            kind === 'zero'
              ? { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
              : null,
        },
      });
      const summary = await finalize(second, generation.generationId);
      expect(summary.usage).toEqual(
        kind === 'zero'
          ? { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
          : null,
      );
      expect(summary.usageCoverage).toBe(
        kind === 'zero' ? 'complete' : 'unavailable',
      );
      expect(summary.measuredAttemptCount).toBe(kind === 'zero' ? 1 : 0);
    },
  );

  it('rolls back a terminal transaction and later finalizes once after releasing capacity', async () => {
    const generation = await begin(first, await actor());
    await attempt(first, generation.generationId);
    await first.call({ action: 'fault', mode: 'terminal-constraint' });
    await expect(
      finalize(first, generation.generationId),
    ).rejects.toMatchObject({ code: 'DB_CHECK_REJECTED' });
    expect(
      await prisma.aiGeneration.findUnique({
        where: { id: generation.generationId },
        select: { outcome: true, attemptCount: true },
      }),
    ).toEqual({ outcome: 'running', attemptCount: 1 });
    expect(
      await prisma.aiProviderAttempt.count({
        where: { generationId: generation.generationId, outcome: 'running' },
      }),
    ).toBe(1);
    expect(await redis.zcard(globalKey)).toBe(0);
    const summary = await finalize(first, generation.generationId, 'failed');
    expect(summary).toMatchObject({
      outcome: 'failed',
      attemptCount: 1,
      usage: null,
    });
    expect(await finalize(first, generation.generationId)).toEqual(summary);
  });

  it('keeps a committed terminal row when Redis release fails and retries only cleanup', async () => {
    const generation = await begin(first, await actor());
    const current = await attempt(first, generation.generationId);
    await first.call({
      action: 'finishAttempt',
      attemptId: current.attemptId,
      outcome: 'succeeded',
      result: { usage: { totalTokens: 4 } },
    });
    await first.call({ action: 'fault', mode: 'release-unavailable' });
    await expect(
      finalize(first, generation.generationId),
    ).rejects.toMatchObject({ code: 'HTTP_503' });
    expect(
      await prisma.aiGeneration.findUnique({
        where: { id: generation.generationId },
        select: { outcome: true, totalTokens: true },
      }),
    ).toEqual({ outcome: 'succeeded', totalTokens: 4n });
    expect(await redis.zcard(globalKey)).toBe(1);
    await first.call({ action: 'fault', mode: 'none' });
    expect(
      await finalize(first, generation.generationId, 'failed'),
    ).toMatchObject({ outcome: 'succeeded', usage: { totalTokens: 4 } });
    expect(await redis.zcard(globalKey)).toBe(0);
  });

  it.each(['acquire-ack-lost', 'acquire-ack-and-cleanup-lost'])(
    'contains %s without unreserved dispatch',
    async (mode) => {
      const userId = await actor();
      await first.call({ action: 'fault', mode });
      await first.call({ action: 'barrier', stage: 'after-lease-acquire' });
      const operation = first.post<BeginResult>(
        {
          action: 'begin',
          userId,
          metadata: {
            requestedModel: 'fixture',
            deadlineAt: Date.now() + 3000,
          },
        },
        true,
      );
      const rejected = operation.result.catch((error) => error);
      const acquiredId = await operation.paused;
      await assertLease(acquiredId!, userId, 3000);
      await first.call({ action: 'continue', requestId: operation.id });
      expect(await rejected).toMatchObject({ code: 'HTTP_503' });
      const row = await prisma.aiGeneration.findFirstOrThrow({
        where: { userId },
      });
      expect(row.outcome).toBe('rejected');
      expect(row.attemptCount).toBe(0);
      if (mode === 'acquire-ack-lost')
        expect(await redis.zcard(globalKey)).toBe(0);
      else {
        await assertLease(row.id, userId, 3000);
        await waitFor(
          async () => (await redis.exists(leaseKeys(row.id, userId)[2])) === 0,
        );
      }
      await first.call({ action: 'fault', mode: 'none' });
      const next = await begin(second, userId);
      expect(await redis.zcard(globalKey)).toBe(1);
      await finalize(second, next.generationId);
    },
  );

  it('characterizes a committed generation with a lost acknowledgement as an orphan, not success', async () => {
    const userId = await actor();
    await first.call({ action: 'fault', mode: 'generation-ack-lost' });
    await expect(begin(first, userId)).rejects.toMatchObject({
      code: 'AI_LEDGER_OPERATION_FAILED',
    });
    const row = await prisma.aiGeneration.findFirstOrThrow({
      where: { userId },
    });
    expect(row).toMatchObject({
      outcome: 'running',
      attemptCount: 0,
      usageCoverage: 'unavailable',
    });
    expect(await redis.zcard(globalKey)).toBe(0);
    expect(
      await new AiQualityService(prisma).getUserUsage(userId, 1),
    ).toMatchObject({ generations: 0 });
  });

  it('recovers lease capacity after a process dies but does not pretend to resume its orphan', async () => {
    const userId = await actor();
    const generation = await begin(first, userId, 1600);
    await attempt(first, generation.generationId);
    await first.stop(true);
    await waitFor(
      async () =>
        (await redis.exists(leaseKeys(generation.generationId, userId)[2])) ===
        0,
    );
    const replacement = await begin(second, userId);
    expect(await redis.zcard(globalKey)).toBe(1);
    const orphan = await prisma.aiGeneration.findUniqueOrThrow({
      where: { id: generation.generationId },
    });
    expect(orphan).toMatchObject({
      outcome: 'running',
      attemptCount: 1,
      usageCoverage: 'unavailable',
    });
    expect(
      await prisma.aiProviderAttempt.count({
        where: { generationId: orphan.id, outcome: 'running' },
      }),
    ).toBe(1);
    first = new LedgerFixtureWorker('first');
    await first.start();
    await expect(
      first.call({ action: 'release', generationId: orphan.id }),
    ).rejects.toMatchObject({ code: 'AI_LEDGER_CONTEXT_NOT_OWNED' });
    await finalize(second, replacement.generationId);
  }, 15000);

  it('rejects cleanup while an admission is paused instead of losing its lease owner', async () => {
    const userId = await actor();
    await first.call({ action: 'barrier', stage: 'after-lease-acquire' });
    const operation = first.post<BeginResult>(
      { action: 'begin', userId, metadata: { deadlineAt: Date.now() + 20000 } },
      true,
    );
    const checked = operation.result.catch((error) => error);
    const generationId = await operation.paused;
    await expect(first.call({ action: 'cleanup' })).rejects.toMatchObject({
      code: 'AI_LEDGER_WORKER_LIMIT',
    });
    await assertLease(generationId!, userId);
    await first.call({ action: 'continue', requestId: operation.id });
    expect(await checked).toHaveProperty('generationId', generationId);
    await first.call({ action: 'cleanup' });
    expect(await redis.zcard(globalKey)).toBe(0);
    expect(
      await prisma.aiGeneration.findUnique({
        where: { id: generationId },
        select: { outcome: true },
      }),
    ).toEqual({ outcome: 'cancelled' });
  });

  it('retains scoped lease IDs when Redis cleanup fails after database disposal', async () => {
    const userId = await actor();
    const generation = await begin(first, userId);
    await first.call({
      action: 'release',
      generationId: generation.generationId,
    });
    const keys = leaseKeys(generation.generationId, userId);
    const expired = Date.now() - 1;
    await redis.zadd(keys[0], expired, generation.generationId);
    await redis.zadd(keys[1], expired, generation.generationId);
    const failed = jest
      .spyOn(redis, 'get')
      .mockRejectedValueOnce(new Error('Fixture cleanup read failed'));
    try {
      await expect(cleanup()).rejects.toThrow('Ledger fixture cleanup failed');
    } finally {
      failed.mockRestore();
    }
    expect(
      await prisma.aiGeneration.count({
        where: { id: generation.generationId },
      }),
    ).toBe(0);
    expect(pendingLeaseCleanup.has(generation.generationId)).toBe(true);
    expect(await redis.zscore(keys[0], generation.generationId)).toBe(
      String(expired),
    );
    expect(await redis.zscore(keys[1], generation.generationId)).toBe(
      String(expired),
    );
    await cleanup();
    expect(pendingLeaseCleanup.size).toBe(0);
    expect(await redis.zscore(keys[0], generation.generationId)).toBeNull();
    expect(await redis.zscore(keys[1], generation.generationId)).toBeNull();
  });

  it('drains a paused generation before graceful worker close and releases its lease', async () => {
    const userId = await actor();
    await first.call({ action: 'barrier', stage: 'after-generation-create' });
    const operation = first.post<BeginResult>(
      { action: 'begin', userId, metadata: { deadlineAt: Date.now() + 20000 } },
      true,
    );
    const checked = operation.result.catch((error) => error);
    const generationId = await operation.paused;
    await first.stop();
    expect(await checked).toHaveProperty('generationId', generationId);
    expect(
      await prisma.aiGeneration.findUnique({
        where: { id: generationId },
        select: { outcome: true, attemptCount: true },
      }),
    ).toEqual({ outcome: 'cancelled', attemptCount: 0 });
    expect(await redis.zcard(globalKey)).toBe(0);
    first = new LedgerFixtureWorker('first');
    await first.start();
  }, 15000);

  it('honors lower configured admission and attempt caps without changing global defaults', async () => {
    await Promise.all(
      [first, second].map((worker) =>
        worker.call({
          action: 'configure',
          limits: {
            AI_EXECUTION_GLOBAL_CONCURRENCY: 1,
            AI_EXECUTION_PER_USER_CONCURRENCY: 1,
            AI_EXECUTION_MAX_ATTEMPTS: 2,
          },
        }),
      ),
    );
    const generation = await begin(first, await actor());
    await expect(begin(second, await actor())).rejects.toMatchObject({
      code: 'HTTP_429',
    });
    await attempt(first, generation.generationId);
    await attempt(first, generation.generationId);
    await expect(attempt(first, generation.generationId)).rejects.toMatchObject(
      { code: 'HTTP_409' },
    );
    expect(await finalize(first, generation.generationId)).toMatchObject({
      attemptCount: 2,
    });
  });

  it('keeps feedback actor-bound under real concurrent upserts and RESTRICT constraints', async () => {
    const userId = await actor();
    const outsider = await actor();
    const generation = await begin(first, userId);
    await finalize(first, generation.generationId);
    await expect(
      second.call({
        action: 'feedback',
        generationId: generation.generationId,
        userId: outsider,
        rating: 'up',
      }),
    ).rejects.toMatchObject({ code: 'HTTP_404' });
    await expect(
      prisma.aiGenerationFeedback.create({
        data: {
          generationId: generation.generationId,
          userId: outsider,
          rating: 'up',
        },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
    await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        (index % 2 ? first : second).call({
          action: 'feedback',
          generationId: generation.generationId,
          userId,
          rating: index % 2 ? 'up' : 'down',
        }),
      ),
    );
    await second.call({
      action: 'feedback',
      generationId: generation.generationId,
      userId,
      rating: 'up',
    });
    expect(
      await prisma.aiGenerationFeedback.findMany({
        where: { generationId: generation.generationId },
        select: { userId: true, rating: true },
      }),
    ).toEqual([{ userId, rating: 'up' }]);
    await expect(
      prisma.user.delete({ where: { id: userId } }),
    ).rejects.toMatchObject({ code: 'P2003' });
    expect(await prisma.user.count({ where: { id: userId } })).toBe(1);
    expect(
      await new AiQualityService(prisma).getUserUsage(outsider, 1),
    ).toMatchObject({
      generations: 0,
      tokens: { promptTokens: null, completionTokens: null, totalTokens: null },
    });
  });
});
