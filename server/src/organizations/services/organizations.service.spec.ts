import { ForbiddenException } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { OrganizationRole } from '../entities/organization-role.enum';
import { Permission } from '../../permissions/enums/permission.enum';

describe('OrganizationsService security', () => {
  let service: OrganizationsService;

  const prismaMock: any = {
    connection: { findMany: jest.fn() },
    user: { findUnique: jest.fn() },
    organization: { findUnique: jest.fn() },
    organizationMember: { findUnique: jest.fn(), create: jest.fn() },
    organizationInvitation: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    organizationResource: { findMany: jest.fn() },
    savedQuery: { findMany: jest.fn() },
    dashboard: { findMany: jest.fn() },
  };
  const auditMock = { log: jest.fn() };
  const permissionsMock = {
    buildDefaultResourcePolicy: jest.fn().mockReturnValue({}),
    getRolePermissions: jest.fn().mockReturnValue([Permission.READ]),
  };
  const mailMock = { sendTeamInvitationEmail: jest.fn() };
  const denyMemberReadPolicy = {
    [OrganizationRole.OWNER]: [
      Permission.READ,
      Permission.WRITE,
      Permission.DELETE,
      Permission.MANAGE,
      Permission.COMMENT,
      Permission.SHARE,
    ],
    [OrganizationRole.ADMIN]: [
      Permission.READ,
      Permission.WRITE,
      Permission.DELETE,
      Permission.MANAGE,
      Permission.COMMENT,
      Permission.SHARE,
    ],
    [OrganizationRole.MEMBER]: [],
    [OrganizationRole.VIEWER]: [Permission.READ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new OrganizationsService(
      prismaMock,
      auditMock as any,
      permissionsMock as any,
      mailMock as any,
    );
  });

  it('rejects invitations that try to grant OWNER', async () => {
    prismaMock.organizationMember.findUnique.mockResolvedValueOnce({
      role: OrganizationRole.OWNER,
    });
    prismaMock.organization.findUnique.mockResolvedValueOnce({
      id: 'org-1',
      name: 'Org 1',
    });
    prismaMock.user.findUnique
      .mockResolvedValueOnce({ id: 'inviter-1', email: 'owner@example.com' })
      .mockResolvedValueOnce(null);

    await expect(
      service.inviteMember('org-1', 'inviter-1', {
        email: 'member@example.com',
        role: OrganizationRole.OWNER,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prismaMock.organizationInvitation.upsert).not.toHaveBeenCalled();
  });

  it('rejects accepting OWNER invitations', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      email: 'member@example.com',
    });
    prismaMock.organizationInvitation.findUnique.mockResolvedValueOnce({
      id: 'invite-1',
      email: 'member@example.com',
      role: OrganizationRole.OWNER,
      invitedBy: 'inviter-1',
      organizationId: 'org-1',
    });

    await expect(
      service.acceptInvitation('invite-1', 'user-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prismaMock.organizationInvitation.update).not.toHaveBeenCalled();
  });

  it('lists only shared queries for an organization workspace', async () => {
    prismaMock.organizationMember.findUnique.mockResolvedValueOnce({
      role: OrganizationRole.MEMBER,
    });
    prismaMock.savedQuery.findMany.mockResolvedValueOnce([]);
    prismaMock.organizationResource.findMany.mockResolvedValueOnce([]);

    await service.listQueries('org-1', 'user-1');

    expect(prismaMock.savedQuery.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: 'org-1',
          visibility: { in: ['workspace', 'team'] },
        },
      }),
    );
  });

  it('lists only shared dashboards for an organization workspace', async () => {
    prismaMock.organizationMember.findUnique.mockResolvedValueOnce({
      role: OrganizationRole.MEMBER,
    });
    prismaMock.dashboard.findMany.mockResolvedValueOnce([]);
    prismaMock.organizationResource.findMany.mockResolvedValueOnce([]);

    await service.listDashboards('org-1', 'user-1');

    expect(prismaMock.dashboard.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: 'org-1',
          visibility: { in: ['workspace', 'team'] },
        },
      }),
    );
  });

  it('hides team connections when the caller role does not have read permission', async () => {
    prismaMock.organizationMember.findUnique.mockResolvedValueOnce({
      role: OrganizationRole.MEMBER,
    });
    prismaMock.connection.findMany.mockResolvedValueOnce([
      {
        id: 'conn-1',
        name: 'Secret DB',
        type: 'postgres',
        host: 'secret.internal',
      },
    ]);
    prismaMock.organizationResource.findMany.mockResolvedValueOnce([
      {
        resourceId: 'conn-1',
        permissions: denyMemberReadPolicy,
        teamspaceId: null,
      },
    ]);

    await expect(service.listConnections('org-1', 'user-1')).resolves.toEqual(
      [],
    );
  });

  it('hides shared queries when the caller role does not have read permission', async () => {
    prismaMock.organizationMember.findUnique.mockResolvedValueOnce({
      role: OrganizationRole.MEMBER,
    });
    prismaMock.savedQuery.findMany.mockResolvedValueOnce([
      {
        id: 'query-1',
        name: 'Revenue',
        sql: 'select * from revenue',
      },
    ]);
    prismaMock.organizationResource.findMany.mockResolvedValueOnce([
      {
        resourceId: 'query-1',
        permissions: denyMemberReadPolicy,
        teamspaceId: null,
      },
    ]);

    await expect(service.listQueries('org-1', 'user-1')).resolves.toEqual([]);
  });

  it('hides shared dashboards when the caller role does not have read permission', async () => {
    prismaMock.organizationMember.findUnique.mockResolvedValueOnce({
      role: OrganizationRole.MEMBER,
    });
    prismaMock.dashboard.findMany.mockResolvedValueOnce([
      {
        id: 'dashboard-1',
        name: 'Finance',
        description: 'Sensitive metrics',
      },
    ]);
    prismaMock.organizationResource.findMany.mockResolvedValueOnce([
      {
        resourceId: 'dashboard-1',
        permissions: denyMemberReadPolicy,
        teamspaceId: null,
      },
    ]);

    await expect(service.listDashboards('org-1', 'user-1')).resolves.toEqual(
      [],
    );
  });
});
