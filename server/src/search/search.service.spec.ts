import { Test, TestingModule } from '@nestjs/testing';
import { SearchService } from './search.service';
import { ConfigService } from '@nestjs/config';
import { ConnectionsService } from '../connections/connections.service';
import { DatabaseStrategyFactory } from '../database-strategies/strategy.factory';
import { NotificationsService } from '../notifications/notifications.service';
import Redis from 'ioredis';
import { AiService } from '../ai/ai.service';

jest.mock('ioredis');

describe('SearchService', () => {
  let service: SearchService;
  let redisMock: jest.Mocked<Redis>;
  let connectionsService: jest.Mocked<ConnectionsService>;
  let strategyFactory: jest.Mocked<DatabaseStrategyFactory>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('redis://localhost:6379'),
          },
        },
        {
          provide: ConnectionsService,
          useValue: { findAll: jest.fn(), getPool: jest.fn() },
        },
        {
          provide: DatabaseStrategyFactory,
          useValue: { getStrategy: jest.fn() },
        },
        {
          provide: NotificationsService,
          useValue: { emit: jest.fn() },
        },
        {
          provide: AiService,
          useValue: {
            suggestTablesBySemantic: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
    connectionsService = module.get(ConnectionsService);
    strategyFactory = module.get(DatabaseStrategyFactory);

    // Setup Redis mock
    service.onModuleInit();
    redisMock = (service as any).redis;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('search', () => {
    it('should return matched items from Redis', async () => {
      const mockItems = [
        JSON.stringify({ name: 'users', type: 'table', connectionName: 'DB1' }),
        JSON.stringify({
          name: 'orders',
          type: 'table',
          connectionName: 'DB1',
        }),
      ];

      redisMock.smembers.mockResolvedValue(mockItems as any);

      const results = await service.search('user-1', 'user');

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('users');
    });

    it('should return empty array if no match', async () => {
      redisMock.smembers.mockResolvedValue(['{"name":"other"}'] as any);
      const results = await service.search('user-1', 'missing');
      expect(results).toHaveLength(0);
    });
  });

  describe('syncIndex', () => {
    it('should clear old index and index new connections', async () => {
      const userId = 'user-1';
      const mockConn = { id: 'conn-1', name: 'Main DB', type: 'postgres' };
      connectionsService.findAll.mockResolvedValue([mockConn] as any);

      const strategyMock = {
        getSchemas: jest
          .fn()
          .mockResolvedValue([{ id: 'db:postgres.schema:public' }]),
        getTables: jest
          .fn()
          .mockResolvedValue([{ name: 'users', type: 'table', id: 't1' }]),
        getViews: jest.fn().mockResolvedValue([]),
      };
      strategyFactory.getStrategy.mockReturnValue(strategyMock as any);
      connectionsService.getPool.mockResolvedValue({} as any);

      await service.syncIndex(userId);

      expect(redisMock.del).toHaveBeenCalled();
      expect(redisMock.sadd).toHaveBeenCalled();
    });
  });
});
