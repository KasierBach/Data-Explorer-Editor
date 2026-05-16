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
});
