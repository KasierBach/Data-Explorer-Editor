import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const MAX_RETENTION_DAYS = 3650;
const MAX_INTERVAL_HOURS = 168;
const MAX_BATCH_SIZE = 100;
const MAX_CASCADE_MESSAGES = 1000;

type EnabledPolicy = {
  status: 'enabled';
  days: number;
  intervalHours: number;
  batchSize: number;
};
type RetentionPolicy =
  | EnabledPolicy
  | { status: 'disabled' | 'invalid_configuration' };

type RetentionCandidate = {
  id: string;
  userId: string;
  updatedAt: Date;
  messageCount: bigint;
};

export interface AiRetentionCleanupResult {
  status:
    | 'disabled'
    | 'invalid_configuration'
    | 'already_running'
    | 'stopped'
    | 'policy_changed'
    | 'completed';
  scannedChats: number;
  deletedChats: number;
  deletedMessages: number;
  skippedChats: number;
  messageBudgetSkippedChats: number;
}

/**
 * Opt-in inactivity retention for app-store chats and their inline messages only.
 * All four settings must be explicit: AI_CHAT_RETENTION_ENABLED=true,
 * AI_CHAT_RETENTION_DAYS (1..3650), AI_RETENTION_CLEANUP_INTERVAL_HOURS (1..168),
 * AI_RETENTION_CLEANUP_BATCH_SIZE (1..100). These are operational limits, not
 * legal retention defaults. Deployment/legal-hold approval must precede opt-in.
 *
 * Provider credentials, ledger/feedback, audit, caches, backups, exported files
 * and provider copies have separate policies; this service never deletes them.
 */
@Injectable()
export class AiRetentionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AiRetentionService.name);
  private cleanupTimer?: NodeJS.Timeout;
  private running = false;
  private stopped = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    if (this.cleanupTimer || this.stopped) return;
    const policy = this.readPolicy();
    if (policy.status !== 'enabled') {
      if (policy.status === 'invalid_configuration') {
        this.logger.warn('AI chat retention disabled: invalid configuration.');
      }
      return;
    }

    // No startup deletion. Changing scheduled policy requires a restart, so an
    // old timer cannot silently use a newly configured, longer interval.
    this.cleanupTimer = setInterval(() => {
      if (!this.isPolicyCurrent(policy)) return;
      void this.runCleanup().catch(() => {
        // DB errors can contain sensitive data; never log the raw error/stack.
        this.logger.error(
          'AI chat retention failed; deletion is not confirmed.',
        );
      });
    }, policy.intervalHours * HOUR_MS);
    this.cleanupTimer.unref();
  }

  onModuleDestroy() {
    this.stopped = true;
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    this.cleanupTimer = undefined;
  }

  async runCleanup(now = new Date()): Promise<AiRetentionCleanupResult> {
    const empty: AiRetentionCleanupResult = {
      status: 'disabled',
      scannedChats: 0,
      deletedChats: 0,
      deletedMessages: 0,
      skippedChats: 0,
      messageBudgetSkippedChats: 0,
    };
    if (this.stopped) return { ...empty, status: 'stopped' };
    const policy = this.readPolicy();
    if (policy.status !== 'enabled') return { ...empty, status: policy.status };
    if (this.running) return { ...empty, status: 'already_running' };

    const cutoff = new Date(now.getTime() - policy.days * DAY_MS);
    if (!Number.isFinite(now.getTime()) || !Number.isFinite(cutoff.getTime())) {
      throw new Error('Invalid AI retention time');
    }

    this.running = true;
    const policyAbort = new Error('AI retention policy changed');
    try {
      const result = await this.prisma.$transaction(
        async (tx) => {
          if (!this.isPolicyCurrent(policy)) throw policyAbort;
          const chats = await tx.$queryRaw<RetentionCandidate[]>(Prisma.sql`
            SELECT c."id", c."userId", c."updatedAt", COUNT(m."id")::bigint AS "messageCount"
            FROM "AiChat" c
            LEFT JOIN "AiMessage" m ON m."chatId" = c."id"
            WHERE c."updatedAt" < ${cutoff}
            GROUP BY c."id", c."userId", c."updatedAt"
            HAVING COUNT(m."id") <= ${MAX_CASCADE_MESSAGES}
            ORDER BY c."updatedAt" ASC, c."id" ASC
            LIMIT ${policy.batchSize}
          `);
          const counts: AiRetentionCleanupResult = {
            ...empty,
            status: 'completed',
            scannedChats: chats.length,
          };
          let remainingMessages = MAX_CASCADE_MESSAGES;
          for (const chat of chats) {
            if (!this.isPolicyCurrent(policy)) throw policyAbort;
            const rawMessageCount = chat.messageCount;
            const messageCount =
              typeof rawMessageCount === 'bigint' &&
              rawMessageCount >= 0n &&
              rawMessageCount <= BigInt(Number.MAX_SAFE_INTEGER)
                ? Number(rawMessageCount)
                : Number.NaN;
            // Retain oversized histories intact, including their attachments;
            // never partially truncate a conversation just to fit this job.
            if (
              !Number.isSafeInteger(messageCount) ||
              messageCount < 0 ||
              messageCount > remainingMessages
            ) {
              counts.skippedChats += 1;
              counts.messageBudgetSkippedChats += 1;
              continue;
            }
            const deleted = await tx.aiChat.deleteMany({
              where: {
                id: chat.id,
                userId: chat.userId,
                updatedAt: { equals: chat.updatedAt, lt: cutoff },
              },
            });
            if (deleted.count === 0) {
              counts.skippedChats += 1;
              continue;
            }
            if (deleted.count !== 1) {
              throw new Error('Invalid AI retention deletion count');
            }
            // AiMessage and its inline attachment JSON cascade with AiChat.
            remainingMessages -= messageCount;
            counts.deletedChats += 1;
            counts.deletedMessages += messageCount;
          }
          if (!this.isPolicyCurrent(policy)) throw policyAbort;
          return counts;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 1000,
          timeout: 5000,
        },
      );
      if (result.deletedChats > 0) {
        this.logger.log(
          `AI retention removed ${result.deletedChats} inactive chat(s) and ${result.deletedMessages} inline message(s); other stores were not deleted.`,
        );
      }
      return result;
    } catch (error) {
      if (error === policyAbort) {
        return {
          ...empty,
          status: this.stopped ? 'stopped' : 'policy_changed',
        };
      }
      // A failed transaction/commit is not a successful cleanup result.
      throw error;
    } finally {
      this.running = false;
    }
  }

  private readPolicy(): RetentionPolicy {
    const enabled = this.config.get<unknown>('AI_CHAT_RETENTION_ENABLED');
    if (enabled !== true && enabled !== 'true') {
      const disabled =
        enabled === undefined ||
        enabled === null ||
        enabled === false ||
        enabled === 'false' ||
        enabled === '';
      return { status: disabled ? 'disabled' : 'invalid_configuration' };
    }
    const days = this.readBoundedInteger(
      'AI_CHAT_RETENTION_DAYS',
      MAX_RETENTION_DAYS,
    );
    const intervalHours = this.readBoundedInteger(
      'AI_RETENTION_CLEANUP_INTERVAL_HOURS',
      MAX_INTERVAL_HOURS,
    );
    const batchSize = this.readBoundedInteger(
      'AI_RETENTION_CLEANUP_BATCH_SIZE',
      MAX_BATCH_SIZE,
    );
    if (days === null || intervalHours === null || batchSize === null) {
      return { status: 'invalid_configuration' };
    }
    return { status: 'enabled', days, intervalHours, batchSize };
  }

  private readBoundedInteger(key: string, maximum: number): number | null {
    const raw = this.config.get<unknown>(key);
    if (
      typeof raw !== 'number' &&
      (typeof raw !== 'string' || !/^[1-9]\d*$/.test(raw))
    ) {
      return null;
    }
    const value = Number(raw);
    return Number.isSafeInteger(value) && value > 0 && value <= maximum
      ? value
      : null;
  }

  private isPolicyCurrent(policy: EnabledPolicy): boolean {
    if (this.stopped) return false;
    const current = this.readPolicy();
    return (
      current.status === 'enabled' &&
      current.days === policy.days &&
      current.intervalHours === policy.intervalHours &&
      current.batchSize === policy.batchSize
    );
  }
}
