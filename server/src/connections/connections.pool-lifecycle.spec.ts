import { ForbiddenException } from '@nestjs/common';
import { ConnectionsService } from './connections.service';
import { Permission } from '../permissions/enums/permission.enum';
import { ResourceType } from '../permissions/enums/resource-type.enum';

// Unit tests must not load provider/configuration modules or real drivers.
jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));
jest.mock('../database-strategies/strategy.factory', () => ({
  DatabaseStrategyFactory: class {},
}));
jest.mock('../audit/audit.service', () => ({
  AuditService: class {},
  AuditAction: { DB_CONNECTION_DELETE: 'DB_CONNECTION_DELETE' },
}));
jest.mock('./ssh-tunnel.service', () => ({ SshTunnelService: class {} }));
jest.mock('../organizations/services/organizations.service', () => ({
  OrganizationsService: class {},
}));
jest.mock('../permissions/services/permissions.service', () => ({
  PermissionsService: class {},
}));
jest.mock('../utils/crypto.util', () => ({
  encryptAttribute: jest.fn((value: string) => `v1:${value}`),
  decryptAttribute: jest.fn((value: string) => value),
}));

describe('ConnectionsService pool lifecycle races', () => {
  let service: ConnectionsService;
  let connection: any;
  let prisma: any;
  let postgres: any;
  let mysql: any;
  let ssh: any;
  let permissions: any;
  const deferredReleases = new Set<() => void>();

  function deferred<T>(fallback: T) {
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    const release = () => resolve(fallback);
    deferredReleases.add(release);
    return { promise, resolve, reject };
  }

  function observe<T>(promise: Promise<T>) {
    return promise.then(
      (value) => ({ status: 'fulfilled' as const, value }),
      (reason) => ({ status: 'rejected' as const, reason }),
    );
  }

  async function flush() {
    for (let i = 0; i < 30; i++) await Promise.resolve();
  }

  beforeEach(() => {
    connection = {
      id: 'conn',
      userId: 'owner',
      type: 'postgres',
      host: 'db.example.com',
      database: 'main',
      password: null,
      readOnly: false,
      allowSchemaChanges: true,
      allowImportExport: true,
      allowQueryExecution: true,
    };
    postgres = {
      createPool: jest.fn(),
      closePool: jest.fn().mockResolvedValue(undefined),
    };
    mysql = {
      createPool: jest.fn(),
      closePool: jest.fn().mockResolvedValue(undefined),
    };
    ssh = {
      openTunnel: jest.fn().mockResolvedValue(15432),
      closeTunnel: jest.fn().mockResolvedValue(undefined),
      assertTunnelOpen: jest.fn(),
    };
    permissions = {
      ensurePermission: jest.fn().mockResolvedValue(undefined),
      getMemberRole: jest.fn().mockResolvedValue('MEMBER'),
    };
    prisma = {
      connection: {
        findFirst: jest
          .fn()
          .mockImplementation(async () => ({ ...connection })),
        findUnique: jest
          .fn()
          .mockImplementation(async () => ({ ...connection })),
        update: jest.fn().mockImplementation(async ({ data }: any) => {
          connection = { ...connection, ...data };
          return { ...connection };
        }),
        delete: jest.fn().mockResolvedValue(undefined),
      },
    };
    service = new ConnectionsService(
      prisma,
      {
        getStrategy: jest.fn((type) => (type === 'mysql' ? mysql : postgres)),
      } as any,
      { log: jest.fn().mockResolvedValue(undefined) } as any,
      ssh,
      {
        ensureResourcePolicy: jest.fn(),
        removeResourcePolicy: jest.fn(),
      } as any,
      permissions,
    );
  });

  afterEach(async () => {
    for (const release of deferredReleases) release();
    deferredReleases.clear();
    await service.onModuleDestroy();
    jest.restoreAllMocks();
  });

  it('captures admission before an asynchronous authorization/configuration lookup', async () => {
    const lookup = deferred({ ...connection });
    prisma.connection.findFirst.mockReturnValueOnce(lookup.promise);
    postgres.createPool.mockResolvedValue({ id: 'obsolete' });
    const pending = observe(service.getPool('conn', 'main', 'owner'));

    await service.update('conn', { host: 'new.example.com' }, 'owner');
    lookup.resolve({ ...connection, host: 'db.example.com' });

    expect((await pending).status).toBe('rejected');
    expect(postgres.createPool).not.toHaveBeenCalled();
    expect((service as any).pools.size).toBe(0);
  });

  it('invalidates a creation on update and closes it with its creating driver', async () => {
    const oldPool = { id: 'old-postgres' };
    const creating = deferred(oldPool);
    postgres.createPool.mockReturnValueOnce(creating.promise);
    const pending = observe(service.getPool('conn', 'main', 'owner'));
    await flush();
    expect(postgres.createPool).toHaveBeenCalledTimes(1);

    await service.update('conn', { type: 'mysql' }, 'owner');
    creating.resolve(oldPool);

    expect((await pending).status).toBe('rejected');
    expect(postgres.closePool).toHaveBeenCalledWith(oldPool);
    expect(mysql.closePool).not.toHaveBeenCalled();
    expect(prisma.connection.findUnique).not.toHaveBeenCalled();
    expect(
      prisma.connection.update.mock.calls.some(
        ([arg]: any[]) => arg.data.lastHealthStatus === 'healthy',
      ),
    ).toBe(false);
    expect((service as any).pools.size).toBe(0);
  });

  it('gates new admissions while a configuration update is awaiting persistence', async () => {
    const saving = deferred({ ...connection, host: 'new.example.com' });
    prisma.connection.update.mockReturnValueOnce(saving.promise);
    const updating = service.update(
      'conn',
      { host: 'new.example.com' },
      'owner',
    );
    await flush();
    expect(prisma.connection.update).toHaveBeenCalledTimes(1);
    postgres.createPool.mockResolvedValue({ id: 'must-not-open' });

    const admission = observe(service.getPool('conn', 'main', 'owner'));
    await flush();
    expect((await admission).status).toBe('rejected');
    expect(postgres.createPool).not.toHaveBeenCalled();
    saving.resolve({ ...connection, host: 'new.example.com' });
    await updating;
  });

  it('invalidates a creation on delete without publishing a late healthy state', async () => {
    const pool = { id: 'deleted-connection-pool' };
    const creating = deferred(pool);
    postgres.createPool.mockReturnValueOnce(creating.promise);
    const pending = observe(service.getPool('conn', 'main', 'owner'));
    await flush();

    await service.remove('conn', 'owner');
    creating.resolve(pool);

    expect((await pending).status).toBe('rejected');
    expect(postgres.closePool).toHaveBeenCalledWith(pool);
    expect(prisma.connection.update).not.toHaveBeenCalled();
    expect((service as any).pools.size).toBe(0);
    // A stale provider result cannot resurrect a successfully deleted id.
    await expect(service.getPool('conn', 'main', 'owner')).rejects.toThrow();
  });

  it('rejects lookups admitted before delete and rejects admissions during delete', async () => {
    const lookup = deferred({ ...connection });
    prisma.connection.findFirst.mockReturnValueOnce(lookup.promise);
    const pending = observe(service.getPool('conn', 'main', 'owner'));
    const deleting = deferred(undefined);
    prisma.connection.delete.mockReturnValueOnce(deleting.promise);
    const removal = service.remove('conn', 'owner');
    await flush();

    await expect(service.getPool('conn', 'main', 'owner')).rejects.toThrow();
    lookup.resolve({ ...connection });
    expect((await pending).status).toBe('rejected');
    expect(postgres.createPool).not.toHaveBeenCalled();
    deleting.resolve(undefined);
    await removal;
  });

  it('drains late creation and awaited resource closure on idempotent shutdown', async () => {
    connection.sshHost = 'ssh.example.com';
    connection.sshUsername = 'deploy';
    const pool = { id: 'late-pool' };
    const creating = deferred(pool);
    const closing = deferred(undefined);
    postgres.createPool.mockReturnValueOnce(creating.promise);
    postgres.closePool.mockReturnValueOnce(closing.promise);
    const pending = observe(service.getPool('conn', 'main', 'owner'));
    await flush();
    expect(postgres.createPool).toHaveBeenCalledTimes(1);
    let drained = false;
    const shutdown = service.onModuleDestroy().then(() => {
      drained = true;
    });
    const secondShutdown = service.onModuleDestroy();
    await flush();

    expect(drained).toBe(false);
    await expect(service.getPool('conn', 'main', 'owner')).rejects.toThrow();
    creating.resolve(pool);
    await flush();
    expect(postgres.closePool).toHaveBeenCalledWith(pool);
    expect(drained).toBe(false);
    closing.resolve(undefined);
    await Promise.all([shutdown, secondShutdown]);
    expect((await pending).status).toBe('rejected');
    expect(postgres.closePool).toHaveBeenCalledTimes(1);
    expect(ssh.closeTunnel).toHaveBeenCalledWith(
      ssh.openTunnel.mock.calls[0][0],
    );
    expect((service as any).pools.size).toBe(0);
  });

  it('drains configuration lookups that started before shutdown without creating resources', async () => {
    const lookup = deferred({ ...connection });
    prisma.connection.findFirst.mockReturnValueOnce(lookup.promise);
    const pending = observe(service.getPool('conn', 'main', 'owner'));
    let drained = false;
    const shutdown = service.onModuleDestroy().then(() => {
      drained = true;
    });
    await flush();

    expect(drained).toBe(false);
    lookup.resolve({ ...connection });
    await shutdown;
    expect((await pending).status).toBe('rejected');
    expect(postgres.createPool).not.toHaveBeenCalled();
    expect(ssh.openTunnel).not.toHaveBeenCalled();
  });

  it('uses separate generation-owned tunnel keys and does not let obsolete cleanup close a replacement', async () => {
    connection.sshHost = 'ssh.example.com';
    connection.sshUsername = 'deploy';
    const oldPool = { id: 'old' };
    const newPool = { id: 'new' };
    const creating = deferred(oldPool);
    postgres.createPool.mockReturnValueOnce(creating.promise);
    mysql.createPool.mockResolvedValue(newPool);
    const oldAdmission = observe(service.getPool('conn', 'main', 'owner'));
    await flush();
    await service.update('conn', { type: 'mysql' }, 'owner');
    const replacement = observe(service.getPool('conn', 'main', 'owner'));
    await flush();

    expect(mysql.createPool).toHaveBeenCalledTimes(1);
    expect((await replacement).status).toBe('fulfilled');
    const oldKey = ssh.openTunnel.mock.calls[0][0];
    const replacementKey = ssh.openTunnel.mock.calls[1][0];
    expect(oldKey).not.toBe(replacementKey);
    ssh.closeTunnel.mockClear();
    creating.resolve(oldPool);
    expect((await oldAdmission).status).toBe('rejected');
    expect(postgres.closePool).toHaveBeenCalledWith(oldPool);
    expect(mysql.closePool).not.toHaveBeenCalled();
    expect(ssh.closeTunnel).not.toHaveBeenCalledWith(replacementKey);
    expect((service as any).pools.get('conn:main').pool).toBe(newPool);
    await expect(service.getPool('conn', 'main', 'owner')).resolves.toBe(
      newPool,
    );
  });

  it('detaches a closing pool before awaiting close and preserves a same-generation replacement', async () => {
    connection.sshHost = 'ssh.example.com';
    connection.sshUsername = 'deploy';
    const oldPool = { id: 'old' };
    const newPool = { id: 'new' };
    postgres.createPool
      .mockResolvedValueOnce(oldPool)
      .mockResolvedValueOnce(newPool);
    await service.getPool('conn', 'main', 'owner');
    const closing = deferred(undefined);
    postgres.closePool.mockReturnValueOnce(closing.promise);
    const oldClose = service.removePool('conn:main', 'owner');
    await flush();
    const replacement = observe(service.getPool('conn', 'main', 'owner'));
    await flush();

    expect(postgres.createPool).toHaveBeenCalledTimes(2);
    const oldKey = ssh.openTunnel.mock.calls[0][0];
    const newKey = ssh.openTunnel.mock.calls[1][0];
    expect(oldKey).not.toBe(newKey);
    closing.resolve(undefined);
    await oldClose;
    expect((await replacement).status).toBe('fulfilled');
    expect((service as any).pools.get('conn:main').pool).toBe(newPool);
    expect(ssh.closeTunnel).toHaveBeenCalledWith(oldKey);
    expect(ssh.closeTunnel).not.toHaveBeenCalledWith(newKey);
  });

  it('does not cache or return a pool while its asynchronous healthy publication is pending', async () => {
    const pool = { id: 'not-yet-published' };
    const healthWrite = deferred({ ...connection });
    postgres.createPool.mockResolvedValue(pool);
    prisma.connection.update.mockReturnValueOnce(healthWrite.promise);
    const first = observe(service.getPool('conn', 'main', 'owner'));
    await flush();
    expect(prisma.connection.update).toHaveBeenCalledTimes(1);
    let secondSettled = false;
    const second = observe(service.getPool('conn', 'main', 'owner')).then(
      (result) => {
        secondSettled = true;
        return result;
      },
    );
    await flush();

    expect((service as any).pools.size).toBe(0);
    expect(secondSettled).toBe(false);
    expect(postgres.createPool).toHaveBeenCalledTimes(1);
    healthWrite.resolve({ ...connection });
    expect((await first).status).toBe('fulfilled');
    expect((await second).status).toBe('fulfilled');
  });

  it('drains accepted publication before an update commits and rejects the obsolete admission', async () => {
    const pool = { id: 'publication-race' };
    const healthWrite = deferred({ ...connection });
    postgres.createPool.mockResolvedValue(pool);
    prisma.connection.update.mockReturnValueOnce(healthWrite.promise);
    const pending = observe(service.getPool('conn', 'main', 'owner'));
    await flush();
    const updating = service.update(
      'conn',
      { host: 'new.example.com' },
      'owner',
    );
    await flush();

    expect(prisma.connection.update).toHaveBeenCalledTimes(1);
    healthWrite.resolve({ ...connection });
    await updating;
    expect((await pending).status).toBe('rejected');
    expect(postgres.closePool).toHaveBeenCalledWith(pool);
    expect((service as any).pools.size).toBe(0);
  });

  it('closes an unpublished pool after a health write failure and retries cleanly', async () => {
    const oldPool = { id: 'failed-publication' };
    const replacement = { id: 'retry' };
    postgres.createPool
      .mockResolvedValueOnce(oldPool)
      .mockResolvedValueOnce(replacement);
    prisma.connection.update.mockRejectedValueOnce(
      new Error('health write failed'),
    );

    await expect(service.getPool('conn', 'main', 'owner')).rejects.toThrow(
      'health write failed',
    );
    expect(postgres.closePool).toHaveBeenCalledWith(oldPool);
    expect((service as any).pools.size).toBe(0);
    await expect(service.getPool('conn', 'main', 'owner')).resolves.toBe(
      replacement,
    );
  });

  it('rechecks admission after awaited pressure cleanup', async () => {
    (service as any).MAX_ACTIVE_POOLS = 0;
    const cleanup = deferred(undefined);
    jest
      .spyOn(service as any, 'cleanupPools')
      .mockReturnValueOnce(cleanup.promise);
    postgres.createPool.mockResolvedValue({ id: 'obsolete' });
    const pending = observe(service.getPool('conn', 'main', 'owner'));
    await flush();
    await service.update('conn', { host: 'new.example.com' }, 'owner');
    cleanup.resolve(undefined);

    expect((await pending).status).toBe('rejected');
    expect(postgres.createPool).not.toHaveBeenCalled();
  });

  it('drains a legacy credential publication before update without opening an obsolete tunnel', async () => {
    connection.sshHost = 'ssh.example.com';
    connection.sshUsername = 'deploy';
    connection.sshPrivateKey = 'legacy-key';
    const upgrading = deferred({ ...connection });
    prisma.connection.update.mockReturnValueOnce(upgrading.promise);
    const pending = observe(service.getPool('conn', 'main', 'owner'));
    await flush();
    const updating = service.update(
      'conn',
      { sshPrivateKey: 'replacement-key' },
      'owner',
    );
    await flush();

    expect(prisma.connection.update).toHaveBeenCalledTimes(1);
    upgrading.resolve({ ...connection });
    await updating;
    expect((await pending).status).toBe('rejected');
    expect(ssh.openTunnel).not.toHaveBeenCalled();
    expect(postgres.createPool).not.toHaveBeenCalled();
    expect(connection.sshPrivateKey).toBe('v1:replacement-key');
  });

  it('does not invalidate an authorized creation when an unauthorized update is denied', async () => {
    const pool = { id: 'authorized' };
    const creating = deferred(pool);
    postgres.createPool.mockReturnValueOnce(creating.promise);
    const pending = observe(service.getPool('conn', 'main', 'owner'));
    await flush();
    permissions.ensurePermission.mockRejectedValueOnce(
      new ForbiddenException('cannot manage'),
    );

    await expect(
      service.update('conn', { host: 'new.example.com' }, 'denied'),
    ).rejects.toThrow(ForbiddenException);
    creating.resolve(pool);
    expect((await pending).status).toBe('fulfilled');
    expect(postgres.closePool).not.toHaveBeenCalled();
  });

  it('does not let a queued pressure victim close a same-key replacement', async () => {
    const now = Date.now();
    const resource = (id: string, lastAccessed: number) => ({
      pool: { id },
      lastAccessed,
      createdAt: lastAccessed,
      connectionId: 'conn',
      database: id,
      generation: 0,
      strategy: postgres,
    });
    const first = resource('first', now - 10000);
    const second = resource('second', now - 5000);
    const third = resource('third', now - 1000);
    (service as any).MAX_ACTIVE_POOLS = 1;
    (service as any).POOL_PRESSURE_IDLE_MS = 0;
    (service as any).pools.set('conn:first', first);
    (service as any).pools.set('conn:second', second);
    (service as any).pools.set('conn:third', third);
    const closing = deferred(undefined);
    postgres.closePool.mockReturnValueOnce(closing.promise);
    const trimming = (service as any).trimIdlePoolsToSoftLimit(now);
    await flush();
    await service.removePool('conn:second', 'owner');
    const replacement = resource('replacement', now);
    (service as any).pools.set('conn:second', replacement);
    closing.resolve(undefined);
    await trimming;

    expect(postgres.closePool).not.toHaveBeenCalledWith(replacement.pool);
    expect((service as any).pools.get('conn:second')).toBe(replacement);
  });

  it('recreates a dead warm tunnel instead of returning its cached pool', async () => {
    connection.sshHost = 'ssh.example.com';
    connection.sshUsername = 'deploy';
    let tunnelOpen = true;
    ssh.openTunnel.mockImplementation(async () => {
      tunnelOpen = true;
      return 15432;
    });
    ssh.assertTunnelOpen.mockImplementation(() => {
      if (!tunnelOpen) throw new Error('SSH tunnel is no longer open');
    });
    const oldPool = { id: 'dead-warm' };
    const replacement = { id: 'replacement' };
    postgres.createPool
      .mockResolvedValueOnce(oldPool)
      .mockResolvedValueOnce(replacement);
    await service.getPool('conn', 'main', 'owner');
    tunnelOpen = false;

    await expect(service.getPool('conn', 'main', 'owner')).resolves.toBe(
      replacement,
    );
    expect(postgres.closePool).toHaveBeenCalledWith(oldPool);
    expect(ssh.openTunnel).toHaveBeenCalledTimes(2);
  });

  it('does not publish healthy state when the owned SSH tunnel dies after readiness', async () => {
    connection.sshHost = 'ssh.example.com';
    connection.sshUsername = 'deploy';
    let tunnelOpen = true;
    ssh.assertTunnelOpen = jest.fn(() => {
      if (!tunnelOpen) throw new Error('SSH tunnel is no longer open');
    });
    const pool = { id: 'dead-tunnel-pool' };
    const creating = deferred(pool);
    postgres.createPool.mockReturnValueOnce(creating.promise);
    const pending = observe(service.getPool('conn', 'main', 'owner'));
    await flush();
    expect(postgres.createPool).toHaveBeenCalledTimes(1);
    tunnelOpen = false;
    creating.resolve(pool);

    expect((await pending).status).toBe('rejected');
    expect(postgres.closePool).toHaveBeenCalledWith(pool);
    expect((service as any).pools.size).toBe(0);
    expect(
      prisma.connection.update.mock.calls.some(
        ([arg]: any[]) => arg.data.lastHealthStatus === 'healthy',
      ),
    ).toBe(false);
  });

  it('rejects an obsolete standalone health check and closes its own driver resource', async () => {
    const pool = { query: jest.fn().mockResolvedValue(undefined) };
    const creating = deferred(pool);
    postgres.createPool.mockReturnValueOnce(creating.promise);
    const checking = observe(service.checkHealth('conn', 'owner'));
    await flush();
    expect(postgres.createPool).toHaveBeenCalledTimes(1);
    await service.update('conn', { type: 'mysql' }, 'owner');
    creating.resolve(pool);

    expect((await checking).status).toBe('rejected');
    expect(postgres.closePool).toHaveBeenCalledWith(pool);
    expect(mysql.closePool).not.toHaveBeenCalled();
    expect(
      prisma.connection.update.mock.calls.some(
        ([arg]: any[]) => arg.data.lastHealthStatus === 'healthy',
      ),
    ).toBe(false);
  });

  it('drains a standalone health configuration lookup on shutdown', async () => {
    const lookup = deferred({ ...connection });
    prisma.connection.findFirst.mockReturnValueOnce(lookup.promise);
    const checking = observe(service.checkHealth('conn', 'owner'));
    let drained = false;
    const shutdown = service.onModuleDestroy().then(() => {
      drained = true;
    });
    await flush();

    expect(drained).toBe(false);
    lookup.resolve({ ...connection });
    await shutdown;
    expect((await checking).status).toBe('rejected');
    expect(postgres.createPool).not.toHaveBeenCalled();
  });

  it('preserves per-caller authentication, permission checks and team ownership when coalescing', async () => {
    connection.organizationId = 'team';
    connection.allowedDatabases = ['main'];
    const pool = { id: 'shared' };
    const creating = deferred(pool);
    postgres.createPool.mockReturnValueOnce(creating.promise);
    const first = service.getPool('conn', 'main', 'owner');
    await flush();
    permissions.ensurePermission.mockImplementation(async (userId: string) => {
      if (userId === 'denied') throw new ForbiddenException('no access');
    });

    await expect(service.getPool('conn', 'main')).rejects.toThrow(
      ForbiddenException,
    );
    await expect(service.getPool('conn', 'main', 'denied')).rejects.toThrow(
      ForbiddenException,
    );
    await expect(service.getPool('conn', 'private', 'member')).rejects.toThrow(
      ForbiddenException,
    );
    const member = service.getPool('conn', 'main', 'member');
    await flush();
    expect(postgres.createPool).toHaveBeenCalledTimes(1);
    creating.resolve(pool);
    await expect(first).resolves.toBe(pool);
    await expect(member).resolves.toBe(pool);
    await expect(service.getPool('conn', 'main', 'denied')).rejects.toThrow(
      ForbiddenException,
    );
    expect(permissions.ensurePermission).toHaveBeenCalledWith(
      'denied',
      ResourceType.CONNECTION,
      'conn',
      Permission.READ,
    );
    expect(permissions.getMemberRole).toHaveBeenCalledWith('member', 'team');
    expect(prisma.connection.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'conn',
        OR: [
          { userId: 'member' },
          { organization: { members: { some: { userId: 'member' } } } },
        ],
      },
    });
  });
});
