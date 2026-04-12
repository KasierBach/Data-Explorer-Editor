import { Controller, Post, Body, Req, UseGuards, Param, Query, Sse, UnauthorizedException } from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MigrationService } from './migration.service';
import { StartMigrationDto } from './dto/start-migration.dto';
import { TokenService } from '../auth/token.service';

@Controller('migration')
export class MigrationController {
    constructor(
        private readonly migrationService: MigrationService,
        private readonly tokenService: TokenService,
    ) {}

    @Post('start')
    @UseGuards(JwtAuthGuard)
    async startMigration(@Req() req: any, @Body() dto: StartMigrationDto) {
        const userId = (req.user as any).id;
        return this.migrationService.startMigration(userId, dto);
    }

    @Post('progress-ticket/:jobId')
    @UseGuards(JwtAuthGuard)
    async createProgressTicket(@Param('jobId') jobId: string, @Req() req: any) {
        const userId = (req.user as any).id;
        await this.migrationService.assertJobOwnership(jobId, userId);

        return {
            ticket: this.tokenService.createMigrationProgressTicket(userId, jobId),
        };
    }

    @Sse('progress/:jobId')
    progress(@Param('jobId') jobId: string, @Query('ticket') ticket: string): Observable<MessageEvent> {
        const payload = this.tokenService.verifyMigrationProgressTicket(ticket);
        if (payload.jobId !== jobId) {
            throw new UnauthorizedException('Migration progress ticket does not match this job.');
        }

        return new Observable<MessageEvent>((observer) => {
            this.migrationService.getPublicJob(jobId, payload.sub!)
                .then((initialJob) => {
                    observer.next({ data: initialJob });
                })
                .catch((error) => {
                    observer.error(error);
                });

            // Listen for progress updates
            const listener = (update: any) => {
                observer.next({ data: update });
                if (update.status === 'completed' || update.status === 'failed') {
                    cleanup();
                    observer.complete();
                }
            };

            this.migrationService.eventEmitter.on(`migration-${jobId}`, listener);

            // Heartbeat: send a comment ping every 15s to keep the SSE connection
            // alive through proxies, load balancers, and browser idle timeouts.
            const heartbeat = setInterval(() => {
                try {
                    observer.next({ data: '__heartbeat__', type: 'ping' } as MessageEvent);
                } catch {
                    // observer may be closed; cleanup will handle it
                }
            }, 15_000);

            // Cleanup when client disconnects or migration ends
            const cleanup = () => {
                clearInterval(heartbeat);
                this.migrationService.eventEmitter.removeListener(`migration-${jobId}`, listener);
            };

            return cleanup;
        });
    }
}
