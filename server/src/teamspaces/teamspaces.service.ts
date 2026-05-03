import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationsRepository } from '../organizations/repositories/organizations.repository';
import { AuditAction, AuditService } from '../audit/audit.service';
import { PermissionsService } from '../permissions/services/permissions.service';
import { ResourceType } from '../permissions/enums/resource-type.enum';
import { OrganizationRole } from '../organizations/entities/organization-role.enum';
import { CreateTeamspaceDto } from './dto/create-teamspace.dto';
import { UpdateTeamspaceDto } from './dto/update-teamspace.dto';

type TeamspaceListItem = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  createdBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
  organizationId: string;
  resourceCount: number;
  creator: {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    avatarUrl?: string | null;
  } | null;
};

@Injectable()
export class TeamspacesService {
  private readonly repository: OrganizationsRepository;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly permissions: PermissionsService,
  ) {
    this.repository = new OrganizationsRepository(prisma);
  }

  async list(organizationId: string, userId: string): Promise<TeamspaceListItem[]> {
    await this.ensureMemberAccess(organizationId, userId);

    const teamspaces = await this.prisma.teamspace.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'asc' },
      include: {
        creator: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        _count: {
          select: {
            resources: true,
          },
        },
      },
    });

    return teamspaces.map((teamspace) => ({
      id: teamspace.id,
      name: teamspace.name,
      slug: teamspace.slug,
      description: teamspace.description,
      createdBy: teamspace.createdBy,
      createdAt: teamspace.createdAt,
      updatedAt: teamspace.updatedAt,
      organizationId: teamspace.organizationId,
      resourceCount: teamspace._count.resources,
      creator: teamspace.creator,
    }));
  }

  async create(organizationId: string, userId: string, dto: CreateTeamspaceDto): Promise<TeamspaceListItem> {
    await this.ensureOwnerOrAdminAccess(organizationId, userId);

    const name = dto.name.trim();
    if (!name) {
      throw new ConflictException('Teamspace name is required');
    }

    const slug = await this.generateUniqueSlug(organizationId, name);
    const teamspace = await this.prisma.teamspace.create({
      data: {
        organizationId,
        name,
        slug,
        description: dto.description?.trim() || null,
        createdBy: userId,
      },
      include: {
        creator: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        _count: {
          select: {
            resources: true,
          },
        },
      },
    });

    await this.audit.log({
      action: AuditAction.TEAMSPACE_CREATE,
      userId,
      organizationId,
      details: {
        teamspaceId: teamspace.id,
        name: teamspace.name,
        slug: teamspace.slug,
      },
    });

    return this.toListItem(teamspace);
  }

  async update(
    organizationId: string,
    teamspaceId: string,
    userId: string,
    dto: UpdateTeamspaceDto,
  ): Promise<TeamspaceListItem> {
    await this.ensureOwnerOrAdminAccess(organizationId, userId);

    const teamspace = await this.getTeamspaceOrThrow(organizationId, teamspaceId);
    const data: { name?: string; description?: string | null } = {};

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) {
        throw new ConflictException('Teamspace name is required');
      }

      data.name = name;
    }

    if (dto.description !== undefined) {
      data.description = dto.description?.trim() || null;
    }

    const updated = await this.prisma.teamspace.update({
      where: { id: teamspace.id },
      data,
      include: {
        creator: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        _count: {
          select: {
            resources: true,
          },
        },
      },
    });

    await this.audit.log({
      action: AuditAction.TEAMSPACE_UPDATE,
      userId,
      organizationId,
      details: {
        teamspaceId: updated.id,
        name: updated.name,
      },
    });

    return this.toListItem(updated);
  }

  async delete(organizationId: string, teamspaceId: string, userId: string): Promise<{ id: string; unassignedResourceCount: number }> {
    await this.ensureOwnerOrAdminAccess(organizationId, userId);

    const teamspace = await this.getTeamspaceOrThrow(organizationId, teamspaceId);
    const resourceCount = await this.prisma.organizationResource.count({
      where: {
        organizationId,
        teamspaceId: teamspace.id,
      },
    });

    await this.prisma.$transaction([
      this.prisma.organizationResource.updateMany({
        where: {
          organizationId,
          teamspaceId: teamspace.id,
        },
        data: {
          teamspaceId: null,
        },
      }),
      this.prisma.teamspace.delete({
        where: { id: teamspace.id },
      }),
    ]);

    await this.audit.log({
      action: AuditAction.TEAMSPACE_DELETE,
      userId,
      organizationId,
      details: {
        teamspaceId: teamspace.id,
        name: teamspace.name,
        unassignedResourceCount: resourceCount,
      },
    });

    return { id: teamspace.id, unassignedResourceCount: resourceCount };
  }

  async assignResourceTeamspace(
    organizationId: string,
    resourceType: ResourceType,
    resourceId: string,
    userId: string,
    teamspaceId: string | null,
  ) {
    await this.ensureOwnerOrAdminAccess(organizationId, userId);

    if (teamspaceId) {
      await this.getTeamspaceOrThrow(organizationId, teamspaceId);
    }

    const resource = await this.prisma.organizationResource.upsert({
      where: {
        resourceType_resourceId_organizationId: {
          resourceType,
          resourceId,
          organizationId,
        },
      },
      create: {
        resourceType,
        resourceId,
        organizationId,
        permissions: this.permissions.buildDefaultResourcePolicy(),
        teamspaceId,
      },
      update: {
        teamspaceId,
      },
    });

    await this.audit.log({
      action: AuditAction.TEAMSPACE_RESOURCE_ASSIGN,
      userId,
      organizationId,
      details: {
        resourceType,
        resourceId,
        teamspaceId,
      },
    });

    return resource;
  }

  private async getTeamspaceOrThrow(organizationId: string, teamspaceId: string) {
    const teamspace = await this.prisma.teamspace.findFirst({
      where: {
        id: teamspaceId,
        organizationId,
      },
    });

    if (!teamspace) {
      throw new NotFoundException('Teamspace not found');
    }

    return teamspace;
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

  private async generateUniqueSlug(organizationId: string, name: string) {
    const baseSlug = this.slugify(name) || 'teamspace';
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

  private toListItem(teamspace: {
    id: string;
    name: string;
    slug: string;
    description?: string | null;
    createdBy?: string | null;
    createdAt: Date;
    updatedAt: Date;
    organizationId: string;
    creator: TeamspaceListItem['creator'];
    _count: { resources: number };
  }): TeamspaceListItem {
    return {
      id: teamspace.id,
      name: teamspace.name,
      slug: teamspace.slug,
      description: teamspace.description,
      createdBy: teamspace.createdBy,
      createdAt: teamspace.createdAt,
      updatedAt: teamspace.updatedAt,
      organizationId: teamspace.organizationId,
      resourceCount: teamspace._count.resources,
      creator: teamspace.creator,
    };
  }
}
