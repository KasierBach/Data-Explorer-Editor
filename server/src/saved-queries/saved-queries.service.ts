import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction, AuditService } from '../audit/audit.service';
import { CreateSavedQueryDto } from './dto/create-saved-query.dto';
import { UpdateSavedQueryDto } from './dto/update-saved-query.dto';
import { ConnectionsService } from '../connections/connections.service';
import { SavedQueryEntity } from './entities/saved-query.entity';

@Injectable()
export class SavedQueriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly connectionsService: ConnectionsService,
  ) {}

  private get savedQueries() {
    return (this.prisma as any).savedQuery;
  }

  private normalizeTags(tags?: string[]) {
    return Array.from(
      new Set(
        (tags ?? [])
          .map((tag) => tag.trim())
          .filter(Boolean)
          .slice(0, 10),
      ),
    );
  }

  private getEmailDomain(email?: string | null) {
    if (!email || !email.includes('@')) {
      return null;
    }
    return email.split('@')[1].toLowerCase();
  }

  private toEntity(savedQuery: any, currentUserId: string): SavedQueryEntity {
    return {
      id: savedQuery.id,
      name: savedQuery.name,
      sql: savedQuery.sql,
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

  private async validateConnectionOwnership(connectionId: string | undefined, userId: string) {
    if (!connectionId) return;
    await this.connectionsService.findOne(connectionId, userId);
  }

  async findAllAvailable(userId: string): Promise<SavedQueryEntity[]> {
    const currentUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    const domain = this.getEmailDomain(currentUser?.email);

    const availableQueries = await this.savedQueries.findMany({
      where: {
        OR: [
          { userId },
          { visibility: 'workspace' },
          ...(domain
            ? [
                {
                  visibility: 'team',
                  user: {
                    email: {
                      endsWith: `@${domain}`,
                      mode: 'insensitive',
                    },
                  },
                },
              ]
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
      },
      orderBy: { updatedAt: 'desc' },
    });

    return availableQueries.map((query) => this.toEntity(query, userId));
  }

  async create(dto: CreateSavedQueryDto, userId: string): Promise<SavedQueryEntity> {
    await this.validateConnectionOwnership(dto.connectionId, userId);

    const savedQuery = await this.savedQueries.create({
      data: {
        name: dto.name.trim(),
        sql: dto.sql,
        database: dto.database?.trim() || null,
        connectionId: dto.connectionId || null,
        visibility: dto.visibility ?? 'private',
        folderId: dto.folderId?.trim() || null,
        tags: this.normalizeTags(dto.tags),
        description: dto.description?.trim() || null,
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

    await this.auditService.log({
      action: AuditAction.DB_QUERY_SAVE,
      userId,
      details: {
        category: 'saved-query',
        savedQueryId: savedQuery.id,
        visibility: savedQuery.visibility,
        connectionId: savedQuery.connectionId,
      },
    });

    return this.toEntity(savedQuery, userId);
  }

  async update(id: string, dto: UpdateSavedQueryDto, userId: string): Promise<SavedQueryEntity> {
    const existing = await this.savedQueries.findFirst({
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

    if (!existing) {
      throw new NotFoundException('Saved query not found or you do not have permission.');
    }

    await this.validateConnectionOwnership(dto.connectionId ?? existing.connectionId ?? undefined, userId);

    const updated = await this.savedQueries.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.sql !== undefined ? { sql: dto.sql } : {}),
        ...(dto.database !== undefined ? { database: dto.database?.trim() || null } : {}),
        ...(dto.connectionId !== undefined ? { connectionId: dto.connectionId || null } : {}),
        ...(dto.visibility !== undefined ? { visibility: dto.visibility } : {}),
        ...(dto.folderId !== undefined ? { folderId: dto.folderId?.trim() || null } : {}),
        ...(dto.tags !== undefined ? { tags: this.normalizeTags(dto.tags) } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
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

    await this.auditService.log({
      action: AuditAction.DB_QUERY_UPDATE,
      userId,
      details: {
        category: 'saved-query',
        savedQueryId: updated.id,
        visibility: updated.visibility,
      },
    });

    return this.toEntity(updated, userId);
  }

  async remove(id: string, userId: string) {
    const existing = await this.savedQueries.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new ForbiddenException('Only the owner can delete this saved query.');
    }

    await this.savedQueries.delete({
      where: { id },
    });

    await this.auditService.log({
      action: AuditAction.DB_QUERY_DELETE,
      userId,
      details: {
        category: 'saved-query',
        savedQueryId: id,
      },
    });

    return { success: true };
  }
}
