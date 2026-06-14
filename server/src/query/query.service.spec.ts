import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { QueryService } from './query.service';
import { ConnectionsService } from '../connections/connections.service';
import { DatabaseStrategyFactory } from '../database-strategies';
import { AuditService } from '../audit/audit.service';
import { FreshnessService } from '../common/freshness/freshness.service';

describe('QueryService', () => {
  let service: QueryService;

  const connectionsService = {
    findOne: jest.fn(),
    getPool: jest.fn(),
  };
  const strategy = {
    executeQuery: jest.fn(),
    updateRow: jest.fn(),
    insertRow: jest.fn(),
    deleteRows: jest.fn(),
    quoteTable: jest.fn(
      (schema: string, table: string) => `${schema}.${table}`,
    ),
    buildAlterTableSql: jest.fn(),
    seedData: jest.fn(),
    createDatabase: jest.fn(),
    dropDatabase: jest.fn(),
    importData: jest.fn(),
  };
  const strategyFactory = {
    getStrategy: jest.fn(() => strategy),
  };
  const auditService = {
    log: jest.fn(),
  };
  const freshnessService = {
    buildKey: jest.fn(),
    bump: jest.fn(),
  };
  const cacheManager = {
    get: jest.fn(),
    set: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueryService,
        { provide: ConnectionsService, useValue: connectionsService },
        { provide: DatabaseStrategyFactory, useValue: strategyFactory },
        { provide: AuditService, useValue: auditService },
        { provide: FreshnessService, useValue: freshnessService },
        { provide: CACHE_MANAGER, useValue: cacheManager },
      ],
    }).compile();

    service = module.get(QueryService);
  });

  it('builds versioned cache keys for query reads including pagination options', async () => {
    connectionsService.findOne.mockResolvedValue({
      id: 'conn-1',
      type: 'postgres',
      database: 'main',
      readOnly: false,
      allowQueryExecution: true,
      allowSchemaChanges: true,
      allowImportExport: true,
    });
    connectionsService.getPool.mockResolvedValue({});
    freshnessService.buildKey.mockResolvedValue('freshness:query:key');
    cacheManager.get.mockResolvedValue(undefined);
    strategy.executeQuery.mockResolvedValue({ rows: [{ id: 1 }] });

    await service.executeQuery(
      {
        connectionId: 'conn-1',
        sql: 'SELECT * FROM users',
        limit: 25,
        offset: 50,
      } as any,
      'user-1',
    );

    expect(freshnessService.buildKey).toHaveBeenCalledWith(
      'query',
      ['conn-1', 'main'],
      ['select * from users', 'limit:25', 'offset:50'],
    );
  });

  it('bumps freshness scopes after a write succeeds', async () => {
    connectionsService.findOne.mockResolvedValue({
      id: 'conn-1',
      type: 'postgres',
      database: 'main',
      readOnly: false,
      allowQueryExecution: true,
      allowSchemaChanges: true,
      allowImportExport: true,
    });
    connectionsService.getPool.mockResolvedValue({});
    strategy.updateRow.mockResolvedValue({ success: true });

    await service.updateRow(
      {
        connectionId: 'conn-1',
        database: 'main',
        schema: 'public',
        table: 'users',
        pkColumn: 'id',
        pkValue: 1,
        updates: { name: 'Ada' },
      } as any,
      'user-1',
    );

    expect(freshnessService.bump).toHaveBeenCalledWith('query', [
      'conn-1',
      'main',
    ]);
    expect(freshnessService.bump).toHaveBeenCalledWith('metadata', ['conn-1']);
    expect(freshnessService.bump).toHaveBeenCalledWith('ai-schema', [
      'conn-1',
      'main',
    ]);
  });

  it('skips total-count side query when caller disables it', async () => {
    connectionsService.findOne.mockResolvedValue({
      id: 'conn-1',
      type: 'postgres',
      database: 'main',
      readOnly: false,
      allowQueryExecution: true,
      allowSchemaChanges: true,
      allowImportExport: true,
    });
    connectionsService.getPool.mockResolvedValue({});
    freshnessService.buildKey.mockResolvedValue('freshness:query:key');
    cacheManager.get.mockResolvedValue(undefined);
    strategy.executeQuery.mockResolvedValue({ rows: [{ id: 1 }] });

    const result = await service.executeQuery(
      {
        connectionId: 'conn-1',
        sql: 'SELECT * FROM users',
        limit: 1000,
        offset: 0,
        includeTotalCount: false,
      } as any,
      'user-1',
    );

    expect(strategy.executeQuery).toHaveBeenCalledTimes(1);
    expect(result.totalCount).toBeUndefined();
    expect(freshnessService.buildKey).toHaveBeenCalledWith(
      'query',
      ['conn-1', 'main'],
      ['select * from users', 'limit:1000', 'offset:0', 'total:0'],
    );
  });

  it('returns explicit table windows with limit, offset, and a trusted total count', async () => {
    connectionsService.findOne.mockResolvedValue({
      id: 'conn-1',
      type: 'postgres',
      database: 'main',
      readOnly: false,
      allowQueryExecution: true,
      allowSchemaChanges: true,
      allowImportExport: true,
    });
    connectionsService.getPool.mockResolvedValue({});
    freshnessService.buildKey.mockResolvedValue('freshness:table-window:key');
    cacheManager.get.mockResolvedValue(undefined);
    strategy.executeQuery
      .mockResolvedValueOnce({
        rows: [{ id: 1 }],
        columns: ['id'],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [{ total: 42 }],
        columns: ['total'],
        rowCount: 1,
      });

    const result = await service.fetchTableWindow(
      {
        connectionId: 'conn-1',
        database: 'main',
        schema: 'public',
        table: 'users',
        limit: 25,
        offset: 50,
      } as any,
      'user-1',
    );

    expect(strategy.quoteTable).toHaveBeenCalledWith('public', 'users');
    expect(strategy.executeQuery).toHaveBeenNthCalledWith(
      1,
      {},
      'SELECT * FROM public.users',
      { limit: 25, offset: 50 },
    );
    expect(strategy.executeQuery).toHaveBeenNthCalledWith(
      2,
      {},
      'SELECT COUNT(*) AS total FROM public.users',
    );
    expect(result).toEqual(
      expect.objectContaining({
        totalCount: 42,
        countStatus: 'available',
        appliedLimit: 25,
        appliedOffset: 50,
        limitSource: 'table_window',
      }),
    );
    expect(cacheManager.set).toHaveBeenCalledWith(
      'freshness:table-window:key',
      expect.objectContaining({
        totalCount: 42,
        countStatus: 'available',
      }),
      60_000,
    );
  });

  it('marks raw select queries with the protective default limit when no explicit limit is requested', async () => {
    connectionsService.findOne.mockResolvedValue({
      id: 'conn-1',
      type: 'postgres',
      database: 'main',
      readOnly: false,
      allowQueryExecution: true,
      allowSchemaChanges: true,
      allowImportExport: true,
    });
    connectionsService.getPool.mockResolvedValue({});
    freshnessService.buildKey.mockResolvedValue('freshness:query:key');
    cacheManager.get.mockResolvedValue(undefined);
    strategy.executeQuery.mockResolvedValue({
      rows: [{ id: 1 }],
      columns: ['id'],
      rowCount: 1,
    });

    const result = await service.executeQuery(
      {
        connectionId: 'conn-1',
        sql: 'SELECT * FROM users',
        includeTotalCount: false,
      } as any,
      'user-1',
    );

    expect(result).toEqual(
      expect.objectContaining({
        appliedLimit: 50_000,
        limitSource: 'protective_default',
        countStatus: 'skipped',
      }),
    );
  });
});
