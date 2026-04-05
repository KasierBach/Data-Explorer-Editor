import { Module } from '@nestjs/common';
import { MigrationService } from './migration.service';
import { MigrationController } from './migration.controller';
import { ConnectionsModule } from '../connections/connections.module';
import { DatabaseStrategiesModule } from '../database-strategies/database-strategies.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [ConnectionsModule, DatabaseStrategiesModule, AuthModule],
  controllers: [MigrationController],
  providers: [MigrationService],
})
export class MigrationModule {}
