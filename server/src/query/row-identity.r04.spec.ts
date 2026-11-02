import Database from 'better-sqlite3';
import { SqliteStrategy } from '../database-strategies/sqlite.strategy';

describe('R04 SQLite row identity', () => {
  const strategy = new SqliteStrategy();
  let db: Database.Database;
  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(
      "CREATE TABLE items(tenant TEXT NOT NULL, id INTEGER NOT NULL, note TEXT, PRIMARY KEY(tenant,id)); INSERT INTO items VALUES ('A',1,'a1'),('A',2,'a2'),('B',1,'b1')",
    );
  });
  afterEach(() => db.close());
  const rows = () => db.prepare('SELECT * FROM items ORDER BY tenant,id').all();

  it('reports both columns of a composite primary key', async () => {
    expect(
      (await strategy.getColumns(db, '', 'items'))
        .filter((c) => c.isPrimaryKey)
        .map((c) => c.name),
    ).toEqual(['tenant', 'id']);
  });
  it('updates only the complete tuple A/1', async () => {
    const params = {
      schema: '',
      table: 'items',
      pkColumn: 'tenant',
      pkValue: 'A',
      identity: [
        { column: 'tenant', value: 'A' },
        { column: 'id', value: 1 },
      ],
      updates: { note: 'changed' },
    };
    expect(await strategy.updateRow(db, params)).toEqual({
      success: true,
      rowCount: 1,
    });
    expect(rows()).toEqual([
      { tenant: 'A', id: 1, note: 'changed' },
      { tenant: 'A', id: 2, note: 'a2' },
      { tenant: 'B', id: 1, note: 'b1' },
    ]);
  });
  it('deletes A/2 and B/1 while preserving A/1', async () => {
    const params = {
      schema: '',
      table: 'items',
      pkColumn: 'tenant',
      pkValues: ['A', 'B'],
      identities: [
        [
          { column: 'tenant', value: 'A' },
          { column: 'id', value: 2 },
        ],
        [
          { column: 'tenant', value: 'B' },
          { column: 'id', value: 1 },
        ],
      ],
    };
    expect(await strategy.deleteRows(db, params)).toEqual({
      success: true,
      rowCount: 2,
    });
    expect(rows()).toEqual([{ tenant: 'A', id: 1, note: 'a1' }]);
  });
  it('rolls back a delete when one selected tuple no longer exists', async () => {
    const params = {
      schema: '',
      table: 'items',
      pkColumn: 'tenant',
      pkValues: ['A', 'Z'],
      identities: [
        [
          { column: 'tenant', value: 'A' },
          { column: 'id', value: 1 },
        ],
        [
          { column: 'tenant', value: 'Z' },
          { column: 'id', value: 9 },
        ],
      ],
    };
    await expect(strategy.deleteRows(db, params)).rejects.toThrow();
    expect(rows()).toEqual([
      { tenant: 'A', id: 1, note: 'a1' },
      { tenant: 'A', id: 2, note: 'a2' },
      { tenant: 'B', id: 1, note: 'b1' },
    ]);
  });
  it('reports a stale update instead of success with zero rows', async () => {
    await expect(
      strategy.updateRow(db, {
        schema: '',
        table: 'items',
        pkColumn: 'tenant',
        pkValue: 'missing',
        updates: { note: 'changed' },
      }),
    ).rejects.toThrow();
    expect(rows()).toHaveLength(3);
  });
  it('rolls back an accidental multi-row update', async () => {
    await expect(
      strategy.updateRow(db, {
        schema: '',
        table: 'items',
        pkColumn: 'tenant',
        pkValue: 'A',
        updates: { note: 'changed' },
      }),
    ).rejects.toThrow();
    expect(rows()).toEqual([
      { tenant: 'A', id: 1, note: 'a1' },
      { tenant: 'A', id: 2, note: 'a2' },
      { tenant: 'B', id: 1, note: 'b1' },
    ]);
  });
  it('does not redirect a main-schema edit into a temporary shadow table', async () => {
    db.exec(
      "CREATE TEMP TABLE items(tenant TEXT,id INTEGER,note TEXT,PRIMARY KEY(tenant,id));INSERT INTO temp.items VALUES('A',1,'temporary')",
    );
    const params = {
      schema: 'main',
      table: 'items',
      pkColumn: 'tenant',
      pkValue: 'A',
      identity: [
        { column: 'tenant', value: 'A' },
        { column: 'id', value: 1 },
      ],
      updates: { note: 'changed' },
    };
    await strategy.updateRow(db, params);
    expect(
      db.prepare("SELECT note FROM main.items WHERE tenant='A' AND id=1").get(),
    ).toEqual({ note: 'changed' });
    expect(db.prepare('SELECT note FROM temp.items').get()).toEqual({
      note: 'temporary',
    });
  });
});
