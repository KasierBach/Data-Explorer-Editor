import { Controller, Post, Body, Req, UseGuards, Param, Sse } from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MigrationService } from './migration.service';
import { StartMigrationDto } from './dto/start-migration.dto';

@Controller('migration')
@UseGuards(JwtAuthGuard)
export class MigrationController {
    constructor(private readonly migrationService: MigrationService) {}

    @Post('start')
    async startMigration(@Req() req: any, @Body() dto: StartMigrationDto) {
        const userId = (req.user as any).sub;
        return this.migrationService.startMigration(userId, dto);
    }

    @Sse('progress/:jobId')
    progress(@Param('jobId') jobId: string): Observable<MessageEvent> {
        return new Observable<MessageEvent>((observer) => {
            const job = this.migrationService.jobs.get(jobId);
            if (!job) {
                observer.error('Job not found');
                return;
            }

            // Emit initial status
            observer.next({ data: job });

            // Listen for progress updates
            const listener = (update: any) => {
                observer.next({ data: update });
                if (update.status === 'completed' || update.status === 'failed') {
                    observer.complete();
                    this.migrationService.eventEmitter.removeListener(`migration-${jobId}`, listener);
                }
            };

            this.migrationService.eventEmitter.on(`migration-${jobId}`, listener);

            // Cleanup when client disconnects
            return () => {
                this.migrationService.eventEmitter.removeListener(`migration-${jobId}`, listener);
            };
        });
    }
}
