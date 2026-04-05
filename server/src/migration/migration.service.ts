import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { ConnectionsService } from '../connections/connections.service';
import { DatabaseStrategyFactory } from '../database-strategies/strategy.factory';
import { StartMigrationDto } from './dto/start-migration.dto';

export interface MigrationJob {
    id: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    processedRows: number;
    error?: string;
}

interface StoredMigrationJob extends MigrationJob {
    ownerId: string;
}

@Injectable()
export class MigrationService {
    private readonly logger = new Logger(MigrationService.name);
    
    // In-memory store of active/completed jobs
    public readonly jobs = new Map<string, StoredMigrationJob>();
    // Event emitter to broadcast progress to SSE controllers
    public readonly eventEmitter = new EventEmitter();

    constructor(
        private connectionsService: ConnectionsService,
        private dbStrategiesFactory: DatabaseStrategyFactory,
    ) { }

    async startMigration(userId: string, dto: StartMigrationDto): Promise<{ jobId: string }> {
        const jobId = uuidv4();
        this.jobs.set(jobId, { id: jobId, status: 'pending', processedRows: 0, ownerId: userId });

        // Fire-and-forget: run the migration asynchronously in the background
        this.runMigrationPipeline(userId, jobId, dto).catch(err => {
            this.logger.error(`Migration ${jobId} failed to start or crashed:`, err);
            const job = this.jobs.get(jobId);
            if (job) {
                job.status = 'failed';
                job.error = err.message || 'Background process crashed';
                this.updateJob(jobId, job);
            }
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

    /**
     * Override connection config to remove timeouts for migration pools.
     * Normal query pools keep 30s timeout, but migration needs unlimited time.
     */
    private buildMigrationConnectionConfig(conn: any): any {
        return {
            ...conn,
            // These flags are read by createPool() in strategies that support them
            statementTimeout: 0,
            queryTimeout: 0,
            socketTimeout: 0,
        };
    }

    private async runMigrationPipeline(userId: string, jobId: string, dto: StartMigrationDto) {
        const job = this.jobs.get(jobId)!;
        job.status = 'running';
        this.updateJob(jobId, job);

        let sourcePool: any = null;
        let targetPool: any = null;
        let sourceStrategy: any = null;
        let targetStrategy: any = null;

        try {
            // 1. Fetch Connection Credentials (with decrypted passwords)
            const sourceConn = await this.connectionsService.getDecryptedConnection(dto.sourceConnectionId, userId);
            const targetConn = await this.connectionsService.getDecryptedConnection(dto.targetConnectionId, userId);

            if (!sourceConn || !targetConn) throw new Error('Source or Target connection not found');

            // 2. Initialize Strategies & Pools (with migration-safe timeout overrides)
            sourceStrategy = this.dbStrategiesFactory.getStrategy(sourceConn.type);
            targetStrategy = this.dbStrategiesFactory.getStrategy(targetConn.type);

            const migrationSourceConfig = this.buildMigrationConnectionConfig(sourceConn);
            const migrationTargetConfig = this.buildMigrationConnectionConfig(targetConn);

            sourcePool = await sourceStrategy.createPool(migrationSourceConfig);
            targetPool = await targetStrategy.createPool(migrationTargetConfig);

            this.logger.log(`Migration ${jobId}: pools created, starting stream...`);

            // 3. Get the Readable Stream from Source
            const stream = await sourceStrategy.exportStream(sourcePool, dto.sourceSchema, dto.sourceTable);

            // 4. Batch Processing Setup
            const BATCH_SIZE = 2000;
            let buffer: any[] = [];
            let isPaused = false;

            const flushBuffer = async () => {
                if (buffer.length === 0) return;
                const batch = buffer;
                buffer = [];

                await targetStrategy.importData(targetPool, {
                    schema: dto.targetSchema,
                    table: dto.targetTable,
                    data: batch
                });

                job.processedRows += batch.length;
                this.updateJob(jobId, job);
                this.logger.verbose(`Migration ${jobId}: flushed ${batch.length} rows (total: ${job.processedRows})`);
            };

            const handleData = async (chunk: any) => {
                buffer.push(chunk);
                if (buffer.length >= BATCH_SIZE) {
                    if (stream.pause && !isPaused) {
                        isPaused = true;
                        stream.pause();
                    }
                    try {
                        await flushBuffer();
                    } catch (error) {
                        stream.emit('error', error);
                        return;
                    }
                    if (stream.resume && isPaused) {
                        isPaused = false;
                        stream.resume();
                    }
                }
            };

            if (typeof stream.on === 'function') {
                stream.on('data', handleData);
                stream.on('row', handleData);

                stream.on('end', async () => {
                    const currentJob = this.jobs.get(jobId)!;
                    if ((currentJob.status as string) === 'failed') return;
                    try {
                        await flushBuffer();
                        const updatedJob = this.jobs.get(jobId)!;
                        if ((updatedJob.status as string) !== 'failed') {
                            updatedJob.status = 'completed';
                            this.logger.log(`Migration ${jobId}: completed (${updatedJob.processedRows} rows)`);
                            this.updateJob(jobId, updatedJob);
                        }
                    } catch (error) {
                        stream.emit('error', error);
                    }
                });

                stream.on('error', (err: any) => {
                    const currentJob = this.jobs.get(jobId)!;
                    if ((currentJob.status as string) === 'failed') return;
                    this.logger.error(`Stream error in migration ${jobId}`, err);
                    currentJob.status = 'failed';
                    currentJob.error = err.message;
                    this.updateJob(jobId, currentJob);
                });
            } else {
                for await (const chunk of stream) {
                    if ((this.jobs.get(jobId)!.status as string) === 'failed') break;
                    await handleData(chunk);
                }
                const currentJob = this.jobs.get(jobId)!;
                if ((currentJob.status as string) !== 'failed') {
                    await flushBuffer();
                    currentJob.status = 'completed';
                    this.logger.log(`Migration ${jobId}: completed (${currentJob.processedRows} rows)`);
                    this.updateJob(jobId, currentJob);
                }
            }

        } catch (error: any) {
            this.logger.error(`Migration ${jobId} PIPELINE EXCEPTION`, error);
            const currentJob = this.jobs.get(jobId)!;
            currentJob.status = 'failed';
            currentJob.error = error.message;
            this.updateJob(jobId, currentJob);
        } finally {
            // Clean up pools
            if (sourcePool && sourceStrategy) {
                try { await sourceStrategy.closePool(sourcePool); } catch (e) { }
            }
            if (targetPool && targetStrategy) {
                try { await targetStrategy.closePool(targetPool); } catch (e) { }
            }
        }
    }

    private updateJob(jobId: string, job: MigrationJob) {
        this.jobs.set(jobId, job as StoredMigrationJob);
        this.eventEmitter.emit(`migration-${jobId}`, this.toPublicJob(job as StoredMigrationJob));
    }

    private toPublicJob(job: StoredMigrationJob): MigrationJob {
        return {
            id: job.id,
            status: job.status,
            processedRows: job.processedRows,
            error: job.error,
        };
    }
}
