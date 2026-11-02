import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter } from 'events';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { ConnectionsService } from '../connections/connections.service';
import {
  DatabaseStrategyFactory,
  ConnectionConfig,
  FullTableMetadata,
} from '../database-strategies';
import { StartMigrationDto } from './dto/start-migration.dto';
import { getErrorMessage } from '../common/utils/error.util';
import { MigrationComparisonService } from './migration-comparison.service';
import { Permission } from '../permissions/enums/permission.enum';
import { FreshnessService } from '../common/freshness/freshness.service';
import {
  isRetryableMigrationBatchError,
  planMigrationBatchSizing,
  reduceMigrationBatchSize,
} from './migration-batch-sizing.util';
import {
  type MigrationConnection,
  type MigrationStage,
  type MigrationJob,
  type StoredMigrationJob,
  type MigrationStream,
  type ResolvedMigrationContext,
  type MigrationColumnDiff,
  type MigrationIndexDiff,
  type MigrationReviewSummary,
} from './migration.types';

// Re-export types for backward compatibility with consumers
export type {
  MigrationStage,
  MigrationJob,
  MigrationColumnDiff,
  MigrationIndexDiff,
  MigrationReviewSummary,
};

@Injectable()
export class MigrationService {
  private readonly logger = new Logger(MigrationService.name);
  public readonly eventEmitter = new EventEmitter();

  constructor(
    private connectionsService: ConnectionsService,
    private dbStrategiesFactory: DatabaseStrategyFactory,
    private comparisonService: MigrationComparisonService,
    @InjectQueue('migration') private migrationQueue: Queue,
    private readonly freshnessService: FreshnessService,
  ) {}

  async onModuleInit() {
    this.logger.log('Migration service initialized with BullMQ.');
  }

  async startMigration(
    userId: string,
    dto: StartMigrationDto,
  ): Promise<{ jobId: string }> {
    const job = await this.migrationQueue.add(
      'migration-job',
      { userId, dto },
      {
        removeOnComplete: false,
        removeOnFail: false,
        attempts: 1,
      },
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
      throw new ForbiddenException(
        'You do not have access to this migration job.',
      );
    }
    return job;
  }

  async getPublicJob(jobId: string, userId: string): Promise<MigrationJob> {
    const job = await this.assertJobOwnership(jobId, userId);

    const state = await job.getState();
    const progress = job.progress as Partial<MigrationJob> | undefined;

    return {
      id: job.id!,
      status:
        state === 'active' && progress?.status
          ? progress.status
          : this.mapBullStatus(state),
      stage:
        progress?.stage ||
        (state === 'waiting' || state === 'delayed' ? 'queued' : 'streaming'),
      processedRows: progress?.processedRows || 0,
      batchesProcessed: progress?.batchesProcessed || 0,
      error: job.failedReason || progress?.error,
    };
  }

  private mapBullStatus(state: string): MigrationJob['status'] {
    switch (state) {
      case 'completed':
        return 'completed';
      case 'failed':
        return 'failed';
      case 'active':
        return 'running';
      default:
        return 'pending';
    }
  }

  private async updateJob(
    jobId: string,
    updater: Partial<MigrationJob> | ((job: any) => void),
  ) {
    const job = await this.migrationQueue.getJob(jobId);
    if (!job) return;

    const progress = (job.progress as any) || {};
    if (typeof progress.processedRows !== 'number') progress.processedRows = 0;
    if (typeof progress.batchesProcessed !== 'number')
      progress.batchesProcessed = 0;
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
      ...progress,
    });
  }

  private async markStage(
    jobId: string,
    stage: MigrationStage,
    status?: MigrationJob['status'],
  ) {
    await this.updateJob(jobId, {
      stage,
      ...(status ? { status } : {}),
    });
  }

  private async failJob(jobId: string, error: string) {
    await this.updateJob(jobId, { status: 'failed', stage: 'failed', error });
  }

  private async completeJob(jobId: string) {
    await this.markStage(jobId, 'completed', 'completed');
  }

  private buildMigrationConnectionConfig(
    conn: MigrationConnection,
  ): ConnectionConfig {
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

  private async resolveMigrationContext(
    userId: string,
    dto: StartMigrationDto,
    options: { jobId?: string; strict?: boolean } = {},
  ): Promise<ResolvedMigrationContext> {
    const jobId = options.jobId;
    const strict = options.strict ?? true;

    if (this.comparisonService.sameMigrationEndpoint(dto)) {
      throw new Error(
        'Source and target cannot point to the same table or collection.',
      );
    }

    if (jobId) {
      await this.markStage(jobId, 'validating', 'running');
    }

    const rawSourceConn = await this.connectionsService.getDecryptedConnection(
      dto.sourceConnectionId,
      userId,
      Permission.READ,
    );
    const rawTargetConn = await this.connectionsService.getDecryptedConnection(
      dto.targetConnectionId,
      userId,
      Permission.WRITE,
    );

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

    const sourceStrategy = this.dbStrategiesFactory.getStrategy(
      sourceConn.type,
    );
    const targetStrategy = this.dbStrategiesFactory.getStrategy(
      targetConn.type,
    );
    const partialContext: Partial<ResolvedMigrationContext> = {
      sourceStrategy,
      targetStrategy,
    };
    try {
      const sourcePool = await sourceStrategy.createPool(
        this.buildMigrationConnectionConfig(sourceConn),
      );
      partialContext.sourcePool = sourcePool;
      const targetPool = await targetStrategy.createPool(
        this.buildMigrationConnectionConfig(targetConn),
      );
      partialContext.targetPool = targetPool;

      if (jobId) {
        await this.markStage(jobId, 'preflight');
      }

      const sourceSchema = this.comparisonService.normalizeSchemaName(
        sourceConn.type,
        dto.sourceSchema,
      );
      const targetSchema = this.comparisonService.normalizeSchemaName(
        targetConn.type,
        dto.targetSchema,
      );
      const sourceTable = this.comparisonService.normalizeTableName(
        dto.sourceTable,
      );
      const targetTable = this.comparisonService.normalizeTableName(
        dto.targetTable,
      );

      const sourceMetadata = await sourceStrategy.getFullMetadata(
        sourcePool,
        sourceSchema,
        sourceTable,
        sourceConn.database || undefined,
      );

      if (!sourceMetadata?.columns || sourceMetadata.columns.length === 0) {
        throw new Error(
          'Source table or collection could not be validated. Check schema, table name, and permissions.',
        );
      }

      const targetMetadata = await targetStrategy
        .getFullMetadata(
          targetPool,
          targetSchema,
          targetTable,
          targetConn.database || undefined,
        )
        .catch((error) => {
          if (strict) {
            throw error;
          }

          this.logger.warn(
            `Migration preview target metadata unavailable: ${getErrorMessage(error)}`,
          );
          return {
            columns: [],
            indices: [],
            rowCount: undefined,
          } as FullTableMetadata;
        });

      if (strict) {
        this.comparisonService.validateTargetCompatibility(
          sourceConn,
          targetConn,
          sourceMetadata,
          targetMetadata,
        );
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
    } catch (error) {
      await this.closeResources(partialContext);
      throw error;
    }
  }

  async previewMigration(
    userId: string,
    dto: StartMigrationDto,
  ): Promise<MigrationReviewSummary> {
    const context = await this.resolveMigrationContext(userId, dto, {
      strict: false,
    });
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
      } catch {
        // Best-effort cleanup.
      }
    }
    if (context?.targetPool && context?.targetStrategy) {
      try {
        await context.targetStrategy.closePool(context.targetPool);
      } catch {
        // Best-effort cleanup.
      }
    }
  }

  public async runMigrationPipeline(
    userId: string,
    jobId: string,
    dto: StartMigrationDto,
  ) {
    let context: Partial<ResolvedMigrationContext> | undefined;

    try {
      const job = await this.assertJobOwnership(jobId, userId);
      const previousProgress = job.progress as
        | Partial<MigrationJob>
        | undefined;
      // shortcut: transfer has no resume checkpoint; a stalled/retried job must never append twice.
      if (previousProgress?.stage && previousProgress.stage !== 'queued') {
        throw new Error(
          'Interrupted migrations cannot be restarted safely. Inspect the target before starting a new transfer.',
        );
      }
      context = await this.resolveMigrationContext(userId, dto, {
        jobId,
        strict: true,
      });
      await this.markStage(jobId, 'streaming');

      const rawStream = await context.sourceStrategy!.exportStream(
        context.sourcePool,
        this.comparisonService.normalizeSchemaName(
          context.sourceConn!.type,
          dto.sourceSchema,
        ),
        this.comparisonService.normalizeTableName(dto.sourceTable),
      );

      const stream = rawStream as MigrationStream;

      let batchPlan = planMigrationBatchSizing({
        targetType: context.targetConn!.type,
        columnCount: context.sourceMetadata!.columns.length,
      });
      let currentBatchSize = batchPlan.recommendedBatchSize;
      let batchPlanHydrated = false;
      let buffer: Record<string, unknown>[] = [];
      let failed = false;

      const hydrateBatchPlan = (sampleRow: Record<string, unknown>) => {
        if (batchPlanHydrated) return;

        batchPlan = planMigrationBatchSizing({
          targetType: context!.targetConn!.type,
          columnCount: context!.sourceMetadata!.columns.length,
          sampleRow,
        });
        currentBatchSize = batchPlan.recommendedBatchSize;
        batchPlanHydrated = true;
      };

      const flushBuffer = async () => {
        if (buffer.length === 0) return;

        const pendingRows = buffer;
        buffer = [];

        let cursor = 0;
        while (cursor < pendingRows.length) {
          const remainingRows = pendingRows.slice(cursor);
          let attemptSize = Math.min(currentBatchSize, remainingRows.length);

          while (true) {
            if (failed) return;
            const batch = remainingRows.slice(0, attemptSize);
            let imported: { success: boolean; rowCount: number };
            try {
              imported = await context!.targetStrategy!.importData(
                context!.targetPool,
                {
                  schema: this.comparisonService.normalizeSchemaName(
                    context!.targetConn!.type,
                    dto.targetSchema,
                  ),
                  table: this.comparisonService.normalizeTableName(
                    dto.targetTable,
                  ),
                  data: batch,
                },
              );
            } catch (error) {
              await this.freshnessService.invalidatePartialWrite(
                error,
                dto.targetConnectionId,
                context!.targetConn!.database,
              );
              if (
                !isRetryableMigrationBatchError(error) ||
                attemptSize <= batchPlan.minimumBatchSize
              ) {
                throw error;
              }

              const reducedBatchSize = reduceMigrationBatchSize(
                attemptSize,
                batchPlan.minimumBatchSize,
              );

              this.logger.warn(
                `Migration ${jobId}: reducing batch size from ${attemptSize} to ${reducedBatchSize} after import failure (${getErrorMessage(error)})`,
              );

              attemptSize = reducedBatchSize;
              currentBatchSize = reducedBatchSize;
              continue;
            }
            if (
              Number.isInteger(imported.rowCount) &&
              imported.rowCount > 0 &&
              imported.rowCount <= batch.length
            ) {
              await this.updateJob(jobId, (job) => {
                job.processedRows += imported.rowCount;
                job.batchesProcessed += 1;
              });
            }
            if (imported.rowCount > 0) {
              await this.freshnessService.invalidateConnection(
                dto.targetConnectionId,
                context!.targetConn!.database,
              );
            }
            if (
              imported.success === false ||
              imported.rowCount !== batch.length
            ) {
              throw new Error(
                `Target imported ${imported.rowCount} of ${batch.length} rows. Inspect the target before starting another transfer.`,
              );
            }
            this.logger.verbose(
              `Migration ${jobId}: flushed ${batch.length} rows (batch size ${attemptSize})`,
            );
            currentBatchSize = Math.max(
              batchPlan.minimumBatchSize,
              attemptSize,
            );
            cursor += batch.length;
            break;
          }
        }
      };

      const handleChunk = async (chunk: Record<string, unknown>) => {
        hydrateBatchPlan(chunk);
        buffer.push(chunk);
        if (buffer.length < currentBatchSize) return;

        await flushBuffer();
      };

      if (typeof stream.on === 'function') {
        const eventStream = stream as any;
        await new Promise<void>((resolve, reject) => {
          let processing = Promise.resolve();
          let settled = false;
          let ended = false;

          const finish = (error?: Error) => {
            if (settled) return;
            settled = true;
            cleanup();
            if (error) reject(error);
            else resolve();
          };

          const handleError = (error: unknown) => {
            if (failed || settled) return;
            failed = true;
            eventStream.pause?.();
            eventStream.destroy?.();
            // Drain the in-flight write before pools close; queued chunks never start after failure.
            void processing
              .catch(() => {})
              .then(() =>
                finish(
                  error instanceof Error
                    ? error
                    : new Error(
                        typeof error === 'string'
                          ? error
                          : 'Migration pipeline failed.',
                      ),
                ),
              );
          };

          const enqueueChunk = (chunk: Record<string, unknown>) => {
            eventStream.pause?.();
            processing = processing.then(() =>
              failed ? undefined : handleChunk(chunk),
            );
            void processing.then(() => {
              if (!failed && !ended) eventStream.resume?.();
            }, handleError);
          };

          const handleEnd = () => {
            ended = true;
            processing = processing.then(() =>
              failed ? undefined : flushBuffer(),
            );
            void processing.then(() => {
              if (!failed) finish();
            }, handleError);
          };
          const handleClose = () => {
            if (!ended)
              handleError(
                new Error('Migration source stream closed before end.'),
              );
          };

          const cleanup = () => {
            eventStream.removeListener(
              'data',
              enqueueChunk as (...args: unknown[]) => void,
            );
            eventStream.removeListener(
              'row',
              enqueueChunk as (...args: unknown[]) => void,
            );
            eventStream.removeListener(
              'end',
              handleEnd as (...args: unknown[]) => void,
            );
            eventStream.removeListener(
              'error',
              handleError as (...args: unknown[]) => void,
            );
            eventStream.removeListener('close', handleClose);
          };

          stream.on('error', handleError as (...args: unknown[]) => void);
          stream.on('close', handleClose);
          stream.on('end', handleEnd as (...args: unknown[]) => void);
          stream.on('row', enqueueChunk as (...args: unknown[]) => void);
          stream.on('data', enqueueChunk as (...args: unknown[]) => void);
          if (eventStream.destroyed && !eventStream.readableEnded)
            handleClose();
        });
      } else {
        for await (const chunk of stream) {
          await handleChunk(chunk);
        }
        await flushBuffer();
      }
      await this.completeJob(jobId);
    } catch (error) {
      this.logger.error(`Migration ${jobId} PIPELINE EXCEPTION`, error);
      const message =
        error instanceof Error ? error.message : 'Migration pipeline failed.';
      await this.failJob(jobId, message);
      throw error instanceof Error ? error : new Error(message);
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
