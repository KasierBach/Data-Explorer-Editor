import { Controller, Get, UseGuards, Query, Req } from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditController {
    constructor(private readonly auditService: AuditService) { }

    @Get()
    @Roles('admin')
    async getLogs(@Query('limit') limitArg: string) {
        let limit = parseInt(limitArg, 10);
        if (isNaN(limit) || limit <= 0) {
            limit = 100;
        }
        return this.auditService.getLogs(limit);
    }

    @Get('me')
    async getMyLogs(@Req() req: any, @Query('limit') limitArg: string) {
        let limit = parseInt(limitArg, 10);
        if (isNaN(limit) || limit <= 0) {
            limit = 100;
        }
        return this.auditService.getLogsByUser(req.user.id, limit);
    }
}
