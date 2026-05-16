import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MigrationService } from './migration.service';
import { MigrationComparisonService } from './migration-comparison.service';
import { MigrationController } from './migration.controller';
import { MigrationProcessor } from './migration.processor';
import { ConnectionsModule } from '../connections/connections.module';
import { DatabaseStrategiesModule } from '../database-strategies/database-strategies.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    ConnectionsModule,
    DatabaseStrategiesModule,
    AuthModule,
    BullModule.registerQueue({
      name: 'migration',
    }),
  ],
  controllers: [MigrationController],
  providers: [MigrationService, MigrationComparisonService, MigrationProcessor],
  exports: [MigrationService],
})
export class MigrationModule {}
