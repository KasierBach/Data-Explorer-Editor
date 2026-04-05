import { Module } from '@nestjs/common';
import { SavedQueriesService } from './saved-queries.service';
import { SavedQueriesController } from './saved-queries.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { ConnectionsModule } from '../connections/connections.module';

@Module({
  imports: [PrismaModule, AuditModule, ConnectionsModule],
  controllers: [SavedQueriesController],
  providers: [SavedQueriesService],
  exports: [SavedQueriesService],
})
export class SavedQueriesModule {}
