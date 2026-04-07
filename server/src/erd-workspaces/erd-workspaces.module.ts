import { Module } from '@nestjs/common';
import { ErdWorkspacesController } from './erd-workspaces.controller';
import { ErdWorkspacesService } from './erd-workspaces.service';
import { AuditModule } from '../audit/audit.module';
import { ConnectionsModule } from '../connections/connections.module';

@Module({
  imports: [AuditModule, ConnectionsModule],
  controllers: [ErdWorkspacesController],
  providers: [ErdWorkspacesService],
  exports: [ErdWorkspacesService],
})
export class ErdWorkspacesModule {}
