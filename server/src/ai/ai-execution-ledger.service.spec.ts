import { HttpException } from '@nestjs/common';
import {
  AI_EXECUTION_LEASE_SCRIPTS,
  AiExecutionLedgerService,
} from './ai-execution-ledger.service';

const NOW = new Date('2026-11-09T00:00:00.000Z').getTime();

/** Semantic mocks, NOT an execution of Lua or proof of distributed Redis/DB. */
function harness(settings: Record<string, unknown> = {}) {
  let generations = new Map<string, any>();
  let attempts = new Map<string, any>();
  let votes = new Map<string, any>();
  const matches = (row: any, where: any) =>
    Object.entries(where).every(([key, value]: [string, any]) => {
      if (key === 'attemptCount') return row[key] < value.lt;
      if (key === 'deadlineAt') return row[key] > value.gt;
      return row[key] === value;
    });
  const updateMany = (
    rows: Map<string, any>,
    { where, data }: { where: any; data: Record<string, any> },
  ) => {
    let count = 0;
    for (const row of rows.values()) {
      if (!matches(row, where)) continue;
      for (const [key, value] of Object.entries(data)) {
        if (value === undefined) continue; // Prisma's default undefined semantics.
        row[key] =
          value && typeof value === 'object' && 'increment' in value
            ? row[key] + value.increment
            : value;
      }
      count++;
    }
    return { count };
  };
  const prisma = {
    aiGeneration: {
      create: jest.fn(async ({ data }: any) => {
        const row = {
          outcome: 'running',
          attemptCount: 0,
          measuredAttemptCount: 0,
          provider: null,
          model: null,
          promptTokens: null,
          completionTokens: null,
          totalTokens: null,
          usageCoverage: 'unavailable',
          ...data,
        };
        generations.set(data.id, row);
        return row;
      }),
      updateMany: jest.fn(async (query: any) => updateMany(generations, query)),
      update: jest.fn(async ({ where, data }: any) => {
        const row = generations.get(where.id);
        Object.assign(row, data);
        return row;
      }),
      findUniqueOrThrow: jest.fn(async ({ where }: any) => {
        const row = generations.get(where.id);
        if (!row) throw new Error('not found');
        return { ...row };
      }),
      findFirst: jest.fn(
        async ({ where }: any) =>
          [...generations.values()].find((row) => matches(row, where)) ?? null,
      ),
    },
    aiProviderAttempt: {
      create: jest.fn(async ({ data }: any) => {
        const row = {
          outcome: 'running',
          provider: null,
          model: null,
          promptTokens: null,
          completionTokens: null,
          totalTokens: null,
          usageCoverage: 'unavailable',
          ...data,
        };
        attempts.set(row.id, row);
        return row;
      }),
      updateMany: jest.fn(async (query: any) => updateMany(attempts, query)),
      findMany: jest.fn(async ({ where }: any) =>
        [...attempts.values()]
          .filter((row) => matches(row, where))
          .sort((a, b) => a.ordinal - b.ordinal),
      ),
    },
    aiGenerationFeedback: {
      upsert: jest.fn(async ({ where, create, update }: any) => {
        const { generationId, userId } = where.generationId_userId;
        const key = `${generationId}/${userId}`;
        const current = votes.get(key);
        const row = current
          ? { ...current, ...update }
          : { id: key, ...create };
        votes.set(key, row);
        return row;
      }),
    },
    $transaction: jest.fn(),
  };
  let transactionTail: Promise<unknown> = Promise.resolve();
  prisma.$transaction.mockImplementation((operation: any) => {
    const result = transactionTail.then(async () => {
      const snapshot = structuredClone({ generations, attempts, votes });
      try {
        return await operation(prisma);
      } catch (error) {
        generations = snapshot.generations;
        attempts = snapshot.attempts;
        votes = snapshot.votes;
        throw error;
      }
    });
    transactionTail = result.catch(() => undefined);
    return result;
  });

  const memberships = new Map<string, Map<string, number>>();
  const leases = new Map<string, { token: string; expiresAt: number }>();
  const client = {
    status: 'ready',
    eval: jest.fn(
      async (
        script: string,
        keyCount: number,
        globalKey: string,
        userKey: string,
        leaseKey: string,
        token: string,
        generationId: string,
        ttl?: number,
        userLimit?: number,
        globalLimit?: number,
      ) => {
        expect(keyCount).toBe(3);
        const now = Date.now();
        const global = memberships.get(globalKey) ?? new Map<string, number>();
        const user = memberships.get(userKey) ?? new Map<string, number>();
        memberships.set(globalKey, global);
        memberships.set(userKey, user);
        const existing = leases.get(leaseKey);
        if (existing && existing.expiresAt <= now) leases.delete(leaseKey);
        if (script === AI_EXECUTION_LEASE_SCRIPTS.acquire) {
          for (const set of [global, user]) {
            for (const [id, expiry] of set) if (expiry <= now) set.delete(id);
          }
          if (user.size >= userLimit!) return 0;
          if (global.size >= globalLimit!) return -1;
          if (leases.has(leaseKey)) return -2;
          leases.set(leaseKey, { token, expiresAt: now + ttl! });
          global.set(generationId, now + ttl!);
          user.set(generationId, now + ttl!);
          return 1;
        }
        if (leases.get(leaseKey)?.token !== token) return 0;
        if (script === AI_EXECUTION_LEASE_SCRIPTS.check) {
          return (global.get(generationId) ?? 0) > now &&
            (user.get(generationId) ?? 0) > now
            ? 1
            : 0;
        }
        if (script === AI_EXECUTION_LEASE_SCRIPTS.release) {
          leases.delete(leaseKey);
          global.delete(generationId);
          user.delete(generationId);
          return 1;
        }
        throw new Error('unrecognized script');
      },
    ),
  };
  const redis = { getClient: jest.fn(() => client) };
  const config = { get: jest.fn((key: string) => settings[key]) };
  const service = new AiExecutionLedgerService(
    prisma as never,
    redis as never,
    config as never,
  );
  return {
    service,
    prisma,
    client,
    redis,
    config,
    memberships,
    leases,
    generations: () => [...generations.values()],
    attempts: () => [...attempts.values()],
    votes: () => [...votes.values()],
    sibling: () =>
      new AiExecutionLedgerService(
        prisma as never,
        redis as never,
        config as never,
      ),
  };
}

async function status(promise: Promise<unknown>) {
  try {
    await promise;
    throw new Error('expected rejection');
  } catch (error) {
    return (error as HttpException).getStatus();
  }
}

describe('AiExecutionLedgerService (local semantic mocks only)', () => {
  beforeEach(() => jest.useFakeTimers({ now: NOW }));
  afterEach(() => jest.useRealTimers());

  it('creates an actor-owned server UUID and persists allowlisted metadata only', async () => {
    const h = harness();
    const ctx = await h.service.begin('actor-1', 'generate_sql', {
      connectionId: 'connection-1',
      database: 'test db',
      requestedModel: 'vendor/model',
      prompt: 'SECRET',
      sql: 'SECRET',
      body: 'SECRET',
      apiKey: 'SECRET',
    } as never);
    expect(ctx.generationId).toMatch(
      /^[0-9a-f-]{14}4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(h.prisma.aiGeneration.create).toHaveBeenCalledWith({
      data: {
        id: ctx.generationId,
        userId: 'actor-1',
        task: 'generate_sql',
        connectionId: 'connection-1',
        database: 'test db',
        requestedModel: 'vendor/model',
        deadlineAt: new Date(NOW + 90_000),
      },
    });
    expect(JSON.stringify(h.generations())).not.toContain('SECRET');
    expect(ctx.deadlineAt).toBe(NOW + 90_000);
  });

  it.each(['provider_discovery', 'provider_test'] as const)(
    'persists the dedicated %s task without changing operational defaults',
    async (task) => {
      const h = harness();
      const ctx = await h.service.begin('actor', task);
      expect(h.generations()[0].task).toBe(task);
      expect(ctx.deadlineAt).toBe(NOW + 90_000);
      expect(h.client.eval.mock.calls[0].slice(7)).toEqual([90_000, 2, 32]);
      await ctx.release();
    },
  );

  it('uses one atomic EVAL with two memberships and token-checked SET PX NX', async () => {
    const h = harness();
    const ctx = await h.service.begin('actor-1', 'chat');
    const call = h.client.eval.mock.calls[0];
    expect(call.slice(0, 2)).toEqual([AI_EXECUTION_LEASE_SCRIPTS.acquire, 3]);
    expect(
      call
        .slice(2, 5)
        .every(
          (key) => typeof key === 'string' && key.includes('{ai-execution}'),
        ),
    ).toBe(true);
    expect(call[6]).toBe(ctx.generationId);
    expect(call.slice(7)).toEqual([90_000, 2, 32]);
    expect(AI_EXECUTION_LEASE_SCRIPTS.acquire).toContain("redis.call('TIME')");
    expect(AI_EXECUTION_LEASE_SCRIPTS.acquire).toContain(
      "redis.call('SET', KEYS[3], ARGV[1], 'PX', ttl, 'NX')",
    );
    expect(
      AI_EXECUTION_LEASE_SCRIPTS.acquire.match(/redis.call\('ZCARD'/g),
    ).toHaveLength(2);
    expect(
      AI_EXECUTION_LEASE_SCRIPTS.acquire.indexOf("redis.call('ZCARD'"),
    ).toBeLessThan(
      AI_EXECUTION_LEASE_SCRIPTS.acquire.indexOf("redis.call('SET'"),
    );
    expect(AI_EXECUTION_LEASE_SCRIPTS.check).toContain(
      "redis.call('GET', KEYS[3]) ~= ARGV[1]",
    );
    expect(
      AI_EXECUTION_LEASE_SCRIPTS.release.indexOf("redis.call('GET'"),
    ).toBeLessThan(
      AI_EXECUTION_LEASE_SCRIPTS.release.indexOf("redis.call('DEL'"),
    );
    expect(
      AI_EXECUTION_LEASE_SCRIPTS.release.match(/redis.call\('ZREM'/g),
    ).toHaveLength(2);
  });

  it('derives the TTL from the caller deadline after metadata persistence latency', async () => {
    const h = harness();
    const original = h.prisma.aiGeneration.create.getMockImplementation()!;
    h.prisma.aiGeneration.create.mockImplementationOnce(async (query) => {
      jest.setSystemTime(NOW + 2_000);
      return original(query);
    });
    const ctx = await h.service.begin('actor', 'chat', {
      deadlineAt: NOW + 10_000,
    });
    expect(ctx.deadlineAt).toBe(NOW + 10_000);
    expect(h.client.eval.mock.calls[0][7]).toBe(8_000);
  });

  it('limits each actor to two leases shared by semantic service instances', async () => {
    const h = harness();
    const first = await h.service.begin('actor', 'chat');
    await h.sibling().begin('actor', 'autocomplete');
    expect(await status(h.service.begin('actor', 'chat'))).toBe(429);
    expect(h.generations().map((row) => row.outcome)).toEqual([
      'running',
      'running',
      'rejected',
    ]);
    expect(h.attempts()).toHaveLength(0);
    await first.release();
    await expect(h.sibling().begin('actor', 'chat')).resolves.toBeDefined();
  });

  it('limits the semantic global pool to 32 and frees capacity on TTL expiry', async () => {
    const h = harness();
    for (let actor = 0; actor < 32; actor++)
      await h.service.begin(`actor-${actor}`, 'chat');
    expect(await status(h.sibling().begin('actor-32', 'chat'))).toBe(429);
    jest.setSystemTime(NOW + 90_001);
    await expect(h.sibling().begin('actor-32', 'chat')).resolves.toBeDefined();
    expect(h.memberships.get('ai:{ai-execution}:leases:global')?.size).toBe(1);
  });

  it.each([0, -1, 'Infinity', 'NaN', 'unlimited', 1.5])(
    'never converts invalid operational limits (%s) into unlimited admission',
    async (value) => {
      const h = harness({
        AI_EXECUTION_PER_USER_CONCURRENCY: value,
        AI_EXECUTION_GLOBAL_CONCURRENCY: value,
      });
      await h.service.begin('actor', 'chat');
      expect(h.client.eval.mock.calls[0].slice(8)).toEqual([2, 32]);
    },
  );

  it('caps positive configuration and respects a lower finite attempt bound', async () => {
    const h = harness({
      AI_EXECUTION_PER_USER_CONCURRENCY: 1000,
      AI_EXECUTION_GLOBAL_CONCURRENCY: 1000,
      AI_EXECUTION_MAX_ATTEMPTS: 2,
    });
    const ctx = await h.service.begin('actor', 'chat');
    expect(h.client.eval.mock.calls[0].slice(8)).toEqual([8, 128]);
    await ctx.beforeAttempt({ provider: 'groq', model: 'model' });
    await ctx.beforeAttempt({ provider: 'groq', model: 'model' });
    expect(
      await status(ctx.beforeAttempt({ provider: 'groq', model: 'model' })),
    ).toBe(409);
  });

  it.each(['connecting', 'reconnecting', 'end'])(
    'fails closed while Redis is %s',
    async (state) => {
      const h = harness();
      h.client.status = state;
      expect(await status(h.service.begin('actor', 'chat'))).toBe(503);
      expect(h.generations()[0].outcome).toBe('rejected');
      expect(h.attempts()).toHaveLength(0);
      expect(h.client.eval).not.toHaveBeenCalled();
    },
  );

  it('fails closed without a Redis client or with a malformed EVAL response', async () => {
    const absent = harness();
    absent.redis.getClient.mockReturnValue(undefined as never);
    expect(await status(absent.service.begin('actor', 'chat'))).toBe(503);
    const malformed = harness();
    malformed.client.eval.mockResolvedValueOnce('1' as never);
    expect(await status(malformed.service.begin('actor', 'chat'))).toBe(503);
    expect(malformed.attempts()).toHaveLength(0);
  });

  it('cleans an admission whose response was lost and does not dispatch an attempt', async () => {
    const h = harness();
    const original = h.client.eval.getMockImplementation()!;
    h.client.eval.mockImplementationOnce(async (...args) => {
      await original(...args);
      throw new Error('lost response SECRET');
    });
    expect(await status(h.service.begin('actor', 'chat'))).toBe(503);
    expect(h.leases.size).toBe(0);
    expect(h.memberships.get('ai:{ai-execution}:leases:global')?.size).toBe(0);
    expect(h.generations()[0].outcome).toBe('rejected');
  });

  it('rejects metadata persistence failure before reserving a lease', async () => {
    const h = harness();
    h.prisma.aiGeneration.create.mockRejectedValueOnce(
      new Error('database unavailable'),
    );
    await expect(h.service.begin('actor', 'chat')).rejects.toThrow(
      'database unavailable',
    );
    expect(h.client.eval).not.toHaveBeenCalled();
  });

  it('rolls back the attempt counter when attempt persistence fails', async () => {
    const h = harness();
    const ctx = await h.service.begin('actor', 'chat');
    h.prisma.aiProviderAttempt.create.mockRejectedValueOnce(
      new Error('write failed'),
    );
    await expect(
      ctx.beforeAttempt({ provider: 'groq', model: 'model' }),
    ).rejects.toThrow('write failed');
    expect(h.generations()[0].attemptCount).toBe(0);
    expect(h.attempts()).toHaveLength(0);
  });

  it('gates every attempt on both finite deadline and current lease storage', async () => {
    const h = harness();
    const ctx = await h.service.begin('actor', 'chat', {
      deadlineAt: NOW + 5_000,
    });
    h.client.status = 'reconnecting';
    expect(
      await status(ctx.beforeAttempt({ provider: 'groq', model: 'model' })),
    ).toBe(503);
    h.client.status = 'ready';
    h.leases.clear();
    expect(
      await status(ctx.beforeAttempt({ provider: 'groq', model: 'model' })),
    ).toBe(503);
    jest.setSystemTime(NOW + 5_000);
    expect(
      await status(ctx.beforeAttempt({ provider: 'groq', model: 'model' })),
    ).toBe(408);
    expect(h.attempts()).toHaveLength(0);
  });

  it('enforces eight total attempts with unique IDs and ordinals, even for concurrent gates', async () => {
    const h = harness({ AI_EXECUTION_MAX_ATTEMPTS: 1000 });
    const ctx = await h.service.begin('actor', 'chat');
    const result = await Promise.allSettled(
      Array.from({ length: 9 }, () =>
        ctx.beforeAttempt({ provider: 'groq', model: 'model' }),
      ),
    );
    expect(result.filter((item) => item.status === 'fulfilled')).toHaveLength(
      8,
    );
    expect(result.filter((item) => item.status === 'rejected')).toHaveLength(1);
    expect(new Set(h.attempts().map((attempt) => attempt.id)).size).toBe(8);
    expect(h.attempts().map((attempt) => attempt.ordinal)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ]);
    expect(h.generations()[0].attemptCount).toBe(8);
  });

  it('stores actual result metadata separately from the planned destination and strips secrets', async () => {
    const h = harness();
    const ctx = await h.service.begin('actor', 'chat');
    const attempt = await ctx.beforeAttempt({
      provider: 'openrouter',
      model: 'planned',
      apiKey: 'SECRET',
      baseUrl: 'SECRET',
    } as never);
    await attempt.complete({
      provider: 'groq',
      model: 'actual',
      usage: { promptTokens: 2, completionTokens: 1, totalTokens: 3 },
      sql: 'SECRET',
      body: 'SECRET',
    } as never);
    expect(h.attempts()[0]).toEqual(
      expect.objectContaining({
        plannedProvider: 'openrouter',
        plannedModel: 'planned',
        provider: 'groq',
        model: 'actual',
        usageCoverage: 'complete',
      }),
    );
    expect(JSON.stringify(h.attempts())).not.toContain('SECRET');
    await expect(ctx.complete()).resolves.toEqual(
      expect.objectContaining({
        provider: 'groq',
        model: 'actual',
        costCoverage: 'unavailable',
      }),
    );
  });

  it('sums received usage across retries, records missing attempts, and never double-inflates counts', async () => {
    const h = harness();
    const ctx = await h.service.begin('actor', 'chat');
    const a = await ctx.beforeAttempt({ provider: 'groq', model: 'first' });
    const b = await ctx.beforeAttempt({ provider: 'groq', model: 'second' });
    const c = await ctx.beforeAttempt({ provider: 'groq', model: 'third' });
    await a.complete({
      provider: 'groq',
      model: 'actual',
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    });
    await a.complete({
      usage: { promptTokens: 999, completionTokens: 999, totalTokens: 1998 },
    });
    await b.fail();
    await c.fail('failed', { usage: { promptTokens: 4, totalTokens: 6 } });
    await expect(ctx.complete()).resolves.toEqual({
      generationId: ctx.generationId,
      outcome: 'succeeded',
      provider: 'groq',
      model: 'actual',
      attemptCount: 3,
      measuredAttemptCount: 2,
      usageCoverage: 'partial',
      usage: { promptTokens: 14, completionTokens: 5, totalTokens: 21 },
      costCoverage: 'unavailable',
    });
    expect(h.generations()[0].promptTokens).toBe(14n);
    expect(h.attempts()[1].totalTokens).toBeNull();
  });

  it('distinguishes an explicitly measured zero from wholly unavailable usage', async () => {
    const h = harness();
    const known = await h.service.begin('actor', 'chat');
    const measured = await known.beforeAttempt({
      provider: 'groq',
      model: 'model',
    });
    await measured.complete({
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    });
    await expect(known.complete()).resolves.toEqual(
      expect.objectContaining({
        usageCoverage: 'complete',
        measuredAttemptCount: 1,
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        costCoverage: 'unavailable',
      }),
    );
    const unknown = await h.service.begin('actor', 'chat');
    const attempt = await unknown.beforeAttempt({
      provider: 'groq',
      model: 'model',
    });
    await attempt.fail();
    await expect(unknown.fail()).resolves.toEqual(
      expect.objectContaining({
        usageCoverage: 'unavailable',
        measuredAttemptCount: 0,
        usage: null,
        costCoverage: 'unavailable',
      }),
    );
    expect(h.attempts()[1]).toEqual(
      expect.objectContaining({
        provider: null,
        model: null,
        promptTokens: null,
        completionTokens: null,
        totalTokens: null,
      }),
    );
  });

  it.each([-1, NaN, Infinity, 0.5, 2_147_483_648])(
    'does not fabricate usage for an invalid counter (%s)',
    async (value) => {
      const h = harness();
      const ctx = await h.service.begin('actor', 'chat');
      const attempt = await ctx.beforeAttempt({
        provider: 'groq',
        model: 'model',
      });
      await attempt.complete({
        usage: { promptTokens: value, completionTokens: value, totalTokens: 1 },
      });
      await expect(ctx.complete()).resolves.toEqual(
        expect.objectContaining({
          usageCoverage: 'partial',
          usage: { promptTokens: null, completionTokens: null, totalTokens: 1 },
        }),
      );
    },
  );

  it('closes unresolved attempts with unavailable usage when the generation fails', async () => {
    const h = harness();
    const ctx = await h.service.begin('actor', 'chat');
    await ctx.beforeAttempt({ provider: 'groq', model: 'model' });
    await expect(ctx.fail('cancelled')).resolves.toEqual(
      expect.objectContaining({
        outcome: 'cancelled',
        attemptCount: 1,
        measuredAttemptCount: 0,
        usage: null,
      }),
    );
    expect(h.attempts()[0].outcome).toBe('cancelled');
    expect(h.leases.size).toBe(0);
  });

  it('keeps first terminal outcome and releases once across complete/fail/finally calls', async () => {
    const h = harness();
    const ctx = await h.service.begin('actor', 'chat');
    const first = await ctx.complete({ provider: 'groq', model: 'actual' });
    await expect(
      ctx.complete({ provider: 'other', model: 'other' }),
    ).resolves.toEqual(first);
    await expect(ctx.fail('timed_out')).resolves.toEqual(first);
    await ctx.release();
    await ctx.release();
    expect(
      h.client.eval.mock.calls.filter(
        ([script]) => script === AI_EXECUTION_LEASE_SCRIPTS.release,
      ),
    ).toHaveLength(1);
    expect(
      await status(ctx.beforeAttempt({ provider: 'groq', model: 'model' })),
    ).toBe(409);
  });

  it('releases capacity on terminal persistence failure, and permits a durable retry', async () => {
    const h = harness();
    const ctx = await h.service.begin('actor', 'chat');
    h.prisma.aiGeneration.update.mockRejectedValueOnce(
      new Error('durability failed'),
    );
    await expect(ctx.complete()).rejects.toThrow('durability failed');
    expect(h.leases.size).toBe(0);
    expect(h.generations()[0].outcome).toBe('running');
    await expect(ctx.fail()).resolves.toEqual(
      expect.objectContaining({ outcome: 'failed' }),
    );
  });

  it('rejects failed release storage, allows release retry, and never reopens dispatch', async () => {
    const h = harness();
    const ctx = await h.service.begin('actor', 'chat');
    h.client.eval.mockRejectedValueOnce(new Error('redis unavailable'));
    expect(await status(ctx.release())).toBe(503);
    await ctx.release();
    expect(h.leases.size).toBe(0);
    expect(
      await status(ctx.beforeAttempt({ provider: 'groq', model: 'model' })),
    ).toBe(409);
  });

  it('does not delete a lease whose token no longer matches', async () => {
    const h = harness();
    const ctx = await h.service.begin('actor', 'chat');
    const key = h.client.eval.mock.calls[0][4];
    const replacement = { token: 'replacement-owner', expiresAt: NOW + 90_000 };
    h.leases.set(key, replacement);
    await ctx.release();
    expect(h.leases.get(key)).toBe(replacement);
    expect(h.memberships.get('ai:{ai-execution}:leases:global')?.size).toBe(1);
  });

  it('verifies feedback actor ownership before a unique current-vote upsert', async () => {
    const h = harness();
    const ctx = await h.service.begin('actor', 'generate_sql');
    expect(
      await status(h.service.feedback('intruder', ctx.generationId, 'up')),
    ).toBe(404);
    expect(h.prisma.aiGenerationFeedback.upsert).not.toHaveBeenCalled();
    await expect(
      h.service.feedback('actor', ctx.generationId, 'up'),
    ).resolves.toEqual({ generationId: ctx.generationId, rating: 'up' });
    await h.service.feedback('actor', ctx.generationId, 'down');
    await h.service.feedback('actor', ctx.generationId, 'down');
    expect(h.votes()).toEqual([
      {
        id: `${ctx.generationId}/actor`,
        generationId: ctx.generationId,
        userId: 'actor',
        rating: 'down',
      },
    ]);
    expect(h.prisma.aiGenerationFeedback.upsert).toHaveBeenCalledWith({
      where: {
        generationId_userId: {
          generationId: ctx.generationId,
          userId: 'actor',
        },
      },
      create: {
        generationId: ctx.generationId,
        userId: 'actor',
        rating: 'down',
      },
      update: { rating: 'down' },
    });
  });

  it('rejects durable feedback failure instead of acknowledging success', async () => {
    const h = harness();
    const ctx = await h.service.begin('actor', 'chat');
    h.prisma.aiGenerationFeedback.upsert.mockRejectedValueOnce(
      new Error('feedback commit failed'),
    );
    await expect(
      h.service.feedback('actor', ctx.generationId, 'up'),
    ).rejects.toThrow('feedback commit failed');
    expect(h.votes()).toHaveLength(0);
  });

  it('rejects unsupported tasks, expired deadlines, and invalid ratings', async () => {
    const h = harness();
    expect(
      await status(h.service.begin('actor', 'SELECT secret' as never)),
    ).toBe(400);
    expect(
      await status(h.service.begin('actor', 'chat', { deadlineAt: Infinity })),
    ).toBe(408);
    expect(
      await status(h.service.begin('actor', 'chat', { deadlineAt: NOW })),
    ).toBe(408);
    expect(
      await status(h.service.feedback('actor', 'unknown', 'invalid' as never)),
    ).toBe(400);
    expect(h.prisma.aiGeneration.create).not.toHaveBeenCalled();
    expect(h.prisma.aiGenerationFeedback.upsert).not.toHaveBeenCalled();
  });
});
