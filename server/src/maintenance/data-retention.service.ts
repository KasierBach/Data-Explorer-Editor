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
    void this.runCleanup().catch((error) =>
      this.logger.error('Data retention cleanup failed', error),
    );
    const intervalHours = this.positiveInt(
      'RETENTION_CLEANUP_INTERVAL_HOURS',
      24,
    );
    this.cleanupTimer = setInterval(
      () =>
        void this.runCleanup().catch((error) =>
          this.logger.error('Data retention cleanup failed', error),
        ),
      intervalHours * 60 * 60 * 1000,
    );
    this.cleanupTimer.unref();
  }

  onModuleDestroy() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
  }

  async runCleanup(now = new Date()) {
    const auditDays = this.nonNegativeInt('AUDIT_RETENTION_DAYS', 365);
    const paymentPayloadDays = this.nonNegativeInt(
      'PAYMENT_PAYLOAD_RETENTION_DAYS',
      30,
    );
    const [auditLogs, paymentPayloads] = await Promise.all([
      auditDays === 0
        ? Promise.resolve({ count: 0 })
        : this.prisma.auditLog.deleteMany({
            where: {
              createdAt: { lt: new Date(now.getTime() - auditDays * DAY_MS) },
            },
          }),
      paymentPayloadDays === 0
        ? Promise.resolve({ count: 0 })
        : this.prisma.payment.updateMany({
            where: {
              createdAt: {
                lt: new Date(now.getTime() - paymentPayloadDays * DAY_MS),
              },
            },
            data: { rawPayload: Prisma.DbNull },
          }),
    ]);

    if (auditLogs.count || paymentPayloads.count) {
      this.logger.log(
        `Retention cleanup removed ${auditLogs.count} audit log(s) and cleared ${paymentPayloads.count} payment payload(s).`,
      );
    }
    return {
      auditLogs: auditLogs.count,
      paymentPayloads: paymentPayloads.count,
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
