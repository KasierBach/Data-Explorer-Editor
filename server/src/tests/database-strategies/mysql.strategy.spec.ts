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
