import { Pool } from 'pg';
import { PostgresStrategy } from '../src/database-strategies/postgres.strategy';

/** Native fixture gate: executed by the maintained E2E configuration, without skips. */
describe('Native PostgreSQL outer result caps', () => {
  let pool: Pool;
  const strategy = new PostgresStrategy();

  beforeAll(() => {
    const connectionString = process.env.E2E_DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        'E2E_DATABASE_URL must name the dedicated local fixture.',
      );
    }
    const target = new URL(connectionString);
    if (
      !['postgres:', 'postgresql:'].includes(target.protocol) ||
      !['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname) ||
      target.pathname !== '/data_explorer_e2e' ||
      target.search ||
      target.hash
    ) {
      throw new Error(
        'Native cap tests accept only the dedicated loopback PostgreSQL fixture.',
      );
    }
    pool = new Pool({
      connectionString,
      max: 1,
      ssl: false,
      connectionTimeoutMillis: 3000,
    });
  });

  afterAll(async () => {
    if (pool) await pool.end();
  });

  it.each([
    'SELECT $q$LIMIT 1$q$ AS label, id FROM generate_series(1, 25) AS id',
    'SELECT id FROM generate_series(1, 25) AS id -- LIMIT 1',
    'SELECT id FROM generate_series(1, 25) AS id -- note\nORDER BY id',
    'WITH update_data AS (SELECT id FROM generate_series(1, 25) AS id) SELECT * FROM update_data',
    '(SELECT id FROM generate_series(1, 25) AS id)',
  ])(
    'caps native driver rowCount before the defense-in-depth slice: %s',
    async (sql) => {
      const result = await strategy.executeQuery(pool, sql, {
        limit: 5,
        offset: 0,
      });
      expect(result.rows).toHaveLength(5);
      expect(result.rowCount).toBe(5);
    },
  );

  it.each([undefined, 0])(
    'applies requested five-row windows over a finite SQL limit of ten (offset %s)',
    async (offset) => {
      const result = await strategy.executeQuery(
        pool,
        'SELECT id FROM generate_series(1, 25) AS id ORDER BY id LIMIT 10',
        { limit: 5, offset },
      );
      expect(result.rows.map((row) => row.id)).toEqual([1, 2, 3, 4, 5]);
      expect(result.rowCount).toBe(5);
    },
  );

  it('caps every branch of a set-operation result', async () => {
    const result = await strategy.executeQuery(
      pool,
      '(SELECT id FROM generate_series(1, 25) AS id LIMIT 1) UNION ALL SELECT id FROM generate_series(1, 25) AS id',
      { limit: 5 },
    );
    expect(result.rows).toHaveLength(5);
    expect(result.rowCount).toBe(5);
  });

  it('keeps the default native cap despite inert dollar text', async () => {
    const result = await strategy.executeQuery(
      pool,
      'SELECT $$LIMIT 1$$ AS label, id FROM generate_series(1, 50001) AS id',
      { readOnly: true },
    );
    expect(result.rows).toHaveLength(50000);
    expect(result.rowCount).toBe(50000);
  });

  it('keeps a cap executable before a locking tail after a line comment', async () => {
    await pool.query(
      'CREATE TEMPORARY TABLE sql_cap_lock_fixture (id INTEGER)',
    );
    try {
      await pool.query(
        'INSERT INTO sql_cap_lock_fixture SELECT generate_series(1, 25)',
      );
      const result = await strategy.executeQuery(
        pool,
        'SELECT id FROM sql_cap_lock_fixture -- note\nFOR UPDATE',
        { limit: 5 },
      );
      expect(result.rows).toHaveLength(5);
      expect(result.rowCount).toBe(5);
    } finally {
      await pool.query('DROP TABLE IF EXISTS pg_temp.sql_cap_lock_fixture');
    }
  });

  it('shrinks finite FETCH and rejects ties or expressions before opening a lease', async () => {
    const result = await strategy.executeQuery(
      pool,
      'SELECT id FROM generate_series(1, 25) AS id FETCH FIRST 10 ROWS ONLY',
      { limit: 5 },
    );
    expect(result.rowCount).toBe(5);
    const connect = jest.spyOn(pool, 'connect');
    try {
      await expect(
        strategy.executeQuery(
          pool,
          'SELECT id FROM generate_series(1, 25) AS id ORDER BY 1 FETCH FIRST 1 ROWS WITH TIES',
        ),
      ).rejects.toThrow('TIES');
      await expect(
        strategy.executeQuery(
          pool,
          'SELECT id FROM generate_series(1, 25) AS id LIMIT 1+100000',
        ),
      ).rejects.toThrow('expression');
      expect(connect).not.toHaveBeenCalled();
    } finally {
      connect.mockRestore();
    }
  });
});
