import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConnectionsService } from './connections.service';

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

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ConnectionsService(
      prismaMock,
      strategyFactoryMock as any,
      auditMock as any,
      sshTunnelMock as any,
      organizationsMock as any,
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
