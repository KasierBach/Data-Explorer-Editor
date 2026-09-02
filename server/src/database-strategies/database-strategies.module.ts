import { Module, Global } from '@nestjs/common';
import { DatabaseStrategyFactory } from './strategy.factory';
import { PostgresStrategy } from './postgres.strategy';
import { CockroachDbStrategy } from './cockroach.strategy';
import { MysqlStrategy } from './mysql.strategy';
import { MssqlStrategy } from './mssql.strategy';
import { MongoDbStrategy } from './mongodb.strategy';
import { SqliteStrategy } from './sqlite.strategy';
import { ClickHouseStrategy } from './clickhouse.strategy';
import { RedisStrategy } from './redis.strategy';

@Global()
@Module({
  providers: [
    PostgresStrategy,
    CockroachDbStrategy,
    MysqlStrategy,
    MssqlStrategy,
    MongoDbStrategy,
    SqliteStrategy,
    ClickHouseStrategy,
    RedisStrategy,
    DatabaseStrategyFactory,
  ],
  exports: [
    PostgresStrategy,
    CockroachDbStrategy,
    MysqlStrategy,
    MssqlStrategy,
    MongoDbStrategy,
    SqliteStrategy,
    ClickHouseStrategy,
    RedisStrategy,
    DatabaseStrategyFactory,
  ],
})
export class DatabaseStrategiesModule { }
