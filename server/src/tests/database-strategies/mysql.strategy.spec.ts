import { MysqlStrategy } from '../../database-strategies/mysql.strategy';
import * as mysql from 'mysql2/promise';

jest.mock('mysql2/promise', () => ({
  createPool: jest.fn(),
}));

describe('MysqlStrategy', () => {
  let strategy: MysqlStrategy;
  let mockPool: any;

  beforeEach(() => {
    strategy = new MysqlStrategy();
    mockPool = {
      query: jest.fn(),
      execute: jest.fn(),
      end: jest.fn(),
    };
    (mysql.createPool as jest.Mock).mockReturnValue(mockPool);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createPool', () => {
    it('should pass connectTimeout 10000 to the MySQL configuration', async () => {
      const config = {
        host: 'localhost',
        port: 3306,
        username: 'root',
        password: 'password',
        database: 'test_db',
      };

      strategy.createPool(config);

      expect(mysql.createPool).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'localhost',
          user: 'root',
          connectTimeout: 10000,
          multipleStatements: false,
        }),
      );
    });

    it('verifies TLS certificates for remote MySQL hosts', () => {
      strategy.createPool({
        host: 'db.example.com',
        port: 3306,
        username: 'root',
        password: 'password',
        database: 'test_db',
      });

      expect(mysql.createPool).toHaveBeenCalledWith(
        expect.objectContaining({
          ssl: { rejectUnauthorized: true },
        }),
      );
    });
  });

  describe('identifier quoting', () => {
    it('escapes delimiter characters in table and column identifiers', async () => {
      const quote = String.fromCharCode(96);
      mockPool.execute.mockResolvedValue([{ affectedRows: 1 }]);

      await strategy.updateRow(mockPool, {
        schema: 'app',
        table: 'users' + quote + '; DROP TABLE audit; --',
        pkColumn: 'id' + quote + ' OR 1=1 --',
        pkValue: 1,
        updates: { ['display' + quote + 'name']: 'Ada' },
      });

      expect(mockPool.execute).toHaveBeenCalledWith(
        'UPDATE ' +
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
          ' = ? WHERE ' +
          quote +
          'id' +
          quote +
          quote +
          ' OR 1=1 --' +
          quote +
          ' = ?',
        ['Ada', 1],
      );
    });

    it('escapes imported column names', async () => {
      const quote = String.fromCharCode(96);
      mockPool.execute.mockResolvedValue([{ affectedRows: 1 }]);

      await strategy.importData(mockPool, {
        schema: 'app',
        table: 'users',
        data: [{ ['display' + quote + 'name']: 'Ada' }],
      });

      expect(mockPool.execute.mock.calls[0][0]).toContain(
        '(' + quote + 'display' + quote + quote + 'name' + quote + ')',
      );
    });
  });

  describe('executeQuery (OOM & Timeout Protections)', () => {
    it('should automatically append LIMIT 50000 to a bare SELECT query to prevent OOM', async () => {
      mockPool.query.mockResolvedValue([[], []]);

      await strategy.executeQuery(mockPool, 'SELECT * FROM big_table');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.objectContaining({
          sql: 'SELECT * FROM big_table LIMIT 50000;',
          timeout: 30000,
        }),
      );
    });

    it('should not append LIMIT if query already has a LIMIT clause', async () => {
      mockPool.query.mockResolvedValue([[], []]);

      await strategy.executeQuery(mockPool, 'SELECT * FROM big_table LIMIT 10');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.objectContaining({
          sql: 'SELECT * FROM big_table LIMIT 10',
          timeout: 30000,
        }),
      );
    });

    it('should not append LIMIT to non-SELECT queries (e.g. UPDATE)', async () => {
      mockPool.query.mockResolvedValue([{ affectedRows: 1 }, []]);

      const result = await strategy.executeQuery(
        mockPool,
        "UPDATE users SET name = 'Test'",
      );

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.objectContaining({
          sql: "UPDATE users SET name = 'Test'",
          timeout: 30000,
        }),
      );
      expect(result.rowCount).toBe(1);
    });

    it('should slice the result array to 50000 max exactly as a secondary guard', async () => {
      // Mock returning 50001 rows
      const massiveArray = new Array(50001).fill({ id: 1 });
      mockPool.query.mockResolvedValue([massiveArray, []]);

      const result = await strategy.executeQuery(
        mockPool,
        'SELECT * FROM big_table',
      );

      expect(result.rows.length).toBe(50000);
    });
  });
});
