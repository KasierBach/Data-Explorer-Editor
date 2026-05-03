import { ForbiddenException, Injectable, Logger, NotFoundException, OnModuleInit, Inject } from '@nestjs/common';
import { EventEmitter } from 'events';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { ConnectionsService } from '../connections/connections.service';
import { DatabaseStrategyFactory, IDatabaseStrategy, ConnectionConfig, FullTableMetadata } from '../database-strategies';
import { StartMigrationDto } from './dto/start-migration.dto';

type ConnectionType = 'postgres' | 'mysql' | 'mssql' | 'sqlite' | 'clickhouse' | 'mock' | 'mongodb' | 'mongodb+srv';

interface MigrationConnection {
  id: string;
  name: string;
  type: ConnectionType;
  host?: string | null;
  port?: number | null;
  username?: string | null;
  password?: string;
  database?: string | null;
}

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

interface MigrationProgress {
  processedRows: number;
  batchesProcessed: number;
  stage: MigrationStage;
}

interface MigrationStream extends AsyncIterable<Record<string, unknown>> {
  on(event: 'data' | 'row' | 'end' | 'error' | 'close', listener: (...args: unknown[]) => void): this;
  pause(): void;
  resume(): void;
  emit(event: string, ...args: unknown[]): boolean;
}

interface ResolvedMigrationContext {
  sourceConn: MigrationConnection;
  targetConn: MigrationConnection;
  sourceStrategy: IDatabaseStrategy;
  targetStrategy: IDatabaseStrategy;
  sourcePool: unknown;
  targetPool: unknown;
  sourceMetadata: FullTableMetadata;
  targetMetadata: FullTableMetadata;
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

  private async fetchMetadata(strategy: IDatabaseStrategy, pool: unknown, schema: string, table: string, database?: string): Promise<FullTableMetadata> {
    return strategy.getFullMetadata(pool, schema, table, database);
  }

  private validateTargetCompatibility(sourceConn: MigrationConnection, targetConn: MigrationConnection, sourceMetadata: FullTableMetadata, targetMetadata: FullTableMetadata) {
    if (this.isMongoLike(targetConn.type)) {
      return;
    }

    const sourceColumns = new Set((sourceMetadata?.columns || []).map((column) => column.name));
    const targetColumns = Array.isArray(targetMetadata?.columns) ? targetMetadata.columns : [];

    if (targetColumns.length === 0) {
      throw new Error('Target table not found or has no accessible columns.');
    }

    const missingColumns = targetColumns
      .filter((column) => !sourceColumns.has(column.name))
      .filter((column) => !column.isNullable && column.defaultValue == null && !column.isPrimaryKey)
      .map((column) => column.name);

    if (missingColumns.length > 0) {
      throw new Error(`Target table is missing required values for columns: ${missingColumns.slice(0, 5).join(', ')}`);
    }

    const unsupportedSourceColumns = (sourceMetadata?.columns || [])
      .map((column) => column.name)
      .filter((columnName) => !targetColumns.some((targetColumn) => targetColumn.name === columnName));

    if (unsupportedSourceColumns.length > 0) {
      throw new Error(`Target table is missing source columns: ${unsupportedSourceColumns.slice(0, 5).join(', ')}`);
    }

    if (this.isMongoLike(sourceConn.type) && unsupportedSourceColumns.some((name) => name.includes('.') || name.includes('[]'))) {
      throw new Error('MongoDB nested document fields are not compatible with the selected SQL target table.');
    }
  }

  private async resolveMigrationContext(userId: string, dto: StartMigrationDto, jobId: string): Promise<ResolvedMigrationContext> {
    if (this.sameMigrationEndpoint(dto)) {
      throw new Error('Source and target cannot point to the same table or collection.');
    }

    await this.markStage(jobId, 'validating', 'running');

    const rawSourceConn = await this.connectionsService.getDecryptedConnection(dto.sourceConnectionId, userId);
    const rawTargetConn = await this.connectionsService.getDecryptedConnection(dto.targetConnectionId, userId);

    if (!rawSourceConn || !rawTargetConn) {
      throw new Error('Source or target connection not found.');
    }

    const sourceConn: MigrationConnection = {
      ...rawSourceConn,
      type: rawSourceConn.type as ConnectionType,
    };
    const targetConn: MigrationConnection = {
      ...rawTargetConn,
      type: rawTargetConn.type as ConnectionType,
    };

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

      const rawStream = await context.sourceStrategy!.exportStream(
        context.sourcePool,
        this.normalizeSchemaName(context.sourceConn!.type, dto.sourceSchema),
        this.normalizeTableName(dto.sourceTable),
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
        let processing = Promise.resolve();
        const enqueueChunk = (chunk: Record<string, unknown>) => {
          processing = processing.then(() => handleChunk(chunk));
          processing.catch((error) => {
            void handleTerminalFailure(error);
          });
        };

        stream.on('data', enqueueChunk as (...args: unknown[]) => void);
        stream.on('row', enqueueChunk as (...args: unknown[]) => void);

        stream.on('end', async () => {
          const currentJob = await this.migrationQueue.getJob(jobId);
          if (!currentJob) return;
          const state = await currentJob.getState();
          if (state === 'failed') return;

          try {
            await processing;
            await flushBuffer();
            const finalizedProgress = currentJob.progress as MigrationProgress | undefined;
            this.logger.log(`Migration ${jobId}: completed (${finalizedProgress?.processedRows || 0} rows)`);
            await this.completeJob(jobId);
          } catch (error) {
            await handleTerminalFailure(error);
          }
        });

        stream.on('error', (error: unknown) => {
          void handleTerminalFailure(error);
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
