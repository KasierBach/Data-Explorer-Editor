import { ForbiddenException, Injectable, Logger, NotFoundException, OnModuleInit, Inject } from '@nestjs/common';
import { EventEmitter } from 'events';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { ConnectionsService } from '../connections/connections.service';
import { DatabaseStrategyFactory, ConnectionConfig, FullTableMetadata } from '../database-strategies';
import { StartMigrationDto } from './dto/start-migration.dto';
import { getErrorMessage } from '../common/utils/error.util';
import { MigrationComparisonService } from './migration-comparison.service';
import {
  type MigrationConnection,
  type MigrationStage,
  type MigrationJob,
  type StoredMigrationJob,
  type MigrationProgress,
  type MigrationStream,
  type ResolvedMigrationContext,
  type MigrationColumnDiff,
  type MigrationIndexDiff,
  type MigrationReviewSummary,
} from './migration.types';

// Re-export types for backward compatibility with consumers
export type { MigrationStage, MigrationJob, MigrationColumnDiff, MigrationIndexDiff, MigrationReviewSummary };

@Injectable()
export class MigrationService {
  private readonly logger = new Logger(MigrationService.name);
  public readonly eventEmitter = new EventEmitter();

  constructor(
    private connectionsService: ConnectionsService,
    private dbStrategiesFactory: DatabaseStrategyFactory,
    private comparisonService: MigrationComparisonService,
    @InjectQueue('migration') private migrationQueue: Queue,
  ) { }

  async onModuleInit() {
    this.logger.log('Migration service initialized with BullMQ.');
  }

  async startMigration(userId: string, dto: StartMigrationDto): Promise<{ jobId: string }> {
    const job = await this.migrationQueue.add(
      'migration-job',
      { userId, dto },
      {
        removeOnComplete: false,
        removeOnFail: false,
        attempts: 1,
      }
    );

    if (!job.id) throw new Error('Failed to create migration job ID');

    this.logger.log(`Migration job ${job.id} queued by user ${userId}`);
    return { jobId: job.id };
  }

  async assertJobOwnership(jobId: string, userId: string): Promise<Job> {
    const job = await this.migrationQueue.getJob(jobId);
    if (!job) {
      throw new NotFoundException('Job not found.');
    }
    if (job.data.userId !== userId) {
      throw new ForbiddenException('You do not have access to this migration job.');
    }
    return job;
  }

  async getPublicJob(jobId: string, userId: string): Promise<MigrationJob> {
    const job = await this.assertJobOwnership(jobId, userId);

    const state = await job.getState();
    const progress = job.progress as MigrationProgress | undefined;

    return {
      id: job.id!,
      status: this.mapBullStatus(state),
      stage: progress?.stage || (state === 'waiting' || state === 'delayed' ? 'queued' : 'streaming'),
      processedRows: progress?.processedRows || 0,
      batchesProcessed: progress?.batchesProcessed || 0,
      error: job.failedReason,
    };
  }

  private mapBullStatus(state: string): MigrationJob['status'] {
    switch (state) {
      case 'completed': return 'completed';
      case 'failed': return 'failed';
      case 'active': return 'running';
      default: return 'pending';
    }
  }

  private async updateJob(jobId: string, updater: Partial<MigrationJob> | ((job: any) => void)) {
    const job = await this.migrationQueue.getJob(jobId);
    if (!job) return;

    let progress = (job.progress as any) || {};
    if (typeof progress.processedRows !== 'number') progress.processedRows = 0;
    if (typeof progress.batchesProcessed !== 'number') progress.batchesProcessed = 0;
    if (!progress.stage) progress.stage = 'streaming';

    if (typeof updater === 'function') {
      updater(progress);
    } else {
      Object.assign(progress, updater);
    }

    await job.updateProgress(progress);
    this.eventEmitter.emit(`migration-${jobId}`, {
      id: jobId,
      status: 'running',
      ...progress
    });
  }

  private async markStage(jobId: string, stage: MigrationStage, status?: MigrationJob['status']) {
    await this.updateJob(jobId, {
      stage,
      ...(status ? { status } : {}),
    });
  }

  private async failJob(jobId: string, error: string) {
    const job = await this.migrationQueue.getJob(jobId);
    if (job) await job.moveToFailed(new Error(error), 'token-if-needed');
  }

  /** No-op: BullMQ handles completion via worker return value automatically. */
  private async completeJob(_jobId: string) { }

  private buildMigrationConnectionConfig(conn: MigrationConnection): ConnectionConfig {
    return {
      host: conn.host,
      port: conn.port,
      username: conn.username,
      password: conn.password,
      database: conn.database,
      statementTimeout: 3600000, // 1 hour safety timeout
      queryTimeout: 3600000,
    };
  }

  private async resolveMigrationContext(userId: string, dto: StartMigrationDto, options: { jobId?: string; strict?: boolean } = {}): Promise<ResolvedMigrationContext> {
    const jobId = options.jobId;
    const strict = options.strict ?? true;

    if (this.comparisonService.sameMigrationEndpoint(dto)) {
      throw new Error('Source and target cannot point to the same table or collection.');
    }

    if (jobId) {
      await this.markStage(jobId, 'validating', 'running');
    }

    const rawSourceConn = await this.connectionsService.getDecryptedConnection(dto.sourceConnectionId, userId);
    const rawTargetConn = await this.connectionsService.getDecryptedConnection(dto.targetConnectionId, userId);

    if (!rawSourceConn || !rawTargetConn) {
      throw new Error('Source or target connection not found.');
    }

    const sourceConn: MigrationConnection = {
      ...rawSourceConn,
      type: rawSourceConn.type as import('./migration.types').ConnectionType,
    };
    const targetConn: MigrationConnection = {
      ...rawTargetConn,
      type: rawTargetConn.type as import('./migration.types').ConnectionType,
    };

    if (jobId) {
      await this.markStage(jobId, 'connecting');
    }

    const sourceStrategy = this.dbStrategiesFactory.getStrategy(sourceConn.type);
    const targetStrategy = this.dbStrategiesFactory.getStrategy(targetConn.type);
    const sourcePool = await sourceStrategy.createPool(this.buildMigrationConnectionConfig(sourceConn));
    const targetPool = await targetStrategy.createPool(this.buildMigrationConnectionConfig(targetConn));

    if (jobId) {
      await this.markStage(jobId, 'preflight');
    }

    const sourceSchema = this.comparisonService.normalizeSchemaName(sourceConn.type, dto.sourceSchema);
    const targetSchema = this.comparisonService.normalizeSchemaName(targetConn.type, dto.targetSchema);
    const sourceTable = this.comparisonService.normalizeTableName(dto.sourceTable);
    const targetTable = this.comparisonService.normalizeTableName(dto.targetTable);

    const sourceMetadata = await sourceStrategy.getFullMetadata(sourcePool, sourceSchema, sourceTable, sourceConn.database || undefined);

    if (!sourceMetadata?.columns || sourceMetadata.columns.length === 0) {
      throw new Error('Source table or collection could not be validated. Check schema, table name, and permissions.');
    }

    const targetMetadata = await targetStrategy.getFullMetadata(targetPool, targetSchema, targetTable, targetConn.database || undefined)
      .catch((error) => {
        if (strict) {
          throw error;
        }

        this.logger.warn(`Migration preview target metadata unavailable: ${getErrorMessage(error)}`);
        return { columns: [], indices: [], rowCount: undefined } as FullTableMetadata;
      });

    if (strict) {
      this.comparisonService.validateTargetCompatibility(sourceConn, targetConn, sourceMetadata, targetMetadata);
    }

    return {
      sourceConn,
      targetConn,
      sourceStrategy,
      targetStrategy,
      sourcePool,
      targetPool,
      sourceMetadata,
      targetMetadata,
    };
  }

  async previewMigration(userId: string, dto: StartMigrationDto): Promise<MigrationReviewSummary> {
    const context = await this.resolveMigrationContext(userId, dto, { strict: false });
    try {
      return this.comparisonService.buildMigrationReviewSummary(context, dto);
    } finally {
      await this.closeResources(context);
    }
  }

  private async closeResources(context?: Partial<ResolvedMigrationContext>) {
    if (context?.sourcePool && context?.sourceStrategy) {
      try {
        await context.sourceStrategy.closePool(context.sourcePool);
      } catch { }
    }
    if (context?.targetPool && context?.targetStrategy) {
      try {
        await context.targetStrategy.closePool(context.targetPool);
      } catch { }
    }
  }

  public async runMigrationPipeline(userId: string, jobId: string, dto: StartMigrationDto) {
    let context: Partial<ResolvedMigrationContext> | undefined;

    try {
      context = await this.resolveMigrationContext(userId, dto, { jobId, strict: true });
      await this.markStage(jobId, 'streaming');

      const rawStream = await context.sourceStrategy!.exportStream(
        context.sourcePool,
        this.comparisonService.normalizeSchemaName(context.sourceConn!.type, dto.sourceSchema),
        this.comparisonService.normalizeTableName(dto.sourceTable),
      );

      const stream = rawStream as MigrationStream;

      const BATCH_SIZE = 2000;
      let buffer: Record<string, unknown>[] = [];
      let isPaused = false;

      const flushBuffer = async () => {
        if (buffer.length === 0) return;

        const batch = buffer;
        buffer = [];

        await context!.targetStrategy!.importData(context!.targetPool, {
          schema: this.comparisonService.normalizeSchemaName(context!.targetConn!.type, dto.targetSchema),
          table: this.comparisonService.normalizeTableName(dto.targetTable),
          data: batch,
        });

        await this.updateJob(jobId, (job) => {
          job.processedRows += batch.length;
          job.batchesProcessed += 1;
        });

        this.logger.verbose(`Migration ${jobId}: flushed ${batch.length} rows`);
      };

      const handleChunk = async (chunk: Record<string, unknown>) => {
        buffer.push(chunk);
        if (buffer.length < BATCH_SIZE) return;

        if (typeof stream.pause === 'function' && !isPaused) {
          isPaused = true;
          stream.pause();
        }

        try {
          await flushBuffer();
        } catch (error) {
          if (error instanceof Error) {
            stream.emit('error', error);
          }
          return;
        }

        if (typeof stream.resume === 'function' && isPaused) {
          isPaused = false;
          stream.resume();
        }
      };

      const handleTerminalFailure = async (error: unknown) => {
        this.logger.error(`Stream error in migration ${jobId}`, error);
        const message = error instanceof Error ? error.message : 'Migration stream failed.';
        await this.failJob(jobId, message);
      };

      if (typeof stream.on === 'function') {
        const eventStream = stream as any;
        await new Promise<void>((resolve) => {
          let processing = Promise.resolve();
          let settled = false;

          const finish = () => {
            if (settled) return;
            settled = true;
            cleanup();
            resolve();
          };

          const enqueueChunk = (chunk: Record<string, unknown>) => {
            processing = processing.then(() => handleChunk(chunk));
            processing.catch((error) => {
              void handleTerminalFailure(error);
            });
          };

          const handleEnd = async () => {
            const currentJob = await this.migrationQueue.getJob(jobId);
            if (!currentJob) {
              finish();
              return;
            }

            const state = await currentJob.getState();
            if (state === 'failed') {
              finish();
              return;
            }

            try {
              await processing;
              await flushBuffer();
              const finalizedProgress = currentJob.progress as MigrationProgress | undefined;
              this.logger.log(`Migration ${jobId}: completed (${finalizedProgress?.processedRows || 0} rows)`);
              await this.completeJob(jobId);
            } catch (error) {
              await handleTerminalFailure(error);
            } finally {
              finish();
            }
          };

          const handleError = (error: unknown) => {
            void (async () => {
              await handleTerminalFailure(error);
              finish();
            })();
          };

          const cleanup = () => {
            eventStream.removeListener('data', enqueueChunk as (...args: unknown[]) => void);
            eventStream.removeListener('row', enqueueChunk as (...args: unknown[]) => void);
            eventStream.removeListener('end', handleEnd as (...args: unknown[]) => void);
            eventStream.removeListener('error', handleError as (...args: unknown[]) => void);
          };

          stream.on('data', enqueueChunk as (...args: unknown[]) => void);
          stream.on('row', enqueueChunk as (...args: unknown[]) => void);
          stream.on('end', handleEnd as (...args: unknown[]) => void);
          stream.on('error', handleError as (...args: unknown[]) => void);
        });
      } else {
        for await (const chunk of stream) {
          const currentJob = await this.migrationQueue.getJob(jobId);
          if (!currentJob) break;
          const state = await currentJob.getState();
          if (state === 'failed') break;
          await handleChunk(chunk as Record<string, unknown>);
        }

        const currentJob = await this.migrationQueue.getJob(jobId);
        if (currentJob) {
          const state = await currentJob.getState();
          if (state !== 'failed') {
            await flushBuffer();
            const finalizedProgress = currentJob.progress as MigrationProgress | undefined;
            this.logger.log(`Migration ${jobId}: completed (${finalizedProgress?.processedRows || 0} rows)`);
            await this.completeJob(jobId);
          }
        }
      }
    } catch (error) {
      this.logger.error(`Migration ${jobId} PIPELINE EXCEPTION`, error);
      const message = error instanceof Error ? error.message : 'Migration pipeline failed.';
      await this.failJob(jobId, message);
    } finally {
      await this.closeResources(context);
    }
  }

  private toPublicJob(job: StoredMigrationJob): MigrationJob {
    return {
      id: job.id,
      status: job.status,
      stage: job.stage,
      processedRows: job.processedRows,
      batchesProcessed: job.batchesProcessed,
      error: job.error,
    };
  }
}
