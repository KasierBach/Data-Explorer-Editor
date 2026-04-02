import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
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

@Injectable()
export class MigrationService {
    private readonly logger = new Logger(MigrationService.name);
    
    // In-memory store of active/completed jobs
    public readonly jobs = new Map<string, MigrationJob>();
    // Event emitter to broadcast progress to SSE controllers
    public readonly eventEmitter = new EventEmitter();

    constructor(
        private connectionsService: ConnectionsService,
        private dbStrategiesFactory: DatabaseStrategyFactory,
    ) { }


    async startMigration(userId: string, dto: StartMigrationDto): Promise<{ jobId: string }> {
        const jobId = uuidv4();
        this.jobs.set(jobId, { id: jobId, status: 'pending', processedRows: 0 });

        // Fire-and-forget: run the migration asynchronously in the background
        this.runMigrationPipeline(userId, jobId, dto).catch(err => {
            this.logger.error(`Migration ${jobId} failed to start or crashed:`, err);
        });

        return { jobId };
    }

    private async runMigrationPipeline(userId: string, jobId: string, dto: StartMigrationDto) {
        const job = this.jobs.get(jobId)!;
        job.status = 'running';
        this.updateJob(jobId, job);

        let sourcePool: any = null;
        let targetPool: any = null;
        let sourceStrategy: any = null;

        try {
            // 1. Fetch Connection Credentials
            const sourceConn = await this.connectionsService.findOne(dto.sourceConnectionId, userId);
            const targetConn = await this.connectionsService.findOne(dto.targetConnectionId, userId);

            if (!sourceConn || !targetConn) throw new Error('Source or Target connection not found');

            // 2. Initialize Strategies & Pools
            sourceStrategy = this.dbStrategiesFactory.getStrategy(sourceConn.type);
            const targetStrategy = this.dbStrategiesFactory.getStrategy(targetConn.type);

            sourcePool = await sourceStrategy.createPool(sourceConn);
            targetPool = await targetStrategy.createPool(targetConn);

            // 3. Get the Readable Stream from Source
            const stream = await sourceStrategy.exportStream(sourcePool, dto.sourceSchema, dto.sourceTable);

            // 4. Batch Processing Setup
            const BATCH_SIZE = 2000;
            let buffer: any[] = [];
            let isPaused = false;

            const flushBuffer = async () => {
                if (buffer.length === 0) return;
                
                // For SQL to NoSQL, JSON stringification for deeply nested objects is recommended.
                // But for v1, we directly pass the buffer and rely on the target strategy to insert it.
                await targetStrategy.importData(targetPool, {
                    schema: dto.targetSchema,
                    table: dto.targetTable,
                    data: buffer
                });

                job.processedRows += buffer.length;
                this.updateJob(jobId, job);
                buffer = [];
            };

            // Common event handler for streams
            const handleData = async (chunk: any) => {
                // If it's pg-stream, chunk is a row object.
                // Provide a uniform adapter if needed, but standard object streams emit row objects.
                buffer.push(chunk);

                if (buffer.length >= BATCH_SIZE) {
                    if (stream.pause && !isPaused) {
                        isPaused = true;
                        stream.pause();
                    }

                    try {
                        await flushBuffer();
                    } catch (error) {
                        stream.emit('error', error); // Abort stream
                        return;
                    }

                    if (stream.resume && isPaused) {
                        isPaused = false;
                        stream.resume();
                    }
                }
            };

            // Attach listeners depending on stream type (MySQL and Pg emit 'data', custom streams emit 'data')
            if (typeof stream.on === 'function') {
                stream.on('data', handleData);
                stream.on('row', handleData); // MSSQL backup if not piped fully

                stream.on('end', async () => {
                    const currentJob = this.jobs.get(jobId)!;
                    if ((currentJob.status as string) === 'failed') return;
                    try {
                        await flushBuffer();
                        if ((this.jobs.get(jobId)!.status as string) !== 'failed') {
                            const updatedJob = this.jobs.get(jobId)!;
                            updatedJob.status = 'completed';
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
                // Fallback for async iterables if stream doesn't have .on
                for await (const chunk of stream) {
                    if ((this.jobs.get(jobId)!.status as string) === 'failed') break;
                    await handleData(chunk);
                }
                const currentJob = this.jobs.get(jobId)!;
                if ((currentJob.status as string) !== 'failed') {
                    await flushBuffer();
                    currentJob.status = 'completed';
                    this.updateJob(jobId, currentJob);
                }
            }

        } catch (error: any) {
            this.logger.error(`Migration ${jobId} failed:`, error);
            job.status = 'failed';
            job.error = error.message;
            this.updateJob(jobId, job);
        } finally {
            // Clean up pools
            if (sourcePool && sourceStrategy) {
                try { await sourceStrategy.closePool(sourcePool); } catch (e) { }
            }
            // Add close targetPool if strategy service tracks it or close manually
        }
    }

    private updateJob(jobId: string, job: MigrationJob) {
        this.jobs.set(jobId, job);
        this.eventEmitter.emit(`migration-${jobId}`, job);
    }
}
