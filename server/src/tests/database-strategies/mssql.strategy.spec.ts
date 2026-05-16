import { MssqlStrategy } from '../../database-strategies/mssql.strategy';
import * as mssql from 'mssql';

jest.mock('mssql', () => {
  return {
    ConnectionPool: jest.fn().mockImplementation(() => ({
      connect: jest.fn().mockReturnThis(),
      close: jest.fn(),
      request: jest.fn(),
    })),
    config: {},
    NVarChar: 'NVarChar',
  };
});

describe('MssqlStrategy', () => {
  let strategy: MssqlStrategy;
  let mockPool: any;
  let mockRequest: any;

  beforeEach(() => {
    strategy = new MssqlStrategy();
    mockRequest = {
      query: jest.fn(),
      input: jest.fn().mockReturnThis(),
    };
    mockPool = new (mssql.ConnectionPool as any)();
    mockPool.request.mockReturnValue(mockRequest);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createPool', () => {
    it('should create pool with timeouts and idle config', async () => {
      const config = {
        host: '127.0.0.1',
        port: 1433,
        username: 'sa',
        password: 'password',
        database: 'test_db',
      };

      await strategy.createPool(config);

      expect(mssql.ConnectionPool).toHaveBeenCalledWith(
        expect.objectContaining({
          server: '127.0.0.1',
          user: 'sa',
          requestTimeout: 30000,
          pool: {
            max: 20,
            min: 0,
            idleTimeoutMillis: 30000,
          },
        }),
      );
    });
  });

  describe('executeQuery (OOM Protections)', () => {
    it('should automatically inject TOP 50000 into a bare SELECT query to prevent OOM', async () => {
      mockRequest.query.mockResolvedValue({ recordset: [], rowsAffected: [0] });

      await strategy.executeQuery(mockPool, 'SELECT * FROM big_table');

      expect(mockRequest.query).toHaveBeenCalledWith(
        'SELECT TOP 50000 * FROM big_table',
      );
    });

    it('should not inject TOP if query already has a TOP clause', async () => {
      mockRequest.query.mockResolvedValue({ recordset: [], rowsAffected: [0] });

      await strategy.executeQuery(mockPool, 'SELECT TOP 10 * FROM big_table');

      expect(mockRequest.query).toHaveBeenCalledWith(
        'SELECT TOP 10 * FROM big_table',
      );
    });

    it('should not inject TOP into non-SELECT queries (e.g. UPDATE)', async () => {
      mockRequest.query.mockResolvedValue({
        recordset: undefined,
        rowsAffected: [5],
      });

      const result = await strategy.executeQuery(
        mockPool,
        'UPDATE users SET active = 1',
      );

      expect(mockRequest.query).toHaveBeenCalledWith(
        'UPDATE users SET active = 1',
      );
      expect(result.rowCount).toBe(5);
    });

    it('should slice the result array to 50000 max exactly as a secondary guard', async () => {
      // Mock returning an array of size 50001
      const massiveArray = new Array(50001).fill({ id: 1 });
      mockRequest.query.mockResolvedValue({
        recordset: massiveArray,
        rowsAffected: [],
      });

      const result = await strategy.executeQuery(
        mockPool,
        'SELECT * FROM big_table',
      );

      expect(result.rows.length).toBe(50000);
    });
  });
});
