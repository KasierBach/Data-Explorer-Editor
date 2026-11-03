import { SqliteStrategy } from '../../database-strategies/sqlite.strategy';
import Database from 'better-sqlite3';
import { SqlUtil } from '../../utils/sql.util';

// These are native SQLite executions: rowCount is measured before the 50k slice.
describe('SqliteStrategy native result-cap regressions', () => {
  let database: Database.Database;
  beforeEach(() => {
    database = new Database(':memory:');
    database.exec(
      'CREATE TABLE users(id INTEGER PRIMARY KEY); WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<25) INSERT INTO users SELECT x FROM n;',
    );
  });
  afterEach(() => database.close());

  it.each([
    [
      'SELECT * FROM users -- LIMIT 1',
      'SELECT * FROM users LIMIT 5 OFFSET 0; -- LIMIT 1',
    ],
    [
      'SELECT id AS [-- label] FROM users',
      'SELECT id AS [-- label] FROM users LIMIT 5 OFFSET 0;',
    ],
    [
      'WITH [update] AS (SELECT * FROM users) SELECT * FROM [update]',
      'WITH [update] AS (SELECT * FROM users) SELECT * FROM [update] LIMIT 5 OFFSET 0;',
    ],
    [
      'WITH update_data AS (SELECT * FROM users) SELECT * FROM update_data',
      'WITH update_data AS (SELECT * FROM users) SELECT * FROM update_data LIMIT 5 OFFSET 0;',
    ],
    [
      'SELECT * FROM users -- note\nORDER BY id',
      'SELECT * FROM users -- note\nORDER BY id LIMIT 5 OFFSET 0;',
    ],
  ])(
    'caps actual native rows and prepares exact SQL (%s)',
    async (sql, expected) => {
      const prepare = jest.spyOn(database, 'prepare');
      const result = await new SqliteStrategy().executeQuery(database, sql, {
        limit: 5,
        offset: 0,
      });
      expect(prepare).toHaveBeenCalledWith(expected);
      expect(result.rowCount).toBe(5);
      expect(result.rows).toHaveLength(5);
    },
  );

  it('rejects a numeric expression before native prepare (formerly returned all 25 rows)', async () => {
    expect(
      database.prepare('SELECT * FROM users LIMIT 1+24').all(),
    ).toHaveLength(25);
    const prepare = jest.spyOn(database, 'prepare');
    await expect(
      new SqliteStrategy().executeQuery(
        database,
        'SELECT * FROM users LIMIT 1+24',
        { limit: 5 },
      ),
    ).rejects.toThrow('finite literal');
    expect(prepare).not.toHaveBeenCalled();
  });

  it.each([undefined, 0])(
    'applies requested limit5 over SQL limit10 with offset %s',
    async (offset) => {
      const result = await new SqliteStrategy().executeQuery(
        database,
        'SELECT * FROM users ORDER BY id LIMIT 10',
        { limit: 5, offset },
      );
      expect(result.rows.map((row) => row.id)).toEqual([1, 2, 3, 4, 5]);
      expect(result.rowCount).toBe(5);
    },
  );

  it('uses an offset-only request with the protective default rather than ignoring it', async () => {
    const result = await new SqliteStrategy().executeQuery(
      database,
      'SELECT * FROM users ORDER BY id',
      { offset: 20 },
    );
    expect(result.rows.map((row) => row.id)).toEqual([21, 22, 23, 24, 25]);
    expect(result.rowCount).toBe(5);
  });

  it('accepts zero-offset comma pagination and caps native rowCount', async () => {
    const result = await new SqliteStrategy().executeQuery(
      database,
      'SELECT * FROM users LIMIT 0, 10',
      { limit: 5 },
    );
    expect(result.rowCount).toBe(5);
  });

  it('caps every batch read, preserves DML and handles a CTE write without a browse clause', async () => {
    const prepare = jest.spyOn(database, 'prepare');
    const result = await new SqliteStrategy().runStatementsInTransaction(
      database,
      [
        'SELECT * FROM users',
        'WITH changed AS (SELECT 1) UPDATE users SET id=id',
        'SELECT * FROM users LIMIT 10',
      ],
      { limit: 5 },
    );
    expect(prepare.mock.calls.map(([sql]) => sql)).toEqual([
      'SELECT * FROM users LIMIT 50000;',
      'WITH changed AS (SELECT 1) UPDATE users SET id=id',
      'SELECT * FROM users LIMIT 5',
    ]);
    expect(result.rowCount).toBe(5);
  });

  it('executes valid reverse pagination without a duplicate ORDER BY and keeps deep-page intent', async () => {
    database.exec(
      'DELETE FROM users; WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<11000) INSERT INTO users SELECT x FROM n;',
    );
    const sql = SqlUtil.injectPagination(
      'SELECT * FROM users ORDER BY id',
      100,
      6000,
      'sqlite',
      { totalCount: 11000, primaryKey: 'id' },
    );
    expect(sql).toBe(
      'SELECT * FROM (SELECT * FROM users ORDER BY "id" DESC LIMIT 100 OFFSET 4900) _rev ORDER BY "id" ASC;',
    );
    const rows = database.prepare(sql).all() as { id: number }[];
    expect(rows.map((row) => row.id)).toEqual(
      Array.from({ length: 100 }, (_, index) => 6001 + index),
    );
  });
});

describe('SqliteStrategy', () => {
  it('exports through the database iterator instead of loading all rows', async () => {
    const iterate = jest.fn(function* () {
      yield { id: 1 };
    });
    const pool = {
      prepare: jest.fn().mockReturnValue({ iterate }),
    };

    const stream = (await new SqliteStrategy().exportStream(
      pool as never,
      '',
      'users',
    )) as AsyncIterable<Record<string, unknown>>;
    const rows: Record<string, unknown>[] = [];
    for await (const row of stream) rows.push(row);
    expect(rows).toEqual([{ id: 1 }]);
    expect(stream[Symbol.asyncIterator]).toBeDefined();
  });
});
