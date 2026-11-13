import { Test, TestingModule } from '@nestjs/testing';
import { SearchService } from './search.service';
import { ConnectionsService } from '../connections/connections.service';
import { DatabaseStrategyFactory } from '../database-strategies/strategy.factory';
import { AiService } from '../ai/ai.service';
import { SearchIndexRepository } from './search-index.repository';
import { AiAccountPolicyService } from '../ai/ai-account-policy.service';
import { AiExecutionLedgerService } from '../ai/ai-execution-ledger.service';
import { ForbiddenException } from '@nestjs/common';

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
  const beforeProviderRequest = jest.fn().mockResolvedValue(undefined);
  const beforeProviderAttempt = jest.fn().mockResolvedValue(undefined);
  const accountPolicy = {
    isEnabled: jest.fn().mockResolvedValue(true),
    assertEnabled: jest.fn().mockResolvedValue(undefined),
    assertConnectionEnabled: jest.fn().mockResolvedValue(undefined),
    beforeProviderRequest: jest.fn(() => beforeProviderRequest),
    beforeProviderAttempt: jest.fn(() => beforeProviderAttempt),
  };
  const execution = {
    generationId: 'semantic-generation',
    deadlineAt: Date.now() + 1_500,
    beforeAttempt: jest.fn(),
    complete: jest.fn().mockResolvedValue({ outcome: 'succeeded' }),
    fail: jest.fn().mockResolvedValue({ outcome: 'failed' }),
    release: jest.fn().mockResolvedValue(undefined),
  };
  const executionLedger = {
    begin: jest.fn().mockImplementation(async (_actor, _task, metadata) => {
      execution.deadlineAt = metadata.deadlineAt;
      return execution;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    accountPolicy.isEnabled.mockReset().mockResolvedValue(true);
    accountPolicy.assertEnabled.mockReset().mockResolvedValue(undefined);
    accountPolicy.assertConnectionEnabled
      .mockReset()
      .mockResolvedValue(undefined);
    beforeProviderRequest.mockReset().mockResolvedValue(undefined);
    beforeProviderAttempt.mockReset().mockResolvedValue(undefined);
    executionLedger.begin
      .mockReset()
      .mockImplementation(async (_actor, _task, metadata) => {
        execution.deadlineAt = metadata.deadlineAt;
        return execution;
      });
    execution.complete.mockReset().mockResolvedValue({ outcome: 'succeeded' });
    execution.fail.mockReset().mockResolvedValue({ outcome: 'failed' });
    execution.release.mockReset().mockResolvedValue(undefined);
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
          useValue: {
            findAll: jest
              .fn()
              .mockResolvedValue([
                { id: 'conn-1', database: 'app', name: 'Primary' },
              ]),
            getPool: jest.fn(),
          },
        },
        {
          provide: DatabaseStrategyFactory,
          useValue: { getStrategy: jest.fn() },
        },
        {
          provide: AiService,
          useValue: aiService,
        },
        { provide: AiAccountPolicyService, useValue: accountPolicy },
        { provide: AiExecutionLedgerService, useValue: executionLedger },
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
    it('keeps keyword results and does not gather semantic names while AI is disabled', async () => {
      accountPolicy.isEnabled.mockResolvedValue(false);
      const keyword = [
        { id: '1', name: 'users', type: 'table', connectionName: 'DB1' },
      ];
      searchIndexRepository.search.mockResolvedValue(keyword);
      await expect(service.search('user-1', 'users')).resolves.toEqual(keyword);
      expect(aiService.suggestTablesBySemantic).not.toHaveBeenCalled();
      expect(
        searchIndexRepository.getSemanticFallbackNames,
      ).not.toHaveBeenCalled();
    });

    it('keeps keyword results when the optional account policy lookup fails', async () => {
      accountPolicy.isEnabled.mockRejectedValue(
        new Error('Policy database unavailable'),
      );
      const keyword = [
        { id: '1', name: 'users', type: 'table', connectionName: 'DB1' },
      ];
      searchIndexRepository.search.mockResolvedValue(keyword);

      await expect(service.search('user-1', 'users')).resolves.toEqual(keyword);
      expect(aiService.suggestTablesBySemantic).not.toHaveBeenCalled();
      expect(
        searchIndexRepository.getSemanticFallbackNames,
      ).not.toHaveBeenCalled();
    });

    it('keeps keyword results when optional semantic fallback fails', async () => {
      const keyword = [
        { id: '1', name: 'audit_logs', type: 'table', connectionName: 'DB1' },
      ];
      searchIndexRepository.search.mockResolvedValue(keyword);
      searchIndexRepository.getSemanticFallbackNames.mockResolvedValue([
        'audit_logs',
        'users',
      ]);
      aiService.suggestTablesBySemantic.mockRejectedValue(
        new Error('Semantic provider unavailable'),
      );

      await expect(service.search('user-1', 'login history')).resolves.toEqual(
        keyword,
      );
    });

    it('aborts a stalled semantic request after its finite deadline and keeps keyword results', async () => {
      jest.useFakeTimers();
      try {
        const keyword = [
          { id: '1', name: 'audit_logs', type: 'table', connectionName: 'DB1' },
        ];
        searchIndexRepository.search.mockResolvedValue(keyword);
        searchIndexRepository.getSemanticFallbackNames.mockResolvedValue([
          'audit_logs',
          'users',
        ]);
        let signal: AbortSignal | undefined;
        aiService.suggestTablesBySemantic.mockImplementation(
          (_query, _names, _policy, request: { signal: AbortSignal }) => {
            signal = request.signal;
            return new Promise<string[]>(() => undefined);
          },
        );
        const pending = service.search('user-1', 'login history');
        await jest.advanceTimersByTimeAsync(0);
        expect(signal?.aborted).toBe(false);
        await jest.advanceTimersByTimeAsync(1_500);
        await expect(pending).resolves.toEqual(keyword);
        expect(signal?.aborted).toBe(true);
        expect(jest.getTimerCount()).toBe(0);
      } finally {
        jest.useRealTimers();
      }
    });

    it('uses only server-derived approved exact database scopes and filters same-name foreign matches', async () => {
      connectionsService.findAll.mockResolvedValue([
        { id: 'approved', database: 'app' },
        { id: 'denied', database: 'secret-db' },
        { id: 'unspecified', database: null },
      ] as any);
      accountPolicy.assertConnectionEnabled.mockImplementation(
        async (_actor, connectionId) => {
          if (connectionId === 'denied')
            throw new ForbiddenException({ reason: 'AI_EGRESS_DENIED' });
        },
      );
      searchIndexRepository.search.mockResolvedValue([]);
      searchIndexRepository.getSemanticFallbackNames.mockImplementation(
        async (_actor, scopes) =>
          scopes[0].connectionId === 'approved' ? ['users'] : ['private_users'],
      );
      aiService.suggestTablesBySemantic.mockResolvedValue([
        'users',
        'invented',
      ]);
      searchIndexRepository.getItemsByNames.mockResolvedValue([
        { id: '1', name: 'users', connectionId: 'approved', database: 'app' },
        {
          id: '2',
          name: 'users',
          connectionId: 'denied',
          database: 'secret-db',
        },
        {
          id: '3',
          name: 'users',
          connectionId: 'approved',
          database: 'other-db',
        },
      ]);
      const results = await service.search('user-1', 'people');
      expect(results.map((item) => item.id)).toEqual(['1']);
      expect(
        searchIndexRepository.getSemanticFallbackNames,
      ).toHaveBeenCalledTimes(1);
      expect(
        searchIndexRepository.getSemanticFallbackNames,
      ).toHaveBeenCalledWith('user-1', [
        { connectionId: 'approved', database: 'app' },
      ]);
      expect(searchIndexRepository.getItemsByNames).toHaveBeenCalledWith(
        'user-1',
        ['users'],
        50,
        [{ connectionId: 'approved', database: 'app' }],
      );
      expect(accountPolicy.beforeProviderAttempt).toHaveBeenCalledWith(
        'user-1',
        'approved',
        'app',
      );
      expect(
        accountPolicy.assertConnectionEnabled.mock.invocationCallOrder[0],
      ).toBeLessThan(
        searchIndexRepository.getSemanticFallbackNames.mock
          .invocationCallOrder[0],
      );
      expect(connectionsService.getPool).not.toHaveBeenCalled();
      expect(strategyFactory.getStrategy).not.toHaveBeenCalled();
    });

    it('keeps keyword results with zero semantic schema reads or budget for default-denied scopes', async () => {
      const keyword = [{ id: '1', name: 'users' }];
      searchIndexRepository.search.mockResolvedValue(keyword);
      accountPolicy.assertConnectionEnabled.mockRejectedValue(
        new ForbiddenException({ reason: 'AI_EGRESS_DENIED' }),
      );
      await expect(service.search('user-1', 'people')).resolves.toEqual(
        keyword,
      );
      expect(
        searchIndexRepository.getSemanticFallbackNames,
      ).not.toHaveBeenCalled();
      expect(executionLedger.begin).not.toHaveBeenCalled();
      expect(aiService.suggestTablesBySemantic).not.toHaveBeenCalled();
    });

    it('keeps keyword results when semantic accounting is unavailable', async () => {
      const keyword = [{ id: '1', name: 'users' }];
      searchIndexRepository.search.mockResolvedValue(keyword);
      const withoutLedger = new SearchService(
        connectionsService,
        strategyFactory,
        aiService as any,
        searchIndexRepository as any,
        accountPolicy as any,
      );
      await expect(withoutLedger.search('user-1', 'people')).resolves.toEqual(
        keyword,
      );
      expect(
        searchIndexRepository.getSemanticFallbackNames,
      ).not.toHaveBeenCalled();
      expect(aiService.suggestTablesBySemantic).not.toHaveBeenCalled();
    });

    it('releases a late-created semantic reservation after the search deadline', async () => {
      jest.useFakeTimers();
      try {
        searchIndexRepository.search.mockResolvedValue([]);
        searchIndexRepository.getSemanticFallbackNames.mockResolvedValue([
          'users',
        ]);
        let resolve!: (value: typeof execution) => void;
        executionLedger.begin.mockReturnValueOnce(
          new Promise((done) => {
            resolve = done;
          }),
        );
        const pending = service.search('user-1', 'people');
        await jest.advanceTimersByTimeAsync(0);
        await jest.advanceTimersByTimeAsync(1_500);
        await expect(pending).resolves.toEqual([]);
        resolve(execution);
        for (let index = 0; index < 30; index++) await Promise.resolve();
        expect(execution.fail).toHaveBeenCalledWith('timed_out');
        expect(execution.release).toHaveBeenCalledTimes(1);
        expect(aiService.suggestTablesBySemantic).not.toHaveBeenCalled();
        expect(jest.getTimerCount()).toBe(0);
      } finally {
        jest.useRealTimers();
      }
    });

    it('discards enrichment on durable completion failure and releases the reservation', async () => {
      const keyword = [{ id: '1', name: 'audit' }];
      searchIndexRepository.search.mockResolvedValue(keyword);
      searchIndexRepository.getSemanticFallbackNames.mockResolvedValue([
        'users',
      ]);
      aiService.suggestTablesBySemantic.mockResolvedValue(['users']);
      execution.complete.mockRejectedValueOnce(new Error('ledger unavailable'));
      await expect(service.search('user-1', 'people')).resolves.toEqual(
        keyword,
      );
      expect(execution.fail).toHaveBeenCalledWith('failed');
      expect(execution.release).toHaveBeenCalledTimes(1);
      expect(searchIndexRepository.getItemsByNames).not.toHaveBeenCalled();
    });

    it('rechecks authorization before semantic enrichment is merged', async () => {
      const keyword = [{ id: '1', name: 'audit' }];
      searchIndexRepository.search.mockResolvedValue(keyword);
      searchIndexRepository.getSemanticFallbackNames.mockResolvedValue([
        'users',
      ]);
      aiService.suggestTablesBySemantic.mockResolvedValue(['users']);
      accountPolicy.assertConnectionEnabled
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(
          new ForbiddenException({ reason: 'AI_EGRESS_DENIED' }),
        );
      await expect(service.search('user-1', 'people')).resolves.toEqual(
        keyword,
      );
      expect(searchIndexRepository.getItemsByNames).not.toHaveBeenCalled();
      expect(execution.release).toHaveBeenCalledTimes(1);
    });

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
        {
          id: '2',
          name: 'users',
          type: 'table',
          connectionName: 'DB1',
          connectionId: 'conn-1',
          database: 'app',
        },
        {
          id: '3',
          name: 'user_sessions',
          type: 'table',
          connectionName: 'DB1',
          connectionId: 'conn-1',
          database: 'app',
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
        beforeProviderRequest,
        expect.objectContaining({
          signal: expect.any(AbortSignal),
          deadlineAt: expect.any(Number),
          requestScopeKey: JSON.stringify(['user-1', 'conn-1', 'app']),
          execution,
          beforeProviderAttempt,
        }),
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

    it('indexes collections from every visible MongoDB database', async () => {
      connectionsService.findAll.mockResolvedValue([
        { id: 'mongo-1', name: 'Mongo', type: 'mongodb' },
      ] as any);
      const strategyMock = {
        getDatabases: jest
          .fn()
          .mockResolvedValue([{ name: 'warehouse' }, { name: 'analytics' }]),
        getSchemas: jest.fn((_: unknown, database: string) => [
          { id: `db:${database}.schema:public`, name: 'public' },
        ]),
        getTables: jest.fn((_: unknown, __: string, database: string) => [
          {
            id: `db:${database}.collection:events`,
            name: 'events',
            type: 'collection',
          },
        ]),
        getViews: jest.fn().mockResolvedValue([]),
      };
      strategyFactory.getStrategy.mockReturnValue(strategyMock as any);
      connectionsService.getPool.mockResolvedValue({} as any);

      await service.syncIndex('user-1');

      expect(searchIndexRepository.replaceUserIndex).toHaveBeenCalledWith(
        'user-1',
        expect.arrayContaining([
          expect.objectContaining({ database: 'warehouse', name: 'events' }),
          expect.objectContaining({ database: 'analytics', name: 'events' }),
        ]),
      );
    });
  });
});
