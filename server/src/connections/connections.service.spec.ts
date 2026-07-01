import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConnectionsService } from './connections.service';
import { Permission } from '../permissions/enums/permission.enum';
import { ResourceType } from '../permissions/enums/resource-type.enum';

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
  const sshTunnelMock = { openTunnel: jest.fn() };
  const organizationsMock = {
    ensureMemberAccess: jest.fn(),
    ensureResourcePolicy: jest.fn(),
    removeResourcePolicy: jest.fn(),
  };
  const permissionsMock = { ensurePermission: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new (ConnectionsService as any)(
      prismaMock,
      strategyFactoryMock as any,
      auditMock as any,
      sshTunnelMock as any,
      organizationsMock as any,
      permissionsMock,
    );
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
    expect((service as any).pools.has('conn-1:db_a')).toBe(false);
    expect((service as any).pools.has('conn-1:db_b')).toBe(true);
  });
});
