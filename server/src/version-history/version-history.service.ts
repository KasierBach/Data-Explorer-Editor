import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditAction, AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

type SupportedResourceType = 'QUERY' | 'ERD';

export interface VersionHistoryAuthor {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

export interface VersionHistoryListItem {
  id: string;
  resourceType: SupportedResourceType;
  resourceId: string;
  versionNumber: number;
  createdAt: Date;
  author: VersionHistoryAuthor;
}

export interface VersionHistoryDetailItem extends VersionHistoryListItem {
  snapshot: Prisma.JsonValue;
}

interface SavedQuerySnapshot {
  name: string;
  sql: string;
  database: string | null;
  connectionId: string | null;
  visibility: string;
  folderId: string | null;
  tags: string[];
  description: string | null;
}

interface ErdWorkspaceSnapshot {
  name: string;
  notes: string | null;
  connectionId: string | null;
  database: string | null;
  layout: Prisma.JsonValue;
}

@Injectable()
export class VersionHistoryService {
  private readonly logger = new Logger(VersionHistoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private get versionHistories() {
    return this.prisma.versionHistory;
  }

  private get userSelect() {
    return {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
    } as const;
  }

  private isHistoryStoreUnavailable(error: unknown) {
    if (!error || typeof error !== 'object') return false;

    const maybeCode = 'code' in error ? String((error as { code: unknown }).code) : '';
    if (maybeCode === 'P2021') return true;

    const message = error instanceof Error ? error.message : String(error);
    return message.includes('VersionHistory') && (
      message.includes('does not exist') ||
      message.includes('Invalid') ||
      message.includes('Could not find')
    );
  }

  private buildHistoryStoreUnavailableException() {
    return new ServiceUnavailableException({
      message: 'Version history is temporarily unavailable until the database schema is synced.',
      reason: 'VERSION_HISTORY_STORAGE_UNAVAILABLE',
      action: 'Run prisma db push on the server database and restart the backend.',
    });
  }

  private parseResourceType(rawResourceType: string): SupportedResourceType {
    const normalized = rawResourceType.trim().toUpperCase();
    if (normalized === 'QUERY' || normalized === 'ERD') {
      return normalized;
    }

    throw new BadRequestException('Version history currently supports only QUERY and ERD resources.');
  }

  private toListItem(version: {
    id: string;
    resourceType: string;
    resourceId: string;
    versionNumber: number;
    createdAt: Date;
    user: VersionHistoryAuthor;
  }): VersionHistoryListItem {
    return {
      id: version.id,
      resourceType: version.resourceType as SupportedResourceType,
      resourceId: version.resourceId,
      versionNumber: version.versionNumber,
      createdAt: version.createdAt,
      author: version.user,
    };
  }

  private toSavedQueryEntity(savedQuery: any, currentUserId: string) {
    return {
      id: savedQuery.id,
      name: savedQuery.name,
      sql: savedQuery.sql,
      organizationId: savedQuery.organizationId,
      database: savedQuery.database,
      connectionId: savedQuery.connectionId,
      visibility: savedQuery.visibility,
      folderId: savedQuery.folderId,
      tags: savedQuery.tags ?? [],
      description: savedQuery.description,
      createdAt: savedQuery.createdAt,
      updatedAt: savedQuery.updatedAt,
      owner: {
        id: savedQuery.user.id,
        email: savedQuery.user.email,
        firstName: savedQuery.user.firstName,
        lastName: savedQuery.user.lastName,
      },
      isOwner: savedQuery.userId === currentUserId,
    };
  }

  private toErdWorkspaceEntity(workspace: any, currentUserId: string) {
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

  private buildSavedQuerySnapshot(savedQuery: any): SavedQuerySnapshot {
    return {
      name: savedQuery.name,
      sql: savedQuery.sql,
      database: savedQuery.database ?? null,
      connectionId: savedQuery.connectionId ?? null,
      visibility: savedQuery.visibility,
      folderId: savedQuery.folderId ?? null,
      tags: Array.isArray(savedQuery.tags) ? savedQuery.tags : [],
      description: savedQuery.description ?? null,
    };
  }

  private buildErdWorkspaceSnapshot(workspace: any): ErdWorkspaceSnapshot {
    return {
      name: workspace.name,
      notes: workspace.notes ?? null,
      connectionId: workspace.connectionId ?? null,
      database: workspace.database ?? null,
      layout: (workspace.layout ?? {}) as Prisma.JsonValue,
    };
  }

  private async assertResourceAccessible(
    resourceType: SupportedResourceType,
    resourceId: string,
    userId: string,
  ) {
    if (resourceType === 'QUERY') {
      const savedQuery = await this.prisma.savedQuery.findFirst({
        where: {
          id: resourceId,
          OR: [
            { userId },
            { visibility: 'workspace' },
            { organization: { members: { some: { userId } } } },
          ],
        },
        include: {
          user: {
            select: this.userSelect,
          },
        },
      });

      if (!savedQuery) {
        throw new NotFoundException('Saved query not found or you do not have access.');
      }

      return savedQuery;
    }

    const workspace = await this.prisma.erdWorkspace.findFirst({
      where: {
        id: resourceId,
        OR: [
          { userId },
          { organization: { members: { some: { userId } } } },
        ],
      },
      include: {
        user: {
          select: this.userSelect,
        },
      },
    });

    if (!workspace) {
      throw new NotFoundException('ERD workspace not found or you do not have access.');
    }

    return workspace;
  }

  private async assertResourceOwner(
    resourceType: SupportedResourceType,
    resourceId: string,
    userId: string,
  ) {
    if (resourceType === 'QUERY') {
      const savedQuery = await this.prisma.savedQuery.findFirst({
        where: { id: resourceId, userId },
        include: {
          user: {
            select: this.userSelect,
          },
        },
      });

      if (!savedQuery) {
        throw new NotFoundException('Saved query not found or you do not have permission.');
      }

      return savedQuery;
    }

    const workspace = await this.prisma.erdWorkspace.findFirst({
      where: { id: resourceId, userId },
      include: {
        user: {
          select: this.userSelect,
        },
      },
    });

    if (!workspace) {
      throw new NotFoundException('ERD workspace not found or you do not have permission.');
    }

    return workspace;
  }

  private async createVersionRecord(
    resourceType: SupportedResourceType,
    resourceId: string,
    snapshot: Prisma.InputJsonValue,
    userId: string,
  ) {
    try {
      const latestVersion = await this.versionHistories.findFirst({
        where: { resourceType, resourceId },
        orderBy: { versionNumber: 'desc' },
        select: { versionNumber: true },
      });

      return await this.versionHistories.create({
        data: {
          resourceType,
          resourceId,
          versionNumber: (latestVersion?.versionNumber ?? 0) + 1,
          snapshot,
          userId,
        },
        include: {
          user: {
            select: this.userSelect,
          },
        },
      });
    } catch (error) {
      if (this.isHistoryStoreUnavailable(error)) {
        throw this.buildHistoryStoreUnavailableException();
      }
      throw error;
    }
  }

  async recordSavedQueryVersion(savedQuery: any, userId: string) {
    try {
      return await this.createVersionRecord(
        'QUERY',
        savedQuery.id,
        this.buildSavedQuerySnapshot(savedQuery) as unknown as Prisma.InputJsonValue,
        userId,
      );
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        this.logger.warn(`Skipping saved query version snapshot because storage is unavailable. queryId=${savedQuery.id}`);
        return null;
      }
      throw error;
    }
  }

  async recordErdWorkspaceVersion(workspace: any, userId: string) {
    try {
      return await this.createVersionRecord(
        'ERD',
        workspace.id,
        this.buildErdWorkspaceSnapshot(workspace) as unknown as Prisma.InputJsonValue,
        userId,
      );
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        this.logger.warn(`Skipping ERD workspace version snapshot because storage is unavailable. workspaceId=${workspace.id}`);
        return null;
      }
      throw error;
    }
  }

  async listVersions(rawResourceType: string, resourceId: string, userId: string) {
    const resourceType = this.parseResourceType(rawResourceType);
    await this.assertResourceAccessible(resourceType, resourceId, userId);

    try {
      const versions = await this.versionHistories.findMany({
        where: { resourceType, resourceId },
        include: {
          user: {
            select: this.userSelect,
          },
        },
        orderBy: [
          { versionNumber: 'desc' },
          { createdAt: 'desc' },
        ],
      });

      return versions.map((version) => this.toListItem(version));
    } catch (error) {
      if (this.isHistoryStoreUnavailable(error)) {
        throw this.buildHistoryStoreUnavailableException();
      }
      throw error;
    }
  }

  async getVersion(rawResourceType: string, resourceId: string, versionId: string, userId: string): Promise<VersionHistoryDetailItem> {
    const resourceType = this.parseResourceType(rawResourceType);
    await this.assertResourceAccessible(resourceType, resourceId, userId);

    try {
      const version = await this.versionHistories.findFirst({
        where: {
          id: versionId,
          resourceType,
          resourceId,
        },
        include: {
          user: {
            select: this.userSelect,
          },
        },
      });

      if (!version) {
        throw new NotFoundException('Version snapshot not found.');
      }

      return {
        ...this.toListItem(version),
        snapshot: version.snapshot,
      };
    } catch (error) {
      if (this.isHistoryStoreUnavailable(error)) {
        throw this.buildHistoryStoreUnavailableException();
      }
      throw error;
    }
  }

  async restoreVersion(rawResourceType: string, resourceId: string, versionId: string, userId: string) {
    const resourceType = this.parseResourceType(rawResourceType);
    await this.assertResourceOwner(resourceType, resourceId, userId);
    const version = await this.getVersion(resourceType, resourceId, versionId, userId);

    if (resourceType === 'QUERY') {
      const snapshot = version.snapshot as unknown as SavedQuerySnapshot;
      const restored = await this.prisma.savedQuery.update({
        where: { id: resourceId },
        data: {
          name: snapshot.name,
          sql: snapshot.sql,
          database: snapshot.database,
          connectionId: snapshot.connectionId,
          visibility: snapshot.visibility,
          folderId: snapshot.folderId,
          tags: Array.isArray(snapshot.tags) ? snapshot.tags : [],
          description: snapshot.description,
        },
        include: {
          user: {
            select: this.userSelect,
          },
        },
      });

      const newVersion = await this.recordSavedQueryVersion(restored, userId);
      await this.auditService.log({
        action: AuditAction.DB_QUERY_UPDATE,
        userId,
        details: {
          category: 'saved-query',
          savedQueryId: restored.id,
          restoredFromVersionId: version.id,
          restoredFromVersionNumber: version.versionNumber,
        },
      });

      return {
        resource: this.toSavedQueryEntity(restored, userId),
        restoredFromVersionId: version.id,
        restoredFromVersionNumber: version.versionNumber,
        newVersionNumber: newVersion?.versionNumber ?? null,
      };
    }

    const snapshot = version.snapshot as unknown as ErdWorkspaceSnapshot;
    const restored = await this.prisma.erdWorkspace.update({
      where: { id: resourceId },
      data: {
        name: snapshot.name,
        notes: snapshot.notes,
        connectionId: snapshot.connectionId,
        database: snapshot.database,
        layout: snapshot.layout as Prisma.InputJsonValue,
      },
      include: {
        user: {
          select: this.userSelect,
        },
      },
    });

    const newVersion = await this.recordErdWorkspaceVersion(restored, userId);
    await this.auditService.log({
      action: AuditAction.ERD_WORKSPACE_UPDATE,
      userId,
      details: {
        category: 'erd-workspace',
        workspaceId: restored.id,
        restoredFromVersionId: version.id,
        restoredFromVersionNumber: version.versionNumber,
      },
    });

    return {
      resource: this.toErdWorkspaceEntity(restored, userId),
      restoredFromVersionId: version.id,
      restoredFromVersionNumber: version.versionNumber,
      newVersionNumber: newVersion?.versionNumber ?? null,
    };
  }
}
