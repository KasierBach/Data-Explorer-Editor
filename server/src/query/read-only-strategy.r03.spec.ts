import Database from 'better-sqlite3';
import { SqliteStrategy } from '../database-strategies/sqlite.strategy';

describe('R03 native SQLite read-only execution', () => {
  const strategy = new SqliteStrategy();
  let database: Database.Database;

  beforeEach(() => {
    database = new Database(':memory:');
    database.exec(
      'CREATE TABLE items (id INTEGER); INSERT INTO items VALUES (1)',
    );
  });

  afterEach(() => database.close());

  it('blocks a row-returning write and restores the pool after failure', async () => {
    await expect(
      strategy.executeQuery(database, 'DELETE FROM items RETURNING id', {
        limit: 10,
        ...{ readOnly: true },
      }),
    ).rejects.toMatchObject({ code: 'SQLITE_READONLY' });
    expect(database.prepare('SELECT * FROM items').all()).toEqual([{ id: 1 }]);
    expect(database.pragma('query_only', { simple: true })).toBe(0);
    database.prepare('INSERT INTO items VALUES (2)').run();
    expect(database.prepare('SELECT count(*) AS n FROM items').get()).toEqual({
      n: 2,
    });
  });

  it('executes the same row-returning write when the operation is writable', async () => {
    const result = await strategy.executeQuery(
      database,
      'DELETE FROM items RETURNING id',
    );
    expect(result.rows).toEqual([{ id: 1 }]);
    expect(database.prepare('SELECT * FROM items').all()).toEqual([]);
  });

  it('blocks an entire read-only batch before any persistent write', async () => {
    await expect(
      strategy.runStatementsInTransaction(
        database,
        ['SELECT 1', 'DELETE FROM items'],
        {
          limit: 10,
          ...{ readOnly: true },
        },
      ),
    ).rejects.toMatchObject({ code: 'SQLITE_READONLY' });
    expect(database.prepare('SELECT * FROM items').all()).toEqual([{ id: 1 }]);
    expect(database.pragma('query_only', { simple: true })).toBe(0);
  });

  it('preserves an existing native read-only mode after a successful read', async () => {
    database.pragma('query_only = ON');
    const result = await strategy.executeQuery(
      database,
      'SELECT * FROM items',
      {
        limit: 10,
        ...{ readOnly: true },
      },
    );
    expect(result.rows).toEqual([{ id: 1 }]);
    expect(database.pragma('query_only', { simple: true })).toBe(1);
  });
});
