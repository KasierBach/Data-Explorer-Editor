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
    authorizeAccess: jest.fn(),
  };
  const strategyFactoryMock = {
    getStrategy: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    redisMock.get.mockReset();
    connectionsMock.authorizeAccess.mockResolvedValue({});
    service = new NoSqlService(
      redisMock as any,
      connectionsMock as any,
      strategyFactoryMock as any,
      {
        buildKey: jest.fn().mockResolvedValue('schema-key'),
        bump: jest.fn(),
      } as never,
    );
  });

  it.each([false, true])(
    'denies schema/sample access before cache read or refresh (refresh=%s)',
    async (refresh) => {
      const denied = new Error('revoked');
      connectionsMock.authorizeAccess.mockRejectedValueOnce(denied);
      redisMock.get.mockResolvedValueOnce([{ sampleValues: ['private'] }]);
      await expect(
        service.analyzeSchema({
          connectionId: 'conn',
          database: 'private',
          collection: 'users',
          userId: 'outsider',
          refresh,
        }),
      ).rejects.toBe(denied);
      expect(redisMock.get).not.toHaveBeenCalled();
      expect(redisMock.del).not.toHaveBeenCalled();
      expect(connectionsMock.getPool).not.toHaveBeenCalled();
    },
  );

  it('does not serve cached sample values when query execution is disabled', async () => {
    connectionsMock.authorizeAccess.mockResolvedValueOnce({
      allowQueryExecution: false,
    });
    await expect(
      service.analyzeSchema({
        connectionId: 'conn',
        database: 'main',
        collection: 'users',
        userId: 'owner',
      }),
    ).rejects.toThrow('Schema sampling is disabled');
    expect(redisMock.get).not.toHaveBeenCalled();
    expect(connectionsMock.getPool).not.toHaveBeenCalled();
  });

  it('authorizes schema cache clearing against the requested connection before deleting cache', async () => {
    connectionsMock.getPool.mockResolvedValueOnce({});

    await service.clearSchemaCache('conn-1', 'analytics', 'events', 'user-1');

    expect(connectionsMock.getPool).toHaveBeenCalledWith(
      'conn-1',
      'analytics',
      'user-1',
    );
    expect(service['freshnessService'].bump).toHaveBeenCalledWith(
      'nosql-schema',
      ['conn-1', 'analytics'],
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

  it('caps schema sampling to the configured maximum to avoid oversized scans', async () => {
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
      sampleSize: 50000,
      userId: 'user-1',
    });

    expect(strategy.executeQuery).toHaveBeenCalledWith(
      {},
      JSON.stringify({
        action: 'find',
        collection: 'events',
        limit: 1000,
      }),
    );
  });
});
