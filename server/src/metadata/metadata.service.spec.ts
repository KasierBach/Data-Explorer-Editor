import { BadRequestException } from '@nestjs/common';
import { MetadataService } from './metadata.service';

describe('MetadataService', () => {
  it('rejects repeated parentId fields before touching a connection', async () => {
    const service = new MetadataService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.getHierarchy('connection-id', ['db:main'], 'user-id'),
    ).rejects.toThrow(BadRequestException);
  });

  it('serves cached empty metadata without querying the database again', async () => {
    const connectionsService = { findOne: jest.fn() };
    const cacheManager = { get: jest.fn().mockResolvedValue([]) };
    const service = new MetadataService(
      connectionsService as never,
      {} as never,
      { buildKey: jest.fn().mockResolvedValue('databases:key') } as never,
      cacheManager as never,
    );

    await expect(
      service.getDatabases('connection-id', 'user-id'),
    ).resolves.toEqual([]);
    expect(connectionsService.findOne).not.toHaveBeenCalled();
  });
});
