import { ClickHouseStrategy } from '../../database-strategies/clickhouse.strategy';
import { createClient } from '@clickhouse/client';

jest.mock('@clickhouse/client', () => ({
  createClient: jest.fn(),
}));

describe('ClickHouseStrategy', () => {
  let strategy: ClickHouseStrategy;
  let mockPool: {
    query: jest.Mock;
    exec: jest.Mock;
    close: jest.Mock;
  };

  beforeEach(() => {
    strategy = new ClickHouseStrategy();
    mockPool = {
      query: jest.fn(),
      exec: jest.fn(),
      close: jest.fn(),
    };
    (createClient as jest.Mock).mockReturnValue(mockPool);
  });

  it('uses HTTPS and the secure default port for remote ClickHouse hosts', () => {
    strategy.createPool({
      host: 'db.example.com',
      username: 'default',
      database: 'default',
    });

    expect(createClient).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'https://db.example.com:8443',
      }),
    );
  });

  it('uses generated parameter names for untrusted column identifiers', async () => {
    await strategy.insertRow(mockPool as never, {
      schema: 'default',
      table: 'users',
      data: { 'name:String} WHERE 1=1 --': 'Ada' },
    });

    expect(mockPool.exec).toHaveBeenCalledWith({
      query:
        'INSERT INTO `default`.`users` (`name:String} WHERE 1=1 --`) VALUES ({p0:String})',
      query_params: { p0: 'Ada' },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('uses the requested limit and offset for paged table windows', async () => {
    mockPool.query.mockResolvedValue({
      json: jest.fn().mockResolvedValue([]),
    });

    await strategy.executeQuery(mockPool as never, 'SELECT * FROM events', {
      limit: 100,
      offset: 200,
    });

    expect(mockPool.query).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'SELECT * FROM events LIMIT 100 OFFSET 200',
        format: 'JSONEachRow',
      }),
    );
  });

  it('keeps the protective 50000-row cap for bare SELECT statements', async () => {
    mockPool.query.mockResolvedValue({
      json: jest.fn().mockResolvedValue([]),
    });

    await strategy.executeQuery(mockPool as never, 'SELECT * FROM events');

    expect(mockPool.query).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'SELECT * FROM events LIMIT 50000',
        format: 'JSONEachRow',
      }),
    );
  });
});
