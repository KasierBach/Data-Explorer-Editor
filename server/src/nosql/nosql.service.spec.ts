import { NoSqlService } from './nosql.service';

describe('NoSqlService security', () => {
  let service: NoSqlService;

  const redisMock = {
    del: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
  };
  const connectionsMock = {
    getPool: jest.fn(),
  };
  const strategyFactoryMock = {
    getStrategy: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NoSqlService(
      redisMock as any,
      connectionsMock as any,
      strategyFactoryMock as any,
    );
  });

  it('authorizes schema cache clearing against the requested connection before deleting cache', async () => {
    connectionsMock.getPool.mockResolvedValueOnce({});

    await service.clearSchemaCache('conn-1', 'analytics', 'events', 'user-1');

    expect(connectionsMock.getPool).toHaveBeenCalledWith(
      'conn-1',
      'analytics',
      'user-1',
    );
    expect(redisMock.del).toHaveBeenCalledWith(
      'nosql_schema:conn-1:analytics:events',
    );
  });

  it('builds a valid Mongo find payload when sampling schema data', async () => {
    const strategy = {
      executeQuery: jest.fn().mockResolvedValue({
        rows: [{ status: 'ok' }],
      }),
    };
    redisMock.get.mockResolvedValueOnce(null);
    connectionsMock.getPool.mockResolvedValueOnce({});
    strategyFactoryMock.getStrategy.mockReturnValue(strategy);

    await service.analyzeSchema({
      connectionId: 'conn-1',
      database: 'analytics',
      collection: 'events',
      sampleSize: 5,
      userId: 'user-1',
    });

    expect(strategyFactoryMock.getStrategy).toHaveBeenCalledWith('mongodb');
    expect(strategy.executeQuery).toHaveBeenCalledWith(
      {},
      JSON.stringify({
        action: 'find',
        collection: 'events',
        limit: 5,
      }),
    );
  });
});
