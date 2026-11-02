import {
  BadRequestException,
  ConflictException,
  HttpException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Test } from '@nestjs/testing';
import { QueryService } from './query.service';
import { queryDatabaseException } from './query-error.util';
import { ConnectionsService } from '../connections/connections.service';
import { DatabaseStrategyFactory } from '../database-strategies';
import { AuditService } from '../audit/audit.service';
import { FreshnessService } from '../common/freshness/freshness.service';
import { PermissionsService } from '../permissions/services/permissions.service';

describe('R10 query error contract', () => {
  let service: QueryService;
  const connection = {
    id: 'r10',
    type: 'postgres',
    database: 'fixture',
    allowQueryExecution: true,
    allowSchemaChanges: true,
    allowImportExport: true,
  };
  const strategy = {
    executeQuery: jest.fn(),
    insertRow: jest.fn(),
    updateRow: jest.fn(),
    deleteRows: jest.fn(),
    seedData: jest.fn(),
    createDatabase: jest.fn(),
    dropDatabase: jest.fn(),
    importData: jest.fn(),
    getColumns: jest.fn().mockResolvedValue([
      { name: 'id', type: 'integer', isPrimaryKey: true },
      { name: 'name', type: 'text' },
    ]),
    quoteTable: jest.fn(() => 'public.items'),
    buildAlterTableSql: jest.fn(() => 'ALTER TABLE items ADD name text'),
  };
  const connections = {
    findOne: jest.fn(() => connection),
    getPool: jest.fn(() => ({})),
  };
  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        QueryService,
        { provide: ConnectionsService, useValue: connections },
        {
          provide: DatabaseStrategyFactory,
          useValue: { getStrategy: () => strategy },
        },
        { provide: AuditService, useValue: { log: jest.fn() } },
        {
          provide: FreshnessService,
          useValue: {
            invalidateConnection: jest.fn(),
            invalidatePartialWrite: jest.fn(),
          },
        },
        {
          provide: PermissionsService,
          useValue: { ensurePermission: jest.fn() },
        },
        {
          provide: CACHE_MANAGER,
          useValue: { get: jest.fn(), set: jest.fn() },
        },
      ],
    }).compile();
    service = module.get(QueryService);
  });

  it.each([
    ['42601', 400, 'QUERY_SYNTAX_ERROR'],
    ['42P01', 400, 'QUERY_OBJECT_NOT_FOUND'],
    ['42703', 400, 'QUERY_OBJECT_NOT_FOUND'],
    ['22P02', 400, 'QUERY_VALIDATION_FAILED'],
    ['23502', 400, 'QUERY_VALIDATION_FAILED'],
    ['23514', 400, 'QUERY_VALIDATION_FAILED'],
    ['23505', 409, 'QUERY_CONFLICT'],
    ['23503', 409, 'QUERY_CONFLICT'],
    ['42501', 403, 'DATABASE_PERMISSION_DENIED'],
    ['08006', 503, 'DATABASE_UNAVAILABLE'],
    ['ECONNREFUSED', 503, 'DATABASE_UNAVAILABLE'],
    ['unrecognized', 500, 'QUERY_EXECUTION_FAILED'],
  ])(
    'classifies PostgreSQL %s without retrying the driver',
    async (code, status, reason) => {
      strategy.executeQuery.mockRejectedValueOnce(
        Object.assign(new Error('native failure'), { code }),
      );
      const operation = service.executeQuery(
        { connectionId: 'r10', sql: 'SELECT 1' },
        'user',
      );
      await expect(operation).rejects.toMatchObject({
        status,
        response: expect.objectContaining({ reason }),
      });
      expect(strategy.executeQuery).toHaveBeenCalledTimes(1);
      expect(service.getActiveQueries('user')).toEqual([]);
    },
  );

  it.each(['insert', 'update', 'delete', 'schema'])(
    'keeps constraint status through the %s caller',
    async (action) => {
      const error = Object.assign(new Error('duplicate fixture key'), {
        code: '23505',
      });
      const payload = {
        connectionId: 'r10',
        schema: 'public',
        table: 'items',
        pkColumn: 'id',
        pkValue: 1,
      };
      let operation: Promise<unknown>;
      if (action === 'insert') {
        strategy.insertRow.mockRejectedValueOnce(error);
        operation = service.insertRow({ ...payload, data: { id: 1 } }, 'user');
      } else if (action === 'update') {
        strategy.updateRow.mockRejectedValueOnce(error);
        operation = service.updateRow(
          { ...payload, updates: { name: 'duplicate' } },
          'user',
        );
      } else if (action === 'delete') {
        strategy.deleteRows.mockRejectedValueOnce(error);
        operation = service.deleteRows({ ...payload, pkValues: [1] }, 'user');
      } else {
        strategy.executeQuery.mockRejectedValueOnce(error);
        operation = service.updateSchema(
          {
            ...payload,
            operations: [
              { type: 'add_column', name: 'name', dataType: 'text' },
            ],
          },
          'user',
        );
      }
      await expect(operation).rejects.toBeInstanceOf(ConflictException);
    },
  );

  it.each(['seed', 'create', 'drop', 'import'])(
    'keeps native conflict status through %s',
    async (action) => {
      const error = Object.assign(new Error('duplicate fixture object'), {
        code: '23505',
      });
      let operation: Promise<unknown>;
      if (action === 'seed') {
        strategy.seedData.mockRejectedValueOnce(error);
        operation = service.seedData('r10', 'user');
      } else if (action === 'create') {
        strategy.createDatabase.mockRejectedValueOnce(error);
        operation = service.createDatabase('r10', 'r10_db', 'user');
      } else if (action === 'drop') {
        strategy.dropDatabase.mockRejectedValueOnce(error);
        operation = service.dropDatabase('r10', 'r10_db', 'user');
      } else {
        strategy.importData.mockRejectedValueOnce(error);
        operation = service.importData(
          {
            connectionId: 'r10',
            schema: 'public',
            table: 'items',
            data: [{ id: 1 }],
          },
          'user',
        );
      }
      await expect(operation).rejects.toBeInstanceOf(ConflictException);
    },
  );

  it('keeps missing-table status through table browsing', async () => {
    strategy.executeQuery.mockRejectedValueOnce(
      Object.assign(new Error('missing table'), { code: '42P01' }),
    );
    await expect(
      service.fetchTableWindow(
        { connectionId: 'r10', schema: 'public', table: 'items' },
        'user',
      ),
    ).rejects.toMatchObject({
      status: 400,
      response: expect.objectContaining({ reason: 'QUERY_OBJECT_NOT_FOUND' }),
    });
  });

  it.each([
    ['cockroach', '23505', 409, 'QUERY_CONFLICT'],
    ['mariadb', 'ER_DUP_ENTRY', 409, 'QUERY_CONFLICT'],
    ['mysql', 'ER_PARSE_ERROR', 400, 'QUERY_SYNTAX_ERROR'],
    ['mysql', 'ER_NO_SUCH_TABLE', 400, 'QUERY_OBJECT_NOT_FOUND'],
    ['mysql', 'ER_BAD_NULL_ERROR', 400, 'QUERY_VALIDATION_FAILED'],
    ['sqlite', 'SQLITE_CONSTRAINT_UNIQUE', 409, 'QUERY_CONFLICT'],
    ['sqlite', 'SQLITE_CONSTRAINT_NOTNULL', 400, 'QUERY_VALIDATION_FAILED'],
    ['mssql', 208, 400, 'QUERY_OBJECT_NOT_FOUND'],
    ['mssql', 2627, 409, 'QUERY_CONFLICT'],
    ['mongodb+srv', 11000, 409, 'QUERY_CONFLICT'],
    ['clickhouse', 62, 400, 'QUERY_SYNTAX_ERROR'],
    ['postgres', 'constructor', 500, 'QUERY_EXECUTION_FAILED'],
  ])('classifies %s native code %s', (engine, code, status, reason) => {
    const error = Object.assign(
      new Error('native failure'),
      engine === 'mssql' ? { number: code } : { code },
    );
    const result = queryDatabaseException(error, engine, 'fixture failed');
    expect(result.getStatus()).toBe(status);
    expect(result.getResponse()).toMatchObject({ reason });
  });

  it.each([
    new BadRequestException('invalid row'),
    new ConflictException('partial write'),
  ])('preserves an existing HTTP error', async (error: HttpException) => {
    strategy.insertRow.mockRejectedValueOnce(error);
    await expect(
      service.insertRow(
        {
          connectionId: 'r10',
          schema: 'public',
          table: 'items',
          data: { id: 1 },
        },
        'user',
      ),
    ).rejects.toBe(error);
  });
});
