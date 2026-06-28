import { Test, TestingModule } from '@nestjs/testing';
import { SearchService } from './search.service';
import { ConnectionsService } from '../connections/connections.service';
import { DatabaseStrategyFactory } from '../database-strategies/strategy.factory';
import { AiService } from '../ai/ai.service';
import { SearchIndexRepository } from './search-index.repository';

describe('SearchService', () => {
  let service: SearchService;
  let connectionsService: jest.Mocked<ConnectionsService>;
  let strategyFactory: jest.Mocked<DatabaseStrategyFactory>;
  let searchIndexRepository: {
    search: jest.Mock;
    replaceUserIndex: jest.Mock;
    getSemanticFallbackNames: jest.Mock;
    getItemsByNames: jest.Mock;
  };
  let aiService: {
    suggestTablesBySemantic: jest.Mock;
  };

  beforeEach(async () => {
    searchIndexRepository = {
      search: jest.fn(),
      replaceUserIndex: jest.fn(),
      getSemanticFallbackNames: jest.fn(),
      getItemsByNames: jest.fn(),
    };
    aiService = {
      suggestTablesBySemantic: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        {
          provide: ConnectionsService,
          useValue: { findAll: jest.fn(), getPool: jest.fn() },
        },
        {
          provide: DatabaseStrategyFactory,
          useValue: { getStrategy: jest.fn() },
        },
        {
          provide: AiService,
          useValue: aiService,
        },
        {
          provide: SearchIndexRepository,
          useValue: searchIndexRepository,
        },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
    connectionsService = module.get(ConnectionsService);
    strategyFactory = module.get(DatabaseStrategyFactory);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('search', () => {
    it('returns indexed keyword matches without triggering semantic fallback when the hit set is already strong', async () => {
      searchIndexRepository.search.mockResolvedValue([
        { id: '1', name: 'users', type: 'table', connectionName: 'DB1' },
        {
          id: '2',
          name: 'users_archive',
          type: 'table',
          connectionName: 'DB1',
        },
        { id: '3', name: 'users_shadow', type: 'table', connectionName: 'DB1' },
        { id: '4', name: 'users_beta', type: 'table', connectionName: 'DB1' },
        {
          id: '5',
          name: 'users_staging',
          type: 'table',
          connectionName: 'DB1',
        },
      ]);

      const results = await service.search('user-1', 'user');

      expect(results).toHaveLength(5);
      expect(results[0].name).toBe('users');
      expect(aiService.suggestTablesBySemantic).not.toHaveBeenCalled();
    });

    it('merges semantic fallback suggestions only when keyword matches are sparse', async () => {
      searchIndexRepository.search.mockResolvedValue([
        { id: '1', name: 'audit_logs', type: 'table', connectionName: 'DB1' },
      ]);
      searchIndexRepository.getSemanticFallbackNames.mockResolvedValue([
        'audit_logs',
        'users',
        'user_sessions',
      ]);
      aiService.suggestTablesBySemantic.mockResolvedValue([
        'users',
        'user_sessions',
      ]);
      searchIndexRepository.getItemsByNames.mockResolvedValue([
        { id: '2', name: 'users', type: 'table', connectionName: 'DB1' },
        {
          id: '3',
          name: 'user_sessions',
          type: 'table',
          connectionName: 'DB1',
        },
      ]);

      const results = await service.search('user-1', 'login history');

      expect(results.map((result) => result.name)).toEqual([
        'audit_logs',
        'users',
        'user_sessions',
      ]);
      expect(aiService.suggestTablesBySemantic).toHaveBeenCalledWith(
        'login history',
        ['audit_logs', 'users', 'user_sessions'],
      );
    });
  });

  describe('syncIndex', () => {
    it('rebuilds the repository index from tables and views across connections', async () => {
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

      expect(searchIndexRepository.replaceUserIndex).toHaveBeenCalledWith(
        userId,
        [
          {
            id: 't1',
            name: 'users',
            type: 'table',
            connectionId: 'conn-1',
            connectionName: 'Main DB',
            database: 'postgres',
            schema: 'public',
          },
        ],
      );
    });
  });
});
