import { Module } from '@nestjs/common';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './services/organizations.service';
import { OrganizationBackupService } from './services/organization-backup.service';
import { AuditModule } from '../audit/audit.module';
import { PermissionsModule } from '../permissions/permissions.module';

@Module({
  imports: [AuditModule, PermissionsModule],
  controllers: [OrganizationsController],
  providers: [OrganizationsService, OrganizationBackupService],
  exports: [OrganizationsService, OrganizationBackupService],
})
export class OrganizationsModule {}
