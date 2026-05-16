import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DashboardsService } from './dashboards.service';
import { CreateDashboardDto } from './dto/create-dashboard.dto';
import { AddDashboardWidgetDto } from './dto/add-dashboard-widget.dto';
import type { AuthenticatedRequest } from '../auth/auth-request.types';

@Controller('dashboards')
@UseGuards(JwtAuthGuard)
export class DashboardsController {
  constructor(private readonly dashboardsService: DashboardsService) {}

  @Get()
  findAll(@Req() req: AuthenticatedRequest) {
    return this.dashboardsService.findAllAvailable(req.user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.dashboardsService.findOne(id, req.user.id);
  }

  @Post()
  create(@Body() dto: CreateDashboardDto, @Req() req: AuthenticatedRequest) {
    return this.dashboardsService.create(dto, req.user.id);
  }

  @Post(':id/widgets')
  addWidget(
    @Param('id') id: string,
    @Body() dto: AddDashboardWidgetDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.dashboardsService.addWidget(id, dto, req.user.id);
  }

  @Delete(':dashboardId/widgets/:widgetId')
  removeWidget(
    @Param('dashboardId') dashboardId: string,
    @Param('widgetId') widgetId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.dashboardsService.removeWidget(
      dashboardId,
      widgetId,
      req.user.id,
    );
  }
}
