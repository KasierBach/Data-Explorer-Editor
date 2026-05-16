import { OrganizationBackupService } from './organization-backup.service';
import { ResourceType } from '../../permissions/enums/resource-type.enum';

describe('OrganizationBackupService', () => {
  let service: OrganizationBackupService;

  const prismaMock: any = {
    organization: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    organizationMember: {
      findUnique: jest.fn(),
    },
    teamspace: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    organizationResource: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    savedQuery: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    dashboard: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    dashboardWidget: {
      create: jest.fn(),
    },
    erdWorkspace: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
  };

  const auditMock = { log: jest.fn() };
  const permissionsMock = {
    buildDefaultResourcePolicy: jest.fn().mockReturnValue({ read: ['read'] }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.organizationMember.findUnique.mockResolvedValue({
      role: 'OWNER',
    });
    prismaMock.teamspace.findFirst.mockResolvedValue(null);
    service = new OrganizationBackupService(
      prismaMock,
      auditMock as any,
      permissionsMock as any,
    );
  });

  it('exports a backup package with teamspaces and artifacts', async () => {
    prismaMock.organization.findUnique.mockResolvedValue({
      id: 'org-1',
      name: 'Org One',
      slug: 'org-one',
      logoUrl: null,
      settings: { theme: 'dark' },
    });
    prismaMock.teamspace.findMany.mockResolvedValue([
      {
        id: 'teamspace-1',
        name: 'Core',
        slug: 'core',
        description: 'Primary space',
        createdBy: 'user-1',
        createdAt: new Date('2026-05-01T00:00:00Z'),
        updatedAt: new Date('2026-05-02T00:00:00Z'),
      },
    ]);
    prismaMock.organizationResource.findMany.mockResolvedValue([
      {
        resourceType: ResourceType.QUERY,
        resourceId: 'query-1',
        permissions: { READ: ['read'] },
        teamspaceId: 'teamspace-1',
      },
    ]);
    prismaMock.savedQuery.findMany.mockResolvedValue([
      {
        id: 'query-1',
        name: 'Quarterly review',
        sql: 'select 1',
        database: 'analytics',
        connectionId: 'conn-1',
        visibility: 'team',
        folderId: 'folder-1',
        tags: ['finance'],
        description: 'backup',
        createdAt: new Date('2026-05-01T00:00:00Z'),
        updatedAt: new Date('2026-05-02T00:00:00Z'),
      },
    ]);
    prismaMock.dashboard.findMany.mockResolvedValue([
      {
        id: 'dashboard-1',
        name: 'Ops Board',
        description: 'status',
        visibility: 'workspace',
        connectionId: 'conn-1',
        database: 'analytics',
        createdAt: new Date('2026-05-01T00:00:00Z'),
        updatedAt: new Date('2026-05-02T00:00:00Z'),
        widgets: [
          {
            id: 'widget-1',
            title: 'Latency',
            chartType: 'line',
            queryText: 'select 1',
            connectionId: 'conn-1',
            database: 'analytics',
            columns: ['latency'],
            xAxis: 'minute',
            yAxis: ['p95'],
            orderIndex: 0,
            config: {},
            dataSnapshot: [],
            createdAt: new Date('2026-05-01T00:00:00Z'),
            updatedAt: new Date('2026-05-02T00:00:00Z'),
          },
        ],
      },
    ]);
    prismaMock.erdWorkspace.findMany.mockResolvedValue([
      {
        id: 'erd-1',
        name: 'Schema',
        notes: 'layout',
        connectionId: 'conn-1',
        database: 'analytics',
        layout: { nodes: [] },
        createdAt: new Date('2026-05-01T00:00:00Z'),
        updatedAt: new Date('2026-05-02T00:00:00Z'),
      },
    ]);

    const backup = await service.exportOrganizationBackup('org-1', 'user-1');

    expect(backup.version).toBe(1);
    expect(backup.teamspaces).toHaveLength(1);
    expect(backup.savedQueries).toHaveLength(1);
    expect(backup.dashboards).toHaveLength(1);
    expect(backup.erdWorkspaces).toHaveLength(1);
    expect(backup.resourcePolicies).toHaveLength(1);
    expect(auditMock.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: expect.any(String),
        organizationId: 'org-1',
      }),
    );
  });

  it('restores a backup package and reattaches policies', async () => {
    prismaMock.organization.findUnique.mockResolvedValue({
      id: 'org-1',
      name: 'Org One',
      slug: 'org-one',
      logoUrl: null,
      settings: {},
    });
    prismaMock.teamspace.create.mockResolvedValue({
      id: 'teamspace-restored-1',
    });
    prismaMock.savedQuery.create.mockResolvedValue({ id: 'query-restored-1' });
    prismaMock.dashboard.create.mockResolvedValue({
      id: 'dashboard-restored-1',
    });
    prismaMock.dashboardWidget.create.mockResolvedValue({
      id: 'widget-restored-1',
    });
    prismaMock.erdWorkspace.create.mockResolvedValue({ id: 'erd-restored-1' });

    const result = await service.restoreOrganizationBackup('org-1', 'user-1', {
      version: 1,
      exportedAt: new Date().toISOString(),
      organization: {
        id: 'org-1',
        name: 'Org One',
        slug: 'org-one',
        logoUrl: null,
        settings: {},
      },
      notes: [],
      teamspaces: [
        {
          sourceId: 'teamspace-1',
          name: 'Core',
          slug: 'core',
          description: null,
          createdBy: 'user-1',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      resourcePolicies: [
        {
          resourceType: ResourceType.QUERY,
          resourceId: 'query-1',
          permissions: { READ: ['read'] },
          teamspaceId: 'teamspace-1',
        },
      ],
      savedQueries: [
        {
          sourceId: 'query-1',
          name: 'Quarterly review',
          sql: 'select 1',
          database: 'analytics',
          connectionId: 'conn-1',
          visibility: 'team',
          folderId: null,
          tags: [],
          description: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      dashboards: [
        {
          sourceId: 'dashboard-1',
          name: 'Ops Board',
          description: null,
          visibility: 'workspace',
          connectionId: 'conn-1',
          database: 'analytics',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          widgets: [
            {
              sourceId: 'widget-1',
              title: 'Latency',
              chartType: 'line',
              queryText: 'select 1',
              connectionId: 'conn-1',
              database: 'analytics',
              columns: [],
              xAxis: null,
              yAxis: [],
              orderIndex: 0,
              config: {},
              dataSnapshot: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        },
      ],
      erdWorkspaces: [
        {
          sourceId: 'erd-1',
          name: 'Schema',
          notes: null,
          connectionId: 'conn-1',
          database: 'analytics',
          layout: { nodes: [] },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });

    expect(result.created.teamspaces).toBe(1);
    expect(result.created.savedQueries).toBe(1);
    expect(result.created.dashboards).toBe(1);
    expect(result.created.dashboardWidgets).toBe(1);
    expect(result.created.erdWorkspaces).toBe(1);
    expect(prismaMock.teamspace.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org-1',
          name: 'Core',
        }),
      }),
    );
    expect(prismaMock.organizationResource.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          resourceType_resourceId_organizationId: {
            resourceType: ResourceType.QUERY,
            resourceId: 'query-restored-1',
            organizationId: 'org-1',
          },
        },
      }),
    );
    expect(prismaMock.organization.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'org-1' },
      }),
    );
  });
});
