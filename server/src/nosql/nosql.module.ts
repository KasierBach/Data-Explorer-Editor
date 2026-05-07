import { Module } from '@nestjs/common';
import { NoSqlController } from './nosql.controller';
import { NoSqlService } from './nosql.service';
import { ConnectionsModule } from '../connections/connections.module';
import { DatabaseStrategiesModule } from '../database-strategies/database-strategies.module';

import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [ConnectionsModule, DatabaseStrategiesModule, RedisModule],
  controllers: [NoSqlController],
  providers: [NoSqlService],
})
export class NoSqlModule {}
