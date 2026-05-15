import { NotFoundException } from '@nestjs/common';
import { ResourceType } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { VersionHistoryService } from './version-history.service';

describe('VersionHistoryService', () => {
  let service: VersionHistoryService;
  let prisma: {
    versionHistory: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
    };
    savedQuery: {
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    erdWorkspace: {
      findFirst: jest.Mock;
      update: jest.Mock;
    };
  };
  let auditService: { log: jest.Mock };

  beforeEach(() => {
    prisma = {
      versionHistory: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
      savedQuery: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      erdWorkspace: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };

    auditService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    service = new VersionHistoryService(prisma as unknown as PrismaService, auditService as unknown as AuditService);
  });

  it('records the next saved query version number', async () => {
    prisma.versionHistory.findFirst.mockResolvedValueOnce({ versionNumber: 2 });
    prisma.versionHistory.create.mockResolvedValueOnce({ versionNumber: 3 });

    const result = await service.recordSavedQueryVersion({
      id: 'query-1',
      name: 'Revenue',
      sql: 'select 1',
      database: 'app',
      connectionId: 'conn-1',
      visibility: 'private',
      folderId: null,
      tags: ['finance'],
      description: null,
    }, 'user-1');

    expect(prisma.versionHistory.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        resourceType: ResourceType.QUERY,
        resourceId: 'query-1',
        versionNumber: 3,
        userId: 'user-1',
      }),
    }));
    expect(result).toEqual({ versionNumber: 3 });
  });

  it('restores a saved query snapshot and records a new version', async () => {
    prisma.savedQuery.findFirst.mockResolvedValueOnce({
      id: 'query-1',
      userId: 'user-1',
      user: { id: 'user-1', email: 'user@example.com', firstName: 'Ada', lastName: 'Lovelace' },
    });
    prisma.savedQuery.findFirst.mockResolvedValueOnce({
      id: 'query-1',
      userId: 'user-1',
      user: { id: 'user-1', email: 'user@example.com', firstName: 'Ada', lastName: 'Lovelace' },
    });
    prisma.versionHistory.findFirst.mockResolvedValueOnce({
      id: 'version-1',
      resourceType: ResourceType.QUERY,
      resourceId: 'query-1',
      versionNumber: 2,
      createdAt: new Date('2026-05-05T00:00:00.000Z'),
      snapshot: {
        name: 'Revenue report',
        sql: 'select * from revenue',
        database: 'analytics',
        connectionId: 'conn-1',
        visibility: 'private',
        folderId: null,
        tags: ['finance'],
        description: 'Restored',
      },
      user: { id: 'user-1', email: 'user@example.com', firstName: 'Ada', lastName: 'Lovelace' },
    });
    prisma.savedQuery.update.mockResolvedValueOnce({
      id: 'query-1',
      name: 'Revenue report',
      sql: 'select * from revenue',
      database: 'analytics',
      connectionId: 'conn-1',
      visibility: 'private',
      folderId: null,
      tags: ['finance'],
      description: 'Restored',
      createdAt: new Date('2026-05-01T00:00:00.000Z'),
      updatedAt: new Date('2026-05-05T00:00:00.000Z'),
      userId: 'user-1',
      user: { id: 'user-1', email: 'user@example.com', firstName: 'Ada', lastName: 'Lovelace' },
    });
    prisma.versionHistory.findFirst.mockResolvedValueOnce({ versionNumber: 2 });
    prisma.versionHistory.create.mockResolvedValueOnce({ versionNumber: 3 });

    const result = await service.restoreVersion('QUERY', 'query-1', 'version-1', 'user-1');

    expect(prisma.savedQuery.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'query-1' },
      data: expect.objectContaining({
        name: 'Revenue report',
        sql: 'select * from revenue',
      }),
    }));
    expect(result).toEqual(expect.objectContaining({
      restoredFromVersionId: 'version-1',
      restoredFromVersionNumber: 2,
      newVersionNumber: 3,
    }));
    expect(auditService.log).toHaveBeenCalled();
  });

  it('rejects version lookups for missing resources', async () => {
    prisma.savedQuery.findFirst.mockResolvedValueOnce(null);

    await expect(service.listVersions('QUERY', 'missing', 'user-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('does not allow version access through global workspace visibility', async () => {
    prisma.savedQuery.findFirst.mockResolvedValueOnce(null);

    await expect(service.listVersions('QUERY', 'query-1', 'viewer-1')).rejects.toBeInstanceOf(NotFoundException);

    const where = prisma.savedQuery.findFirst.mock.calls[0][0].where;
    expect(where.OR).not.toContainEqual({ visibility: 'workspace' });
    expect(where.OR).toContainEqual({
      visibility: 'workspace',
      organizationId: { not: null },
      organization: { members: { some: { userId: 'viewer-1' } } },
    });
  });

  it('normalizes legacy team visibility when restoring a saved query snapshot', async () => {
    prisma.savedQuery.findFirst.mockResolvedValueOnce({
      id: 'query-1',
      userId: 'user-1',
      organizationId: 'org-1',
      user: { id: 'user-1', email: 'user@example.com', firstName: 'Ada', lastName: 'Lovelace' },
    });
    prisma.savedQuery.findFirst.mockResolvedValueOnce({
      id: 'query-1',
      userId: 'user-1',
      organizationId: 'org-1',
      user: { id: 'user-1', email: 'user@example.com', firstName: 'Ada', lastName: 'Lovelace' },
    });
    prisma.versionHistory.findFirst.mockResolvedValueOnce({
      id: 'version-legacy',
      resourceType: ResourceType.QUERY,
      resourceId: 'query-1',
      versionNumber: 4,
      createdAt: new Date('2026-05-05T00:00:00.000Z'),
      snapshot: {
        name: 'Legacy team query',
        sql: 'select * from revenue',
        database: null,
        connectionId: null,
        visibility: 'team',
        folderId: null,
        tags: [],
        description: null,
      },
      user: { id: 'user-1', email: 'user@example.com', firstName: 'Ada', lastName: 'Lovelace' },
    });
    prisma.savedQuery.update.mockResolvedValueOnce({
      id: 'query-1',
      name: 'Legacy team query',
      sql: 'select * from revenue',
      database: null,
      connectionId: null,
      visibility: 'workspace',
      organizationId: 'org-1',
      folderId: null,
      tags: [],
      description: null,
      createdAt: new Date('2026-05-01T00:00:00.000Z'),
      updatedAt: new Date('2026-05-05T00:00:00.000Z'),
      userId: 'user-1',
      user: { id: 'user-1', email: 'user@example.com', firstName: 'Ada', lastName: 'Lovelace' },
    });
    prisma.versionHistory.findFirst.mockResolvedValueOnce({ versionNumber: 4 });
    prisma.versionHistory.create.mockResolvedValueOnce({ versionNumber: 5 });

    await service.restoreVersion('QUERY', 'query-1', 'version-legacy', 'user-1');

    expect(prisma.savedQuery.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        visibility: 'workspace',
      }),
    }));
  });
});
