import { ClickHouseStrategy } from '../../database-strategies/clickhouse.strategy';

describe('ClickHouseStrategy', () => {
  let strategy: ClickHouseStrategy;
  let mockPool: {
    query: jest.Mock;
    close: jest.Mock;
  };

  beforeEach(() => {
    strategy = new ClickHouseStrategy();
    mockPool = {
      query: jest.fn(),
      close: jest.fn(),
    };
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
