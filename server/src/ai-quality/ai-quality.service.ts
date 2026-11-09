import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type GenerationMetadata = {
  outcome: string;
  provider: string | null;
  model: string | null;
  latencyMs: number | null;
  attemptCount: number;
  measuredAttemptCount: number;
  usageCoverage: string;
  promptTokens: bigint | null;
  completionTokens: bigint | null;
  totalTokens: bigint | null;
};

const GENERATION_SELECT = {
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
} as const;
const TERMINAL_OUTCOMES = ['succeeded', 'failed', 'cancelled', 'timed_out'];

@Injectable()
export class AiQualityService {
  constructor(private readonly prisma: PrismaService) {}

  async getMetrics(days: number, now = new Date()) {
    const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const [generations, votes] = await Promise.all([
      this.prisma.aiGeneration.findMany({
        where: {
          outcome: { in: TERMINAL_OUTCOMES },
          createdAt: { gte: since },
        },
        select: GENERATION_SELECT,
      }),
      // Current unique votes for generations in the window, not vote/audit events.
      this.prisma.aiGenerationFeedback.findMany({
        where: { generation: { createdAt: { gte: since } } },
        select: { rating: true },
      }),
    ]);
    const latencies = generations
      .map((generation) => generation.latencyMs)
      .filter((value): value is number => value !== null && value >= 0)
      .sort((a, b) => a - b);
    const models = new Map<string, { success: number; failed: number }>();
    for (const generation of generations) {
      const model =
        [generation.provider, generation.model].filter(Boolean).join('/') ||
        'unavailable';
      const metrics = models.get(model) ?? { success: 0, failed: 0 };
      if (generation.outcome === 'succeeded') metrics.success++;
      else metrics.failed++;
      models.set(model, metrics);
    }
    const success = generations.filter(
      (generation) => generation.outcome === 'succeeded',
    ).length;
    const up = votes.filter((vote) => vote.rating === 'up').length;
    const down = votes.filter((vote) => vote.rating === 'down').length;
    return {
      days,
      generations: generations.length,
      success,
      failed: generations.length - success,
      successRate: generations.length
        ? Math.round((success / generations.length) * 1000) / 10
        : 0,
      averageLatencyMs: latencies.length
        ? Math.round(
            latencies.reduce((sum, value) => sum + value, 0) / latencies.length,
          )
        : 0,
      p95LatencyMs: latencies.length
        ? latencies[Math.ceil(latencies.length * 0.95) - 1]
        : 0,
      feedback: { up, down, total: up + down },
      tokens: this.sumTokenUsage(generations),
      models: [...models.entries()]
        .map(([model, metrics]) => ({
          model,
          ...metrics,
          total: metrics.success + metrics.failed,
        }))
        .sort((a, b) => b.total - a.total),
    };
  }

  /** Actor-scoped metadata only. Historical audit logs are not usage evidence. */
  async getUserUsage(userId: string, days: number, now = new Date()) {
    const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const generations = await this.prisma.aiGeneration.findMany({
      where: {
        userId,
        outcome: { in: TERMINAL_OUTCOMES },
        createdAt: { gte: since },
      },
      select: GENERATION_SELECT,
    });
    const success = generations.filter(
      (generation) => generation.outcome === 'succeeded',
    ).length;
    return {
      days,
      generations: generations.length,
      success,
      failed: generations.length - success,
      tokens: this.sumTokenUsage(generations),
    };
  }

  private sumTokenUsage(generations: GenerationMetadata[]) {
    const observed = (
      key: 'promptTokens' | 'completionTokens' | 'totalTokens',
    ) =>
      generations.reduce(
        (sum, generation) => sum + Number(generation[key] ?? 0n),
        0,
      );
    const attempts = generations.reduce(
      (sum, generation) => sum + generation.attemptCount,
      0,
    );
    const measuredAttempts = generations.reduce(
      (sum, generation) => sum + generation.measuredAttemptCount,
      0,
    );
    // Numeric fields retain the existing observed-subtotal contract. Coverage is
    // mandatory alongside them: unavailable attempts are not free or measured zero.
    const usageCoverage =
      generations.length &&
      generations.every((generation) => generation.usageCoverage === 'complete')
        ? 'complete'
        : measuredAttempts
          ? 'partial'
          : 'unavailable';
    return {
      promptTokens: observed('promptTokens'),
      completionTokens: observed('completionTokens'),
      totalTokens: observed('totalTokens'),
      trackedRequests: generations.filter(
        (generation) => generation.measuredAttemptCount > 0,
      ).length,
      attempts,
      measuredAttempts,
      unmeasuredAttempts: attempts - measuredAttempts,
      usageCoverage,
      observedOnly: true,
      costCoverage: 'unavailable',
    };
  }
}
