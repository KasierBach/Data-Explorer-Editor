import { OrganizationRole } from '../../organizations/entities/organization-role.enum';
import { Permission } from '../enums/permission.enum';

export const RESOURCE_PERMISSION_ROLES = [
  OrganizationRole.OWNER,
  OrganizationRole.ADMIN,
  OrganizationRole.MEMBER,
  OrganizationRole.VIEWER,
] as const;

export type ResourcePermissionPolicy = Record<OrganizationRole, Permission[]>;

const PERMISSION_VALUES = new Set(Object.values(Permission));

function isPermissionValue(value: unknown): value is Permission {
  return typeof value === 'string' && PERMISSION_VALUES.has(value as Permission);
}

export function isResourcePermissionPolicy(value: unknown): value is ResourcePermissionPolicy {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return RESOURCE_PERMISSION_ROLES.every((role) => {
    const rolePermissions = (value as Record<string, unknown>)[role];
    return Array.isArray(rolePermissions) && rolePermissions.every(isPermissionValue);
  });
}

export function normalizePermissionList(value: unknown): Permission[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(new Set(value.filter(isPermissionValue)));
}
