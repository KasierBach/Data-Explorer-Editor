import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
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

  public readonly jobs = new Map<string, StoredMigrationJob>();
  public readonly eventEmitter = new EventEmitter();

  constructor(
    private connectionsService: ConnectionsService,
    private dbStrategiesFactory: DatabaseStrategyFactory,
  ) {}

  async startMigration(userId: string, dto: StartMigrationDto): Promise<{ jobId: string }> {
    const jobId = uuidv4();
    this.jobs.set(jobId, {
      id: jobId,
      status: 'pending',
      stage: 'queued',
      processedRows: 0,
      batchesProcessed: 0,
      ownerId: userId,
    });

    this.runMigrationPipeline(userId, jobId, dto).catch((err) => {
      this.logger.error(`Migration ${jobId} failed to start or crashed:`, err);
      this.failJob(jobId, err.message || 'Background process crashed');
    });

    return { jobId };
  }

  assertJobOwnership(jobId: string, userId: string) {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new NotFoundException('Job not found.');
    }

    if (job.ownerId !== userId) {
      throw new ForbiddenException('You do not have access to this migration job.');
    }

    return job;
  }

  getPublicJob(jobId: string, userId: string): MigrationJob {
    return this.toPublicJob(this.assertJobOwnership(jobId, userId));
  }

  private updateJob(jobId: string, updater: Partial<MigrationJob> | ((job: StoredMigrationJob) => void)) {
    const existing = this.jobs.get(jobId);
    if (!existing) return;

    if (typeof updater === 'function') {
      updater(existing);
    } else {
      Object.assign(existing, updater);
    }

    this.jobs.set(jobId, existing);
    this.eventEmitter.emit(`migration-${jobId}`, this.toPublicJob(existing));
  }

  private markStage(jobId: string, stage: MigrationStage, status?: MigrationJob['status']) {
    this.updateJob(jobId, {
      stage,
      ...(status ? { status } : {}),
    });
  }

  private failJob(jobId: string, error: string) {
    const current = this.jobs.get(jobId);
    if (!current || current.status === 'failed' || current.status === 'completed') return;
    this.logger.error(`Migration ${jobId} failed`, error);
    this.updateJob(jobId, {
      status: 'failed',
      stage: 'failed',
      error,
    });
  }

  private completeJob(jobId: string) {
    const current = this.jobs.get(jobId);
    if (!current || current.status === 'failed') return;
    this.updateJob(jobId, {
      status: 'completed',
      stage: 'completed',
    });
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

    this.markStage(jobId, 'validating', 'running');

    const sourceConn = await this.connectionsService.getDecryptedConnection(dto.sourceConnectionId, userId);
    const targetConn = await this.connectionsService.getDecryptedConnection(dto.targetConnectionId, userId);

    if (!sourceConn || !targetConn) {
      throw new Error('Source or target connection not found.');
    }

    this.markStage(jobId, 'connecting');

    const sourceStrategy = this.dbStrategiesFactory.getStrategy(sourceConn.type);
    const targetStrategy = this.dbStrategiesFactory.getStrategy(targetConn.type);
    const sourcePool = await sourceStrategy.createPool(this.buildMigrationConnectionConfig(sourceConn));
    const targetPool = await targetStrategy.createPool(this.buildMigrationConnectionConfig(targetConn));

    this.markStage(jobId, 'preflight');

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

  private async runMigrationPipeline(userId: string, jobId: string, dto: StartMigrationDto) {
    let context: Partial<ResolvedMigrationContext> | undefined;

    try {
      context = await this.resolveMigrationContext(userId, dto, jobId);
      this.markStage(jobId, 'streaming');

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

        this.updateJob(jobId, (job) => {
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

      const handleTerminalFailure = (error: any) => {
        this.logger.error(`Stream error in migration ${jobId}`, error);
        this.failJob(jobId, error?.message || 'Migration stream failed.');
      };

      if (typeof stream.on === 'function') {
        let processing = Promise.resolve();
        const enqueueChunk = (chunk: any) => {
          processing = processing.then(() => handleChunk(chunk));
          processing.catch(handleTerminalFailure);
        };

        stream.on('data', enqueueChunk);
        stream.on('row', enqueueChunk);

        stream.on('end', async () => {
          const currentJob = this.jobs.get(jobId);
          if (!currentJob || currentJob.status === 'failed') return;
          try {
            await processing;
            await flushBuffer();
            this.logger.log(`Migration ${jobId}: completed (${this.jobs.get(jobId)?.processedRows || 0} rows)`);
            this.completeJob(jobId);
          } catch (error: any) {
            handleTerminalFailure(error);
          }
        });

        stream.on('error', handleTerminalFailure);
      } else {
        for await (const chunk of stream) {
          const currentJob = this.jobs.get(jobId);
          if (!currentJob || currentJob.status === 'failed') break;
          await handleChunk(chunk);
        }

        const currentJob = this.jobs.get(jobId);
        if (currentJob && currentJob.status !== 'failed') {
          await flushBuffer();
          this.logger.log(`Migration ${jobId}: completed (${currentJob.processedRows} rows)`);
          this.completeJob(jobId);
        }
      }
    } catch (error: any) {
      this.logger.error(`Migration ${jobId} PIPELINE EXCEPTION`, error);
      this.failJob(jobId, error.message || 'Migration pipeline failed.');
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
