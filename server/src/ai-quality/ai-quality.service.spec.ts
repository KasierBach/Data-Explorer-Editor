import { AiQualityService } from './ai-quality.service';

const NOW = new Date('2026-11-09T00:00:00.000Z');
const SELECT = {
  outcome: true,
  provider: true,
  model: true,
  latencyMs: true,
  attemptCount: true,
  measuredAttemptCount: true,
  usageCoverage: true,
  promptTokens: true,
  completionTokens: true,
  totalTokens: true,
};
const row = (override = {}) => ({
  outcome: 'succeeded',
  provider: 'groq',
  model: 'actual',
  latencyMs: 100,
  attemptCount: 1,
  measuredAttemptCount: 1,
  usageCoverage: 'complete',
  promptTokens: 10n,
  completionTokens: 5n,
  totalTokens: 15n,
  ...override,
});
function setup(generations: unknown[] = [], votes: unknown[] = []) {
  const prisma = {
    aiGeneration: { findMany: jest.fn().mockResolvedValue(generations) },
    aiGenerationFeedback: { findMany: jest.fn().mockResolvedValue(votes) },
    auditLog: {
      findMany: jest
        .fn()
        .mockRejectedValue(new Error('must not read audit payloads')),
    },
  };
  return { prisma, service: new AiQualityService(prisma as never) };
}

describe('AiQualityService durable metadata metrics', () => {
  it('aggregates generation metadata and current unique votes without audit inflation', async () => {
    const h = setup(
      [
        row(),
        row({ provider: 'openrouter', model: 'actual', latencyMs: 300 }),
        row({
          outcome: 'failed',
          latencyMs: 500,
          attemptCount: 2,
          measuredAttemptCount: 0,
          usageCoverage: 'unavailable',
          promptTokens: null,
          completionTokens: null,
          totalTokens: null,
        }),
      ],
      [{ rating: 'down' }],
    );
    await expect(h.service.getMetrics(30, NOW)).resolves.toEqual(
      expect.objectContaining({
        generations: 3,
        success: 2,
        failed: 1,
        successRate: 66.7,
        averageLatencyMs: 300,
        p95LatencyMs: 500,
        feedback: { up: 0, down: 1, total: 1 },
        tokens: {
          promptTokens: 20,
          completionTokens: 10,
          totalTokens: 30,
          trackedRequests: 2,
          attempts: 4,
          measuredAttempts: 2,
          unmeasuredAttempts: 2,
          usageCoverage: 'partial',
          observedOnly: true,
          costCoverage: 'unavailable',
        },
        models: expect.arrayContaining([
          { model: 'groq/actual', success: 1, failed: 1, total: 2 },
        ]),
      }),
    );
    expect(h.prisma.aiGeneration.findMany).toHaveBeenCalledWith({
      where: {
        outcome: { in: ['succeeded', 'failed', 'cancelled', 'timed_out'] },
        createdAt: { gte: new Date('2026-10-10T00:00:00.000Z') },
      },
      select: SELECT,
    });
    expect(h.prisma.aiGenerationFeedback.findMany).toHaveBeenCalledWith({
      where: {
        generation: {
          createdAt: { gte: new Date('2026-10-10T00:00:00.000Z') },
        },
      },
      select: { rating: true },
    });
    expect(h.prisma.auditLog.findMany).not.toHaveBeenCalled();
  });

  it('sums replacement votes as current records only', async () => {
    const votes = [{ rating: 'up' }];
    const h = setup([row()], votes);
    expect((await h.service.getMetrics(1, NOW)).feedback).toEqual({
      up: 1,
      down: 0,
      total: 1,
    });
    votes[0].rating = 'down';
    expect((await h.service.getMetrics(1, NOW)).feedback).toEqual({
      up: 0,
      down: 1,
      total: 1,
    });
    expect((await h.service.getMetrics(1, NOW)).feedback.total).toBe(1);
  });

  it('scopes personal usage to the actor and sums all observed attempt subtotals', async () => {
    const h = setup([
      row({
        attemptCount: 3,
        measuredAttemptCount: 2,
        usageCoverage: 'partial',
        promptTokens: 14n,
        completionTokens: 5n,
        totalTokens: 21n,
      }),
    ]);
    await expect(h.service.getUserUsage('actor', 7, NOW)).resolves.toEqual(
      expect.objectContaining({
        generations: 1,
        success: 1,
        failed: 0,
        tokens: expect.objectContaining({
          promptTokens: 14,
          completionTokens: 5,
          totalTokens: 21,
          attempts: 3,
          measuredAttempts: 2,
          unmeasuredAttempts: 1,
          usageCoverage: 'partial',
          costCoverage: 'unavailable',
        }),
      }),
    );
    expect(h.prisma.aiGeneration.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'actor',
        outcome: { in: ['succeeded', 'failed', 'cancelled', 'timed_out'] },
        createdAt: { gte: new Date('2026-11-02T00:00:00.000Z') },
      },
      select: SELECT,
    });
    expect(h.prisma.aiGenerationFeedback.findMany).not.toHaveBeenCalled();
  });

  it('labels unavailable usage instead of claiming observed zero is the complete cost', async () => {
    const h = setup([
      row({
        outcome: 'timed_out',
        provider: null,
        model: null,
        latencyMs: null,
        measuredAttemptCount: 0,
        usageCoverage: 'unavailable',
        promptTokens: null,
        completionTokens: null,
        totalTokens: null,
      }),
    ]);
    const result = await h.service.getMetrics(7, NOW);
    expect(result.tokens).toEqual(
      expect.objectContaining({
        totalTokens: 0,
        trackedRequests: 0,
        unmeasuredAttempts: 1,
        usageCoverage: 'unavailable',
        observedOnly: true,
        costCoverage: 'unavailable',
      }),
    );
    expect(result.models).toEqual([
      { model: 'unavailable', success: 0, failed: 1, total: 1 },
    ]);
    expect(result.averageLatencyMs).toBe(0);
  });

  it('propagates metadata/vote persistence query failures', async () => {
    const h = setup();
    h.prisma.aiGenerationFeedback.findMany.mockRejectedValueOnce(
      new Error('metadata unavailable'),
    );
    await expect(h.service.getMetrics(7, NOW)).rejects.toThrow(
      'metadata unavailable',
    );
    h.prisma.aiGeneration.findMany.mockRejectedValueOnce(
      new Error('metadata unavailable'),
    );
    await expect(h.service.getUserUsage('actor', 7, NOW)).rejects.toThrow(
      'metadata unavailable',
    );
  });
});
