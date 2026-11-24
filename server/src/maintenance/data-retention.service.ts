import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class DataRetentionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DataRetentionService.name);
  private cleanupTimer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    void this.runCleanup().catch(() =>
      this.logger.error('Data retention cleanup failed'),
    );
    const intervalHours = this.positiveInt(
      'RETENTION_CLEANUP_INTERVAL_HOURS',
      24,
    );
    this.cleanupTimer = setInterval(
      () =>
        void this.runCleanup().catch(() =>
          this.logger.error('Data retention cleanup failed'),
        ),
      intervalHours * 60 * 60 * 1000,
    );
    this.cleanupTimer.unref();
  }

  onModuleDestroy() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
  }

  async runCleanup(now = new Date()) {
    const startedAt = Date.now();
    const auditDays = this.nonNegativeInt('AUDIT_RETENTION_DAYS', 365);
    const paymentPayloadDays = this.nonNegativeInt(
      'PAYMENT_PAYLOAD_RETENTION_DAYS',
      30,
    );
    let firstFailure: unknown;
    let failed = false;
    const observe = (operation: () => Promise<{ count: number }>) =>
      Promise.resolve()
        .then(operation)
        .catch((error: unknown) => {
          if (!failed) {
            failed = true;
            firstFailure = error;
          }
          throw error;
        });
    const [auditLogs, paymentPayloads] = await Promise.allSettled([
      observe(() =>
        auditDays === 0
          ? Promise.resolve({ count: 0 })
          : this.prisma.auditLog.deleteMany({
              where: {
                createdAt: {
                  lt: new Date(now.getTime() - auditDays * DAY_MS),
                },
              },
            }),
      ),
      observe(() =>
        paymentPayloadDays === 0
          ? Promise.resolve({ count: 0 })
          : this.prisma.payment.updateMany({
              where: {
                createdAt: {
                  lt: new Date(now.getTime() - paymentPayloadDays * DAY_MS),
                },
                rawPayload: { not: Prisma.DbNull },
              },
              data: { rawPayload: Prisma.DbNull },
            }),
      ),
    ]);
    const outcome = (
      result: PromiseSettledResult<{ count: number }>,
      disabled: boolean,
    ) =>
      result.status === 'rejected'
        ? { status: 'failed', count: null }
        : {
            status: disabled ? 'disabled' : 'completed',
            count: result.value.count,
          };
    const failedBranches = [auditLogs, paymentPayloads].filter(
      (result) => result.status === 'rejected',
    ).length;
    this.logger.log({
      event: 'data_retention_cleanup',
      status:
        failedBranches === 0
          ? 'completed'
          : failedBranches === 2
            ? 'failed'
            : 'partial_failure',
      durationMs: Math.max(0, Date.now() - startedAt),
      auditLogs: outcome(auditLogs, auditDays === 0),
      paymentPayloads: outcome(paymentPayloads, paymentPayloadDays === 0),
    });
    if (
      auditLogs.status === 'rejected' ||
      paymentPayloads.status === 'rejected'
    ) {
      // Preserve failure while keeping raw database details out of logs.
      throw firstFailure;
    }
    return {
      auditLogs: auditLogs.value.count,
      paymentPayloads: paymentPayloads.value.count,
    };
  }

  private nonNegativeInt(key: string, fallback: number) {
    const value = Number(this.config.get<string>(key));
    return Number.isInteger(value) && value >= 0 ? value : fallback;
  }

  private positiveInt(key: string, fallback: number) {
    const value = this.nonNegativeInt(key, fallback);
    return value > 0 ? value : fallback;
  }
}
