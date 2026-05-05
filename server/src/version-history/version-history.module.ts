import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { VersionHistoryService } from './version-history.service';
import { VersionHistoryController } from './version-history.controller';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [VersionHistoryController],
  providers: [VersionHistoryService],
  exports: [VersionHistoryService],
})
export class VersionHistoryModule {}
