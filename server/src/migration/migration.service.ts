import {
  BadRequestException,
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
  type MigrationEndpointSnapshot,
  type MigrationEndpointSnapshots,
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

  private normalizeMigrationDto(dto: StartMigrationDto): StartMigrationDto {
    const sourceConnectionId = dto.sourceConnectionId?.trim();
    const targetConnectionId = dto.targetConnectionId?.trim();
    if (!sourceConnectionId || !targetConnectionId) {
      throw new BadRequestException(
        'Migration connection IDs must not be empty.',
      );
    }
    return {
      sourceConnectionId,
      targetConnectionId,
      sourceSchema: dto.sourceSchema?.trim() || '',
      targetSchema: dto.targetSchema?.trim() || '',
      sourceTable: this.comparisonService.normalizeTableName(dto.sourceTable),
      targetTable: this.comparisonService.normalizeTableName(dto.targetTable),
    };
  }

  private snapshotMigrationEndpoint(
    connection: MigrationConnection,
  ): MigrationEndpointSnapshot {
    return Object.freeze({
      id: connection.id,
      type: connection.type,
      host: connection.host,
      port: connection.port,
      database: connection.database,
    });
  }

  private assertMigrationEndpointUnchanged(
    expected: MigrationEndpointSnapshot,
    actual: {
      id: string;
      type: string;
      host?: string | null;
      port?: number | null;
      database?: string | null;
    },
  ): void {
    if (
      expected.id !== actual.id ||
      expected.type !== actual.type ||
      expected.host !== actual.host ||
      expected.port !== actual.port ||
      expected.database !== actual.database
    ) {
      throw new ForbiddenException(
        'Migration endpoint changed after authorization. Start a new migration after reviewing the connection.',
      );
    }
  }

  private async authorizeMigrationEndpoints(
    userId: string,
    dto: StartMigrationDto,
    endpoints?: MigrationEndpointSnapshots,
  ) {
    const normalizedDto = this.normalizeMigrationDto(dto);
    const sourceConn = await this.connectionsService.getMigrationConnection(
      normalizedDto.sourceConnectionId,
      userId,
      {
        permission: Permission.READ,
        database: endpoints?.source.database,
        schema: normalizedDto.sourceSchema,
        write: false,
      },
    );
    const targetConn = await this.connectionsService.getMigrationConnection(
      normalizedDto.targetConnectionId,
      userId,
      {
        permission: Permission.WRITE,
        database: endpoints?.target.database,
        schema: normalizedDto.targetSchema,
        write: true,
      },
    );

    if (!sourceConn || !targetConn) {
      throw new Error('Source or target connection not found.');
    }

    for (const connection of [sourceConn, targetConn]) {
      if (
        (connection.type === 'postgres' || connection.type === 'cockroach') &&
        !connection.database?.trim()
      ) {
        throw new BadRequestException(
          'An explicit database is required for PostgreSQL/CockroachDB migrations; connection defaults are not inferred.',
        );
      }
    }
    if (endpoints) {
      this.assertMigrationEndpointUnchanged(endpoints.source, sourceConn);
      this.assertMigrationEndpointUnchanged(endpoints.target, targetConn);
    }
    const canonicalDto = Object.freeze({
      ...normalizedDto,
      sourceSchema: this.comparisonService.normalizeSchemaName(
        sourceConn.type,
        normalizedDto.sourceSchema,
        sourceConn.database,
      ),
      targetSchema: this.comparisonService.normalizeSchemaName(
        targetConn.type,
        normalizedDto.targetSchema,
        targetConn.database,
      ),
    });
    if (
      this.comparisonService.sameMigrationEndpoint(
        canonicalDto,
        sourceConn.type,
        targetConn.type,
        sourceConn as MigrationConnection,
        targetConn as MigrationConnection,
      )
    ) {
      throw new Error(
        'Source and target cannot point to the same table or collection.',
      );
    }

    return { sourceConn, targetConn, dto: canonicalDto };
  }

  private async reauthorizeMigrationContext(
    userId: string,
    context: Pick<
      ResolvedMigrationContext,
      'dto' | 'sourceConn' | 'targetConn'
    >,
  ): Promise<void> {
    const { dto, sourceConn, targetConn } = context;
    // Recheck current policy against the databases of the already-created pools,
    // never a newly configured default database or a caller-mutated DTO.
    const currentSource = await this.connectionsService.getMigrationConnection(
      dto.sourceConnectionId,
      userId,
      {
        permission: Permission.READ,
        database: sourceConn.database,
        schema: dto.sourceSchema,
        write: false,
      },
    );
    const currentTarget = await this.connectionsService.getMigrationConnection(
      dto.targetConnectionId,
      userId,
      {
        permission: Permission.WRITE,
        database: targetConn.database,
        schema: dto.targetSchema,
        write: true,
      },
    );
    this.assertMigrationEndpointUnchanged(
      this.snapshotMigrationEndpoint(sourceConn),
      currentSource,
    );
    this.assertMigrationEndpointUnchanged(
      this.snapshotMigrationEndpoint(targetConn),
      currentTarget,
    );
  }

  async startMigration(
    userId: string,
    dto: StartMigrationDto,
  ): Promise<{ jobId: string }> {
    const {
      dto: canonicalDto,
      sourceConn,
      targetConn,
    } = await this.authorizeMigrationEndpoints(userId, dto);
    const endpoints = Object.freeze({
      source: this.snapshotMigrationEndpoint(sourceConn as MigrationConnection),
      target: this.snapshotMigrationEndpoint(targetConn as MigrationConnection),
    });

    const job = await this.migrationQueue.add(
      'migration-job',
      { userId, dto: canonicalDto, endpoints },
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
    options: {
      jobId?: string;
      strict?: boolean;
      endpoints?: MigrationEndpointSnapshots;
    } = {},
  ): Promise<ResolvedMigrationContext> {
    const jobId = options.jobId;
    const strict = options.strict ?? true;

    if (jobId) {
      await this.markStage(jobId, 'validating', 'running');
    }

    const {
      sourceConn: rawSourceConn,
      targetConn: rawTargetConn,
      dto: canonicalDto,
    } = await this.authorizeMigrationEndpoints(userId, dto, options.endpoints);

    if (jobId) {
      await this.markStage(jobId, 'connecting');
    }

    const sourceConn: MigrationConnection = {
      ...rawSourceConn,
      type: rawSourceConn.type as import('./migration.types').ConnectionType,
    };
    const targetConn: MigrationConnection = {
      ...rawTargetConn,
      type: rawTargetConn.type as import('./migration.types').ConnectionType,
    };

    const sourceStrategy = this.dbStrategiesFactory.getStrategy(
      sourceConn.type,
    );
    const targetStrategy = this.dbStrategiesFactory.getStrategy(
      targetConn.type,
    );
    const endpointContext = { dto: canonicalDto, sourceConn, targetConn };
    const partialContext: Partial<ResolvedMigrationContext> = {
      ...endpointContext,
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

      await this.reauthorizeMigrationContext(userId, endpointContext);
      const sourceMetadata = await sourceStrategy.getFullMetadata(
        sourcePool,
        canonicalDto.sourceSchema,
        canonicalDto.sourceTable,
        sourceConn.database || undefined,
      );

      if (!sourceMetadata?.columns || sourceMetadata.columns.length === 0) {
        throw new Error(
          'Source table or collection could not be validated. Check schema, table name, and permissions.',
        );
      }

      await this.reauthorizeMigrationContext(userId, endpointContext);
      const targetMetadata = await targetStrategy
        .getFullMetadata(
          targetPool,
          canonicalDto.targetSchema,
          canonicalDto.targetTable,
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

      await this.reauthorizeMigrationContext(userId, endpointContext);
      if (strict) {
        this.comparisonService.validateTargetCompatibility(
          sourceConn,
          targetConn,
          sourceMetadata,
          targetMetadata,
        );
      }

      return {
        ...endpointContext,
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
      return this.comparisonService.buildMigrationReviewSummary(
        context,
        context.dto,
      );
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
      const resolvedContext = await this.resolveMigrationContext(
        userId,
        job.data.dto ?? dto,
        {
          jobId,
          strict: true,
          endpoints: job.data.endpoints,
        },
      );
      context = resolvedContext;
      const canonicalDto = resolvedContext.dto;
      await this.markStage(jobId, 'streaming');
      await this.reauthorizeMigrationContext(userId, resolvedContext);

      const rawStream = await resolvedContext.sourceStrategy.exportStream(
        resolvedContext.sourcePool,
        canonicalDto.sourceSchema,
        canonicalDto.sourceTable,
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
            // Authorization is outside the retryable-write catch: a policy denial
            // never retries, and cannot erase bookkeeping for a committed batch.
            await this.reauthorizeMigrationContext(userId, resolvedContext);
            if (failed) return;
            let imported: { success: boolean; rowCount: number };
            try {
              imported = await resolvedContext.targetStrategy.importData(
                resolvedContext.targetPool,
                {
                  schema: canonicalDto.targetSchema,
                  table: canonicalDto.targetTable,
                  data: batch,
                },
              );
            } catch (error) {
              await this.freshnessService.invalidatePartialWrite(
                error,
                canonicalDto.targetConnectionId,
                resolvedContext.targetConn.database,
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
                canonicalDto.targetConnectionId,
                resolvedContext.targetConn.database,
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
