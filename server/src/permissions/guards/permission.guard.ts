import { Injectable, CanActivate, ExecutionContext, BadRequestException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsService } from '../services/permissions.service';
import { PERMISSION_KEY, PermissionMetadata } from '../decorators/require-permission.decorator';
import type { AuthenticatedRequest } from '../../auth/auth-request.types';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionsService: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const meta = this.reflector.getAllAndOverride<PermissionMetadata>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!meta) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.user?.id;

    if (!userId) return false;

    const rawResourceId = request.params[meta.resourceIdParam ?? 'id'];

    if (!rawResourceId) {
      throw new BadRequestException('Resource ID is required');
    }

    const resourceId = Array.isArray(rawResourceId) ? rawResourceId[0] : rawResourceId;

    await this.permissionsService.ensurePermission(
      userId,
      meta.resourceType,
      resourceId,
      meta.permission,
    );

    return true;
  }
}
