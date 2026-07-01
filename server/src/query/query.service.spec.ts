import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { QueryService } from './query.service';
import { ConnectionsService } from '../connections/connections.service';
import { DatabaseStrategyFactory } from '../database-strategies';
import { AuditAction, AuditService } from '../audit/audit.service';
import { FreshnessService } from '../common/freshness/freshness.service';
import { PermissionsService } from '../permissions/services/permissions.service';
import { Permission } from '../permissions/enums/permission.enum';
import { ResourceType } from '../permissions/enums/resource-type.enum';

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
  const permissionsService = {
    ensurePermission: jest.fn(),
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
        { provide: PermissionsService, useValue: permissionsService },
      ],
    }).compile();

    service = module.get(QueryService);
  });

  it('requires write permission before executing mutating SQL', async () => {
    connectionsService.findOne.mockResolvedValue({
      id: 'conn-1',
      type: 'postgres',
      database: 'main',
      readOnly: false,
      allowQueryExecution: true,
      allowSchemaChanges: true,
      allowImportExport: true,
    });
    permissionsService.ensurePermission.mockRejectedValueOnce(
      new ForbiddenException('viewer cannot write'),
    );

    await expect(
      service.executeQuery(
        {
          connectionId: 'conn-1',
          sql: 'UPDATE users SET active = false',
          confirmed: true,
        } as any,
        'viewer-1',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(permissionsService.ensurePermission).toHaveBeenCalledWith(
      'viewer-1',
      ResourceType.CONNECTION,
      'conn-1',
      Permission.WRITE,
    );
    expect(strategy.executeQuery).not.toHaveBeenCalled();
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

    const result = (await service.executeQuery(
      {
        connectionId: 'conn-1',
        sql: 'SELECT * FROM users',
        limit: 1000,
        offset: 0,
        includeTotalCount: false,
      } as any,
      'user-1',
    )) as any;

    expect(strategy.executeQuery).toHaveBeenCalledTimes(1);
    expect(result.totalCount).toBeUndefined();
    expect(freshnessService.buildKey).toHaveBeenCalledWith(
      'query',
      ['conn-1', 'main'],
      ['select * from users', 'limit:1000', 'offset:0', 'total:0'],
    );
  });

  it('runs multi-statement SQL sequentially and returns the final statement result', async () => {
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
    strategy.executeQuery
      .mockResolvedValueOnce({
        rows: [{ sample: 'hello; world' }],
        columns: ['sample'],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [{ id: 2 }],
        columns: ['id'],
        rowCount: 1,
      });

    const result = await service.executeQuery(
      {
        connectionId: 'conn-1',
        sql: "SELECT 'hello; world' AS sample; SELECT * FROM users",
        limit: 10,
        offset: 5,
        includeTotalCount: false,
      } as any,
      'user-1',
    );

    expect(strategy.executeQuery).toHaveBeenNthCalledWith(
      1,
      {},
      "SELECT 'hello; world' AS sample",
      undefined,
    );
    expect(strategy.executeQuery).toHaveBeenNthCalledWith(
      2,
      {},
      'SELECT * FROM users',
      { limit: 10, offset: 5 },
    );
    expect(cacheManager.get).not.toHaveBeenCalled();
    expect(freshnessService.buildKey).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        rows: [{ id: 2 }],
        columns: ['id'],
        rowCount: 1,
        appliedLimit: 10,
        appliedOffset: 5,
        limitSource: 'requested',
        countStatus: 'skipped',
      }),
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

  it('reuses a table count across different page windows', async () => {
    const cache = new Map<string, unknown>();
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
    freshnessService.buildKey.mockImplementation((...parts: unknown[]) =>
      JSON.stringify(parts),
    );
    cacheManager.get.mockImplementation((key: string) => cache.get(key));
    cacheManager.set.mockImplementation(
      (key: string, value: unknown) => void cache.set(key, value),
    );
    strategy.executeQuery
      .mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ total: 42 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ id: 2 }], rowCount: 1 });

    await service.fetchTableWindow(
      {
        connectionId: 'conn-1',
        database: 'main',
        schema: 'public',
        table: 'users',
        limit: 25,
        offset: 0,
      } as any,
      'user-1',
    );
    const secondPage = await service.fetchTableWindow(
      {
        connectionId: 'conn-1',
        database: 'main',
        schema: 'public',
        table: 'users',
        limit: 25,
        offset: 25,
      } as any,
      'user-1',
    );

    expect(strategy.executeQuery).toHaveBeenCalledTimes(3);
    expect(secondPage.totalCount).toBe(42);
  });

  it('skips confirmation for create and insert statements', async () => {
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
    strategy.executeQuery.mockResolvedValue({
      rows: [],
      columns: [],
      rowCount: 0,
    });

    await expect(
      service.executeQuery(
        {
          connectionId: 'conn-1',
          sql: 'CREATE TABLE audit_log (id INT)',
          includeTotalCount: false,
        } as any,
        'user-1',
      ),
    ).resolves.toBeDefined();

    await expect(
      service.executeQuery(
        {
          connectionId: 'conn-1',
          sql: 'INSERT INTO audit_log (id) VALUES (1)',
          includeTotalCount: false,
        } as any,
        'user-1',
      ),
    ).resolves.toBeDefined();

    expect(auditService.log).not.toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.DB_QUERY_BLOCKED,
      }),
    );
  });

  it('skips confirmation for targeted deletes with a WHERE clause', async () => {
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
    strategy.executeQuery.mockResolvedValue({
      rows: [],
      columns: [],
      rowCount: 1,
    });

    await expect(
      service.executeQuery(
        {
          connectionId: 'conn-1',
          sql: 'DELETE FROM audit_log WHERE id = 1',
          includeTotalCount: false,
        } as any,
        'user-1',
      ),
    ).resolves.toBeDefined();

    expect(auditService.log).not.toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.DB_QUERY_BLOCKED,
      }),
    );
  });

  it('requires confirmation for deletes without a WHERE clause', async () => {
    connectionsService.findOne.mockResolvedValue({
      id: 'conn-1',
      type: 'postgres',
      database: 'main',
      readOnly: false,
      allowQueryExecution: true,
      allowSchemaChanges: true,
      allowImportExport: true,
    });

    await expect(
      service.executeQuery(
        {
          connectionId: 'conn-1',
          sql: 'DELETE FROM audit_log',
          includeTotalCount: false,
        } as any,
        'user-1',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.DB_QUERY_BLOCKED,
        details: expect.objectContaining({
          reason: 'DESTRUCTIVE_REQUIRES_CONFIRMATION',
          severity: 'high',
        }),
      }),
    );
  });

  it('requires confirmation when a later statement in a SQL sequence is dangerous', async () => {
    connectionsService.findOne.mockResolvedValue({
      id: 'conn-1',
      type: 'postgres',
      database: 'main',
      readOnly: false,
      allowQueryExecution: true,
      allowSchemaChanges: true,
      allowImportExport: true,
    });

    let thrown: ForbiddenException | null = null;
    try {
      await service.executeQuery(
        {
          connectionId: 'conn-1',
          sql: 'CREATE TABLE temp_users (id INT); DELETE FROM audit_log',
          includeTotalCount: false,
        } as any,
        'user-1',
      );
    } catch (error) {
      thrown = error as ForbiddenException;
    }

    expect(thrown).toBeInstanceOf(ForbiddenException);
    expect(strategy.executeQuery).not.toHaveBeenCalled();

    const response = thrown?.getResponse() as any;
    expect(response.message).toContain(
      'Statement 2 of 2 requires confirmation.',
    );
    expect(response.details.analysis).toEqual(
      expect.objectContaining({
        severity: 'high',
        statement: 'DELETE FROM audit_log',
        statementIndex: 2,
        statementCount: 2,
        flaggedStatements: 1,
        affectedObject: 'audit_log',
      }),
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.DB_QUERY_BLOCKED,
        details: expect.objectContaining({
          flaggedStatementSnippet: 'DELETE FROM audit_log',
          statementIndex: 2,
          statementCount: 2,
        }),
      }),
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
