import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { QueryService } from './query.service';
import { ConnectionsService } from '../connections/connections.service';
import { DatabaseStrategyFactory } from '../database-strategies';
import { AuditService } from '../audit/audit.service';
import { FreshnessService } from '../common/freshness/freshness.service';
import { PermissionsService } from '../permissions/services/permissions.service';

describe('R03 query policy routing', () => {
  let service: QueryService;
  let connection: Record<string, unknown>;
  const connections = { findOne: jest.fn(), getPool: jest.fn() };
  const strategy = {
    executeQuery: jest.fn(),
    runStatementsInTransaction: jest.fn(),
  };
  const permissions = { ensurePermission: jest.fn(), getMemberRole: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    connection = {
      id: 'connection',
      userId: 'owner',
      type: 'postgres',
      readOnly: true,
      allowQueryExecution: true,
    };
    connections.findOne.mockImplementation(async () => connection);
    connections.getPool.mockResolvedValue({});
    strategy.executeQuery.mockImplementation(async () => ({
      rows: [{ n: 1 }],
      columns: ['n'],
    }));
    permissions.getMemberRole.mockResolvedValue('MEMBER');
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
            buildKey: jest.fn().mockResolvedValue('r03'),
            bump: jest.fn(),
            invalidateConnection: jest.fn(),
            invalidatePartialWrite: jest.fn(),
          },
        },
        {
          provide: CACHE_MANAGER,
          useValue: { get: jest.fn(), set: jest.fn() },
        },
        { provide: PermissionsService, useValue: permissions },
      ],
    }).compile();
    service = module.get(QueryService);
  });

  it.each(['connection', 'team-role', 'classified-read'])(
    'passes native read-only mode to both result and count queries: %s',
    async (mode) => {
      if (mode === 'classified-read') {
        connection.readOnly = false;
        permissions.ensurePermission.mockRejectedValue(
          new ForbiddenException('No WRITE permission'),
        );
      }
      if (mode === 'team-role') {
        Object.assign(connection, {
          readOnly: false,
          organizationId: 'organization',
          roleQueryModes: { MEMBER: 'readonly' },
        });
      }
      await service.executeQuery(
        {
          connectionId: 'connection',
          sql: 'SELECT n FROM items',
          includeTotalCount: true,
        },
        'member',
      );
      expect(strategy.executeQuery).toHaveBeenCalledTimes(2);
      for (const call of strategy.executeQuery.mock.calls) {
        expect(call[2]).toEqual(expect.objectContaining({ readOnly: true }));
      }
    },
  );

  it.each([
    [{ $out: 'copy' }],
    [{ $merge: { into: 'copy' } }],
    [
      {
        $lookup: { from: 'other', as: 'related', pipeline: [{ $out: 'copy' }] },
      },
    ],
    [
      {
        $facet: {
          nested: [
            {
              $lookup: {
                from: 'other',
                as: 'related',
                pipeline: [{ $merge: 'copy' }],
              },
            },
          ],
        },
      },
    ],
    [{ $unknown: {} }],
  ])(
    'rejects unsafe/unknown aggregation pipelines before any pool call: %j',
    async (...stages) => {
      connection.type = 'mongodb';
      const sql = JSON.stringify({
        action: 'aggregate',
        collection: 'items',
        pipeline: stages,
      });
      await expect(
        service.executeQuery(
          { connectionId: 'connection', sql, confirmed: true },
          'owner',
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(connections.getPool).not.toHaveBeenCalled();
      expect(strategy.executeQuery).not.toHaveBeenCalled();
    },
  );

  it('allows an actual Redis read command for a read-only role', async () => {
    Object.assign(connection, {
      type: 'redis',
      organizationId: 'organization',
      roleQueryModes: { MEMBER: 'readonly' },
    });
    await expect(
      service.executeQuery(
        { connectionId: 'connection', sql: 'GET r03:key' },
        'member',
      ),
    ).resolves.toBeDefined();
    expect(strategy.executeQuery).toHaveBeenCalledTimes(1);
  });

  it('rejects a Redis write even with confirmation', async () => {
    connection.type = 'redis';
    await expect(
      service.executeQuery(
        {
          connectionId: 'connection',
          sql: 'SET r03:key changed',
          confirmed: true,
        },
        'owner',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(connections.getPool).not.toHaveBeenCalled();
  });

  it('returns an explicit client error for unsupported SQL before acquiring a pool', async () => {
    await expect(
      service.executeQuery(
        { connectionId: 'connection', sql: "SELECT 'unterminated" },
        'owner',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(connections.getPool).not.toHaveBeenCalled();
  });

  it.each(['mysql', 'mariadb'])(
    'rejects a hash comment before acquiring a writable pool: %s',
    async (type) => {
      Object.assign(connection, { type, readOnly: false });
      await expect(
        service.executeQuery(
          { connectionId: 'connection', sql: "# '\nDELETE FROM items # '" },
          'owner',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(connections.getPool).not.toHaveBeenCalled();
    },
  );

  it('keeps a native read-only violation as an authorization denial', async () => {
    strategy.executeQuery.mockRejectedValueOnce(
      Object.assign(new Error('read-only transaction'), { code: '25006' }),
    );
    await expect(
      service.executeQuery(
        { connectionId: 'connection', sql: 'SELECT stored_function()' },
        'owner',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
