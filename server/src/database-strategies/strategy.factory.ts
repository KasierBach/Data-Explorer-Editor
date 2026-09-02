import { Injectable, BadRequestException } from '@nestjs/common';
import type { IDatabaseStrategy } from './database-strategy.interface';
import { PostgresStrategy } from './postgres.strategy';
import { CockroachDbStrategy } from './cockroach.strategy';
import { MysqlStrategy } from './mysql.strategy';
import { MssqlStrategy } from './mssql.strategy';
import { MongoDbStrategy } from './mongodb.strategy';
import { SqliteStrategy } from './sqlite.strategy';
import { ClickHouseStrategy } from './clickhouse.strategy';
import { RedisStrategy } from './redis.strategy';

export const DATABASE_STRATEGIES = 'DATABASE_STRATEGIES';

export interface DatabaseStrategyProvider {
  type: string;
  strategy: IDatabaseStrategy;
}

@Injectable()
export class DatabaseStrategyFactory {
  private readonly strategies: Map<string, IDatabaseStrategy>;

  constructor(
    postgresStrategy: PostgresStrategy,
    cockroachDbStrategy: CockroachDbStrategy,
    mysqlStrategy: MysqlStrategy,
    mssqlStrategy: MssqlStrategy,
    mongoDbStrategy: MongoDbStrategy,
    sqliteStrategy: SqliteStrategy,
    clickHouseStrategy: ClickHouseStrategy,
    redisStrategy: RedisStrategy,
  ) {
    this.strategies = new Map<string, IDatabaseStrategy>([
      ['postgres', postgresStrategy],
      // CockroachDB speaks the PostgreSQL wire protocol, so it extends the
      // Postgres strategy (default port 26257, Cockroach-compatible metrics).
      ['cockroach', cockroachDbStrategy],
      ['mysql', mysqlStrategy],
      // MariaDB is a MySQL drop-in (default port 3306).
      ['mariadb', mysqlStrategy],
      ['mssql', mssqlStrategy],
      ['mongodb', mongoDbStrategy],
      ['mongodb+srv', mongoDbStrategy],
      ['sqlite', sqliteStrategy],
      ['clickhouse', clickHouseStrategy],
      ['redis', redisStrategy],
    ]);
  }

  getStrategy(type: string): IDatabaseStrategy {
    const strategy = this.strategies.get(type);
    if (!strategy) {
      throw new BadRequestException(`Unsupported connection type: ${type}`);
    }
    return strategy;
  }
}
