import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OrganizationsRepository } from '../repositories/organizations.repository';
import { OrganizationRole } from '../entities/organization-role.enum';
import { AuditAction, AuditService } from '../../audit/audit.service';
import { PermissionsService } from '../../permissions/services/permissions.service';
import { ResourceType } from '../../permissions/enums/resource-type.enum';

export interface OrganizationBackupTeamspace {
  sourceId: string;
  name: string;
  slug: string;
  description: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationBackupResourcePolicy {
  resourceType: ResourceType;
  resourceId: string;
  permissions: unknown;
  teamspaceId: string | null;
}

export interface OrganizationBackupSavedQuery {
  sourceId: string;
  name: string;
  sql: string;
  database: string | null;
  connectionId: string | null;
  visibility: string;
  folderId: string | null;
  tags: string[];
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationBackupDashboardWidget {
  sourceId: string;
  title: string;
  chartType: string;
  queryText: string | null;
  connectionId: string | null;
  database: string | null;
  columns: string[];
  xAxis: string | null;
  yAxis: string[];
  orderIndex: number;
  config: unknown;
  dataSnapshot: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationBackupDashboard {
  sourceId: string;
  name: string;
  description: string | null;
  visibility: string;
  connectionId: string | null;
  database: string | null;
  createdAt: string;
  updatedAt: string;
  widgets: OrganizationBackupDashboardWidget[];
}

export interface OrganizationBackupErdWorkspace {
  sourceId: string;
  name: string;
  notes: string | null;
  connectionId: string | null;
  database: string | null;
  layout: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationBackupPackage {
  version: 1;
  exportedAt: string;
  organization: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    settings: Record<string, unknown> | null;
  };
  notes: string[];
  teamspaces: OrganizationBackupTeamspace[];
  resourcePolicies: OrganizationBackupResourcePolicy[];
  savedQueries: OrganizationBackupSavedQuery[];
  dashboards: OrganizationBackupDashboard[];
  erdWorkspaces: OrganizationBackupErdWorkspace[];
}

export interface OrganizationBackupRestoreResult {
  organizationId: string;
  restoredAt: string;
  created: {
    teamspaces: number;
    savedQueries: number;
    dashboards: number;
    dashboardWidgets: number;
    erdWorkspaces: number;
    resourcePolicies: number;
  };
  warnings: string[];
}

@Injectable()
export class OrganizationBackupService {
  private readonly repository: OrganizationsRepository;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly permissions: PermissionsService,
  ) {
    this.repository = new OrganizationsRepository(prisma);
  }

  async exportOrganizationBackup(organizationId: string, userId: string): Promise<OrganizationBackupPackage> {
    await this.ensureMemberAccess(organizationId, userId);

    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        settings: true,
      },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found.');
    }

    const [teamspaces, resourcePolicies, savedQueries, dashboards, erdWorkspaces] = await Promise.all([
      this.prisma.teamspace.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.organizationResource.findMany({
        where: {
          organizationId,
          resourceType: {
            in: [ResourceType.QUERY, ResourceType.DASHBOARD, ResourceType.ERD],
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.savedQuery.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.dashboard.findMany({
        where: { organizationId },
        include: {
          widgets: {
            orderBy: { orderIndex: 'asc' },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.erdWorkspace.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const backup: OrganizationBackupPackage = {
      version: 1,
      exportedAt: new Date().toISOString(),
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        logoUrl: organization.logoUrl ?? null,
        settings: (organization.settings as Record<string, unknown> | null) ?? null,
      },
      notes: [
        'Connection secrets are not included.',
        'Restore recreates teamspaces and saved artifacts, then reattaches sharing metadata.',
      ],
      teamspaces: teamspaces.map((teamspace) => ({
        sourceId: teamspace.id,
        name: teamspace.name,
        slug: teamspace.slug,
        description: teamspace.description ?? null,
        createdBy: teamspace.createdBy ?? null,
        createdAt: teamspace.createdAt.toISOString(),
        updatedAt: teamspace.updatedAt.toISOString(),
      })),
      resourcePolicies: resourcePolicies.map((policy) => ({
        resourceType: policy.resourceType as ResourceType,
        resourceId: policy.resourceId,
        permissions: policy.permissions,
        teamspaceId: policy.teamspaceId ?? null,
      })),
      savedQueries: savedQueries.map((query) => ({
        sourceId: query.id,
        name: query.name,
        sql: query.sql,
        database: query.database ?? null,
        connectionId: query.connectionId ?? null,
        visibility: query.visibility,
        folderId: query.folderId ?? null,
        tags: Array.isArray(query.tags) ? query.tags : [],
        description: query.description ?? null,
        createdAt: query.createdAt.toISOString(),
        updatedAt: query.updatedAt.toISOString(),
      })),
      dashboards: dashboards.map((dashboard: any) => ({
        sourceId: dashboard.id,
        name: dashboard.name,
        description: dashboard.description ?? null,
        visibility: dashboard.visibility,
        connectionId: dashboard.connectionId ?? null,
        database: dashboard.database ?? null,
        createdAt: dashboard.createdAt.toISOString(),
        updatedAt: dashboard.updatedAt.toISOString(),
        widgets: (dashboard.widgets ?? []).map((widget: any) => ({
          sourceId: widget.id,
          title: widget.title,
          chartType: widget.chartType,
          queryText: widget.queryText ?? null,
          connectionId: widget.connectionId ?? null,
          database: widget.database ?? null,
          columns: Array.isArray(widget.columns) ? widget.columns : [],
          xAxis: widget.xAxis ?? null,
          yAxis: Array.isArray(widget.yAxis) ? widget.yAxis : [],
          orderIndex: widget.orderIndex ?? 0,
          config: widget.config ?? null,
          dataSnapshot: widget.dataSnapshot ?? [],
          createdAt: widget.createdAt.toISOString(),
          updatedAt: widget.updatedAt.toISOString(),
        })),
      })),
      erdWorkspaces: erdWorkspaces.map((workspace) => ({
        sourceId: workspace.id,
        name: workspace.name,
        notes: workspace.notes ?? null,
        connectionId: workspace.connectionId ?? null,
        database: workspace.database ?? null,
        layout: workspace.layout,
        createdAt: workspace.createdAt.toISOString(),
        updatedAt: workspace.updatedAt.toISOString(),
      })),
    };

    await this.audit.log({
      action: AuditAction.BACKUP_EXPORT,
      userId,
      organizationId,
      details: {
        teamspaces: backup.teamspaces.length,
        savedQueries: backup.savedQueries.length,
        dashboards: backup.dashboards.length,
        erdWorkspaces: backup.erdWorkspaces.length,
      },
    });

    return backup;
  }

  async restoreOrganizationBackup(
    organizationId: string,
    userId: string,
    backup: OrganizationBackupPackage,
  ): Promise<OrganizationBackupRestoreResult> {
    if (!backup || backup.version !== 1) {
      throw new BadRequestException('Unsupported backup version.');
    }

    await this.ensureOwnerOrAdminAccess(organizationId, userId);

    if (backup.organization.id !== organizationId) {
      throw new ConflictException('This backup belongs to a different organization.');
    }

    const warnings: string[] = [];
    const created = {
      teamspaces: 0,
      savedQueries: 0,
      dashboards: 0,
      dashboardWidgets: 0,
      erdWorkspaces: 0,
      resourcePolicies: 0,
    };

    const teamspaceMap = new Map<string, string>();
    const supportedResourcePolicies = backup.resourcePolicies.filter((policy) =>
      policy.resourceType === ResourceType.QUERY ||
      policy.resourceType === ResourceType.DASHBOARD ||
      policy.resourceType === ResourceType.ERD,
    );

    const policyMap = new Map(
      supportedResourcePolicies.map((policy) => [`${policy.resourceType}:${policy.resourceId}`, policy] as const),
    );

    for (const teamspace of backup.teamspaces) {
      const slug = await this.generateUniqueTeamspaceSlug(organizationId, teamspace.slug || teamspace.name);
      const createdTeamspace = await this.prisma.teamspace.create({
        data: {
          organizationId,
          name: teamspace.name,
          slug,
          description: teamspace.description ?? null,
          createdBy: userId,
        },
      });
      teamspaceMap.set(teamspace.sourceId, createdTeamspace.id);
      created.teamspaces += 1;
    }

    for (const query of backup.savedQueries) {
      const restored = await this.prisma.savedQuery.create({
        data: {
          organizationId,
          userId,
          name: query.name,
          sql: query.sql,
          database: query.database ?? null,
          connectionId: query.connectionId ?? null,
          visibility: query.visibility,
          folderId: query.folderId ?? null,
          tags: Array.isArray(query.tags) ? query.tags : [],
          description: query.description ?? null,
        },
      });

      await this.attachRestoredResourcePolicy(
        organizationId,
        userId,
        ResourceType.QUERY,
        query.sourceId,
        restored.id,
        policyMap,
        teamspaceMap,
      );
      created.savedQueries += 1;
      created.resourcePolicies += 1;
    }

    for (const dashboard of backup.dashboards) {
      const restoredDashboard = await this.prisma.dashboard.create({
        data: {
          organizationId,
          userId,
          name: dashboard.name,
          description: dashboard.description ?? null,
          visibility: dashboard.visibility,
          connectionId: dashboard.connectionId ?? null,
          database: dashboard.database ?? null,
        },
      });

      await this.attachRestoredResourcePolicy(
        organizationId,
        userId,
        ResourceType.DASHBOARD,
        dashboard.sourceId,
        restoredDashboard.id,
        policyMap,
        teamspaceMap,
      );

      for (const widget of dashboard.widgets) {
        await this.prisma.dashboardWidget.create({
          data: {
            dashboardId: restoredDashboard.id,
            title: widget.title,
            chartType: widget.chartType,
            queryText: widget.queryText ?? null,
            connectionId: widget.connectionId ?? null,
            database: widget.database ?? null,
            columns: Array.isArray(widget.columns) ? widget.columns : [],
            xAxis: widget.xAxis ?? null,
            yAxis: Array.isArray(widget.yAxis) ? widget.yAxis : [],
            orderIndex: widget.orderIndex ?? 0,
            config: (widget.config ?? Prisma.JsonNull) as Prisma.InputJsonValue,
            dataSnapshot: (widget.dataSnapshot ?? []) as Prisma.InputJsonValue,
          },
        });
        created.dashboardWidgets += 1;
      }

      created.dashboards += 1;
      created.resourcePolicies += 1;
    }

    for (const workspace of backup.erdWorkspaces) {
      const restoredWorkspace = await this.prisma.erdWorkspace.create({
        data: {
          organizationId,
          userId,
          name: workspace.name,
          notes: workspace.notes ?? null,
          connectionId: workspace.connectionId ?? null,
          database: workspace.database ?? null,
          layout: workspace.layout as Prisma.InputJsonValue,
        },
      });

      await this.attachRestoredResourcePolicy(
        organizationId,
        userId,
        ResourceType.ERD,
        workspace.sourceId,
        restoredWorkspace.id,
        policyMap,
        teamspaceMap,
      );
      created.erdWorkspaces += 1;
      created.resourcePolicies += 1;
    }

    await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        name: backup.organization.name,
        logoUrl: backup.organization.logoUrl ?? null,
        settings: (backup.organization.settings ?? {}) as Prisma.InputJsonValue,
      },
    });

    await this.audit.log({
      action: AuditAction.BACKUP_RESTORE,
      userId,
      organizationId,
      details: {
        teamspaces: created.teamspaces,
        savedQueries: created.savedQueries,
        dashboards: created.dashboards,
        erdWorkspaces: created.erdWorkspaces,
      },
    });

    if (supportedResourcePolicies.length < backup.resourcePolicies.length) {
      warnings.push('Some resource policies in the backup were skipped because they are not currently restored by this flow.');
    }

    return {
      organizationId,
      restoredAt: new Date().toISOString(),
      created,
      warnings,
    };
  }

  private async attachRestoredResourcePolicy(
    organizationId: string,
    userId: string,
    resourceType: ResourceType,
    sourceId: string,
    restoredId: string,
    policyMap: Map<string, OrganizationBackupResourcePolicy>,
    teamspaceMap: Map<string, string>,
  ) {
    const policy = policyMap.get(`${resourceType}:${sourceId}`);
    const mappedTeamspaceId = policy?.teamspaceId ? (teamspaceMap.get(policy.teamspaceId) ?? null) : null;

    if (policy?.teamspaceId && !mappedTeamspaceId) {
      // The resource policy referenced a teamspace that was not part of the backup.
      // Keep the resource restored and fall back to an unassigned policy.
    }

    await this.prisma.organizationResource.upsert({
      where: {
        resourceType_resourceId_organizationId: {
          resourceType,
          resourceId: restoredId,
          organizationId,
        },
      },
      create: {
        resourceType,
        resourceId: restoredId,
        organizationId,
        permissions: (policy?.permissions ?? this.permissions.buildDefaultResourcePolicy()) as Prisma.InputJsonValue,
        teamspaceId: mappedTeamspaceId,
      },
      update: {
        permissions: (policy?.permissions ?? this.permissions.buildDefaultResourcePolicy()) as Prisma.InputJsonValue,
        teamspaceId: mappedTeamspaceId,
      },
    });
  }

  private async generateUniqueTeamspaceSlug(organizationId: string, rawSlug: string) {
    const baseSlug = this.slugify(rawSlug) || 'teamspace';
    let candidate = baseSlug;
    let suffix = 2;

    while (await this.prisma.teamspace.findFirst({ where: { organizationId, slug: candidate } })) {
      candidate = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    return candidate;
  }

  private slugify(value: string) {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  private async ensureMemberAccess(organizationId: string, userId: string) {
    const member = await this.repository.findMember(organizationId, userId);
    if (!member) {
      throw new ForbiddenException('You are not a member');
    }
  }

  private async ensureOwnerOrAdminAccess(organizationId: string, userId: string) {
    const member = await this.repository.findMember(organizationId, userId);
    if (!member) {
      throw new ForbiddenException('You are not a member');
    }

    const allowed = [OrganizationRole.OWNER, OrganizationRole.ADMIN];
    if (!allowed.includes(member.role as OrganizationRole)) {
      throw new ForbiddenException('Only owners and admins can perform this action');
    }
  }
}
