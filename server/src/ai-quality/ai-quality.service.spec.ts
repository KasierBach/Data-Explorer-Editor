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
        promptTokens: null,
        completionTokens: null,
        totalTokens: null,
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

  describe.each(['metrics', 'personal'] as const)(
    '%s independently observed counters',
    (scope) => {
      const readTokens = async (generations: unknown[]) => {
        const h = setup(generations);
        const result =
          scope === 'metrics'
            ? await h.service.getMetrics(7, NOW)
            : await h.service.getUserUsage('actor', 7, NOW);
        return result.tokens;
      };

      it.each(['promptTokens', 'completionTokens', 'totalTokens'] as const)(
        'retains only the measured %s without inferring its peers',
        async (key) => {
          const tokens = await readTokens([
            row({
              usageCoverage: 'partial',
              promptTokens: null,
              completionTokens: null,
              totalTokens: null,
              [key]: 23n,
            }),
          ]);
          expect(tokens).toEqual({
            promptTokens: null,
            completionTokens: null,
            totalTokens: null,
            [key]: 23,
            trackedRequests: 1,
            attempts: 1,
            measuredAttempts: 1,
            unmeasuredAttempts: 0,
            usageCoverage: 'partial',
            observedOnly: true,
            costCoverage: 'unavailable',
          });
        },
      );

      it.each(['promptTokens', 'completionTokens', 'totalTokens'] as const)(
        'keeps explicitly measured %s zero distinct from absent peers',
        async (key) => {
          const tokens = await readTokens([
            row({
              usageCoverage: 'partial',
              promptTokens: null,
              completionTokens: null,
              totalTokens: null,
              [key]: 0n,
            }),
          ]);
          expect(tokens).toEqual(
            expect.objectContaining({
              promptTokens: null,
              completionTokens: null,
              totalTokens: null,
              [key]: 0,
              measuredAttempts: 1,
              usageCoverage: 'partial',
            }),
          );
        },
      );

      it('preserves complete explicitly measured zero', async () => {
        await expect(
          readTokens([
            row({ promptTokens: 0n, completionTokens: 0n, totalTokens: 0n }),
          ]),
        ).resolves.toEqual(
          expect.objectContaining({
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            usageCoverage: 'complete',
            measuredAttempts: 1,
          }),
        );
      });

      it('keeps empty periods unknown rather than inventing measured zero', async () => {
        await expect(readTokens([])).resolves.toEqual({
          promptTokens: null,
          completionTokens: null,
          totalTokens: null,
          trackedRequests: 0,
          attempts: 0,
          measuredAttempts: 0,
          unmeasuredAttempts: 0,
          usageCoverage: 'unavailable',
          observedOnly: true,
          costCoverage: 'unavailable',
        });
      });

      it('sums mixed terminal generations per counter without deriving missing totals', async () => {
        const tokens = await readTokens([
          row({
            usageCoverage: 'partial',
            promptTokens: 7n,
            completionTokens: null,
            totalTokens: null,
          }),
          row({
            outcome: 'failed',
            usageCoverage: 'partial',
            promptTokens: null,
            completionTokens: 4n,
            totalTokens: null,
          }),
          row({
            outcome: 'cancelled',
            usageCoverage: 'partial',
            promptTokens: 3n,
            completionTokens: null,
            totalTokens: 8n,
          }),
          row({
            outcome: 'timed_out',
            attemptCount: 2,
            measuredAttemptCount: 0,
            usageCoverage: 'unavailable',
            promptTokens: null,
            completionTokens: null,
            totalTokens: null,
          }),
        ]);
        expect(tokens).toEqual({
          promptTokens: 10,
          completionTokens: 4,
          totalTokens: 8,
          trackedRequests: 3,
          attempts: 5,
          measuredAttempts: 3,
          unmeasuredAttempts: 2,
          usageCoverage: 'partial',
          observedOnly: true,
          costCoverage: 'unavailable',
        });
      });

      it('does not derive an unmeasured total from measured prompt and output', async () => {
        const tokens = await readTokens([
          row({
            usageCoverage: 'partial',
            promptTokens: 7n,
            completionTokens: 4n,
            totalTokens: null,
          }),
          row({
            outcome: 'failed',
            usageCoverage: 'partial',
            promptTokens: 3n,
            completionTokens: 0n,
            totalTokens: null,
          }),
        ]);
        expect(tokens).toEqual(
          expect.objectContaining({
            promptTokens: 10,
            completionTokens: 4,
            totalTokens: null,
            attempts: 2,
            measuredAttempts: 2,
            usageCoverage: 'partial',
            costCoverage: 'unavailable',
          }),
        );
      });

      it('retains the exact safe-integer aggregate boundary', async () => {
        const max = BigInt(Number.MAX_SAFE_INTEGER);
        const tokens = await readTokens(
          [max - 7n, 3n, 4n].map((value) =>
            row({
              promptTokens: value,
              completionTokens: value,
              totalTokens: value,
            }),
          ),
        );
        expect(tokens).toEqual(
          expect.objectContaining({
            promptTokens: Number.MAX_SAFE_INTEGER,
            completionTokens: Number.MAX_SAFE_INTEGER,
            totalTokens: Number.MAX_SAFE_INTEGER,
            usageCoverage: 'complete',
          }),
        );
        expect(() => JSON.stringify(tokens)).not.toThrow();
      });

      it.each(['promptTokens', 'completionTokens', 'totalTokens'] as const)(
        'keeps overflowing %s unknown without hiding safely representable peers',
        async (key) => {
          const max = BigInt(Number.MAX_SAFE_INTEGER);
          for (const values of [[max + 2n], [max, 1n], [max - 1n, 1n, 1n]]) {
            const tokens = await readTokens(
              values.map((value) => row({ [key]: value })),
            );
            expect(tokens).toEqual(
              expect.objectContaining({
                promptTokens: 10 * values.length,
                completionTokens: 5 * values.length,
                totalTokens: 15 * values.length,
                [key]: null,
                attempts: values.length,
                measuredAttempts: values.length,
                usageCoverage: 'complete',
                observedOnly: true,
                costCoverage: 'unavailable',
              }),
            );
            expect(() => JSON.stringify(tokens)).not.toThrow();
          }
        },
      );
    },
  );

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
