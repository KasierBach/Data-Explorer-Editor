import { Controller, Sse, UseGuards, Req } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Observable } from 'rxjs';

@Controller('notifications')
export class NotificationsController {
    constructor(private readonly notificationsService: NotificationsService) {}

    @Sse('stream')
    @UseGuards(JwtAuthGuard)
    stream(@Req() req: any): Observable<any> {
        const userId = req.user.id;
        return this.notificationsService.eventStream(userId);
    }
}
