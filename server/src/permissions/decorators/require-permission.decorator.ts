import { SetMetadata } from '@nestjs/common';
import { ResourceType } from '../enums/resource-type.enum';
import { Permission } from '../enums/permission.enum';

export const PERMISSION_KEY = 'permission';

export interface PermissionMetadata {
  resourceType: ResourceType;
  permission: Permission;
  resourceIdParam?: string;
}

export const RequirePermission = (
  resourceType: ResourceType,
  permission: Permission,
  resourceIdParam = 'id',
) => SetMetadata(PERMISSION_KEY, { resourceType, permission, resourceIdParam });
