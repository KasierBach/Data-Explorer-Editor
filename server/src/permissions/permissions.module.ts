import { Module } from '@nestjs/common';
import { PermissionsService } from './services/permissions.service';
import { PermissionGuard } from './guards/permission.guard';

@Module({
  providers: [PermissionsService, PermissionGuard],
  exports: [PermissionsService, PermissionGuard],
})
export class PermissionsModule {}
