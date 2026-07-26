import { DataRetentionService } from './data-retention.service';

describe('DataRetentionService', () => {
  it('uses configured cutoffs without deleting user-created resources', async () => {
    const prisma = {
      auditLog: { deleteMany: jest.fn().mockResolvedValue({ count: 4 }) },
      payment: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
    };
    const config = {
      get: jest.fn((key: string) =>
        key === 'AUDIT_RETENTION_DAYS' ? '90' : '14',
      ),
    };
    const service = new DataRetentionService(prisma as never, config as never);
    const now = new Date('2026-07-26T00:00:00.000Z');

    await expect(service.runCleanup(now)).resolves.toEqual({
      auditLogs: 4,
      paymentPayloads: 2,
    });
    expect(prisma.auditLog.deleteMany).toHaveBeenCalledWith({
      where: { createdAt: { lt: new Date('2026-04-27T00:00:00.000Z') } },
    });
    expect(prisma.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          createdAt: { lt: new Date('2026-07-12T00:00:00.000Z') },
        },
      }),
    );
  });
});
