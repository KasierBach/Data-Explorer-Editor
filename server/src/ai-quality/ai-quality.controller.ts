import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AiQualityService } from './ai-quality.service';
import type { AuthenticatedRequest } from '../auth/auth-request.types';

function parseDays(daysArg?: string): number {
  const parsed = Number.parseInt(daysArg ?? '', 10);
  return Number.isFinite(parsed) ? Math.min(90, Math.max(1, parsed)) : 30;
}

/** Personal AI usage stats — available to every authenticated user. */
@Controller('ai-quality')
@UseGuards(JwtAuthGuard)
export class AiUsageController {
  constructor(private readonly aiQualityService: AiQualityService) {}

  @Get('my-usage')
  getMyUsage(
    @Req() req: AuthenticatedRequest,
    @Query('days') daysArg?: string,
  ) {
    return this.aiQualityService.getUserUsage(req.user.id, parseDays(daysArg));
  }
}

/** Platform-wide AI quality metrics — admin only. */
@Controller('admin/ai-quality')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AiQualityController {
  constructor(private readonly aiQualityService: AiQualityService) {}

  @Get()
  getMetrics(@Query('days') daysArg?: string) {
    return this.aiQualityService.getMetrics(parseDays(daysArg));
  }
}
