import { Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DataRetentionService } from './data-retention.service';

const NOW = new Date('2026-07-26T00:00:00.000Z');

function fixture(auditDays = '90', paymentDays = '14') {
  const prisma = {
    auditLog: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    payment: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
  };
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'AUDIT_RETENTION_DAYS') return auditDays;
      if (key === 'PAYMENT_PAYLOAD_RETENTION_DAYS') return paymentDays;
      return undefined;
    }),
  };
  const service = new DataRetentionService(prisma as never, config as never);
  const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
  return { prisma, service, log };
}

describe('DataRetentionService repeat-run and outcome regression', () => {
  afterEach(() => jest.restoreAllMocks());

  it('clears only remaining payloads and excludes database-null rows on a repeat run', async () => {
    const { prisma, service } = fixture();
    const payments: Array<{ createdAt: Date; payload: object | null }> = [
      { createdAt: new Date('2026-01-01'), payload: { reference: 'test' } },
      { createdAt: new Date('2026-01-01'), payload: null },
      { createdAt: NOW, payload: { reference: 'recent' } },
    ];
    prisma.payment.updateMany.mockImplementation(
      async (args: {
        where: { createdAt: { lt: Date }; rawPayload?: { not: unknown } };
        data: { rawPayload: unknown };
      }) => {
        const selected = payments.filter(
          (row) =>
            row.createdAt < args.where.createdAt.lt &&
            (args.where.rawPayload?.not !== Prisma.DbNull ||
              row.payload !== null),
        );
        expect(args.data.rawPayload).toBe(Prisma.DbNull);
        selected.forEach((row) => {
          row.payload = null;
        });
        return { count: selected.length };
      },
    );

    await expect(service.runCleanup(NOW)).resolves.toEqual({
      auditLogs: 0,
      paymentPayloads: 1,
    });
    await expect(service.runCleanup(NOW)).resolves.toEqual({
      auditLogs: 0,
      paymentPayloads: 0,
    });
    expect(prisma.payment.updateMany).toHaveBeenCalledWith({
      where: {
        createdAt: { lt: new Date('2026-07-12T00:00:00.000Z') },
        rawPayload: { not: Prisma.DbNull },
      },
      data: { rawPayload: Prisma.DbNull },
    });
    expect(payments[2].payload).toEqual({ reference: 'recent' });
  });

  it('records successful zero-change cleanup instead of remaining silent', async () => {
    const { service, log } = fixture();
    await expect(service.runCleanup(NOW)).resolves.toEqual({
      auditLogs: 0,
      paymentPayloads: 0,
    });
    expect(log).toHaveBeenCalledWith({
      event: 'data_retention_cleanup',
      status: 'completed',
      durationMs: expect.any(Number),
      auditLogs: { status: 'completed', count: 0 },
      paymentPayloads: { status: 'completed', count: 0 },
    });
  });

  it('distinguishes disabled branches without sending cleanup queries', async () => {
    const { prisma, service, log } = fixture('0', '0');
    await expect(service.runCleanup(NOW)).resolves.toEqual({
      auditLogs: 0,
      paymentPayloads: 0,
    });
    expect(prisma.auditLog.deleteMany).not.toHaveBeenCalled();
    expect(prisma.payment.updateMany).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'completed',
        auditLogs: { status: 'disabled', count: 0 },
        paymentPayloads: { status: 'disabled', count: 0 },
      }),
    );
  });

  it('reports the completed branch on partial failure and propagates the original error', async () => {
    const { prisma, service, log } = fixture();
    const error = new Error('private database error detail');
    prisma.auditLog.deleteMany.mockResolvedValue({ count: 4 });
    prisma.payment.updateMany.mockRejectedValue(error);

    await expect(service.runCleanup(NOW)).rejects.toBe(error);
    expect(log).toHaveBeenCalledWith({
      event: 'data_retention_cleanup',
      status: 'partial_failure',
      durationMs: expect.any(Number),
      auditLogs: { status: 'completed', count: 4 },
      paymentPayloads: { status: 'failed', count: null },
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain(error.message);
  });

  it('waits for all branch outcomes and preserves the first failure', async () => {
    const { prisma, service, log } = fixture();
    const first = new Error('first private detail');
    const second = new Error('second private detail');
    let rejectAudit!: (error: Error) => void;
    prisma.auditLog.deleteMany.mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectAudit = reject;
        }),
    );
    prisma.payment.updateMany.mockRejectedValue(first);
    let settled = false;
    const cleanup = service.runCleanup(NOW).catch((error) => {
      settled = true;
      throw error;
    });
    const observed = cleanup.catch((error) => error);
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(settled).toBe(false);
    rejectAudit(second);
    await expect(observed).resolves.toBe(first);
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        auditLogs: { status: 'failed', count: null },
        paymentPayloads: { status: 'failed', count: null },
      }),
    );
    expect(JSON.stringify(log.mock.calls)).not.toContain('private detail');
  });

  it('does not log raw database errors from startup or scheduled cleanup', async () => {
    const { service } = fixture();
    const error = new Error('private retention database details');
    jest.spyOn(service, 'runCleanup').mockRejectedValue(error);
    const logError = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.useFakeTimers();
    try {
      service.onModuleInit();
      await Promise.resolve();
      expect(logError).toHaveBeenCalledWith('Data retention cleanup failed');
      logError.mockClear();
      jest.advanceTimersByTime(24 * 60 * 60 * 1000);
      await Promise.resolve();
      expect(logError).toHaveBeenCalledWith('Data retention cleanup failed');
      expect(logError.mock.calls.flat()).not.toContain(error);
    } finally {
      service.onModuleDestroy();
      jest.useRealTimers();
    }
  });
});
