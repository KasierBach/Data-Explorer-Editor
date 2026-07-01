import { Module } from '@nestjs/common';
import { QueryService } from './query.service';
import { QueryController } from './query.controller';
import { ConnectionsModule } from '../connections/connections.module';
import { AuditModule } from '../audit/audit.module';
import { PermissionsModule } from '../permissions/permissions.module';

@Module({
  imports: [ConnectionsModule, AuditModule, PermissionsModule],
  controllers: [QueryController],
  providers: [QueryService],
})
export class QueryModule {}
