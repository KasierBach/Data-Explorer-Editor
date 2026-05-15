import { Module } from '@nestjs/common';
import { SavedQueriesService } from './saved-queries.service';
import { SavedQueriesController } from './saved-queries.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { ConnectionsModule } from '../connections/connections.module';
import { VersionHistoryModule } from '../version-history/version-history.module';
import { OrganizationsModule } from '../organizations/organizations.module';

@Module({
  imports: [PrismaModule, AuditModule, ConnectionsModule, VersionHistoryModule, OrganizationsModule],
  controllers: [SavedQueriesController],
  providers: [SavedQueriesService],
  exports: [SavedQueriesService],
})
export class SavedQueriesModule {}
