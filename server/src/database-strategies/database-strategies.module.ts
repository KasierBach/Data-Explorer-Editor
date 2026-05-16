import { Module, Global } from '@nestjs/common';
import { DatabaseStrategyFactory } from './strategy.factory';
import { PostgresStrategy } from './postgres.strategy';
import { MysqlStrategy } from './mysql.strategy';
import { MssqlStrategy } from './mssql.strategy';
import { MongoDbStrategy } from './mongodb.strategy';
import { SqliteStrategy } from './sqlite.strategy';
import { ClickHouseStrategy } from './clickhouse.strategy';

@Global()
@Module({
  providers: [
    PostgresStrategy,
    MysqlStrategy,
    MssqlStrategy,
    MongoDbStrategy,
    SqliteStrategy,
    ClickHouseStrategy,
    DatabaseStrategyFactory,
  ],
  exports: [
    PostgresStrategy,
    MysqlStrategy,
    MssqlStrategy,
    MongoDbStrategy,
    SqliteStrategy,
    ClickHouseStrategy,
    DatabaseStrategyFactory,
  ],
})
export class DatabaseStrategiesModule {}
