import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Permission } from '../enums/permission.enum';
import { ResourceType } from '../enums/resource-type.enum';
import { OrganizationRole } from '../../organizations/entities/organization-role.enum';
import {
  RESOURCE_PERMISSION_ROLES,
  isResourcePermissionPolicy,
  normalizePermissionList,
  type ResourcePermissionPolicy,
} from '../types/resource-permission-policy';

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
    const record = await this.findResourceRecord(resourceType, resourceId);
    const orgId = record?.organizationId ?? null;

    if (orgId) {
      return this.checkOrgPermission(userId, orgId, resourceType, resourceId, permission);
    }

    return record?.userId === userId;
  }

  private async checkOrgPermission(
    userId: string,
    orgId: string,
    resourceType: ResourceType,
    resourceId: string,
    permission: Permission,
  ): Promise<boolean> {
    const [member, policy] = await Promise.all([
      this.prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: orgId,
            userId,
          },
        },
      }),
      this.getResourcePolicy(resourceType, resourceId, orgId),
    ]);

    if (!member) return false;

    return this.getPermissionsForRole(member.role as OrganizationRole, policy).includes(permission);
  }

  getRolePermissions(role: OrganizationRole): Permission[] {
    const map: Record<OrganizationRole, Permission[]> = {
      [OrganizationRole.OWNER]: [
        Permission.READ,
        Permission.WRITE,
        Permission.DELETE,
        Permission.MANAGE,
        Permission.COMMENT,
        Permission.SHARE,
      ],
      [OrganizationRole.ADMIN]: [
        Permission.READ,
        Permission.WRITE,
        Permission.DELETE,
        Permission.MANAGE,
        Permission.COMMENT,
        Permission.SHARE,
      ],
      [OrganizationRole.MEMBER]: [
        Permission.READ,
        Permission.WRITE,
        Permission.COMMENT,
      ],
      [OrganizationRole.VIEWER]: [Permission.READ],
    };

    return map[role] ?? [];
  }

  buildDefaultResourcePolicy(): ResourcePermissionPolicy {
    return RESOURCE_PERMISSION_ROLES.reduce((policy, role) => {
      policy[role] = [...this.getRolePermissions(role)];
      return policy;
    }, {} as ResourcePermissionPolicy);
  }

  private getPermissionsForRole(
    role: OrganizationRole,
    policy: ResourcePermissionPolicy | null,
  ): Permission[] {
    if (policy && policy[role]) {
      return normalizePermissionList(policy[role]);
    }

    return this.getRolePermissions(role);
  }

  private async getResourcePolicy(
    type: ResourceType,
    id: string,
    orgId: string,
  ): Promise<ResourcePermissionPolicy | null> {
    const record = await this.prisma.organizationResource.findUnique({
      where: {
        resourceType_resourceId_organizationId: {
          resourceType: type,
          resourceId: id,
          organizationId: orgId,
        },
      },
      select: { permissions: true },
    });

    return isResourcePermissionPolicy(record?.permissions) ? record.permissions : null;
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
