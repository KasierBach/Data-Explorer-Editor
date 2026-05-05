import { Module } from '@nestjs/common';
import { ErdWorkspacesController } from './erd-workspaces.controller';
import { ErdWorkspacesService } from './erd-workspaces.service';
import { AuditModule } from '../audit/audit.module';
import { ConnectionsModule } from '../connections/connections.module';
import { VersionHistoryModule } from '../version-history/version-history.module';

@Module({
  imports: [AuditModule, ConnectionsModule, VersionHistoryModule],
  controllers: [ErdWorkspacesController],
  providers: [ErdWorkspacesService],
  exports: [ErdWorkspacesService],
})
export class ErdWorkspacesModule {}
