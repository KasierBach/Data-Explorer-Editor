import { SavedQueriesService } from './saved-queries.service';

describe('SavedQueriesService', () => {
  const prismaMock = {
    savedQuery: {
      findMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };
  const auditServiceMock = { log: jest.fn() };
  const connectionsServiceMock = { findOne: jest.fn() };
  const versionHistoryServiceMock = { recordSavedQueryVersion: jest.fn() };
  const organizationsServiceMock = {
    ensureMemberAccess: jest.fn(),
    ensureResourcePolicy: jest.fn(),
    removeResourcePolicy: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.savedQuery.findMany.mockResolvedValue([]);
    prismaMock.savedQuery.findFirst.mockResolvedValue(null);
  });

  it('does not expose workspace saved queries globally outside organizations', async () => {
    const service = new SavedQueriesService(
      prismaMock as any,
      auditServiceMock as any,
      connectionsServiceMock as any,
      versionHistoryServiceMock as any,
      organizationsServiceMock as any,
    );

    await service.findAllAvailable('viewer-1');

    const where = prismaMock.savedQuery.findMany.mock.calls[0][0].where;
    expect(where.OR).not.toContainEqual({ visibility: 'workspace' });
    expect(where.OR).toContainEqual({
      visibility: 'workspace',
      organizationId: { not: null },
      organization: { members: { some: { userId: 'viewer-1' } } },
    });
  });

  it('validates organization membership and registers a policy when creating a workspace query', async () => {
    const created = {
      id: 'query-1',
      name: 'Revenue',
      sql: 'select 1',
      organizationId: 'org-1',
      database: null,
      connectionId: null,
      visibility: 'workspace',
      folderId: null,
      tags: [],
      description: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      userId: 'owner-1',
      user: {
        id: 'owner-1',
        email: 'owner@example.com',
        firstName: null,
        lastName: null,
      },
    };
    prismaMock.savedQuery.create.mockResolvedValue(created);

    const service = new SavedQueriesService(
      prismaMock as any,
      auditServiceMock as any,
      connectionsServiceMock as any,
      versionHistoryServiceMock as any,
      organizationsServiceMock as any,
    );

    await service.create(
      {
        name: 'Revenue',
        sql: 'select 1',
        visibility: 'workspace',
        organizationId: 'org-1',
      },
      'owner-1',
    );

    expect(organizationsServiceMock.ensureMemberAccess).toHaveBeenCalledWith(
      'org-1',
      'owner-1',
    );
    expect(prismaMock.savedQuery.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ organizationId: 'org-1' }),
      }),
    );
    expect(organizationsServiceMock.ensureResourcePolicy).toHaveBeenCalledWith(
      'QUERY',
      'query-1',
      'org-1',
    );
  });

  it('does not attach organization scope when creating a private query', async () => {
    const created = {
      id: 'query-private',
      name: 'Draft',
      sql: 'select 1',
      organizationId: null,
      database: null,
      connectionId: null,
      visibility: 'private',
      folderId: null,
      tags: [],
      description: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      userId: 'owner-1',
      user: {
        id: 'owner-1',
        email: 'owner@example.com',
        firstName: null,
        lastName: null,
      },
    };
    prismaMock.savedQuery.create.mockResolvedValue(created);

    const service = new SavedQueriesService(
      prismaMock as any,
      auditServiceMock as any,
      connectionsServiceMock as any,
      versionHistoryServiceMock as any,
      organizationsServiceMock as any,
    );

    await service.create(
      {
        name: 'Draft',
        sql: 'select 1',
        visibility: 'private',
        organizationId: 'org-1',
      },
      'owner-1',
    );

    expect(organizationsServiceMock.ensureMemberAccess).not.toHaveBeenCalled();
    expect(prismaMock.savedQuery.create).toHaveBeenCalledWith(
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

  it('validates organization membership and refreshes policy when updating query workspace scope', async () => {
    const existing = {
      id: 'query-1',
      name: 'Revenue',
      sql: 'select 1',
      organizationId: null,
      database: null,
      connectionId: null,
      visibility: 'private',
      folderId: null,
      tags: [],
      description: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      userId: 'owner-1',
      user: {
        id: 'owner-1',
        email: 'owner@example.com',
        firstName: null,
        lastName: null,
      },
    };
    const updated = {
      ...existing,
      visibility: 'workspace',
      organizationId: 'org-1',
      updatedAt: new Date('2026-01-02T00:00:00Z'),
    };
    prismaMock.savedQuery.findFirst.mockResolvedValue(existing);
    prismaMock.savedQuery.update.mockResolvedValue(updated);

    const service = new SavedQueriesService(
      prismaMock as any,
      auditServiceMock as any,
      connectionsServiceMock as any,
      versionHistoryServiceMock as any,
      organizationsServiceMock as any,
    );

    await service.update(
      'query-1',
      {
        visibility: 'workspace',
        organizationId: 'org-1',
      },
      'owner-1',
    );

    expect(organizationsServiceMock.ensureMemberAccess).toHaveBeenCalledWith(
      'org-1',
      'owner-1',
    );
    expect(prismaMock.savedQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          visibility: 'workspace',
          organizationId: 'org-1',
        }),
      }),
    );
    expect(organizationsServiceMock.ensureResourcePolicy).toHaveBeenCalledWith(
      'QUERY',
      'query-1',
      'org-1',
    );
  });

  it('clears organization policy when updating a workspace query back to private', async () => {
    const existing = {
      id: 'query-1',
      name: 'Revenue',
      sql: 'select 1',
      organizationId: 'org-1',
      database: null,
      connectionId: null,
      visibility: 'workspace',
      folderId: null,
      tags: [],
      description: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      userId: 'owner-1',
      user: {
        id: 'owner-1',
        email: 'owner@example.com',
        firstName: null,
        lastName: null,
      },
    };
    const updated = {
      ...existing,
      visibility: 'private',
      organizationId: null,
      updatedAt: new Date('2026-01-02T00:00:00Z'),
    };
    prismaMock.savedQuery.findFirst.mockResolvedValue(existing);
    prismaMock.savedQuery.update.mockResolvedValue(updated);

    const service = new SavedQueriesService(
      prismaMock as any,
      auditServiceMock as any,
      connectionsServiceMock as any,
      versionHistoryServiceMock as any,
      organizationsServiceMock as any,
    );

    await service.update(
      'query-1',
      {
        visibility: 'private',
      },
      'owner-1',
    );

    expect(prismaMock.savedQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          visibility: 'private',
          organizationId: null,
        }),
      }),
    );
    expect(organizationsServiceMock.removeResourcePolicy).toHaveBeenCalledWith(
      'QUERY',
      'query-1',
      'org-1',
    );
    expect(
      organizationsServiceMock.ensureResourcePolicy,
    ).not.toHaveBeenCalled();
  });
});
