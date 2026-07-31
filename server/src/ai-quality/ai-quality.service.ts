import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction } from '../audit/audit.service';

type AiAuditDetails = {
  provider?: string | null;
  model?: string | null;
  latencyMs?: number;
  rating?: 'up' | 'down';
};

@Injectable()
export class AiQualityService {
  constructor(private readonly prisma: PrismaService) {}

  async getMetrics(days: number, now = new Date()) {
    const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const logs = await this.prisma.auditLog.findMany({
      where: {
        action: {
          in: [
            AuditAction.AI_SQL_GENERATED,
            AuditAction.AI_SQL_GENERATION_FAILED,
            AuditAction.AI_SQL_FEEDBACK,
          ],
        },
        createdAt: { gte: since },
      },
      select: { action: true, details: true },
    });
    const latencies: number[] = [];
    const models = new Map<string, { success: number; failed: number }>();
    let success = 0;
    let failed = 0;
    let feedbackUp = 0;
    let feedbackDown = 0;

    for (const log of logs) {
      const details = this.parseDetails(log.details);
      if (log.action === String(AuditAction.AI_SQL_FEEDBACK)) {
        if (details.rating === 'up') feedbackUp += 1;
        if (details.rating === 'down') feedbackDown += 1;
        continue;
      }

      if (typeof details.latencyMs === 'number' && details.latencyMs >= 0) {
        latencies.push(details.latencyMs);
      }
      const model =
        [details.provider?.trim(), details.model?.trim()]
          .filter(Boolean)
          .join('/') || 'default';
      const modelMetrics = models.get(model) ?? { success: 0, failed: 0 };
      if (log.action === String(AuditAction.AI_SQL_GENERATED)) {
        success += 1;
        modelMetrics.success += 1;
      } else {
        failed += 1;
        modelMetrics.failed += 1;
      }
      models.set(model, modelMetrics);
    }

    latencies.sort((a, b) => a - b);
    const generations = success + failed;
    const feedback = feedbackUp + feedbackDown;
    return {
      days,
      generations,
      success,
      failed,
      successRate: generations
        ? Math.round((success / generations) * 1000) / 10
        : 0,
      averageLatencyMs: latencies.length
        ? Math.round(
            latencies.reduce((sum, value) => sum + value, 0) / latencies.length,
          )
        : 0,
      p95LatencyMs: latencies.length
        ? latencies[Math.ceil(latencies.length * 0.95) - 1]
        : 0,
      feedback: { up: feedbackUp, down: feedbackDown, total: feedback },
      models: [...models.entries()]
        .map(([model, values]) => ({
          model,
          ...values,
          total: values.success + values.failed,
        }))
        .sort((a, b) => b.total - a.total),
    };
  }

  private parseDetails(details: string | null): AiAuditDetails {
    if (!details) return {};
    try {
      const parsed = JSON.parse(details);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
}
