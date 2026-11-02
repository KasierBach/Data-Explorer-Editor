import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import Database from 'better-sqlite3';
import { QueryService } from './query.service';
import { ConnectionsService } from '../connections/connections.service';
import { DatabaseStrategyFactory } from '../database-strategies';
import { SqliteStrategy } from '../database-strategies/sqlite.strategy';
import { AuditService } from '../audit/audit.service';
import { FreshnessService } from '../common/freshness/freshness.service';
import { PermissionsService } from '../permissions/services/permissions.service';
import { assertPrimaryKeyIdentities } from '../database-strategies/row-identity.util';

describe('R04 mutation trust boundary', () => {
  let service: QueryService;
  let db: Database.Database;
  const connection = {
    id: 'connection',
    userId: 'owner',
    type: 'sqlite',
    readOnly: false,
    allowQueryExecution: true,
  };
  beforeEach(async () => {
    db = new Database(':memory:');
    db.exec(
      "CREATE TABLE single_key(id TEXT PRIMARY KEY, note TEXT); INSERT INTO single_key VALUES ('001','first'),('1','second'); CREATE TABLE composite(tenant TEXT,id INTEGER,note TEXT,PRIMARY KEY(tenant,id)); INSERT INTO composite VALUES ('A',1,'a1'),('A',2,'a2'),('B',1,'b1'); CREATE TABLE no_key(id TEXT,note TEXT); INSERT INTO no_key VALUES ('x','a'),('x','b')",
    );
    const module = await Test.createTestingModule({
      providers: [
        QueryService,
        {
          provide: ConnectionsService,
          useValue: {
            findOne: async () => connection,
            getPool: async () => db,
          },
        },
        {
          provide: DatabaseStrategyFactory,
          useValue: { getStrategy: () => new SqliteStrategy() },
        },
        { provide: AuditService, useValue: { log: jest.fn() } },
        {
          provide: FreshnessService,
          useValue: {
            bump: jest.fn(),
            invalidateConnection: jest.fn(),
            invalidatePartialWrite: jest.fn(),
          },
        },
        {
          provide: CACHE_MANAGER,
          useValue: { get: jest.fn(), set: jest.fn() },
        },
        {
          provide: PermissionsService,
          useValue: { ensurePermission: jest.fn() },
        },
      ],
    }).compile();
    service = module.get(QueryService);
  });
  afterEach(() => db.close());
  it.each([
    { table: 'single_key', pkColumn: 'note', pkValue: 'first' },
    { table: 'composite', pkColumn: 'tenant', pkValue: 'A' },
    { table: 'no_key', pkColumn: 'id', pkValue: 'x' },
    { table: 'single_key', pkColumn: 'id', pkValue: 1 },
    { table: 'single_key', pkColumn: 'id', pkValue: 9007199254740992 },
  ])(
    'rejects an incomplete, forged, or mistyped identity before writing: %j',
    async (payload) => {
      const before = db.prepare(`SELECT * FROM ${payload.table}`).all();
      await expect(
        service.updateRow(
          {
            connectionId: 'connection',
            schema: 'main',
            ...payload,
            updates: { note: 'changed' },
          },
          'owner',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(db.prepare(`SELECT * FROM ${payload.table}`).all()).toEqual(
        before,
      );
    },
  );
  it('keeps legacy single text keys usable and exact', async () => {
    expect(
      await service.updateRow(
        {
          connectionId: 'connection',
          schema: 'main',
          table: 'single_key',
          pkColumn: 'id',
          pkValue: '001',
          updates: { note: 'changed' },
        },
        'owner',
      ),
    ).toEqual({ success: true, rowCount: 1 });
    expect(db.prepare('SELECT * FROM single_key ORDER BY id').all()).toEqual([
      { id: '001', note: 'changed' },
      { id: '1', note: 'second' },
    ]);
  });
  it('rejects duplicate tuples even when JSON object property order differs', async () => {
    const payload = {
      connectionId: 'connection',
      schema: 'main',
      table: 'composite',
      pkColumn: 'tenant',
      pkValues: ['A', 'A'],
      identities: [
        [
          { column: 'tenant', value: 'A' },
          { column: 'id', value: 1 },
        ],
        [
          { value: 'A', column: 'tenant' },
          { value: 1, column: 'id' },
        ],
      ],
    };
    await expect(service.deleteRows(payload, 'owner')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(db.prepare('SELECT count(*) n FROM composite').get()).toEqual({
      n: 3,
    });
  });
  it.each(['ID', 'rowid', '_rowid_', 'oid'])(
    'rejects update identifier alias %s before writing',
    async (name) => {
      db.exec(
        "CREATE TABLE aliases(id INTEGER PRIMARY KEY,note TEXT); INSERT INTO aliases VALUES (1,'before')",
      );
      await expect(
        service.updateRow(
          {
            connectionId: 'connection',
            schema: 'main',
            table: 'aliases',
            pkColumn: 'id',
            pkValue: 1,
            updates: { [name]: 2 },
          },
          'owner',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(db.prepare('SELECT * FROM aliases').all()).toEqual([
        { id: 1, note: 'before' },
      ]);
    },
  );
  it('accepts SQL Server uniqueidentifier keys and rejects malformed GUIDs', () => {
    const columns = [
      {
        name: 'id',
        type: 'uniqueidentifier',
        isPrimaryKey: true,
        isNullable: false,
        defaultValue: null,
        pkConstraintName: null,
      },
    ];
    expect(() =>
      assertPrimaryKeyIdentities(
        [[{ column: 'id', value: '550e8400-e29b-41d4-a716-446655440000' }]],
        columns,
      ),
    ).not.toThrow();
    expect(() =>
      assertPrimaryKeyIdentities(
        [[{ column: 'id', value: 'not-a-guid' }]],
        columns,
      ),
    ).toThrow(BadRequestException);
  });
  it.each(['decimal', 'numeric', 'money', 'smallmoney'])(
    'requires a lossless string for an exact %s key',
    (type) => {
      const columns = [
        {
          name: 'id',
          type,
          isPrimaryKey: true,
          isNullable: false,
          defaultValue: null,
          pkConstraintName: null,
        },
      ];
      expect(() =>
        assertPrimaryKeyIdentities([[{ column: 'id', value: 1 }]], columns),
      ).toThrow(BadRequestException);
      expect(() =>
        assertPrimaryKeyIdentities(
          [[{ column: 'id', value: '1.000000000000000001' }]],
          columns,
        ),
      ).not.toThrow();
    },
  );
});
