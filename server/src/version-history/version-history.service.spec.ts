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
});
