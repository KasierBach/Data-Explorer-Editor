import { QueryService } from './query.service';
import { MetadataService } from '../metadata/metadata.service';
import { FreshnessService } from '../common/freshness/freshness.service';

describe('R08 shared invalidation boundaries', () => {
  function setup() {
    const values = new Map<string, unknown>();
    const cache = {
      get: async (key: string) => values.get(key),
      set: async (key: string, value: unknown) => {
        values.set(key, value);
      },
    };
    const freshness = new FreshnessService(cache as never);
    const connection = {
      id: 'conn',
      userId: 'owner',
      name: 'fixture',
      type: 'postgres',
      database: 'Main',
      allowQueryExecution: true,
      allowSchemaChanges: true,
      allowImportExport: true,
    };
    const connections = {
      findOne: jest.fn(async () => connection),
      authorizeAccess: jest.fn(async () => connection),
      getPool: jest.fn(async () => ({})),
      removePool: jest.fn(),
    };
    const strategy = {
      executeQuery: jest.fn(async () => ({ rows: [], rowCount: 1 })),
      runStatementsInTransaction: jest.fn(async () => ({
        rows: [],
        rowCount: 1,
      })),
      quoteTable: (s: string, t: string) => `${s}.${t}`,
      buildAlterTableSql: () => 'ALTER TABLE items ADD COLUMN extra int',
      importData: jest.fn(async () => ({ success: true, rowCount: 1 })),
    };
    const factory = { getStrategy: () => strategy };
    const query = new QueryService(
      connections as never,
      factory as never,
      { log: jest.fn() } as never,
      freshness,
      cache as never,
      { ensurePermission: jest.fn() } as never,
    );
    const metadata = new MetadataService(
      connections as never,
      factory as never,
      freshness,
      cache as never,
    );
    const keys = () =>
      Promise.all([
        freshness.buildKey('query', ['conn', 'Main'], ['count']),
        ...[
          'hierarchy',
          'databases',
          'columns',
          'fullmeta',
          'relationships',
          'metrics',
        ].map((ns) => freshness.buildKey(ns, ['conn'], ['table'])),
        freshness.buildKey('ai-schema', ['conn', 'Main'], ['schema']),
        freshness.buildKey('nosql-schema', ['conn', 'Main'], ['items', 100]),
      ]);
    return {
      query,
      metadata,
      freshness,
      keys,
      connection,
      connections,
      strategy,
      cache,
    };
  }

  it.each([
    'INSERT INTO items VALUES (1)',
    'UPDATE items SET id=2 WHERE id=1',
    'DELETE FROM items WHERE id=1',
    'ALTER TABLE items ADD COLUMN extra int',
  ])(
    'invalidates all dependent cache families after raw write: %s',
    async (sql) => {
      const f = setup(),
        before = await f.keys();
      await f.query.executeQuery(
        { connectionId: 'conn', sql, confirmed: true },
        'owner',
      );
      const after = await f.keys();
      after.forEach((key, i) => expect(key).not.toBe(before[i]));
      expect(
        await f.freshness.buildKey('query', ['other', 'Main'], ['count']),
      ).toContain(':v0:');
    },
  );

  it('leaves generations unchanged for reads and failed rolled back transactions', async () => {
    const f = setup(),
      before = await f.keys();
    await f.query.executeQuery(
      { connectionId: 'conn', sql: 'SELECT 1' },
      'owner',
    );
    expect(await f.keys()).toEqual(before);
    f.strategy.runStatementsInTransaction.mockRejectedValueOnce(
      new Error('rolled back'),
    );
    await expect(
      f.query.executeQuery(
        {
          connectionId: 'conn',
          sql: 'INSERT INTO items VALUES (1); SELECT missing',
          confirmed: true,
        },
        'owner',
      ),
    ).rejects.toThrow('rolled back');
    expect(await f.keys()).toEqual(before);
  });

  it('invalidates a completed write even if recording audit history fails', async () => {
    const f = setup(),
      before = await f.keys();
    jest
      .spyOn(f.query['auditService'], 'log')
      .mockRejectedValueOnce(new Error('audit unavailable'));
    await expect(
      f.query.executeQuery(
        { connectionId: 'conn', sql: 'INSERT INTO items VALUES (1)' },
        'owner',
      ),
    ).rejects.toThrow('audit unavailable');
    expect((await f.keys())[0]).not.toBe(before[0]);
  });

  it('refresh invalidates count and schema as well as metadata', async () => {
    const f = setup(),
      before = await f.keys();
    await f.metadata.refresh('conn', 'owner', 'Main');
    (await f.keys()).forEach((key, i) => expect(key).not.toBe(before[i]));
  });

  it('partial schema operations invalidate the first committed DDL even when a later one fails', async () => {
    const f = setup(),
      before = await f.keys();
    f.strategy.executeQuery.mockRejectedValueOnce(new Error('first failed'));
    await expect(
      f.query.updateSchema(
        {
          connectionId: 'conn',
          schema: 'public',
          table: 'items',
          operations: [
            { type: 'add_column', column: { name: 'extra', type: 'int' } },
          ],
        } as never,
        'owner',
      ),
    ).rejects.toThrow('first failed');
    expect(await f.keys()).toEqual(before);
    f.strategy.executeQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockRejectedValueOnce(new Error('second failed'));
    await expect(
      f.query.updateSchema(
        {
          connectionId: 'conn',
          schema: 'public',
          table: 'items',
          operations: [{ type: 'add_column' }, { type: 'add_column' }],
        } as never,
        'owner',
      ),
    ).rejects.toThrow('second failed');
    expect((await f.keys())[3]).not.toBe(before[3]);
  });

  it('does not invalidate a rejected transactional import', async () => {
    const f = setup(),
      before = await f.keys();
    f.strategy.importData.mockRejectedValueOnce(new Error('rolled back'));
    await expect(
      f.query.importData(
        {
          connectionId: 'conn',
          schema: 'public',
          table: 'items',
          data: [{ id: 1 }],
        },
        'owner',
      ),
    ).rejects.toThrow('rolled back');
    expect(await f.keys()).toEqual(before);
  });
});
