import { OrganizationRole } from '../../organizations/entities/organization-role.enum';
import { Permission } from '../enums/permission.enum';
import { ResourceType } from '../enums/resource-type.enum';
import { PermissionsService } from './permissions.service';

describe('PermissionsService', () => {
  it('filters a resource list using membership roles and custom policies in two queries', async () => {
    const prisma = {
      organizationMember: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { organizationId: 'org-1', role: OrganizationRole.MEMBER },
          ]),
      },
      organizationResource: {
        findMany: jest.fn().mockResolvedValue([
          {
            organizationId: 'org-1',
            resourceId: 'denied',
            permissions: {
              OWNER: Object.values(Permission),
              ADMIN: Object.values(Permission),
              MEMBER: [],
              VIEWER: [],
            },
          },
        ]),
      },
    };
    const service = new PermissionsService(prisma as never);

    const allowed = await service.filterAccessibleResourceIds(
      'member-1',
      ResourceType.DASHBOARD,
      [
        { id: 'private', userId: 'member-1', organizationId: null },
        { id: 'default', userId: 'owner-1', organizationId: 'org-1' },
        { id: 'denied', userId: 'owner-1', organizationId: 'org-1' },
      ],
      Permission.READ,
    );

    expect([...allowed]).toEqual(['private', 'default']);
    expect(prisma.organizationMember.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.organizationResource.findMany).toHaveBeenCalledTimes(1);
  });
});
