import { ClickHouseStrategy } from './clickhouse.strategy';
import { SqliteStrategy } from './sqlite.strategy';
import { MysqlStrategy } from './mysql.strategy';
import { MssqlStrategy } from './mssql.strategy';
import Database from 'better-sqlite3';
import { EventEmitter } from 'node:events';

describe('R08 nontransactional batch invalidation', () => {
  it('keeps the native MySQL failure when refreshing a partial batch also fails', async () => {
    const nativeError = new Error('duplicate row');
    const connection = Object.assign(new EventEmitter(), {
      query: jest
        .fn()
        .mockResolvedValueOnce([{ affectedRows: 1, serverStatus: 1 }, []])
        .mockRejectedValueOnce(nativeError),
      beginTransaction: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn(),
      destroy: jest.fn(),
    });
    await expect(
      new MysqlStrategy().runStatementsInTransaction(
        { getConnection: async () => connection } as never,
        ['INSERT INTO items VALUES(1)', 'INSERT INTO items VALUES(1)'],
        {
          onMutation: async () => {
            throw new Error('cache unavailable');
          },
        },
      ),
    ).rejects.toBe(nativeError);
    expect(connection.rollback).toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalledTimes(1);
  });

  it('SQLite seed commits all tables/data or rolls back all new tables on failure', async () => {
    const db = new Database(':memory:'),
      broken = new Database(':memory:');
    try {
      await new SqliteStrategy().seedData(db);
      expect(db.prepare('SELECT count(*) AS total FROM users').get()).toEqual({
        total: 2,
      });
      expect(
        db.prepare('SELECT count(*) AS total FROM products').get(),
      ).toEqual({ total: 1 });
      broken.exec('CREATE TABLE users(id integer PRIMARY KEY)');
      await expect(new SqliteStrategy().seedData(broken)).rejects.toMatchObject(
        {
          code: 'SQLITE_ERROR',
          message: expect.stringContaining('no column named name'),
        },
      );
      expect(
        broken
          .prepare("SELECT name FROM sqlite_master WHERE type='table'")
          .all(),
      ).toEqual([{ name: 'users' }]);
      expect(
        broken.prepare('SELECT count(*) AS total FROM users').get(),
      ).toEqual({ total: 0 });
    } finally {
      db.close();
      broken.close();
    }
  });

  it('seed uses native batch boundaries for MySQL and SQL Server', async () => {
    const mysql = new MysqlStrategy(),
      mssql = new MssqlStrategy(),
      onMutation = jest.fn(async () => {});
    const mysqlRun = jest
      .spyOn(mysql, 'runStatementsInTransaction')
      .mockResolvedValue({ rows: [], columns: [] });
    const mssqlRun = jest
      .spyOn(mssql, 'runStatementsInTransaction')
      .mockResolvedValue({ rows: [], columns: [] });
    await mysql.seedData({} as never, { onMutation });
    await mssql.seedData({} as never);
    expect(mysqlRun.mock.calls[0][1]).toHaveLength(6);
    expect(mysqlRun.mock.calls[0][2]?.onMutation).toBe(onMutation);
    expect(mssqlRun.mock.calls[0][1]).toHaveLength(1);
  });

  it('ClickHouse seed reports its committed schema before the data statement fails', async () => {
    const onMutation = jest.fn(async () => {}),
      exec = jest
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('insert failed'));
    await expect(
      new ClickHouseStrategy().seedData({ exec } as never, { onMutation }),
    ).rejects.toThrow('insert failed');
    expect(onMutation).toHaveBeenCalledTimes(1);
  });

  it('reports a completed ClickHouse write before a later statement fails', async () => {
    const strategy = new ClickHouseStrategy(),
      onMutation = jest.fn(async () => {});
    jest
      .spyOn(strategy, 'executeQuery')
      .mockResolvedValueOnce({ rows: [], columns: [], rowCount: 1 })
      .mockRejectedValueOnce(new Error('later failed'));
    await expect(
      strategy.runStatementsInTransaction(
        {} as never,
        ['INSERT INTO items VALUES(1)', 'INSERT INTO missing VALUES(2)'],
        { onMutation },
      ),
    ).rejects.toThrow('later failed');
    expect(onMutation).toHaveBeenCalledTimes(1);
  });
  it('does not report a write when the first statement fails or the batch only reads', async () => {
    const strategy = new ClickHouseStrategy(),
      onMutation = jest.fn(async () => {});
    jest
      .spyOn(strategy, 'executeQuery')
      .mockRejectedValueOnce(new Error('first failed'));
    await expect(
      strategy.runStatementsInTransaction(
        {} as never,
        ['INSERT INTO missing VALUES(1)'],
        { onMutation },
      ),
    ).rejects.toThrow('first failed');
    expect(onMutation).not.toHaveBeenCalled();
    jest
      .spyOn(strategy, 'executeQuery')
      .mockResolvedValue({ rows: [], columns: [] });
    await strategy.runStatementsInTransaction(
      {} as never,
      ['SELECT 1', 'SELECT 2'],
      { onMutation },
    );
    expect(onMutation).not.toHaveBeenCalled();
  });
});
