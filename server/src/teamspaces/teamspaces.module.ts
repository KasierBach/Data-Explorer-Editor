import { Module } from '@nestjs/common';
import { TeamspacesController } from './teamspaces.controller';
import { TeamspacesService } from './teamspaces.service';
import { AuditModule } from '../audit/audit.module';
import { PermissionsModule } from '../permissions/permissions.module';

@Module({
  imports: [AuditModule, PermissionsModule],
  controllers: [TeamspacesController],
  providers: [TeamspacesService],
  exports: [TeamspacesService],
})
export class TeamspacesModule {}
