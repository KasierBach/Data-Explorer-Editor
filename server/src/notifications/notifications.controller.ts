import { Controller, Sse, UseGuards, Req, Post, HttpCode, HttpStatus, Query, UnauthorizedException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Observable } from 'rxjs';
import type { AuthenticatedRequest } from '../auth/auth-request.types';
import { TokenService } from '../auth/token.service';

@Controller('notifications')
export class NotificationsController {
    constructor(
        private readonly notificationsService: NotificationsService,
        private readonly tokenService: TokenService,
    ) {}

    @Post('stream-ticket')
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.OK)
    createStreamTicket(@Req() req: AuthenticatedRequest) {
        return {
            ticket: this.tokenService.createNotificationsStreamTicket(req.user.id),
        };
    }

    @Sse('stream')
    stream(@Query('ticket') ticket: string): Observable<any> {
        const payload = this.tokenService.verifyNotificationsStreamTicket(ticket);
        if (!payload.sub) {
            throw new UnauthorizedException('Notifications stream ticket is invalid.');
        }

        return this.notificationsService.eventStream(payload.sub);
    }
}
