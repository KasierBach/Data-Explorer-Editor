import { ForbiddenException, Injectable, Logger, NotFoundException, OnModuleInit, Inject } from '@nestjs/common';
import { EventEmitter } from 'events';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { ConnectionsService } from '../connections/connections.service';
import { DatabaseStrategyFactory, IDatabaseStrategy, ConnectionConfig, FullTableMetadata, ColumnInfo, IndexInfo } from '../database-strategies';
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

export interface MigrationColumnDiff {
  name: string;
  status: 'added' | 'removed' | 'changed' | 'unchanged';
  changes: string[];
  source: ColumnInfo | null;
  target: ColumnInfo | null;
}

export interface MigrationIndexDiff {
  name: string;
  status: 'added' | 'removed' | 'changed' | 'unchanged';
  changes: string[];
  source: IndexInfo | null;
  target: IndexInfo | null;
}

export interface MigrationReviewSummary {
  canProceed: boolean;
  blockers: string[];
  warnings: string[];
  rollbackCaveats: string[];
  estimatedImpact: {
    addedColumns: number;
    removedColumns: number;
    changedColumns: number;
    addedIndices: number;
    removedIndices: number;
    changedIndices: number;
  };
  source: {
    connectionId: string;
    connectionName: string;
    schema: string;
    table: string;
    rowCount: number | null;
    columnCount: number;
    indexCount: number;
  };
  target: {
    connectionId: string;
    connectionName: string;
    schema: string;
    table: string;
    rowCount: number | null;
    columnCount: number;
    indexCount: number;
  };
  columnDiffs: MigrationColumnDiff[];
  indexDiffs: MigrationIndexDiff[];
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

  private collectTargetCompatibilityIssues(sourceConn: MigrationConnection, targetConn: MigrationConnection, sourceMetadata: FullTableMetadata, targetMetadata: FullTableMetadata) {
    const issues: string[] = [];

    if (this.isMongoLike(targetConn.type)) {
      return issues;
    }

    const sourceColumns = new Set((sourceMetadata?.columns || []).map((column) => column.name));
    const targetColumns = Array.isArray(targetMetadata?.columns) ? targetMetadata.columns : [];

    if (targetColumns.length === 0) {
      issues.push('Target table not found or has no accessible columns.');
      return issues;
    }

    const missingColumns = targetColumns
      .filter((column) => !sourceColumns.has(column.name))
      .filter((column) => !column.isNullable && column.defaultValue == null && !column.isPrimaryKey)
      .map((column) => column.name);

    if (missingColumns.length > 0) {
      issues.push(`Target table is missing required values for columns: ${missingColumns.slice(0, 5).join(', ')}`);
    }

    const unsupportedSourceColumns = (sourceMetadata?.columns || [])
      .map((column) => column.name)
      .filter((columnName) => !targetColumns.some((targetColumn) => targetColumn.name === columnName));

    if (unsupportedSourceColumns.length > 0) {
      issues.push(`Target table is missing source columns: ${unsupportedSourceColumns.slice(0, 5).join(', ')}`);
    }

    if (this.isMongoLike(sourceConn.type) && unsupportedSourceColumns.some((name) => name.includes('.') || name.includes('[]'))) {
      issues.push('MongoDB nested document fields are not compatible with the selected SQL target table.');
    }

    return issues;
  }

  private validateTargetCompatibility(sourceConn: MigrationConnection, targetConn: MigrationConnection, sourceMetadata: FullTableMetadata, targetMetadata: FullTableMetadata) {
    const issues = this.collectTargetCompatibilityIssues(sourceConn, targetConn, sourceMetadata, targetMetadata);
    if (issues.length > 0) {
      throw new Error(issues[0]);
    }
  }

  private async resolveMigrationContext(userId: string, dto: StartMigrationDto, options: { jobId?: string; strict?: boolean } = {}): Promise<ResolvedMigrationContext> {
    const jobId = options.jobId;
    const strict = options.strict ?? true;

    if (this.sameMigrationEndpoint(dto)) {
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
      type: rawSourceConn.type as ConnectionType,
    };
    const targetConn: MigrationConnection = {
      ...rawTargetConn,
      type: rawTargetConn.type as ConnectionType,
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

    const sourceSchema = this.normalizeSchemaName(sourceConn.type, dto.sourceSchema);
    const targetSchema = this.normalizeSchemaName(targetConn.type, dto.targetSchema);
    const sourceTable = this.normalizeTableName(dto.sourceTable);
    const targetTable = this.normalizeTableName(dto.targetTable);

    const sourceMetadata = await this.fetchMetadata(sourceStrategy, sourcePool, sourceSchema, sourceTable, sourceConn.database || undefined);

    if (!sourceMetadata?.columns || sourceMetadata.columns.length === 0) {
      throw new Error('Source table or collection could not be validated. Check schema, table name, and permissions.');
    }

    const targetMetadata = await this.fetchMetadata(targetStrategy, targetPool, targetSchema, targetTable, targetConn.database || undefined)
      .catch((error) => {
        if (strict) {
          throw error;
        }

        this.logger.warn(`Migration preview target metadata unavailable: ${error instanceof Error ? error.message : String(error)}`);
        return { columns: [], indices: [], rowCount: undefined } as FullTableMetadata;
      });

    if (strict) {
      this.validateTargetCompatibility(sourceConn, targetConn, sourceMetadata, targetMetadata);
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

  private compareColumns(sourceColumns: ColumnInfo[], targetColumns: ColumnInfo[]): MigrationColumnDiff[] {
    const sourceMap = new Map(sourceColumns.map((column) => [column.name, column]));
    const targetMap = new Map(targetColumns.map((column) => [column.name, column]));
    const names = Array.from(new Set([...sourceMap.keys(), ...targetMap.keys()])).sort((a, b) => a.localeCompare(b));

    return names.map((name) => {
      const source = sourceMap.get(name) ?? null;
      const target = targetMap.get(name) ?? null;
      const changes: string[] = [];

      if (!source) {
        changes.push('added in target');
      } else if (!target) {
        changes.push('removed from target');
      } else {
        if (source.type !== target.type) changes.push(`type ${source.type} -> ${target.type}`);
        if (source.isNullable !== target.isNullable) changes.push(`nullable ${source.isNullable ? 'yes' : 'no'} -> ${target.isNullable ? 'yes' : 'no'}`);
        if (JSON.stringify(source.defaultValue ?? null) !== JSON.stringify(target.defaultValue ?? null)) changes.push('default value changed');
        if (source.isPrimaryKey !== target.isPrimaryKey) changes.push(`primary key ${source.isPrimaryKey ? 'yes' : 'no'} -> ${target.isPrimaryKey ? 'yes' : 'no'}`);
        if ((source.pkConstraintName ?? null) !== (target.pkConstraintName ?? null)) changes.push('primary key constraint changed');
        if ((source.comment ?? null) !== (target.comment ?? null)) changes.push('comment changed');
      }

      return {
        name,
        status: !source ? 'added' : !target ? 'removed' : changes.length > 0 ? 'changed' : 'unchanged',
        changes,
        source,
        target,
      };
    });
  }

  private compareIndices(sourceIndices: IndexInfo[], targetIndices: IndexInfo[]): MigrationIndexDiff[] {
    const sourceMap = new Map(sourceIndices.map((index) => [index.name, index]));
    const targetMap = new Map(targetIndices.map((index) => [index.name, index]));
    const names = Array.from(new Set([...sourceMap.keys(), ...targetMap.keys()])).sort((a, b) => a.localeCompare(b));

    return names.map((name) => {
      const source = sourceMap.get(name) ?? null;
      const target = targetMap.get(name) ?? null;
      const changes: string[] = [];

      if (!source) {
        changes.push('index added in target');
      } else if (!target) {
        changes.push('index removed from target');
      } else {
        if (source.isUnique !== target.isUnique) changes.push(`unique ${source.isUnique ? 'yes' : 'no'} -> ${target.isUnique ? 'yes' : 'no'}`);
        if (source.isPrimary !== target.isPrimary) changes.push(`primary ${source.isPrimary ? 'yes' : 'no'} -> ${target.isPrimary ? 'yes' : 'no'}`);
        if (JSON.stringify(source.columns) !== JSON.stringify(target.columns)) changes.push('indexed columns changed');
      }

      return {
        name,
        status: !source ? 'added' : !target ? 'removed' : changes.length > 0 ? 'changed' : 'unchanged',
        changes,
        source,
        target,
      };
    });
  }

  private buildMigrationReviewSummary(context: ResolvedMigrationContext, dto: StartMigrationDto): MigrationReviewSummary {
    const columnDiffs = this.compareColumns(context.sourceMetadata.columns || [], context.targetMetadata.columns || []);
    const indexDiffs = this.compareIndices(context.sourceMetadata.indices || [], context.targetMetadata.indices || []);
    const blockers = this.collectTargetCompatibilityIssues(context.sourceConn, context.targetConn, context.sourceMetadata, context.targetMetadata);
    const warnings: string[] = [];

    const changedColumns = columnDiffs.filter((diff) => diff.status === 'changed').length;
    const removedColumns = columnDiffs.filter((diff) => diff.status === 'removed').length;
    const addedColumns = columnDiffs.filter((diff) => diff.status === 'added').length;
    const changedIndices = indexDiffs.filter((diff) => diff.status === 'changed').length;
    const removedIndices = indexDiffs.filter((diff) => diff.status === 'removed').length;
    const addedIndices = indexDiffs.filter((diff) => diff.status === 'added').length;

    if ((context.sourceMetadata.rowCount ?? 0) > 100_000) {
      warnings.push('Large source table detected. Expect the transfer to take noticeable time.');
    }

    if (changedColumns > 0 || changedIndices > 0) {
      warnings.push('Structure differs between source and target. Review the diff carefully before running.');
    }

    if (!context.targetMetadata.columns?.length) {
      warnings.push('Target metadata could not be inspected fully. Double-check the target schema before running.');
    }

    return {
      canProceed: blockers.length === 0,
      blockers,
      warnings,
      rollbackCaveats: [
        'This transfer is one-way and does not automatically roll back inserted rows.',
        'If the target structure differs, run a fresh backup before reattempting the transfer.',
        'Primary key and index mismatches may require manual cleanup after a failed run.',
      ],
      estimatedImpact: {
        addedColumns,
        removedColumns,
        changedColumns,
        addedIndices,
        removedIndices,
        changedIndices,
      },
      source: {
        connectionId: context.sourceConn.id,
        connectionName: context.sourceConn.name,
        schema: this.normalizeSchemaName(context.sourceConn.type, dto.sourceSchema),
        table: this.normalizeTableName(dto.sourceTable),
        rowCount: context.sourceMetadata.rowCount ?? null,
        columnCount: context.sourceMetadata.columns?.length ?? 0,
        indexCount: context.sourceMetadata.indices?.length ?? 0,
      },
      target: {
        connectionId: context.targetConn.id,
        connectionName: context.targetConn.name,
        schema: this.normalizeSchemaName(context.targetConn.type, dto.targetSchema),
        table: this.normalizeTableName(dto.targetTable),
        rowCount: context.targetMetadata.rowCount ?? null,
        columnCount: context.targetMetadata.columns?.length ?? 0,
        indexCount: context.targetMetadata.indices?.length ?? 0,
      },
      columnDiffs,
      indexDiffs,
    };
  }

  async previewMigration(userId: string, dto: StartMigrationDto): Promise<MigrationReviewSummary> {
    const context = await this.resolveMigrationContext(userId, dto, { strict: false });
    try {
      return this.buildMigrationReviewSummary(context, dto);
    } finally {
      await this.closeResources(context);
    }
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
      context = await this.resolveMigrationContext(userId, dto, { jobId, strict: true });
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
