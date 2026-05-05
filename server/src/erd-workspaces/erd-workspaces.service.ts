import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

interface RawErdWorkspaceUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

interface RawErdWorkspace {
  id: string;
  name: string;
  notes: string | null;
  organizationId: string | null;
  connectionId: string | null;
  database: string | null;
  layout: unknown;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  user: RawErdWorkspaceUser;
  [key: string]: unknown;
}
import { AuditAction, AuditService } from '../audit/audit.service';
import { ConnectionsService } from '../connections/connections.service';
import { CreateErdWorkspaceDto } from './dto/create-erd-workspace.dto';
import { UpdateErdWorkspaceDto } from './dto/update-erd-workspace.dto';
import { ErdWorkspaceEntity } from './entities/erd-workspace.entity';
import { VersionHistoryService } from '../version-history/version-history.service';

@Injectable()
export class ErdWorkspacesService {
  private readonly logger = new Logger(ErdWorkspacesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly connectionsService: ConnectionsService,
    private readonly versionHistoryService: VersionHistoryService,
  ) {}

  private get erdWorkspaces() {
    return this.prisma.erdWorkspace;
  }

  private isWorkspaceStoreUnavailable(error: unknown) {
    if (!error || typeof error !== 'object') return false;

    const maybeCode = 'code' in error ? String((error as { code: unknown }).code) : '';
    if (maybeCode === 'P2021') return true;

    const message = error instanceof Error ? error.message : String(error);
    return (
      message.includes('erdWorkspace') &&
      (
        message.includes('does not exist') ||
        message.includes('Invalid') ||
        message.includes('Could not find')
      )
    );
  }

  private buildWorkspaceStoreUnavailableException() {
    return new ServiceUnavailableException({
      message: 'ERD workspaces are temporarily unavailable until the database schema is synced.',
      reason: 'ERD_WORKSPACE_STORAGE_UNAVAILABLE',
      action: 'Run prisma db push on the server database and restart the backend.',
    });
  }

  private async validateConnectionOwnership(connectionId: string | undefined | null, userId: string) {
    if (!connectionId) return;
    await this.connectionsService.findOne(connectionId, userId);
  }

  private sanitizeName(name: string) {
    return name.trim().slice(0, 120);
  }

  private sanitizeNotes(notes?: string | null) {
    const value = notes?.trim();
    return value ? value.slice(0, 5000) : null;
  }

  private normalizeLayout(layout: unknown) {
    const l = typeof layout === 'object' && layout !== null ? layout as Record<string, unknown> : {};
    return {
      visibleTables: Array.isArray(l.visibleTables) ? l.visibleTables : [],
      nodes: Array.isArray(l.nodes) ? l.nodes : [],
      edges: Array.isArray(l.edges) ? l.edges : [],
      isSidebarCollapsed: !!l.isSidebarCollapsed,
      detailLevel: l.detailLevel || 'all',
      schemaFilter: l.schemaFilter || 'all',
      showMinimap: l.showMinimap ?? true,
      performanceMode: !!l.performanceMode,
      edgeRouting: l.edgeRouting || 'smoothstep',
      backgroundVariant: l.backgroundVariant || 'dots',
      isEdgeAnimated: l.isEdgeAnimated ?? true,
      isToolbarCollapsed: !!l.isToolbarCollapsed,
      collapsedTables: Array.isArray(l.collapsedTables) ? l.collapsedTables : [],
    };
  }

  private toEntity(workspace: RawErdWorkspace, currentUserId: string): ErdWorkspaceEntity {
    return {
      id: workspace.id,
      name: workspace.name,
      notes: workspace.notes,
      organizationId: workspace.organizationId,
      connectionId: workspace.connectionId,
      database: workspace.database,
      layout: (workspace.layout ?? {}) as Record<string, unknown>,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
      owner: {
        id: workspace.user.id,
        email: workspace.user.email,
        firstName: workspace.user.firstName,
        lastName: workspace.user.lastName,
      },
      isOwner: workspace.userId === currentUserId,
    };
  }

  async findAll(userId: string, connectionId?: string): Promise<ErdWorkspaceEntity[]> {
    try {
      const workspaces = await this.erdWorkspaces.findMany({
        where: {
          OR: [
            { userId },
            { organization: { members: { some: { userId } } } },
          ],
          ...(connectionId ? { connectionId } : {}),
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
        },
        orderBy: { updatedAt: 'desc' },
      });

      return workspaces.map((workspace) => this.toEntity(workspace as unknown as RawErdWorkspace, userId));
    } catch (error) {
      if (this.isWorkspaceStoreUnavailable(error)) {
        this.logger.warn('ERD workspace storage is unavailable. Returning an empty workspace list.');
        return [];
      }
      throw error;
    }
  }

  async findOne(id: string, userId: string): Promise<ErdWorkspaceEntity> {
    const workspace = await this.erdWorkspaces.findFirst({
      where: {
        id,
        OR: [
          { userId },
          { organization: { members: { some: { userId } } } },
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
      },
    });

    if (!workspace) {
      throw new NotFoundException('ERD workspace not found.');
    }

    return this.toEntity(workspace, userId);
  }

  async create(dto: CreateErdWorkspaceDto, userId: string): Promise<ErdWorkspaceEntity> {
    await this.validateConnectionOwnership(dto.connectionId, userId);

    let workspace: RawErdWorkspace;
    try {
      workspace = await this.erdWorkspaces.create({
        data: {
          name: this.sanitizeName(dto.name),
          notes: this.sanitizeNotes(dto.notes),
          connectionId: dto.connectionId || null,
          database: dto.database?.trim() || null,
          layout: this.normalizeLayout(dto.layout),
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
        },
      });
    } catch (error) {
      if (this.isWorkspaceStoreUnavailable(error)) {
        throw this.buildWorkspaceStoreUnavailableException();
      }
      throw error;
    }

    await this.auditService.log({
      action: AuditAction.ERD_WORKSPACE_CREATE,
      userId,
      details: {
        category: 'erd-workspace',
        workspaceId: workspace.id,
        connectionId: workspace.connectionId,
        database: workspace.database,
      },
    });

    await this.versionHistoryService.recordErdWorkspaceVersion(workspace, userId);

    return this.toEntity(workspace, userId);
  }

  async update(id: string, dto: UpdateErdWorkspaceDto, userId: string): Promise<ErdWorkspaceEntity> {
    let existing: RawErdWorkspace | null;
    try {
      existing = await this.erdWorkspaces.findFirst({
        where: { id, userId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });
    } catch (error) {
      if (this.isWorkspaceStoreUnavailable(error)) {
        throw this.buildWorkspaceStoreUnavailableException();
      }
      throw error;
    }

    if (!existing) {
      throw new NotFoundException('ERD workspace not found.');
    }

    await this.validateConnectionOwnership(dto.connectionId ?? existing.connectionId ?? undefined, userId);

    let updated: RawErdWorkspace;
    try {
      updated = await this.erdWorkspaces.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: this.sanitizeName(dto.name) } : {}),
          ...(dto.notes !== undefined ? { notes: this.sanitizeNotes(dto.notes) } : {}),
          ...(dto.connectionId !== undefined ? { connectionId: dto.connectionId || null } : {}),
          ...(dto.database !== undefined ? { database: dto.database?.trim() || null } : {}),
          ...(dto.layout !== undefined ? { layout: this.normalizeLayout(dto.layout) } : {}),
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
        },
      });
    } catch (error) {
      if (this.isWorkspaceStoreUnavailable(error)) {
        throw this.buildWorkspaceStoreUnavailableException();
      }
      throw error;
    }

    await this.auditService.log({
      action: AuditAction.ERD_WORKSPACE_UPDATE,
      userId,
      details: {
        category: 'erd-workspace',
        workspaceId: updated.id,
        connectionId: updated.connectionId,
        database: updated.database,
      },
    });

    await this.versionHistoryService.recordErdWorkspaceVersion(updated, userId);

    return this.toEntity(updated, userId);
  }

  async remove(id: string, userId: string) {
    let workspace: { id: string } | null = null;
    try {
      workspace = await this.erdWorkspaces.findFirst({
        where: { id, userId },
        select: { id: true },
      });
    } catch (error) {
      if (this.isWorkspaceStoreUnavailable(error)) {
        throw this.buildWorkspaceStoreUnavailableException();
      }
      throw error;
    }

    if (!workspace) {
      throw new ForbiddenException('Only the workspace owner can delete it.');
    }

    try {
      await this.erdWorkspaces.delete({
        where: { id },
      });
    } catch (error) {
      if (this.isWorkspaceStoreUnavailable(error)) {
        throw this.buildWorkspaceStoreUnavailableException();
      }
      throw error;
    }

    await this.auditService.log({
      action: AuditAction.ERD_WORKSPACE_DELETE,
      userId,
      details: {
        category: 'erd-workspace',
        workspaceId: id,
      },
    });

    return { success: true };
  }
}
