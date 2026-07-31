import { AuditAction } from '../audit/audit.service';
import { AiQualityService } from './ai-quality.service';

describe('AiQualityService', () => {
  it('aggregates AI quality without reading prompts or generated SQL', async () => {
    const prisma = {
      auditLog: {
        findMany: jest.fn().mockResolvedValue([
          {
            action: AuditAction.AI_SQL_GENERATED,
            details: JSON.stringify({
              provider: 'openrouter',
              model: 'fast',
              latencyMs: 100,
            }),
          },
          {
            action: AuditAction.AI_SQL_GENERATED,
            details: JSON.stringify({ model: 'fast', latencyMs: 300 }),
          },
          {
            action: AuditAction.AI_SQL_GENERATION_FAILED,
            details: JSON.stringify({ model: 'slow', latencyMs: 500 }),
          },
          {
            action: AuditAction.AI_SQL_FEEDBACK,
            details: JSON.stringify({ generationId: 'g1', rating: 'up' }),
          },
        ]),
      },
    };
    const service = new AiQualityService(prisma as never);

    await expect(
      service.getMetrics(30, new Date('2026-07-26T00:00:00.000Z')),
    ).resolves.toEqual(
      expect.objectContaining({
        generations: 3,
        success: 2,
        failed: 1,
        successRate: 66.7,
        averageLatencyMs: 300,
        p95LatencyMs: 500,
        feedback: { up: 1, down: 0, total: 1 },
        models: expect.arrayContaining([
          expect.objectContaining({ model: 'openrouter/fast', success: 1 }),
        ]),
      }),
    );
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ select: { action: true, details: true } }),
    );
  });
});
