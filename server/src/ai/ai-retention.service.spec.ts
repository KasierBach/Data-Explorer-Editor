import { Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  AiRetentionService,
  type AiRetentionCleanupResult,
} from './ai-retention.service';

// Never construct PrismaService or a real database adapter in these tests.
jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

const NOW = new Date('2026-11-09T00:00:00.000Z');
const OLD = new Date('2026-08-01T00:00:00.000Z');
const CUTOFF = new Date('2026-10-10T00:00:00.000Z');
const HOUR_MS = 60 * 60 * 1000;
const ENABLED = {
  AI_CHAT_RETENTION_ENABLED: 'true',
  AI_CHAT_RETENTION_DAYS: '30',
  AI_RETENTION_CLEANUP_INTERVAL_HOURS: '24',
  AI_RETENTION_CLEANUP_BATCH_SIZE: '5',
};

type ChatRow = {
  id: string;
  userId: string;
  updatedAt: Date;
  messageCount: number;
};

function createFixture(
  configuration: Record<string, unknown> = ENABLED,
  rows: ChatRow[] = [],
) {
  const settings = { ...configuration };
  const state = new Map(rows.map((row) => [row.id, { ...row }]));
  const controls: {
    holdQuery?: Promise<void>;
    afterFind?: () => void;
    beforeDelete?: () => void;
    afterDelete?: () => void;
    queryError?: Error;
    deleteError?: Error;
    commitError?: Error;
  } = {};
  const excluded = {
    aiMessage: { deleteMany: jest.fn() },
    aiProviderConnection: { deleteMany: jest.fn() },
    aiGeneration: { deleteMany: jest.fn() },
    aiProviderAttempt: { deleteMany: jest.fn() },
    aiGenerationFeedback: { deleteMany: jest.fn() },
    auditLog: { deleteMany: jest.fn() },
    payment: { updateMany: jest.fn() },
    user: { delete: jest.fn() },
  };
  const tx = {
    ...excluded,
    aiChat: {
      findMany: jest.fn(
        async ({
          where,
          take,
        }: {
          where: { updatedAt: { lt: Date } };
          take: number;
        }) => {
          if (controls.holdQuery) await controls.holdQuery;
          if (controls.queryError) throw controls.queryError;
          const selected = [...state.values()]
            .filter((row) => row.updatedAt < where.updatedAt.lt)
            .sort(
              (a, b) =>
                a.updatedAt.getTime() - b.updatedAt.getTime() ||
                a.id.localeCompare(b.id),
            )
            .slice(0, take)
            .map((row) => ({
              id: row.id,
              userId: row.userId,
              updatedAt: row.updatedAt,
              _count: { messages: row.messageCount },
            }));
          controls.afterFind?.();
          return selected;
        },
      ),
      deleteMany: jest.fn(
        async ({
          where,
        }: {
          where: {
            id: string;
            userId: string;
            updatedAt: { equals: Date; lt: Date };
          };
        }) => {
          controls.beforeDelete?.();
          if (controls.deleteError) throw controls.deleteError;
          const row = state.get(where.id);
          if (
            !row ||
            row.userId !== where.userId ||
            row.updatedAt.getTime() !== where.updatedAt.equals.getTime() ||
            row.updatedAt >= where.updatedAt.lt
          ) {
            return { count: 0 };
          }
          state.delete(row.id);
          controls.afterDelete?.();
          return { count: 1 };
        },
      ),
    },
  };
  const prisma = {
    ...excluded,
    aiChat: { findMany: jest.fn(), deleteMany: jest.fn() },
    $transaction: jest.fn(
      async (
        work: (client: typeof tx) => Promise<AiRetentionCleanupResult>,
      ) => {
        const before = new Map([...state].map(([id, row]) => [id, { ...row }]));
        try {
          const result = await work(tx);
          if (controls.commitError) throw controls.commitError;
          return result;
        } catch (error) {
          state.clear();
          for (const [id, row] of before) state.set(id, row);
          throw error;
        }
      },
    ),
  };
  const config = { get: jest.fn((key: string) => settings[key]) };
  const service = new AiRetentionService(prisma as never, config as never);
  return { service, state, settings, controls, prisma, tx, excluded };
}

describe('AiRetentionService (mock storage only)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it.each([undefined, null, false, 'false', ''])(
    'is OFF with enable=%s even when other settings are present',
    async (enabled) => {
      const db = createFixture({
        ...ENABLED,
        AI_CHAT_RETENTION_ENABLED: enabled,
      });
      db.service.onModuleInit();
      expect(jest.getTimerCount()).toBe(0);
      await expect(db.service.runCleanup(NOW)).resolves.toMatchObject({
        status: 'disabled',
        deletedChats: 0,
      });
      expect(db.prisma.$transaction).not.toHaveBeenCalled();
    },
  );

  it('defaults OFF with no settings and does not borrow generic audit/payment cleanup flags', async () => {
    const db = createFixture({
      AUDIT_RETENTION_DAYS: '1',
      RETENTION_CLEANUP_INTERVAL_HOURS: '1',
    });
    db.service.onModuleInit();
    await expect(db.service.runCleanup(NOW)).resolves.toMatchObject({
      status: 'disabled',
    });
    expect(jest.getTimerCount()).toBe(0);
    expect(db.prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each([
    ['AI_CHAT_RETENTION_ENABLED', 'TRUE'],
    ['AI_CHAT_RETENTION_ENABLED', '1'],
    ['AI_CHAT_RETENTION_ENABLED', 1],
    ['AI_CHAT_RETENTION_DAYS', undefined],
    ['AI_CHAT_RETENTION_DAYS', ''],
    ['AI_CHAT_RETENTION_DAYS', '0'],
    ['AI_CHAT_RETENTION_DAYS', '-1'],
    ['AI_CHAT_RETENTION_DAYS', '1.5'],
    ['AI_CHAT_RETENTION_DAYS', '1e2'],
    ['AI_CHAT_RETENTION_DAYS', '0x10'],
    ['AI_CHAT_RETENTION_DAYS', ' 30'],
    ['AI_CHAT_RETENTION_DAYS', '030'],
    ['AI_CHAT_RETENTION_DAYS', '3651'],
    ['AI_CHAT_RETENTION_DAYS', Infinity],
    ['AI_CHAT_RETENTION_DAYS', NaN],
    ['AI_CHAT_RETENTION_DAYS', true],
    ['AI_RETENTION_CLEANUP_INTERVAL_HOURS', undefined],
    ['AI_RETENTION_CLEANUP_INTERVAL_HOURS', '0'],
    ['AI_RETENTION_CLEANUP_INTERVAL_HOURS', '169'],
    ['AI_RETENTION_CLEANUP_INTERVAL_HOURS', '0.1'],
    ['AI_RETENTION_CLEANUP_BATCH_SIZE', undefined],
    ['AI_RETENTION_CLEANUP_BATCH_SIZE', 0],
    ['AI_RETENTION_CLEANUP_BATCH_SIZE', 101],
    ['AI_RETENTION_CLEANUP_BATCH_SIZE', 1.1],
    ['AI_RETENTION_CLEANUP_BATCH_SIZE', {}],
  ])('fails closed without DB work for %s=%s', async (key, value) => {
    const db = createFixture({ ...ENABLED, [key]: value });
    db.service.onModuleInit();
    await expect(db.service.runCleanup(NOW)).resolves.toMatchObject({
      status: 'invalid_configuration',
    });
    expect(jest.getTimerCount()).toBe(0);
    expect(db.prisma.$transaction).not.toHaveBeenCalled();
    expect(Logger.prototype.warn).toHaveBeenCalledWith(
      'AI chat retention disabled: invalid configuration.',
    );
  });

  it('accepts explicit typed settings within the same finite bounds', async () => {
    const db = createFixture({
      AI_CHAT_RETENTION_ENABLED: true,
      AI_CHAT_RETENTION_DAYS: 3650,
      AI_RETENTION_CLEANUP_INTERVAL_HOURS: 168,
      AI_RETENTION_CLEANUP_BATCH_SIZE: 100,
    });
    await expect(db.service.runCleanup(NOW)).resolves.toMatchObject({
      status: 'completed',
      scannedChats: 0,
    });
    expect(db.tx.aiChat.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 }),
    );
  });

  it('uses inactivity cutoff, stable bounded selection and exact owner/version delete; preserves other stores', async () => {
    const db = createFixture(
      { ...ENABLED, AI_RETENTION_CLEANUP_BATCH_SIZE: '1' },
      [
        { id: 'b', userId: 'user-1', updatedAt: OLD, messageCount: 3 },
        {
          id: 'boundary',
          userId: 'user-1',
          updatedAt: CUTOFF,
          messageCount: 1,
        },
        { id: 'active', userId: 'user-1', updatedAt: NOW, messageCount: 1 },
        { id: 'a', userId: 'user-2', updatedAt: OLD, messageCount: 2 },
      ],
    );
    await expect(db.service.runCleanup(NOW)).resolves.toEqual({
      status: 'completed',
      scannedChats: 1,
      deletedChats: 1,
      deletedMessages: 2,
      skippedChats: 0,
      messageBudgetSkippedChats: 0,
    });
    expect(db.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(db.prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 1000,
      timeout: 5000,
    });
    expect(db.tx.aiChat.findMany).toHaveBeenCalledWith({
      where: { updatedAt: { lt: CUTOFF } },
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take: 1,
      select: {
        id: true,
        userId: true,
        updatedAt: true,
        _count: { select: { messages: true } },
      },
    });
    expect(db.tx.aiChat.deleteMany).toHaveBeenCalledWith({
      where: {
        id: 'a',
        userId: 'user-2',
        updatedAt: { equals: OLD, lt: CUTOFF },
      },
    });
    expect([...db.state.keys()].sort()).toEqual(['active', 'b', 'boundary']);
    expect(db.prisma.aiChat.findMany).not.toHaveBeenCalled();
    expect(db.prisma.aiChat.deleteMany).not.toHaveBeenCalled();
    for (const delegate of Object.values(db.excluded)) {
      for (const operation of Object.values(delegate))
        expect(operation).not.toHaveBeenCalled();
    }
    expect(Logger.prototype.log).toHaveBeenCalledWith(
      'AI retention removed 1 inactive chat(s) and 2 inline message(s); other stores were not deleted.',
    );
  });

  it('bounds inline-message cascades and retains oversized histories intact', async () => {
    const db = createFixture(ENABLED, [
      { id: 'a', userId: 'user-1', updatedAt: OLD, messageCount: 1001 },
      { id: 'b', userId: 'user-1', updatedAt: OLD, messageCount: 3 },
      { id: 'c', userId: 'user-2', updatedAt: OLD, messageCount: 995 },
      { id: 'd', userId: 'user-2', updatedAt: OLD, messageCount: 4 },
    ]);
    await expect(db.service.runCleanup(NOW)).resolves.toEqual({
      status: 'completed',
      scannedChats: 4,
      deletedChats: 2,
      deletedMessages: 998,
      skippedChats: 2,
      messageBudgetSkippedChats: 2,
    });
    expect([...db.state.keys()]).toEqual(['a', 'd']);
    expect(db.tx.aiChat.deleteMany).toHaveBeenCalledTimes(2);
    expect(db.excluded.aiMessage.deleteMany).not.toHaveBeenCalled();
  });

  it.each([-1, NaN, 0.5])(
    'retains chats when cascade count=%s is invalid',
    async (messageCount) => {
      const db = createFixture(ENABLED, [
        { id: 'a', userId: 'u', updatedAt: OLD, messageCount },
      ]);
      await expect(db.service.runCleanup(NOW)).resolves.toMatchObject({
        deletedChats: 0,
        messageBudgetSkippedChats: 1,
      });
      expect(db.tx.aiChat.deleteMany).not.toHaveBeenCalled();
    },
  );

  it.each(['version', 'owner', 'removed'])(
    'does not delete a candidate with a changed %s',
    async (change) => {
      const db = createFixture(ENABLED, [
        { id: 'a', userId: 'u', updatedAt: OLD, messageCount: 1 },
      ]);
      db.controls.beforeDelete = () => {
        const row = db.state.get('a')!;
        if (change === 'version') row.updatedAt = NOW;
        else if (change === 'owner') row.userId = 'outsider';
        else db.state.delete('a');
      };
      await expect(db.service.runCleanup(NOW)).resolves.toMatchObject({
        deletedChats: 0,
        deletedMessages: 0,
        skippedChats: 1,
      });
      expect(Logger.prototype.log).not.toHaveBeenCalled();
    },
  );

  it('stops before any write if configured opt-in is revoked during selection', async () => {
    const db = createFixture(ENABLED, [
      { id: 'a', userId: 'u', updatedAt: OLD, messageCount: 1 },
    ]);
    db.controls.afterFind = () => {
      db.settings.AI_CHAT_RETENTION_ENABLED = 'false';
    };
    await expect(db.service.runCleanup(NOW)).resolves.toMatchObject({
      status: 'policy_changed',
      deletedChats: 0,
    });
    expect(db.tx.aiChat.deleteMany).not.toHaveBeenCalled();
    expect(db.state.has('a')).toBe(true);
  });

  it('rolls back a batch on mid-batch policy change rather than reporting partial deletion', async () => {
    const db = createFixture(ENABLED, [
      { id: 'a', userId: 'u', updatedAt: OLD, messageCount: 1 },
      { id: 'b', userId: 'u', updatedAt: OLD, messageCount: 1 },
    ]);
    db.controls.afterDelete = () => {
      db.settings.AI_CHAT_RETENTION_DAYS = '60';
    };
    await expect(db.service.runCleanup(NOW)).resolves.toMatchObject({
      status: 'policy_changed',
      deletedChats: 0,
      deletedMessages: 0,
    });
    expect(db.tx.aiChat.deleteMany).toHaveBeenCalledTimes(1);
    expect([...db.state.keys()]).toEqual(['a', 'b']);
    expect(Logger.prototype.log).not.toHaveBeenCalled();
  });

  it.each(['queryError', 'deleteError', 'commitError'] as const)(
    'does not report success or retain overlap guard on %s',
    async (failure) => {
      const db = createFixture(ENABLED, [
        { id: 'a', userId: 'u', updatedAt: OLD, messageCount: 1 },
      ]);
      const error = new Error('private prompt/key/backend error');
      db.controls[failure] = error;
      await expect(db.service.runCleanup(NOW)).rejects.toBe(error);
      expect(db.state.has('a')).toBe(true);
      expect(Logger.prototype.log).not.toHaveBeenCalled();
      expect(Logger.prototype.error).not.toHaveBeenCalled();
      db.controls[failure] = undefined;
      await expect(db.service.runCleanup(NOW)).resolves.toMatchObject({
        status: 'completed',
        deletedChats: 1,
      });
    },
  );

  it('runs at most one batch at a time', async () => {
    const db = createFixture();
    let release!: () => void;
    db.controls.holdQuery = new Promise<void>((resolve) => {
      release = resolve;
    });
    const first = db.service.runCleanup(NOW);
    await expect(db.service.runCleanup(NOW)).resolves.toMatchObject({
      status: 'already_running',
    });
    expect(db.prisma.$transaction).toHaveBeenCalledTimes(1);
    release();
    await expect(first).resolves.toMatchObject({ status: 'completed' });
  });

  it('creates one unref timer without startup deletion, then clears it on shutdown', async () => {
    const db = createFixture({
      ...ENABLED,
      AI_RETENTION_CLEANUP_INTERVAL_HOURS: '1',
    });
    db.service.onModuleInit();
    db.service.onModuleInit();
    expect(jest.getTimerCount()).toBe(1);
    expect(db.prisma.$transaction).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(HOUR_MS);
    expect(db.prisma.$transaction).toHaveBeenCalledTimes(1);
    db.service.onModuleDestroy();
    expect(jest.getTimerCount()).toBe(0);
    await expect(db.service.runCleanup(NOW)).resolves.toMatchObject({
      status: 'stopped',
    });
    await jest.advanceTimersByTimeAsync(HOUR_MS);
    expect(db.prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['AI_CHAT_RETENTION_ENABLED', 'false'],
    ['AI_RETENTION_CLEANUP_INTERVAL_HOURS', '2'],
  ])('does not dispatch the old timer after %s changes', async (key, value) => {
    const db = createFixture({
      ...ENABLED,
      AI_RETENTION_CLEANUP_INTERVAL_HOURS: '1',
    });
    db.service.onModuleInit();
    db.settings[key] = value;
    await jest.advanceTimersByTimeAsync(2 * HOUR_MS);
    expect(db.prisma.$transaction).not.toHaveBeenCalled();
    db.service.onModuleDestroy();
  });

  it('aborts an in-flight batch on module shutdown', async () => {
    const db = createFixture(ENABLED, [
      { id: 'a', userId: 'u', updatedAt: OLD, messageCount: 1 },
    ]);
    let release!: () => void;
    db.controls.holdQuery = new Promise<void>((resolve) => {
      release = resolve;
    });
    const pending = db.service.runCleanup(NOW);
    db.service.onModuleDestroy();
    release();
    await expect(pending).resolves.toMatchObject({
      status: 'stopped',
      deletedChats: 0,
    });
    expect(db.tx.aiChat.deleteMany).not.toHaveBeenCalled();
    expect(db.state.has('a')).toBe(true);
  });

  it('uses only fixed redacted failure text for scheduled cleanup errors', async () => {
    const db = createFixture({
      ...ENABLED,
      AI_RETENTION_CLEANUP_INTERVAL_HOURS: '1',
    });
    db.controls.queryError = new Error('private prompt/key/backend error');
    db.service.onModuleInit();
    await jest.advanceTimersByTimeAsync(HOUR_MS);
    expect(Logger.prototype.error).toHaveBeenCalledWith(
      'AI chat retention failed; deletion is not confirmed.',
    );
    expect(Logger.prototype.log).not.toHaveBeenCalled();
    db.service.onModuleDestroy();
  });

  it.each([new Date(NaN), new Date(-8640000000000000)])(
    'rejects invalid cutoff time without DB work',
    async (time) => {
      const db = createFixture();
      await expect(db.service.runCleanup(time)).rejects.toThrow(
        'Invalid AI retention time',
      );
      expect(db.prisma.$transaction).not.toHaveBeenCalled();
    },
  );
});
