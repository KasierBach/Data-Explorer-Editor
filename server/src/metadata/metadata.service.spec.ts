import { BadRequestException } from '@nestjs/common';
import { MetadataService } from './metadata.service';

describe('MetadataService', () => {
  it.each(['getColumns', 'getFullMetadata'])(
    'uses the selected allowed database without opening the default database: %s',
    async (method) => {
      const connections = {
        authorizeAccess: jest.fn().mockResolvedValue({ userId: 'owner' }),
        findOne: jest.fn().mockResolvedValue({ type: 'postgres' }),
        getPool: jest.fn().mockImplementation((_id, _db) => {
          if (_db !== 'allowed')
            throw new Error('default database must not be opened');
          return {};
        }),
      };
      const strategy = {
        getColumns: jest.fn().mockResolvedValue([]),
        getFullMetadata: jest.fn().mockResolvedValue({}),
      };
      const service = new MetadataService(
        connections as never,
        { getStrategy: () => strategy } as never,
        { buildKey: jest.fn().mockResolvedValue('key') } as never,
        {
          get: jest.fn().mockResolvedValue(undefined),
          set: jest.fn(),
        } as never,
      );
      await service[method](
        'conn',
        'db:allowed.schema:public.table:items',
        'member',
      );
      expect(connections.getPool).toHaveBeenCalledWith(
        'conn',
        'allowed',
        'member',
      );
    },
  );
  it('filters a shared warm database list for the current member', async () => {
    const service = new MetadataService(
      {
        authorizeAccess: jest.fn().mockResolvedValue({
          userId: 'owner',
          allowedDatabases: ['allowed'],
        }),
      } as never,
      {} as never,
      { buildKey: jest.fn().mockResolvedValue('key') } as never,
      { get: jest.fn().mockResolvedValue(['allowed', 'private']) } as never,
    );
    await expect(service.getDatabases('conn', 'member')).resolves.toEqual([
      'allowed',
    ]);
  });
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
    const connectionsService = {
      findOne: jest.fn(),
      authorizeAccess: jest.fn().mockResolvedValue({}),
    };
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
    expect(connectionsService.authorizeAccess).toHaveBeenCalledWith(
      'connection-id',
      'user-id',
      null,
    );
  });

  it.each([
    'getDatabases',
    'getHierarchy',
    'getColumns',
    'getRelationships',
    'getDatabaseMetrics',
    'getFullMetadata',
  ])('denies warm cache before reading it: %s', async (method) => {
    const denied = new Error('revoked');
    const cache = { get: jest.fn().mockResolvedValue(['private']) };
    const connections = {
      authorizeAccess: jest.fn().mockRejectedValue(denied),
    };
    const service = new MetadataService(
      connections as never,
      {} as never,
      { buildKey: jest.fn().mockResolvedValue('key') } as never,
      cache as never,
    );
    const args = ['getHierarchy', 'getColumns', 'getFullMetadata'].includes(
      method,
    )
      ? ['conn', 'db:private.table:items', 'outsider']
      : ['conn', 'outsider'];
    await expect(service[method](...args)).rejects.toBe(denied);
    expect(cache.get).not.toHaveBeenCalled();
  });
});
