import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import {
  AI_EXECUTION_TASKS,
  type AiExecutionAttempt,
  type AiExecutionAttemptPlan,
  type AiExecutionAttemptResult,
  type AiExecutionContext,
  type AiExecutionFailure,
  type AiExecutionMetadata,
  type AiExecutionOutcome,
  type AiExecutionResultMetadata,
  type AiExecutionSummary,
  type AiExecutionTask,
  type AiFeedbackRating,
  type AiUsageCoverage,
} from './dto/ai-execution.types';

export type {
  AiExecutionAttempt,
  AiExecutionAttemptPlan,
  AiExecutionAttemptResult,
  AiExecutionContext,
  AiExecutionFailure,
  AiExecutionMetadata,
  AiExecutionOutcome,
  AiExecutionResultMetadata,
  AiExecutionSummary,
  AiExecutionTask,
  AiExecutionUsage,
  AiFeedbackRating,
} from './dto/ai-execution.types';

const MAX_LEASE_MS = 90_000;
const MAX_ATTEMPTS = 8;
const MAX_TOKEN_COUNT = 2_147_483_647;

/** All three KEYS share a Redis Cluster hash slot. No process-local admission. */
export const AI_EXECUTION_LEASE_SCRIPTS = {
  acquire: `
local clock = redis.call('TIME')
local now = tonumber(clock[1]) * 1000 + math.floor(tonumber(clock[2]) / 1000)
local ttl = tonumber(ARGV[3])
if not ttl or ttl < 1 or ttl > 90000 then return -3 end
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now)
redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', now)
if redis.call('ZCARD', KEYS[2]) >= tonumber(ARGV[4]) then return 0 end
if redis.call('ZCARD', KEYS[1]) >= tonumber(ARGV[5]) then return -1 end
if not redis.call('SET', KEYS[3], ARGV[1], 'PX', ttl, 'NX') then return -2 end
redis.call('ZADD', KEYS[1], now + ttl, ARGV[2])
redis.call('ZADD', KEYS[2], now + ttl, ARGV[2])
redis.call('PEXPIRE', KEYS[1], 90000)
redis.call('PEXPIRE', KEYS[2], 90000)
return 1`,
  check: `
local clock = redis.call('TIME')
local now = tonumber(clock[1]) * 1000 + math.floor(tonumber(clock[2]) / 1000)
if redis.call('GET', KEYS[3]) ~= ARGV[1] then return 0 end
local globalExpiry = redis.call('ZSCORE', KEYS[1], ARGV[2])
local userExpiry = redis.call('ZSCORE', KEYS[2], ARGV[2])
if not globalExpiry or not userExpiry then return 0 end
if tonumber(globalExpiry) <= now or tonumber(userExpiry) <= now then return 0 end
return 1`,
  release: `
if redis.call('GET', KEYS[3]) ~= ARGV[1] then return 0 end
redis.call('DEL', KEYS[3])
redis.call('ZREM', KEYS[1], ARGV[2])
redis.call('ZREM', KEYS[2], ARGV[2])
return 1`,
} as const;

type Lease = {
  generationId: string;
  userId: string;
  token: string;
  keys: [string, string, string];
  startedAt: number;
  deadlineAt: number;
};

const SUMMARY_SELECT = {
  id: true,
  outcome: true,
  provider: true,
  model: true,
  attemptCount: true,
  measuredAttemptCount: true,
  promptTokens: true,
  completionTokens: true,
  totalTokens: true,
  usageCoverage: true,
} as const;

type SummaryRow = {
  id: string;
  outcome: string;
  provider: string | null;
  model: string | null;
  attemptCount: number;
  measuredAttemptCount: number;
  promptTokens: bigint | null;
  completionTokens: bigint | null;
  totalTokens: bigint | null;
  usageCoverage: string;
};

@Injectable()
export class AiExecutionLedgerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  async begin(
    userId: string,
    task: AiExecutionTask,
    metadata: AiExecutionMetadata = {},
  ): Promise<AiExecutionContext> {
    this.identifier(userId, 'actor', 128);
    if (!AI_EXECUTION_TASKS.includes(task)) {
      throw new BadRequestException('Unsupported AI execution task.');
    }
    const connectionId = this.identifier(
      metadata.connectionId,
      'connection',
      128,
    );
    const database = this.identifier(metadata.database, 'database', 256, true);
    const requestedModel = this.identifier(
      metadata.requestedModel,
      'model',
      200,
    );
    const startedAt = Date.now();
    if (
      metadata.deadlineAt !== undefined &&
      (!Number.isFinite(metadata.deadlineAt) ||
        metadata.deadlineAt <= startedAt)
    ) {
      throw this.deadlineError();
    }
    const deadlineAt = Math.min(
      startedAt + MAX_LEASE_MS,
      metadata.deadlineAt ?? startedAt + MAX_LEASE_MS,
    );
    const generationId = randomUUID();
    const userNamespace = createHash('sha256').update(userId).digest('hex');
    const lease: Lease = {
      generationId,
      userId,
      token: randomUUID(),
      keys: [
        'ai:{ai-execution}:leases:global',
        `ai:{ai-execution}:leases:user:${userNamespace}`,
        `ai:{ai-execution}:lease:${generationId}`,
      ],
      startedAt,
      deadlineAt,
    };

    // Explicit allowlist: extra runtime properties of metadata never reach storage.
    await this.prisma.aiGeneration.create({
      data: {
        id: generationId,
        userId,
        task,
        connectionId,
        database,
        requestedModel,
        deadlineAt: new Date(deadlineAt),
      },
    });
    try {
      this.assertDeadline(lease);
      const globalLimit = this.limit(
        'AI_EXECUTION_GLOBAL_CONCURRENCY',
        32,
        128,
      );
      const userLimit = Math.min(
        globalLimit,
        this.limit('AI_EXECUTION_PER_USER_CONCURRENCY', 2, 8),
      );
      const admitted = await this.evalLease(
        AI_EXECUTION_LEASE_SCRIPTS.acquire,
        lease,
        Math.max(1, Math.floor(deadlineAt - Date.now())),
        userLimit,
        globalLimit,
      );
      if (admitted === 0 || admitted === -1) {
        throw new HttpException(
          'AI operational concurrency is busy. Retry after an active request ends.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      if (admitted !== 1) {
        throw new ServiceUnavailableException(
          'AI lease could not be reserved.',
        );
      }
      this.assertDeadline(lease);
    } catch (error) {
      try {
        await this.prisma.aiGeneration.updateMany({
          where: { id: generationId, userId, outcome: 'running' },
          data: {
            outcome: 'rejected',
            completedAt: new Date(),
            latencyMs: Math.max(0, Date.now() - startedAt),
          },
        });
      } finally {
        // Admission may have committed even if its response was lost. TTL is the
        // final safety net when the storage failure also prevents this cleanup.
        await this.releaseLease(lease).catch(() => undefined);
      }
      throw error;
    }
    return this.context(lease);
  }

  async feedback(
    userId: string,
    generationId: string,
    rating: AiFeedbackRating,
  ): Promise<{ generationId: string; rating: AiFeedbackRating }> {
    this.identifier(userId, 'actor', 128);
    this.identifier(generationId, 'generation', 128);
    if (rating !== 'up' && rating !== 'down') {
      throw new BadRequestException('Invalid AI feedback rating.');
    }
    return this.prisma.$transaction(async (tx) => {
      const owned = await tx.aiGeneration.findFirst({
        where: { id: generationId, userId },
        select: { id: true },
      });
      if (!owned) throw new NotFoundException('AI generation not found.');
      await tx.aiGenerationFeedback.upsert({
        where: { generationId_userId: { generationId, userId } },
        create: { generationId, userId, rating },
        update: { rating },
      });
      // Never acknowledge before the transaction has durably committed.
      return { generationId, rating };
    });
  }

  private context(lease: Lease): AiExecutionContext {
    let stopped = false;
    let tail: Promise<unknown> = Promise.resolve();
    let releasePending: Promise<void> | undefined;
    const serial = <T>(operation: () => Promise<T>): Promise<T> => {
      const result = tail.then(operation);
      tail = result.catch(() => undefined);
      return result;
    };
    const release = () => {
      stopped = true;
      return (releasePending ??= this.releaseLease(lease).catch((error) => {
        releasePending = undefined;
        throw error;
      }));
    };
    const finalize = (
      outcome: 'succeeded' | AiExecutionFailure,
      result?: AiExecutionResultMetadata,
    ) =>
      serial(async () => {
        stopped = true;
        try {
          return await this.finalize(lease, outcome, result);
        } finally {
          await release();
        }
      });

    return {
      generationId: lease.generationId,
      deadlineAt: lease.deadlineAt,
      beforeAttempt: (plan) =>
        serial(async () => {
          if (stopped) throw new ConflictException('AI execution is closed.');
          this.assertDeadline(lease);
          if (
            (await this.evalLease(AI_EXECUTION_LEASE_SCRIPTS.check, lease)) !==
            1
          ) {
            throw new ServiceUnavailableException(
              'AI execution lease is unavailable.',
            );
          }
          if (stopped) throw new ConflictException('AI execution is closed.');
          this.assertDeadline(lease);
          const attemptId = await this.reserveAttempt(lease, plan);
          // Persistence can consume the remaining deadline or outlive a lost
          // lease. Recheck immediately before returning the dispatch capability.
          if (stopped) throw new ConflictException('AI execution is closed.');
          this.assertDeadline(lease);
          if (
            (await this.evalLease(AI_EXECUTION_LEASE_SCRIPTS.check, lease)) !==
            1
          ) {
            throw new ServiceUnavailableException(
              'AI execution lease is unavailable.',
            );
          }
          this.assertDeadline(lease);
          const finish = (
            outcome: 'succeeded' | AiExecutionFailure,
            result?: AiExecutionAttemptResult,
          ) =>
            serial(() => this.finishAttempt(lease, attemptId, outcome, result));
          return {
            attemptId,
            complete: (result) => finish('succeeded', result),
            fail: (outcome = 'failed', result) => finish(outcome, result),
          } satisfies AiExecutionAttempt;
        }),
      complete: (result) => finalize('succeeded', result),
      fail: (outcome = 'failed') => finalize(outcome),
      release: () => {
        stopped = true;
        return serial(release);
      },
    };
  }

  private async reserveAttempt(lease: Lease, plan: AiExecutionAttemptPlan) {
    const plannedProvider = this.identifier(plan.provider, 'provider', 64);
    const plannedModel = this.identifier(plan.model, 'model', 200);
    if (!plannedProvider || !plannedModel) {
      throw new BadRequestException(
        'AI attempt provider and model are required.',
      );
    }
    const attemptId = randomUUID();
    const maxAttempts = this.limit(
      'AI_EXECUTION_MAX_ATTEMPTS',
      MAX_ATTEMPTS,
      MAX_ATTEMPTS,
    );
    await this.prisma.$transaction(async (tx) => {
      const reserved = await tx.aiGeneration.updateMany({
        where: {
          id: lease.generationId,
          userId: lease.userId,
          outcome: 'running',
          deadlineAt: { gt: new Date() },
          attemptCount: { lt: maxAttempts },
        },
        data: { attemptCount: { increment: 1 } },
      });
      if (reserved.count !== 1) {
        throw new ConflictException(
          'AI execution is closed or its finite attempt bound was reached.',
        );
      }
      const generation = await tx.aiGeneration.findUniqueOrThrow({
        where: { id: lease.generationId },
        select: { attemptCount: true },
      });
      await tx.aiProviderAttempt.create({
        data: {
          id: attemptId,
          generationId: lease.generationId,
          ordinal: generation.attemptCount,
          plannedProvider,
          plannedModel,
        },
      });
    });
    return attemptId;
  }

  private async finishAttempt(
    lease: Lease,
    attemptId: string,
    outcome: 'succeeded' | AiExecutionFailure,
    result: AiExecutionAttemptResult = {},
  ) {
    this.assertOutcome(outcome);
    const provider = this.identifier(result.provider, 'provider', 64);
    const model = this.identifier(result.model, 'model', 200);
    const counter = (value: unknown): number | null =>
      typeof value === 'number' &&
      Number.isInteger(value) &&
      value >= 0 &&
      value <= MAX_TOKEN_COUNT
        ? value
        : null;
    const promptTokens = counter(result.usage?.promptTokens);
    const completionTokens = counter(result.usage?.completionTokens);
    const totalTokens = counter(result.usage?.totalTokens);
    const counts = [promptTokens, completionTokens, totalTokens];
    const usageCoverage: AiUsageCoverage = counts.every(
      (value) => value !== null,
    )
      ? 'complete'
      : counts.some((value) => value !== null)
        ? 'partial'
        : 'unavailable';
    await this.prisma.aiProviderAttempt.updateMany({
      where: {
        id: attemptId,
        generationId: lease.generationId,
        outcome: 'running',
      },
      data: {
        outcome,
        provider,
        model,
        promptTokens,
        completionTokens,
        totalTokens,
        usageCoverage,
        completedAt: new Date(),
      },
    });
  }

  private async finalize(
    lease: Lease,
    outcome: 'succeeded' | AiExecutionFailure,
    result: AiExecutionResultMetadata = {},
  ): Promise<AiExecutionSummary> {
    this.assertOutcome(outcome);
    const provider = this.identifier(result.provider, 'provider', 64);
    const model = this.identifier(result.model, 'model', 200);
    const row = await this.prisma.$transaction(async (tx) => {
      // A conditional write takes the generation row lock before reading its
      // attempts. Admission increments the same row; first terminal outcome wins.
      const changed = await tx.aiGeneration.updateMany({
        where: {
          id: lease.generationId,
          userId: lease.userId,
          outcome: 'running',
        },
        data: {
          outcome,
          completedAt: new Date(),
          latencyMs: Math.max(0, Date.now() - lease.startedAt),
        },
      });
      if (changed.count === 1) {
        await tx.aiProviderAttempt.updateMany({
          where: { generationId: lease.generationId, outcome: 'running' },
          data: {
            outcome: outcome === 'succeeded' ? 'failed' : outcome,
            completedAt: new Date(),
          },
        });
        const attempts = await tx.aiProviderAttempt.findMany({
          where: { generationId: lease.generationId },
          orderBy: { ordinal: 'asc' },
          select: {
            provider: true,
            model: true,
            promptTokens: true,
            completionTokens: true,
            totalTokens: true,
            usageCoverage: true,
          },
        });
        const sum = (
          key: 'promptTokens' | 'completionTokens' | 'totalTokens',
        ) => {
          const values = attempts
            .map((attempt) => attempt[key])
            .filter((value) => value !== null);
          return values.length
            ? values.reduce((total, value) => total + BigInt(value), 0n)
            : null;
        };
        const measuredAttemptCount = attempts.filter(
          (attempt) => attempt.usageCoverage !== 'unavailable',
        ).length;
        const usageCoverage: AiUsageCoverage =
          attempts.length &&
          attempts.every((attempt) => attempt.usageCoverage === 'complete')
            ? 'complete'
            : measuredAttemptCount
              ? 'partial'
              : 'unavailable';
        const lastActual = [...attempts]
          .reverse()
          .find((attempt) => attempt.provider || attempt.model);
        await tx.aiGeneration.update({
          where: { id: lease.generationId },
          data: {
            provider: provider ?? lastActual?.provider ?? null,
            model: model ?? lastActual?.model ?? null,
            attemptCount: attempts.length,
            measuredAttemptCount,
            promptTokens: sum('promptTokens'),
            completionTokens: sum('completionTokens'),
            totalTokens: sum('totalTokens'),
            usageCoverage,
          },
        });
      }
      return tx.aiGeneration.findUniqueOrThrow({
        where: { id: lease.generationId },
        select: SUMMARY_SELECT,
      });
    });
    return this.summary(row);
  }

  private summary(row: SummaryRow): AiExecutionSummary {
    const usage = [
      row.promptTokens,
      row.completionTokens,
      row.totalTokens,
    ].some((value) => value !== null)
      ? {
          promptTokens:
            row.promptTokens === null ? null : Number(row.promptTokens),
          completionTokens:
            row.completionTokens === null ? null : Number(row.completionTokens),
          totalTokens:
            row.totalTokens === null ? null : Number(row.totalTokens),
        }
      : null;
    return {
      generationId: row.id,
      outcome: row.outcome as AiExecutionOutcome,
      provider: row.provider,
      model: row.model,
      attemptCount: row.attemptCount,
      measuredAttemptCount: row.measuredAttemptCount,
      usageCoverage: row.usageCoverage as AiUsageCoverage,
      usage,
      costCoverage: 'unavailable',
    };
  }

  private async evalLease(
    script: string,
    lease: Lease,
    ...args: number[]
  ): Promise<number> {
    try {
      const client = this.redis.getClient();
      if (!client || client.status !== 'ready') {
        throw new Error('Lease storage not ready');
      }
      const result = await client.eval(
        script,
        3,
        ...lease.keys,
        lease.token,
        lease.generationId,
        ...args,
      );
      if (typeof result !== 'number') throw new Error('Invalid lease response');
      return result;
    } catch {
      throw new ServiceUnavailableException('AI lease storage is unavailable.');
    }
  }

  private async releaseLease(lease: Lease) {
    const result = await this.evalLease(
      AI_EXECUTION_LEASE_SCRIPTS.release,
      lease,
    );
    if (result !== 0 && result !== 1) {
      throw new ServiceUnavailableException('AI lease could not be released.');
    }
  }

  private limit(key: string, fallback: number, cap: number) {
    const configured = this.config.get<number | string>(key);
    const value = Number(configured);
    return Number.isInteger(value) && value > 0
      ? Math.min(cap, value)
      : fallback;
  }

  private identifier(
    value: unknown,
    label: string,
    maxLength: number,
    allowSpaces = false,
  ): string | undefined {
    if (value === undefined || value === null) return undefined;
    if (
      typeof value !== 'string' ||
      !value.length ||
      value.length > maxLength ||
      (allowSpaces
        ? [...value].some((character) => {
            const code = character.charCodeAt(0);
            return code <= 0x1f || code === 0x7f;
          })
        : !/^[A-Za-z0-9][A-Za-z0-9._/:@-]*$/.test(value))
    ) {
      throw new BadRequestException(`Invalid AI ${label} metadata.`);
    }
    return value;
  }

  private assertOutcome(outcome: string) {
    if (!['succeeded', 'failed', 'cancelled', 'timed_out'].includes(outcome)) {
      throw new BadRequestException('Invalid AI execution outcome.');
    }
  }

  private assertDeadline(lease: Lease) {
    if (Date.now() >= lease.deadlineAt) throw this.deadlineError();
  }

  private deadlineError() {
    return new HttpException(
      'AI execution deadline expired.',
      HttpStatus.REQUEST_TIMEOUT,
    );
  }
}
