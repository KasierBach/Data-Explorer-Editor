import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { MigrationService } from './migration.service';

@Processor('migration')
export class MigrationProcessor extends WorkerHost {
  private readonly logger = new Logger(MigrationProcessor.name);

  constructor(private readonly migrationService: MigrationService) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`Processing migration job ${job.id}`);
    const { userId, dto } = job.data;

    // The actual migration logic will be called here.
    // We will refactor migration.service to have a method that performs the work
    // which this processor will call.
    try {
      await this.migrationService.runMigrationPipeline(userId, job.id!, dto);
      return { success: true };
    } catch (error: any) {
      this.logger.error(`Migration job ${job.id} failed: ${error.message}`);
      throw error;
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`Migration job ${job.id} completed successfully`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Migration job ${job.id} failed: ${error.message}`);
  }
}
