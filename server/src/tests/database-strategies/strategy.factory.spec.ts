import { Test } from '@nestjs/testing';
import { DatabaseStrategyFactory } from '../../database-strategies/strategy.factory';
import { PostgresStrategy } from '../../database-strategies/postgres.strategy';
import { MysqlStrategy } from '../../database-strategies/mysql.strategy';
import { MssqlStrategy } from '../../database-strategies/mssql.strategy';
import { MongoDbStrategy } from '../../database-strategies/mongodb.strategy';
import { SqliteStrategy } from '../../database-strategies/sqlite.strategy';
import { ClickHouseStrategy } from '../../database-strategies/clickhouse.strategy';
import { BadRequestException } from '@nestjs/common';

describe('DatabaseStrategyFactory', () => {
  let factory: DatabaseStrategyFactory;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        DatabaseStrategyFactory,
        PostgresStrategy,
        MysqlStrategy,
        MssqlStrategy,
        MongoDbStrategy,
        SqliteStrategy,
        ClickHouseStrategy,
      ],
    }).compile();

    factory = moduleRef.get(DatabaseStrategyFactory);
  });

  it('resolves the postgres strategy for postgres', () => {
    expect(factory.getStrategy('postgres')).toBeInstanceOf(PostgresStrategy);
  });

  it('maps cockroach to the postgres strategy (wire-compatible)', () => {
    // CockroachDB speaks the PostgreSQL wire protocol.
    const strategy = factory.getStrategy('cockroach');
    expect(strategy).toBeInstanceOf(PostgresStrategy);
  });

  it('maps mariadb to the mysql strategy (drop-in compatible)', () => {
    const strategy = factory.getStrategy('mariadb');
    expect(strategy).toBeInstanceOf(MysqlStrategy);
  });

  it('maps mongodb+srv to the mongodb strategy', () => {
    const strategy = factory.getStrategy('mongodb+srv');
    expect(strategy).toBeInstanceOf(MongoDbStrategy);
  });

  it('resolves every built-in engine type', () => {
    for (const type of [
      'postgres',
      'cockroach',
      'mysql',
      'mariadb',
      'mssql',
      'mongodb',
      'mongodb+srv',
      'sqlite',
      'clickhouse',
    ]) {
      expect(() => factory.getStrategy(type)).not.toThrow();
    }
  });

  it('rejects unknown connection types', () => {
    expect(() => factory.getStrategy('oracle')).toThrow(BadRequestException);
    expect(() => factory.getStrategy('')).toThrow(BadRequestException);
  });
});
