import { ForbiddenException } from '@nestjs/common';
import { TeamspacesService } from './teamspaces.service';
import { ResourceType } from '../permissions/enums/resource-type.enum';

describe('TeamspacesService', () => {
  let service: TeamspacesService;

  const prismaMock: any = {
    organizationMember: {
      findUnique: jest.fn(),
    },
    teamspace: {
      findMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    organizationResource: {
      count: jest.fn(),
      updateMany: jest.fn(),
      upsert: jest.fn(),
    },
  };

  const auditMock: any = {
    log: jest.fn(),
  };

  const permissionsMock: any = {
    buildDefaultResourcePolicy: jest.fn().mockReturnValue({
      OWNER: ['read', 'write', 'manage'],
      ADMIN: ['read', 'write'],
      MEMBER: ['read'],
      VIEWER: ['read'],
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TeamspacesService(prismaMock, auditMock, permissionsMock);
  });

  it('rejects teamspace creation for non-admin members', async () => {
    prismaMock.organizationMember.findUnique.mockResolvedValue({ role: 'MEMBER' });

    await expect(
      service.create('org-1', 'user-1', { name: 'Operations' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('assigns a resource to a teamspace and logs the change', async () => {
    prismaMock.organizationMember.findUnique.mockResolvedValue({ role: 'OWNER' });
    prismaMock.teamspace.findFirst.mockResolvedValue({ id: 'teamspace-1', organizationId: 'org-1' });
    prismaMock.organizationResource.upsert.mockResolvedValue({
      id: 'resource-1',
      teamspaceId: 'teamspace-1',
    });

    const result = await service.assignResourceTeamspace(
      'org-1',
      ResourceType.CONNECTION,
      'connection-1',
      'user-1',
      'teamspace-1',
    );

    expect(result.teamspaceId).toBe('teamspace-1');
    expect(prismaMock.organizationResource.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          resourceType_resourceId_organizationId: {
            resourceType: ResourceType.CONNECTION,
            resourceId: 'connection-1',
            organizationId: 'org-1',
          },
        },
        update: { teamspaceId: 'teamspace-1' },
      }),
    );
    expect(auditMock.log).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
      }),
    );
  });
});
