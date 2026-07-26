import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DataRetentionService } from './data-retention.service';

@Module({
  imports: [PrismaModule],
  providers: [DataRetentionService],
})
export class MaintenanceModule {}
