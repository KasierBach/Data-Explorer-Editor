import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConnectionsService } from './connections.service';
import { Permission } from '../permissions/enums/permission.enum';
import { ResourceType } from '../permissions/enums/resource-type.enum';
import * as cryptoUtil from '../utils/crypto.util';

describe('ConnectionsService security', () => {
  let service: ConnectionsService;

  const prismaMock: any = {
    connection: {
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
    },
  };
  const strategyMock = {
    createPool: jest.fn(),
    closePool: jest.fn(),
  };
  const strategyFactoryMock = {
    getStrategy: jest.fn().mockReturnValue(strategyMock),
  };
  const auditMock = { log: jest.fn() };
  const sshTunnelMock = {
    openTunnel: jest.fn(),
    closeTunnel: jest.fn(),
  };
  const organizationsMock = {
    ensureMemberAccess: jest.fn(),
    ensureResourcePolicy: jest.fn(),
    removeResourcePolicy: jest.fn(),
  };
  const permissionsMock = {
    ensurePermission: jest.fn(),
    getMemberRole: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    permissionsMock.getMemberRole.mockResolvedValue('MEMBER');
    service = new (ConnectionsService as any)(
      prismaMock,
      strategyFactoryMock as any,
      auditMock as any,
      sshTunnelMock as any,
      organizationsMock as any,
      permissionsMock,
    );
  });

  it('authorizes migration source and target intents with team restrictions', async () => {
    const connection = {
      id: 'conn-migration',
      userId: 'owner',
      organizationId: 'org',
      database: 'allowed',
      type: 'postgres',
      password: null,
      readOnly: false,
      allowImportExport: true,
      allowedDatabases: ['allowed'],
      roleQueryModes: { MEMBER: 'readonly' },
    };
    prismaMock.connection.findFirst.mockResolvedValue(connection);

    await expect(
      (service as any).getMigrationConnection('conn-migration', 'member', {
        permission: Permission.READ,
        database: 'allowed',
        write: false,
      }),
    ).resolves.toEqual(expect.objectContaining({ id: 'conn-migration' }));

    await expect(
      (service as any).getMigrationConnection('conn-migration', 'member', {
        permission: Permission.WRITE,
        database: 'allowed',
        write: true,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(permissionsMock.ensurePermission).toHaveBeenLastCalledWith(
      'member',
      ResourceType.CONNECTION,
      'conn-migration',
      Permission.WRITE,
    );
  });

  it('rejects migration targets that are readonly, disabled, or outside the database whitelist', async () => {
    const baseConnection = {
      id: 'conn-migration',
      userId: 'owner',
      organizationId: 'org',
      database: 'allowed',
      type: 'mysql',
      password: null,
      readOnly: false,
      allowImportExport: true,
      allowedDatabases: ['allowed'],
      roleQueryModes: { MEMBER: 'full' },
    };

    prismaMock.connection.findFirst
      .mockResolvedValueOnce({ ...baseConnection, readOnly: true })
      .mockResolvedValueOnce({ ...baseConnection, allowImportExport: false })
      .mockResolvedValueOnce(baseConnection);

    const authorizeTarget = () =>
      (service as any).getMigrationConnection('conn-migration', 'member', {
        permission: Permission.WRITE,
        database: 'allowed',
        write: true,
      });

    await expect(authorizeTarget()).rejects.toBeInstanceOf(ForbiddenException);
    await expect(authorizeTarget()).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      (service as any).getMigrationConnection('conn-migration', 'member', {
        permission: Permission.WRITE,
        database: 'private',
        write: true,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it.each(['mysql', 'mariadb', 'clickhouse'])(
    'returns the authorized schema database for %s without changing the saved connection',
    async (type) => {
      const connection = {
        id: 'conn-migration',
        userId: 'owner',
        organizationId: 'org',
        type,
        database: 'legacy',
        password: null,
        allowImportExport: true,
        readOnly: false,
        allowedDatabases: ['allowed'],
        roleQueryModes: { MEMBER: 'full' },
      };
      prismaMock.connection.findFirst.mockResolvedValue(connection);

      const result = await service.getMigrationConnection(
        'conn-migration',
        'member',
        {
          permission: Permission.WRITE,
          schema: ' allowed ',
          write: true,
        },
      );

      expect(result.database).toBe('allowed');
      expect(connection.database).toBe('legacy');
    },
  );

  it('rejects a forbidden ClickHouse schema database instead of authorizing its saved default', async () => {
    prismaMock.connection.findFirst.mockResolvedValue({
      id: 'conn-migration',
      userId: 'owner',
      organizationId: 'org',
      type: 'clickhouse',
      database: 'allowed',
      password: null,
      allowedDatabases: ['allowed'],
      roleQueryModes: { MEMBER: 'full' },
    });
    await expect(
      service.getMigrationConnection('conn-migration', 'member', {
        permission: Permission.WRITE,
        schema: ' private ',
        write: true,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it.each(['postgres', 'cockroach'])(
    'rejects %s migration with no explicit database instead of using username/environment defaults',
    async (type) => {
      for (const database of [undefined, null, '', '   ']) {
        prismaMock.connection.findFirst.mockResolvedValue({
          id: 'conn-migration',
          userId: 'owner',
          organizationId: 'org',
          type,
          database,
          username: 'allowed',
          password: null,
          allowedDatabases: ['allowed'],
        });
        permissionsMock.getMemberRole.mockClear();
        await expect(
          service.getMigrationConnection('conn-migration', 'member', {
            permission: Permission.READ,
            schema: 'public',
            write: false,
          }),
        ).rejects.toThrow(BadRequestException);
        expect(permissionsMock.getMemberRole).not.toHaveBeenCalled();
      }
    },
  );

  it.each(['postgres', 'cockroach'])(
    'accepts an explicit %s database override even if no saved database exists',
    async (type) => {
      prismaMock.connection.findFirst.mockResolvedValue({
        id: 'conn-migration',
        userId: 'owner',
        organizationId: 'org',
        type,
        username: 'different_default',
        password: null,
        allowedDatabases: ['allowed'],
      });
      await expect(
        service.getMigrationConnection('conn-migration', 'member', {
          permission: Permission.READ,
          database: ' allowed ',
          schema: 'public',
          write: false,
        }),
      ).resolves.toEqual(expect.objectContaining({ database: 'allowed' }));
    },
  );

  it('returns the trimmed database override used by migration authorization', async () => {
    prismaMock.connection.findFirst.mockResolvedValue({
      id: 'conn-migration',
      userId: 'owner',
      organizationId: 'org',
      type: 'postgres',
      database: 'legacy',
      password: null,
      allowedDatabases: ['allowed'],
    });

    const result = await service.getMigrationConnection(
      'conn-migration',
      'member',
      { permission: Permission.READ, database: ' allowed ', write: false },
    );

    expect(result.database).toBe('allowed');
  });

  it('rejects a forbidden database even when its pool is warm', async () => {
    prismaMock.connection.findFirst.mockResolvedValue({
      id: 'conn',
      userId: 'owner',
      organizationId: 'org',
      database: 'allowed',
      type: 'postgres',
      allowedDatabases: ['allowed'],
    });
    (service as any).pools.set('conn:private', {
      pool: {},
      lastAccessed: Date.now(),
    });
    await expect(
      service.getPool('conn', 'private', 'member'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(strategyMock.createPool).not.toHaveBeenCalled();
    (service as any).pools.clear();
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  it('rejects network connections without a host', async () => {
    await expect(
      service.create(
        {
          name: 'My DB',
          type: 'mysql',
        } as any,
        'user-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prismaMock.connection.create).not.toHaveBeenCalled();
  });

  it('requires manage permission before updating a shared connection', async () => {
    prismaMock.connection.findFirst.mockResolvedValue({
      id: 'conn-1',
      userId: 'owner-1',
      organizationId: 'org-1',
      name: 'Shared DB',
      type: 'postgres',
      host: 'db.example.com',
      readOnly: false,
      allowSchemaChanges: true,
      allowImportExport: true,
      allowQueryExecution: true,
    });
    permissionsMock.ensurePermission.mockRejectedValueOnce(
      new ForbiddenException('viewer cannot manage'),
    );

    await expect(
      service.update('conn-1', { name: 'Renamed DB' } as any, 'viewer-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(permissionsMock.ensurePermission).toHaveBeenCalledWith(
      'viewer-1',
      ResourceType.CONNECTION,
      'conn-1',
      Permission.MANAGE,
    );
    expect(prismaMock.connection.update).not.toHaveBeenCalled();
  });

  it('requires delete permission before deleting a shared connection', async () => {
    prismaMock.connection.findFirst.mockResolvedValue({
      id: 'conn-1',
      userId: 'owner-1',
      organizationId: 'org-1',
      name: 'Shared DB',
      type: 'postgres',
    });
    permissionsMock.ensurePermission.mockRejectedValueOnce(
      new ForbiddenException('member cannot delete'),
    );

    await expect(service.remove('conn-1', 'member-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    expect(permissionsMock.ensurePermission).toHaveBeenCalledWith(
      'member-1',
      ResourceType.CONNECTION,
      'conn-1',
      Permission.DELETE,
    );
    expect(prismaMock.connection.delete).not.toHaveBeenCalled();
  });

  it('strips SSH secrets from returned connections', async () => {
    prismaMock.connection.findFirst.mockResolvedValue({
      id: 'conn-1',
      userId: 'user-1',
      organizationId: null,
      name: 'SSH DB',
      type: 'postgres',
      host: 'db.example.com',
      password: 'encrypted-password',
      sshPrivateKey: 'base64-private-key',
      sshPassphrase: 'super-secret-passphrase',
    });
    permissionsMock.ensurePermission.mockResolvedValue(undefined);

    const result = await service.findOne('conn-1', 'user-1');

    expect(result).toEqual(
      expect.objectContaining({
        id: 'conn-1',
        name: 'SSH DB',
        type: 'postgres',
        host: 'db.example.com',
      }),
    );
    expect(result).not.toHaveProperty('password');
    expect(result).not.toHaveProperty('sshPrivateKey');
    expect(result).not.toHaveProperty('sshPassphrase');
  });

  it('upgrades legacy SSH credentials after they are used', async () => {
    const encryptAttribute = jest
      .spyOn(cryptoUtil, 'encryptAttribute')
      .mockImplementation((value) => `v1:encrypted-${value}`);
    const connection = {
      id: 'conn-ssh-1',
      userId: 'user-1',
      type: 'postgres',
      host: 'db.example.com',
      port: 5432,
      database: 'main',
      password: null,
      sshHost: 'ssh.example.com',
      sshPort: 22,
      sshUsername: 'deploy',
      sshPrivateKey: 'bGVnYWN5LXByaXZhdGUta2V5',
      sshPassphrase: 'legacy-passphrase',
    };
    const pool = { id: 'ssh-pool' };
    prismaMock.connection.findFirst.mockResolvedValue(connection);
    prismaMock.connection.update.mockResolvedValue(connection);
    sshTunnelMock.openTunnel.mockResolvedValue(15432);
    strategyMock.createPool.mockResolvedValue(pool);

    await expect(service.getPool('conn-ssh-1', 'main', 'user-1')).resolves.toBe(
      pool,
    );

    expect(sshTunnelMock.openTunnel).toHaveBeenCalledWith('conn-ssh-1:main', {
      sshHost: 'ssh.example.com',
      sshPort: 22,
      sshUsername: 'deploy',
      sshPrivateKey: 'bGVnYWN5LXByaXZhdGUta2V5',
      sshPassphrase: 'legacy-passphrase',
      dbHost: 'db.example.com',
      dbPort: 5432,
    });
    expect(encryptAttribute).toHaveBeenCalledWith('bGVnYWN5LXByaXZhdGUta2V5');
    expect(encryptAttribute).toHaveBeenCalledWith('legacy-passphrase');
    expect(prismaMock.connection.update).toHaveBeenCalledWith({
      where: { id: 'conn-ssh-1' },
      data: {
        sshPrivateKey: 'v1:encrypted-bGVnYWN5LXByaXZhdGUta2V5',
        sshPassphrase: 'v1:encrypted-legacy-passphrase',
      },
    });

    encryptAttribute.mockRestore();
  });
  it('creates one shared pool for concurrent requests with the same key', async () => {
    const connection = {
      id: 'conn-1',
      userId: 'user-1',
      type: 'postgres',
      host: 'db.example.com',
      database: 'main',
      password: null,
    };
    const pool = { id: 'shared-pool' };
    prismaMock.connection.findFirst.mockResolvedValue(connection);
    prismaMock.connection.update.mockResolvedValue(connection);
    strategyMock.createPool.mockResolvedValue(pool);

    const [first, second] = await Promise.all([
      service.getPool('conn-1', 'main', 'user-1'),
      service.getPool('conn-1', 'main', 'user-1'),
    ]);

    expect(first).toBe(pool);
    expect(second).toBe(pool);
    expect(strategyMock.createPool).toHaveBeenCalledTimes(1);
  });

  it('rejects attaching a connection to a team the caller does not belong to', async () => {
    organizationsMock.ensureMemberAccess.mockRejectedValueOnce(
      new ForbiddenException('nope'),
    );

    await expect(
      service.create(
        {
          name: 'My DB',
          type: 'postgres',
          host: 'db.example.com',
          organizationId: 'org-1',
        } as any,
        'user-1',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(organizationsMock.ensureMemberAccess).toHaveBeenCalledWith(
      'org-1',
      'user-1',
    );
    expect(prismaMock.connection.create).not.toHaveBeenCalled();
  });

  it('cleans up stale pools once they exceed the TTL window', async () => {
    prismaMock.connection.findUnique.mockResolvedValue({
      id: 'conn-1',
      type: 'postgres',
    });

    const now = Date.now();
    (service as any).pools.set('conn-1:db_a', {
      pool: { id: 'stale' },
      lastAccessed: now - 16 * 60 * 1000,
      createdAt: now - 16 * 60 * 1000,
      connectionId: 'conn-1',
      database: 'db_a',
    });
    (service as any).pools.set('conn-1:db_b', {
      pool: { id: 'fresh' },
      lastAccessed: now,
      createdAt: now,
      connectionId: 'conn-1',
      database: 'db_b',
    });

    await (service as any).cleanupPools();

    expect(strategyMock.closePool).toHaveBeenCalledWith({ id: 'stale' });
    expect(sshTunnelMock.closeTunnel).toHaveBeenCalledWith('conn-1:db_a');
    expect((service as any).pools.has('conn-1:db_a')).toBe(false);
    expect((service as any).pools.has('conn-1:db_b')).toBe(true);
  });

  it('trims oldest idle pools when the soft pool limit is exceeded', async () => {
    prismaMock.connection.findUnique.mockResolvedValue({
      id: 'conn-1',
      type: 'postgres',
    });

    const now = Date.now();
    (service as any).MAX_ACTIVE_POOLS = 1;
    (service as any).POOL_PRESSURE_IDLE_MS = 0;
    (service as any).pools.set('conn-1:db_a', {
      pool: { id: 'oldest' },
      lastAccessed: now - 10_000,
      createdAt: now - 10_000,
      connectionId: 'conn-1',
      database: 'db_a',
    });
    (service as any).pools.set('conn-1:db_b', {
      pool: { id: 'newer' },
      lastAccessed: now - 1_000,
      createdAt: now - 1_000,
      connectionId: 'conn-1',
      database: 'db_b',
    });

    await (service as any).cleanupPools();

    expect(strategyMock.closePool).toHaveBeenCalledWith({ id: 'oldest' });
    expect(sshTunnelMock.closeTunnel).toHaveBeenCalledWith('conn-1:db_a');
    expect((service as any).pools.has('conn-1:db_a')).toBe(false);
    expect((service as any).pools.has('conn-1:db_b')).toBe(true);
  });

  it('closes an SSH tunnel when pool creation fails', async () => {
    const connection = {
      id: 'conn-ssh-fail',
      userId: 'user-1',
      type: 'postgres',
      host: 'db.example.com',
      database: 'main',
      password: null,
      sshHost: 'ssh.example.com',
      sshUsername: 'deploy',
    };
    const error = new Error('database unavailable');
    prismaMock.connection.findFirst.mockResolvedValue(connection);
    sshTunnelMock.openTunnel.mockResolvedValue(15432);
    strategyMock.createPool.mockRejectedValue(error);
    prismaMock.connection.update.mockResolvedValue(connection);

    await expect(
      service.getPool('conn-ssh-fail', 'main', 'user-1'),
    ).rejects.toThrow('database unavailable');

    expect(sshTunnelMock.closeTunnel).toHaveBeenCalledWith(
      'conn-ssh-fail:main',
    );
  });
});
