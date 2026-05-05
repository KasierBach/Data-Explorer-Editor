import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PresenceService } from './presence.service';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../permissions/services/permissions.service';
import { ResourceType } from '../permissions/enums/resource-type.enum';

describe('PresenceService', () => {
  let service: PresenceService;
  const prismaMock = {
    user: {
      findUnique: jest.fn(),
    },
    organizationMember: {
      findUnique: jest.fn(),
    },
    teamspace: {
      findFirst: jest.fn(),
    },
  } as any;
  const permissionsMock = {
    ensurePermission: jest.fn(),
  } as any;
  const configMock = {
    get: jest.fn().mockReturnValue('redis://localhost:6379'),
  } as any;
  const redisMock = {
    hset: jest.fn(),
    hgetall: jest.fn(),
    expire: jest.fn(),
    hdel: jest.fn(),
    quit: jest.fn(),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PresenceService(
      prismaMock as PrismaService,
      permissionsMock as PermissionsService,
      configMock as ConfigService,
    );
    (service as any).redis = redisMock;
  });

  it('heartbeats and lists live teamspace presence', async () => {
    prismaMock.organizationMember.findUnique.mockResolvedValue({ id: 'member-1' });
    prismaMock.teamspace.findFirst.mockResolvedValue({ id: 'teamspace-1' });
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
      username: 'ada',
      avatarUrl: null,
    });
    redisMock.hgetall.mockResolvedValue({});

    const result = await service.heartbeatTeamspace('org-1', 'teamspace-1', 'user-1');

    expect(redisMock.hset).toHaveBeenCalledWith(
      'presence:organizations:org-1:teamspaces:teamspace-1',
      'user-1',
      expect.stringContaining('"displayName":"Ada Lovelace"'),
    );
    expect(redisMock.expire).toHaveBeenCalled();
    expect(result).toHaveLength(0);
  });

  it('filters stale presence on read', async () => {
    prismaMock.organizationMember.findUnique.mockResolvedValue({ id: 'member-1' });
    prismaMock.teamspace.findFirst.mockResolvedValue({ id: 'teamspace-1' });
    redisMock.hgetall.mockResolvedValue({
      fresh: JSON.stringify({
        id: 'fresh',
        email: 'fresh@example.com',
        firstName: 'Fresh',
        lastName: 'User',
        username: 'fresh',
        avatarUrl: null,
        displayName: 'Fresh User',
        lastSeen: Date.now(),
      }),
      stale: JSON.stringify({
        id: 'stale',
        email: 'stale@example.com',
        firstName: 'Stale',
        lastName: 'User',
        username: 'stale',
        avatarUrl: null,
        displayName: 'Stale User',
        lastSeen: Date.now() - 120_000,
      }),
    });

    const result = await service.listTeamspacePresence('org-1', 'teamspace-1', 'user-1');

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('fresh');
    expect(redisMock.hdel).toHaveBeenCalledWith('presence:organizations:org-1:teamspaces:teamspace-1', 'stale');
  });

  it('blocks resource presence without read access', async () => {
    permissionsMock.ensurePermission.mockRejectedValue(new ForbiddenException('denied'));

    await expect(
      service.heartbeatResource('org-1', ResourceType.QUERY, 'query-1', 'user-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('requires a real teamspace membership', async () => {
    prismaMock.organizationMember.findUnique.mockResolvedValue(null);
    prismaMock.teamspace.findFirst.mockResolvedValue({ id: 'teamspace-1' });

    await expect(service.listTeamspacePresence('org-1', 'teamspace-1', 'user-1')).rejects.toBeInstanceOf(ForbiddenException);
  });
});
