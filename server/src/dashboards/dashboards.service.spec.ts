import { DashboardsService } from './dashboards.service';

describe('DashboardsService', () => {
  const prismaMock = {
    user: {
      findUnique: jest.fn(),
    },
    dashboard: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn().mockResolvedValue({ id: 'dashboard-1' }),
    },
    dashboardWidget: { create: jest.fn() },
    organizationResource: {
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    $transaction: jest.fn(async (operations: Promise<unknown>[]) =>
      Promise.all(operations),
    ),
  };
  const auditServiceMock = { log: jest.fn() };
  const connectionsServiceMock = { findOne: jest.fn() };
  const organizationsServiceMock = {
    ensureMemberAccess: jest.fn(),
    ensureResourcePolicy: jest.fn(),
  };
  const permissionsServiceMock = {
    filterAccessibleResourceIds: jest.fn().mockResolvedValue(new Set()),
    ensurePermission: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.user.findUnique.mockResolvedValue({
      email: 'analyst@example.com',
    });
    prismaMock.dashboard.findMany.mockResolvedValue([]);
    permissionsServiceMock.filterAccessibleResourceIds.mockResolvedValue(
      new Set(),
    );
  });

  it('does not grant dashboard access by matching email domain', async () => {
    const service = new DashboardsService(
      prismaMock as any,
      auditServiceMock as any,
      connectionsServiceMock as any,
      organizationsServiceMock as any,
      permissionsServiceMock as any,
    );

    await service.findAllAvailable('viewer-1');

    const where = prismaMock.dashboard.findMany.mock.calls[0][0].where;
    expect(JSON.stringify(where)).not.toContain('endsWith');
  });

  it('does not expose workspace dashboards globally outside organizations', async () => {
    const service = new DashboardsService(
      prismaMock as any,
      auditServiceMock as any,
      connectionsServiceMock as any,
      organizationsServiceMock as any,
      permissionsServiceMock as any,
    );

    await service.findAllAvailable('viewer-1');

    const where = prismaMock.dashboard.findMany.mock.calls[0][0].where;
    expect(where.OR).not.toContainEqual({ visibility: 'workspace' });
    expect(where.OR).toContainEqual({
      visibility: 'workspace',
      organizationId: { not: null },
      organization: { members: { some: { userId: 'viewer-1' } } },
    });
  });

  it('validates organization membership and registers a policy when creating a workspace dashboard', async () => {
    const created = {
      id: 'dashboard-1',
      name: 'Revenue',
      description: null,
      visibility: 'workspace',
      connectionId: null,
      database: null,
      organizationId: 'org-1',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      userId: 'owner-1',
      user: {
        id: 'owner-1',
        email: 'owner@example.com',
        firstName: null,
        lastName: null,
      },
      widgets: [],
    };
    prismaMock.dashboard.create.mockResolvedValue(created);

    const service = new DashboardsService(
      prismaMock as any,
      auditServiceMock as any,
      connectionsServiceMock as any,
      organizationsServiceMock as any,
      permissionsServiceMock as any,
    );

    await service.create(
      {
        name: 'Revenue',
        visibility: 'workspace',
        organizationId: 'org-1',
      },
      'owner-1',
    );

    expect(organizationsServiceMock.ensureMemberAccess).toHaveBeenCalledWith(
      'org-1',
      'owner-1',
    );
    expect(prismaMock.dashboard.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ organizationId: 'org-1' }),
      }),
    );
    expect(organizationsServiceMock.ensureResourcePolicy).toHaveBeenCalledWith(
      'DASHBOARD',
      'dashboard-1',
      'org-1',
    );
  });

  it('does not attach organization scope when creating a private dashboard', async () => {
    const created = {
      id: 'dashboard-private',
      name: 'Draft',
      description: null,
      visibility: 'private',
      connectionId: null,
      database: null,
      organizationId: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      userId: 'owner-1',
      user: {
        id: 'owner-1',
        email: 'owner@example.com',
        firstName: null,
        lastName: null,
      },
      widgets: [],
    };
    prismaMock.dashboard.create.mockResolvedValue(created);

    const service = new DashboardsService(
      prismaMock as any,
      auditServiceMock as any,
      connectionsServiceMock as any,
      organizationsServiceMock as any,
      permissionsServiceMock as any,
    );

    await service.create(
      {
        name: 'Draft',
        visibility: 'private',
        organizationId: 'org-1',
      },
      'owner-1',
    );

    expect(organizationsServiceMock.ensureMemberAccess).not.toHaveBeenCalled();
    expect(prismaMock.dashboard.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          visibility: 'private',
          organizationId: null,
        }),
      }),
    );
    expect(
      organizationsServiceMock.ensureResourcePolicy,
    ).not.toHaveBeenCalled();
  });

  it('rejects oversized dashboard snapshots before storing a widget', async () => {
    prismaMock.dashboard.findUnique.mockResolvedValue({
      id: 'dashboard-1',
      connectionId: null,
      database: null,
      widgets: [],
      user: {},
    });
    const service = new DashboardsService(
      prismaMock as any,
      auditServiceMock as any,
      connectionsServiceMock as any,
      organizationsServiceMock as any,
      permissionsServiceMock as any,
    );

    await expect(
      service.addWidget(
        'dashboard-1',
        {
          title: 'Too large',
          chartType: 'table',
          columns: ['value'],
          yAxis: [],
          dataSnapshot: [{ value: 'x'.repeat(512 * 1024) }],
        },
        'member-1',
      ),
    ).rejects.toThrow('Dashboard snapshot must not exceed 512 KB.');
    expect(prismaMock.dashboardWidget.create).not.toHaveBeenCalled();
  });

  it('deletes a dashboard and its detached resource policy together', async () => {
    prismaMock.dashboard.findUnique.mockResolvedValue({
      id: 'dashboard-1',
      organizationId: 'org-1',
    });
    const service = new DashboardsService(
      prismaMock as any,
      auditServiceMock as any,
      connectionsServiceMock as any,
      organizationsServiceMock as any,
      permissionsServiceMock as any,
    );

    await expect(service.remove('dashboard-1', 'owner-1')).resolves.toEqual({
      success: true,
    });
    expect(permissionsServiceMock.ensurePermission).toHaveBeenCalledWith(
      'owner-1',
      'DASHBOARD',
      'dashboard-1',
      'delete',
    );
    expect(prismaMock.organizationResource.deleteMany).toHaveBeenCalledWith({
      where: { resourceType: 'DASHBOARD', resourceId: 'dashboard-1' },
    });
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });
});
