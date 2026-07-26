import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AiQualityService } from './ai-quality.service';

@Controller('admin/ai-quality')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AiQualityController {
  constructor(private readonly aiQualityService: AiQualityService) {}

  @Get()
  getMetrics(@Query('days') daysArg?: string) {
    const parsed = Number.parseInt(daysArg ?? '', 10);
    const days = Number.isFinite(parsed)
      ? Math.min(90, Math.max(1, parsed))
      : 30;
    return this.aiQualityService.getMetrics(days);
  }
}
