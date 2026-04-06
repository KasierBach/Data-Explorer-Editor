import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction, AuditService } from '../audit/audit.service';
import { ConnectionsService } from '../connections/connections.service';
import { CreateDashboardDto } from './dto/create-dashboard.dto';
import { AddDashboardWidgetDto } from './dto/add-dashboard-widget.dto';
import { DashboardEntity } from './entities/dashboard.entity';

@Injectable()
export class DashboardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly connectionsService: ConnectionsService,
  ) {}

  private get dashboards() {
    return (this.prisma as any).dashboard;
  }

  private get dashboardWidgets() {
    return (this.prisma as any).dashboardWidget;
  }

  private getEmailDomain(email?: string | null) {
    if (!email || !email.includes('@')) {
      return null;
    }
    return email.split('@')[1].toLowerCase();
  }

  private async validateConnectionOwnership(connectionId: string | undefined | null, userId: string) {
    if (!connectionId) return;
    await this.connectionsService.findOne(connectionId, userId);
  }

  private toEntity(dashboard: any, currentUserId: string): DashboardEntity {
    return {
      id: dashboard.id,
      name: dashboard.name,
      description: dashboard.description,
      visibility: dashboard.visibility,
      connectionId: dashboard.connectionId,
      database: dashboard.database,
      createdAt: dashboard.createdAt,
      updatedAt: dashboard.updatedAt,
      owner: {
        id: dashboard.user.id,
        email: dashboard.user.email,
        firstName: dashboard.user.firstName,
        lastName: dashboard.user.lastName,
      },
      isOwner: dashboard.userId === currentUserId,
      widgets: (dashboard.widgets ?? [])
        .slice()
        .sort((a: any, b: any) => a.orderIndex - b.orderIndex || a.createdAt.getTime() - b.createdAt.getTime())
        .map((widget: any) => ({
          id: widget.id,
          title: widget.title,
          chartType: widget.chartType,
          queryText: widget.queryText,
          connectionId: widget.connectionId,
          database: widget.database,
          columns: widget.columns ?? [],
          xAxis: widget.xAxis,
          yAxis: widget.yAxis ?? [],
          orderIndex: widget.orderIndex ?? 0,
          config: widget.config ?? null,
          dataSnapshot: Array.isArray(widget.dataSnapshot) ? widget.dataSnapshot : [],
          createdAt: widget.createdAt,
          updatedAt: widget.updatedAt,
        })),
    };
  }

  async findAllAvailable(userId: string): Promise<DashboardEntity[]> {
    const currentUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    const domain = this.getEmailDomain(currentUser?.email);

    const dashboards = await this.dashboards.findMany({
      where: {
        OR: [
          { userId },
          { visibility: 'workspace' },
          ...(domain
            ? [{
                visibility: 'team',
                user: {
                  email: {
                    endsWith: `@${domain}`,
                    mode: 'insensitive',
                  },
                },
              }]
            : []),
        ],
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        widgets: {
          orderBy: { orderIndex: 'asc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return dashboards.map((dashboard: any) => this.toEntity(dashboard, userId));
  }

  async findOne(id: string, userId: string): Promise<DashboardEntity> {
    const dashboards = await this.findAllAvailable(userId);
    const dashboard = dashboards.find((entry) => entry.id === id);
    if (!dashboard) {
      throw new NotFoundException('Dashboard not found or not accessible.');
    }
    return dashboard;
  }

  async create(dto: CreateDashboardDto, userId: string): Promise<DashboardEntity> {
    await this.validateConnectionOwnership(dto.connectionId, userId);

    const dashboard = await this.dashboards.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        visibility: dto.visibility ?? 'private',
        connectionId: dto.connectionId || null,
        database: dto.database?.trim() || null,
        userId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        widgets: true,
      },
    });

    await this.auditService.log({
      action: AuditAction.DASHBOARD_CREATE,
      userId,
      details: {
        category: 'dashboard',
        dashboardId: dashboard.id,
        visibility: dashboard.visibility,
        connectionId: dashboard.connectionId,
      },
    });

    return this.toEntity(dashboard, userId);
  }

  async addWidget(dashboardId: string, dto: AddDashboardWidgetDto, userId: string): Promise<DashboardEntity> {
    const dashboard = await this.dashboards.findFirst({
      where: { id: dashboardId, userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        widgets: true,
      },
    });

    if (!dashboard) {
      throw new ForbiddenException('Only the dashboard owner can add widgets.');
    }

    await this.validateConnectionOwnership(dto.connectionId ?? dashboard.connectionId, userId);

    const widgetCount = dashboard.widgets?.length ?? 0;
    await this.dashboardWidgets.create({
      data: {
        dashboardId,
        title: dto.title.trim(),
        chartType: dto.chartType,
        queryText: dto.queryText?.trim() || null,
        connectionId: dto.connectionId || dashboard.connectionId || null,
        database: dto.database?.trim() || dashboard.database || null,
        columns: dto.columns ?? [],
        xAxis: dto.xAxis?.trim() || null,
        yAxis: dto.yAxis ?? [],
        orderIndex: dto.orderIndex ?? widgetCount,
        config: dto.config ?? null,
        dataSnapshot: dto.dataSnapshot ?? [],
      },
    });

    await this.auditService.log({
      action: AuditAction.DASHBOARD_WIDGET_CREATE,
      userId,
      details: {
        category: 'dashboard-widget',
        dashboardId,
        chartType: dto.chartType,
        title: dto.title,
      },
    });

    const updated = await this.dashboards.findFirst({
      where: { id: dashboardId, userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        widgets: {
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    return this.toEntity(updated, userId);
  }

  async removeWidget(dashboardId: string, widgetId: string, userId: string) {
    const dashboard = await this.dashboards.findFirst({
      where: { id: dashboardId, userId },
      select: { id: true },
    });

    if (!dashboard) {
      throw new ForbiddenException('Only the dashboard owner can delete widgets.');
    }

    const widget = await this.dashboardWidgets.findFirst({
      where: { id: widgetId, dashboardId },
      select: { id: true },
    });

    if (!widget) {
      throw new NotFoundException('Dashboard widget not found.');
    }

    await this.dashboardWidgets.delete({
      where: { id: widgetId },
    });

    await this.auditService.log({
      action: AuditAction.DASHBOARD_WIDGET_DELETE,
      userId,
      details: {
        category: 'dashboard-widget',
        dashboardId,
        widgetId,
      },
    });

    return { success: true };
  }
}
