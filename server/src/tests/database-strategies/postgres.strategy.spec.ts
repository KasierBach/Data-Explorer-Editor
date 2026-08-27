import { PostgresStrategy } from '../../database-strategies/postgres.strategy';
import { Pool } from 'pg';

jest.mock('pg', () => {
  return {
    Pool: jest.fn().mockImplementation(() => ({
      connect: jest.fn(),
      query: jest.fn(),
      end: jest.fn(),
      on: jest.fn(),
    })),
  };
});

describe('PostgresStrategy', () => {
  let strategy: PostgresStrategy;
  let mockPool: any;
  let mockClient: any;

  beforeEach(() => {
    strategy = new PostgresStrategy();
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    mockPool = new Pool();
    mockPool.connect.mockResolvedValue(mockClient);
    (Pool as unknown as jest.Mock).mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createPool', () => {
    it('should pass timeouts to the PG Pool configuration', () => {
      const config = {
        host: '127.0.0.1',
        port: 5432,
        username: 'postgres',
        password: 'password',
        database: 'test_db',
      };

      strategy.createPool(config);

      expect(Pool).toHaveBeenCalledWith(
        expect.objectContaining({
          host: '127.0.0.1',
          statement_timeout: 30000,
          query_timeout: 30000,
          ssl: false,
        }),
      );
    });

    it('verifies TLS certificates for remote PostgreSQL hosts', () => {
      strategy.createPool({
        host: 'db.example.com',
        port: 5432,
        username: 'postgres',
        password: 'password',
        database: 'test_db',
      });

      expect(Pool).toHaveBeenCalledWith(
        expect.objectContaining({
          ssl: { rejectUnauthorized: true },
        }),
      );
    });

    it('trusts the official Supabase CA while keeping TLS verification enabled', () => {
      strategy.createPool({
        host: 'aws-1-ap-south-1.pooler.supabase.com',
        port: 6543,
        username: 'postgres',
        password: 'password',
        database: 'postgres',
      });

      expect(Pool).toHaveBeenCalledWith(
        expect.objectContaining({
          ssl: expect.objectContaining({
            ca: expect.stringContaining('BEGIN CERTIFICATE'),
            rejectUnauthorized: true,
          }),
        }),
      );
    });
  });

  describe('identifier quoting', () => {
    it('quotes schema operation identifiers', () => {
      const quote = String.fromCharCode(34);
      const sql = strategy.buildAlterTableSql(quote + 'users' + quote, {
        type: 'add_fk',
        name: 'fk' + quote + 'name',
        columns: ['user' + quote + 'id'],
        refTable: 'accounts',
        refColumns: ['id'],
      } as any);

      expect(sql).toBe(
        'ALTER TABLE ' +
          quote +
          'users' +
          quote +
          ' ADD CONSTRAINT ' +
          quote +
          'fk' +
          quote +
          quote +
          'name' +
          quote +
          ' FOREIGN KEY (' +
          quote +
          'user' +
          quote +
          quote +
          'id' +
          quote +
          ') REFERENCES ' +
          quote +
          'accounts' +
          quote +
          ' (' +
          quote +
          'id' +
          quote +
          ')',
      );
    });

    it('escapes delimiter characters in table and column identifiers', async () => {
      const quote = String.fromCharCode(34);
      mockPool.query.mockResolvedValue({ rowCount: 1 });

      await strategy.updateRow(mockPool, {
        schema: 'public',
        table: 'users' + quote + '; DROP TABLE audit; --',
        pkColumn: 'id' + quote + ' OR 1=1 --',
        pkValue: 1,
        updates: { ['display' + quote + 'name']: 'Ada' },
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        'UPDATE ' +
          quote +
          'public' +
          quote +
          '.' +
          quote +
          'users' +
          quote +
          quote +
          '; DROP TABLE audit; --' +
          quote +
          ' SET ' +
          quote +
          'display' +
          quote +
          quote +
          'name' +
          quote +
          ' = $1 WHERE ' +
          quote +
          'id' +
          quote +
          quote +
          ' OR 1=1 --' +
          quote +
          ' = $2',
        ['Ada', 1],
      );
    });

    it('escapes imported column names', async () => {
      const quote = String.fromCharCode(34);
      mockClient.query.mockResolvedValue({ rowCount: 1 });

      await strategy.importData(mockPool, {
        schema: 'public',
        table: 'users',
        data: [{ ['display' + quote + 'name']: 'Ada' }],
      });

      const insertCall = mockClient.query.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].startsWith('INSERT'),
      );
      expect(insertCall?.[0]).toContain(
        '(' + quote + 'display' + quote + quote + 'name' + quote + ')',
      );
    });

    it('chunks large imports to stay under the Postgres parameter limit and wraps them in a transaction', async () => {
      mockClient.query.mockResolvedValue({ rowCount: 1 });

      // 3 columns × 25000 rows = 75000 parameters > 60000 → must split into 2 chunks.
      const rows = Array.from({ length: 25000 }, () => ({
        a: 1,
        b: 2,
        c: 3,
      }));

      const result = await strategy.importData(mockPool, {
        schema: 'public',
        table: 'users',
        data: rows,
      });

      const insertCalls = mockClient.query.mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0].startsWith('INSERT'),
      );
      expect(insertCalls.length).toBe(2);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(result).toEqual({ success: true, rowCount: 2 });
    });

    it('rolls back the import when a chunk fails', async () => {
      mockClient.query.mockImplementation((sql: string) => {
        if (sql === 'BEGIN') return Promise.resolve({});
        if (sql.startsWith('INSERT')) {
          return Promise.reject(new Error('insert failed'));
        }
        return Promise.resolve({});
      });

      await expect(
        strategy.importData(mockPool, {
          schema: 'public',
          table: 'users',
          data: [{ a: 1 }],
        }),
      ).rejects.toThrow('insert failed');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('executeQuery (OOM & Timeout Protections)', () => {
    it('should automatically append LIMIT 50000 to a bare SELECT query to prevent OOM', async () => {
      mockClient.query.mockResolvedValue({ rows: [], fields: [], rowCount: 0 });

      await strategy.executeQuery(mockPool, 'SELECT * FROM big_table');

      expect(mockClient.query).toHaveBeenCalledWith(
        'SELECT * FROM big_table LIMIT 50000;',
      );
    });

    it('should not append LIMIT if query already has a LIMIT clause', async () => {
      mockClient.query.mockResolvedValue({ rows: [], fields: [], rowCount: 0 });

      await strategy.executeQuery(mockPool, 'SELECT * FROM big_table LIMIT 10');

      expect(mockClient.query).toHaveBeenCalledWith(
        'SELECT * FROM big_table LIMIT 10',
      );
    });

    it('should not append LIMIT to non-SELECT queries (e.g. DELETE)', async () => {
      mockClient.query.mockResolvedValue({ rows: [], fields: [], rowCount: 5 });

      const result = await strategy.executeQuery(
        mockPool,
        'DELETE FROM users WHERE id > 100',
      );

      expect(mockClient.query).toHaveBeenCalledWith(
        'DELETE FROM users WHERE id > 100',
      );
      expect(result.rowCount).toBe(5);
    });

    it('should slice the result array to 50000 max exactly as a secondary guard', async () => {
      // Mock returning an array of size 50001
      const massiveArray = new Array(50001).fill({ id: 1 });
      mockClient.query.mockResolvedValue({
        rows: massiveArray,
        fields: [],
        rowCount: 50001,
      });

      const result = await strategy.executeQuery(
        mockPool,
        'SELECT * FROM big_table',
      );

      expect(result.rows.length).toBe(50000);
      expect(mockClient.release).toHaveBeenCalled();
    });
  });
});
