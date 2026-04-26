import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Permission } from '../enums/permission.enum';
import { ResourceType } from '../enums/resource-type.enum';
import { OrganizationRole } from '../../organizations/entities/organization-role.enum';

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async ensurePermission(
    userId: string,
    resourceType: ResourceType,
    resourceId: string,
    permission: Permission,
  ): Promise<void> {
    const hasAccess = await this.checkPermission(
      userId,
      resourceType,
      resourceId,
      permission,
    );

    if (!hasAccess) {
      throw new ForbiddenException('Insufficient permissions for this resource');
    }
  }

  async checkPermission(
    userId: string,
    resourceType: ResourceType,
    resourceId: string,
    permission: Permission,
  ): Promise<boolean> {
    const orgId = await this.findResourceOrganizationId(resourceType, resourceId);

    if (orgId) {
      return this.checkOrgPermission(userId, orgId, permission);
    }

    const ownerId = await this.findResourceOwnerId(resourceType, resourceId);

    return ownerId === userId;
  }

  private async checkOrgPermission(
    userId: string,
    orgId: string,
    permission: Permission,
  ): Promise<boolean> {
    const member = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: orgId,
          userId,
        },
      },
    });

    if (!member) return false;

    return this.roleHasPermission(member.role as OrganizationRole, permission);
  }

  private roleHasPermission(role: OrganizationRole, permission: Permission): boolean {
    const map: Record<OrganizationRole, Permission[]> = {
      [OrganizationRole.OWNER]: [
        Permission.READ,
        Permission.WRITE,
        Permission.DELETE,
        Permission.MANAGE,
      ],
      [OrganizationRole.ADMIN]: [
        Permission.READ,
        Permission.WRITE,
        Permission.DELETE,
        Permission.MANAGE,
      ],
      [OrganizationRole.MEMBER]: [Permission.READ, Permission.WRITE],
      [OrganizationRole.VIEWER]: [Permission.READ],
    };

    return map[role]?.includes(permission) ?? false;
  }

  private async findResourceOrganizationId(
    type: ResourceType,
    id: string,
  ): Promise<string | null> {
    const record = await this.findResourceRecord(type, id);

    return record?.organizationId ?? null;
  }

  private async findResourceOwnerId(
    type: ResourceType,
    id: string,
  ): Promise<string | null> {
    const record = await this.findResourceRecord(type, id);

    return record?.userId ?? null;
  }

  private findResourceRecord(type: ResourceType, id: string): Promise<any> {
    switch (type) {
      case ResourceType.CONNECTION:
        return this.prisma.connection.findUnique({ where: { id }, select: { userId: true, organizationId: true } });
      case ResourceType.QUERY:
        return this.prisma.savedQuery.findUnique({ where: { id }, select: { userId: true, organizationId: true } });
      case ResourceType.DASHBOARD:
        return this.prisma.dashboard.findUnique({ where: { id }, select: { userId: true, organizationId: true } });
      case ResourceType.ERD:
        return this.prisma.erdWorkspace.findUnique({ where: { id }, select: { userId: true, organizationId: true } });
      default:
        return Promise.resolve(null);
    }
  }
}
