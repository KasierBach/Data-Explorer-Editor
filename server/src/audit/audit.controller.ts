import { Controller, Get, UseGuards, Query, Req } from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedRequest } from '../auth/auth-request.types';

const DEFAULT_AUDIT_LOG_LIMIT = 100;
const MAX_AUDIT_LOG_LIMIT = 500;

@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  private parseLimit(limitArg?: string) {
    const parsed = Number.parseInt(limitArg ?? '', 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return DEFAULT_AUDIT_LOG_LIMIT;
    }

    return Math.min(parsed, MAX_AUDIT_LOG_LIMIT);
  }

  @Get()
  @Roles('admin')
  async getLogs(@Query('limit') limitArg: string) {
    return this.auditService.getLogs(this.parseLimit(limitArg));
  }

  @Get('me')
  async getMyLogs(
    @Req() req: AuthenticatedRequest,
    @Query('limit') limitArg: string,
  ) {
    return this.auditService.getLogsByUser(
      req.user.id,
      this.parseLimit(limitArg),
    );
  }
}
