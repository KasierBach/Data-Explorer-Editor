import { ForbiddenException, Injectable, Logger, NotFoundException, OnModuleInit, Inject } from '@nestjs/common';
import { EventEmitter } from 'events';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { ConnectionsService } from '../connections/connections.service';
import { DatabaseStrategyFactory } from '../database-strategies/strategy.factory';
import { StartMigrationDto } from './dto/start-migration.dto';

export type MigrationStage =
  | 'queued'
  | 'validating'
  | 'connecting'
  | 'preflight'
  | 'streaming'
  | 'completed'
  | 'failed';

export interface MigrationJob {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  stage: MigrationStage;
  processedRows: number;
  batchesProcessed: number;
  error?: string;
}

interface StoredMigrationJob extends MigrationJob {
  ownerId: string;
}

interface ResolvedMigrationContext {
  sourceConn: any;
  targetConn: any;
  sourceStrategy: any;
  targetStrategy: any;
  sourcePool: any;
  targetPool: any;
  sourceMetadata: any;
  targetMetadata: any;
}

@Injectable()
export class MigrationService {
  private readonly logger = new Logger(MigrationService.name);
  public readonly eventEmitter = new EventEmitter();

  constructor(
    private connectionsService: ConnectionsService,
    private dbStrategiesFactory: DatabaseStrategyFactory,
    @InjectQueue('migration') private migrationQueue: Queue,
  ) {}

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
        attempts: 1, // Let's keep it simple for now
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
    
    // Convert BullMQ Job status and metadata back to MigrationJob format
    const state = await job.getState();
    const progress = job.progress as any;

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

    let progress = (job.progress as any) || { processedRows: 0, batchesProcessed: 0, stage: 'streaming' };
    
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

  private async completeJob(jobId: string) {
    // BullMQ handles completion via worker return value
  }

  private isMongoLike(type: string) {
    return type === 'mongodb' || type === 'mongodb+srv';
  }

  private buildMigrationConnectionConfig(conn: any): any {
    return {
      ...conn,
      statementTimeout: 0,
      queryTimeout: 0,
      socketTimeout: 0,
    };
  }

  private normalizeSchemaName(type: string, schema?: string) {
    if (this.isMongoLike(type)) return '';
    return schema?.trim() || (type === 'postgres' ? 'public' : '');
  }

  private normalizeTableName(table: string) {
    return table.trim();
  }

  private sameMigrationEndpoint(dto: StartMigrationDto) {
    return (
      dto.sourceConnectionId === dto.targetConnectionId &&
      (dto.sourceSchema || '') === (dto.targetSchema || '') &&
      dto.sourceTable === dto.targetTable
    );
  }

  private async fetchMetadata(strategy: any, pool: any, schema: string, table: string, database?: string) {
    return strategy.getFullMetadata(pool, schema, table, database);
  }

  private validateTargetCompatibility(sourceConn: any, targetConn: any, sourceMetadata: any, targetMetadata: any) {
    if (this.isMongoLike(targetConn.type)) {
      return;
    }

    const sourceColumns = new Set((sourceMetadata?.columns || []).map((column: any) => column.name));
    const targetColumns = Array.isArray(targetMetadata?.columns) ? targetMetadata.columns : [];

    if (targetColumns.length === 0) {
      throw new Error('Target table not found or has no accessible columns.');
    }

    const missingColumns = targetColumns
      .filter((column: any) => !sourceColumns.has(column.name))
      .filter((column: any) => !column.isNullable && column.defaultValue == null && !column.isPrimaryKey)
      .map((column: any) => column.name);

    if (missingColumns.length > 0) {
      throw new Error(`Target table is missing required values for columns: ${missingColumns.slice(0, 5).join(', ')}`);
    }

    const unsupportedSourceColumns = (sourceMetadata?.columns || [])
      .map((column: any) => column.name)
      .filter((columnName: string) => !targetColumns.some((targetColumn: any) => targetColumn.name === columnName));

    if (unsupportedSourceColumns.length > 0) {
      throw new Error(`Target table is missing source columns: ${unsupportedSourceColumns.slice(0, 5).join(', ')}`);
    }

    if (this.isMongoLike(sourceConn.type) && unsupportedSourceColumns.some((name: string) => name.includes('.') || name.includes('[]'))) {
      throw new Error('MongoDB nested document fields are not compatible with the selected SQL target table.');
    }
  }

  private async resolveMigrationContext(userId: string, dto: StartMigrationDto, jobId: string): Promise<ResolvedMigrationContext> {
    if (this.sameMigrationEndpoint(dto)) {
      throw new Error('Source and target cannot point to the same table or collection.');
    }

    await this.markStage(jobId, 'validating', 'running');

    const sourceConn = await this.connectionsService.getDecryptedConnection(dto.sourceConnectionId, userId);
    const targetConn = await this.connectionsService.getDecryptedConnection(dto.targetConnectionId, userId);

    if (!sourceConn || !targetConn) {
      throw new Error('Source or target connection not found.');
    }

    await this.markStage(jobId, 'connecting');

    const sourceStrategy = this.dbStrategiesFactory.getStrategy(sourceConn.type);
    const targetStrategy = this.dbStrategiesFactory.getStrategy(targetConn.type);
    const sourcePool = await sourceStrategy.createPool(this.buildMigrationConnectionConfig(sourceConn));
    const targetPool = await targetStrategy.createPool(this.buildMigrationConnectionConfig(targetConn));

    await this.markStage(jobId, 'preflight');

    const sourceSchema = this.normalizeSchemaName(sourceConn.type, dto.sourceSchema);
    const targetSchema = this.normalizeSchemaName(targetConn.type, dto.targetSchema);
    const sourceTable = this.normalizeTableName(dto.sourceTable);
    const targetTable = this.normalizeTableName(dto.targetTable);

    const sourceMetadata = await this.fetchMetadata(sourceStrategy, sourcePool, sourceSchema, sourceTable, sourceConn.database || undefined);

    if (!sourceMetadata?.columns || sourceMetadata.columns.length === 0) {
      throw new Error('Source table or collection could not be validated. Check schema, table name, and permissions.');
    }

    const targetMetadata = await this.fetchMetadata(targetStrategy, targetPool, targetSchema, targetTable, targetConn.database || undefined);
    this.validateTargetCompatibility(sourceConn, targetConn, sourceMetadata, targetMetadata);

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

  private async closeResources(context?: Partial<ResolvedMigrationContext>) {
    if (context?.sourcePool && context?.sourceStrategy) {
      try {
        await context.sourceStrategy.closePool(context.sourcePool);
      } catch {}
    }
    if (context?.targetPool && context?.targetStrategy) {
      try {
        await context.targetStrategy.closePool(context.targetPool);
      } catch {}
    }
  }

  public async runMigrationPipeline(userId: string, jobId: string, dto: StartMigrationDto) {
    let context: Partial<ResolvedMigrationContext> | undefined;

    try {
      context = await this.resolveMigrationContext(userId, dto, jobId);
      await this.markStage(jobId, 'streaming');

      const stream = await context.sourceStrategy!.exportStream(
        context.sourcePool,
        this.normalizeSchemaName(context.sourceConn!.type, dto.sourceSchema),
        this.normalizeTableName(dto.sourceTable),
      );

      const BATCH_SIZE = 2000;
      let buffer: any[] = [];
      let isPaused = false;

      const flushBuffer = async () => {
        if (buffer.length === 0) return;

        const batch = buffer;
        buffer = [];

        await context!.targetStrategy!.importData(context!.targetPool, {
          schema: this.normalizeSchemaName(context!.targetConn!.type, dto.targetSchema),
          table: this.normalizeTableName(dto.targetTable),
          data: batch,
        });

        await this.updateJob(jobId, (job) => {
          job.processedRows += batch.length;
          job.batchesProcessed += 1;
        });

        this.logger.verbose(`Migration ${jobId}: flushed ${batch.length} rows`);
      };

      const handleChunk = async (chunk: any) => {
        buffer.push(chunk);
        if (buffer.length < BATCH_SIZE) return;

        if (typeof stream.pause === 'function' && !isPaused) {
          isPaused = true;
          stream.pause();
        }

        try {
          await flushBuffer();
        } catch (error: any) {
          stream.emit?.('error', error);
          return;
        }

        if (typeof stream.resume === 'function' && isPaused) {
          isPaused = false;
          stream.resume();
        }
      };

      const handleTerminalFailure = async (error: any) => {
        this.logger.error(`Stream error in migration ${jobId}`, error);
        await this.failJob(jobId, error?.message || 'Migration stream failed.');
      };

      if (typeof stream.on === 'function') {
        let processing = Promise.resolve();
        const enqueueChunk = (chunk: any) => {
          processing = processing.then(() => handleChunk(chunk));
          processing.catch((error) => {
            void handleTerminalFailure(error);
          });
        };

        stream.on('data', enqueueChunk);
        stream.on('row', enqueueChunk);

        stream.on('end', async () => {
          const currentJob = await this.migrationQueue.getJob(jobId);
          if (!currentJob) return;
          const state = await currentJob.getState();
          if (state === 'failed') return;

          try {
            await processing;
            await flushBuffer();
            const finalizedProgress = currentJob.progress as any;
            this.logger.log(`Migration ${jobId}: completed (${finalizedProgress?.processedRows || 0} rows)`);
            await this.completeJob(jobId);
          } catch (error: any) {
            await handleTerminalFailure(error);
          }
        });

        stream.on('error', (error: any) => {
          void handleTerminalFailure(error);
        });
      } else {
        for await (const chunk of stream) {
          const currentJob = await this.migrationQueue.getJob(jobId);
          if (!currentJob) break;
          const state = await currentJob.getState();
          if (state === 'failed') break;
          await handleChunk(chunk);
        }

        const currentJob = await this.migrationQueue.getJob(jobId);
        if (currentJob) {
          const state = await currentJob.getState();
          if (state !== 'failed') {
            await flushBuffer();
            const finalizedProgress = currentJob.progress as any;
            this.logger.log(`Migration ${jobId}: completed (${finalizedProgress?.processedRows || 0} rows)`);
            await this.completeJob(jobId);
          }
        }
      }
    } catch (error: any) {
      this.logger.error(`Migration ${jobId} PIPELINE EXCEPTION`, error);
      await this.failJob(jobId, error.message || 'Migration pipeline failed.');
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
