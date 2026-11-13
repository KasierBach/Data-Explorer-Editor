import { AiAutocompleteService } from '../../ai/ai.autocomplete-service';
import { ForbiddenException } from '@nestjs/common';

describe('AiAutocompleteService', () => {
  let service: AiAutocompleteService;
  let trustedAutocomplete: AiAutocompleteService['autocomplete'];
  const beforeProviderRequest = jest.fn().mockResolvedValue(undefined);
  const beforeProviderAttempt = jest.fn().mockResolvedValue(undefined);
  const execution = {
    generationId: 'owned-autocomplete',
    beforeAttempt: jest.fn(),
  };

  const cacheManager = {
    get: jest.fn(),
    set: jest.fn(),
  };

  const providerRunner = {
    isGeminiAvailable: jest.fn(),
    completeGeminiText: jest.fn(),
    completeOpenAiCompatibleText: jest.fn(),
  };

  const routingService = {
    buildPlanChain: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    beforeProviderRequest.mockReset().mockResolvedValue(undefined);
    beforeProviderAttempt.mockReset().mockResolvedValue(undefined);
    providerRunner.completeGeminiText.mockReset();
    providerRunner.completeOpenAiCompatibleText.mockReset();
    providerRunner.isGeminiAvailable.mockReturnValue(true);
    routingService.buildPlanChain.mockReturnValue({
      plans: [{ provider: 'gemini', model: 'gemini-3.1-flash-lite-preview' }],
    });
    service = new AiAutocompleteService(
      cacheManager as never,
      providerRunner as never,
      routingService as never,
    );
    trustedAutocomplete = (params) =>
      service.autocomplete({
        beforeProviderRequest,
        beforeProviderAttempt,
        execution,
        requestScopeKey: JSON.stringify([
          'actor',
          params.connectionId ?? 'conn-a',
          params.database ?? 'app',
        ]),
        ...params,
      });
  });

  it('default-denies autocomplete without authenticated request capabilities', async () => {
    await expect(
      service.autocomplete({
        beforeCursor: 'SELECT ',
        schemaContext: 'secret schema',
      }),
    ).resolves.toBe('');
    await expect(
      trustedAutocomplete({
        beforeCursor: 'SELECT ',
        beforeProviderAttempt: undefined,
      }),
    ).resolves.toBe('');
    expect(cacheManager.get).not.toHaveBeenCalled();
    expect(providerRunner.completeGeminiText).not.toHaveBeenCalled();
    expect(providerRunner.completeOpenAiCompatibleText).not.toHaveBeenCalled();
  });

  it.each(['gemini', 'custom'] as const)(
    'forwards server-owned lifetime/execution/key/hooks for %s autocomplete',
    async (provider) => {
      cacheManager.get.mockResolvedValue(undefined);
      cacheManager.set.mockResolvedValue(undefined);
      const plan = {
        provider,
        model: 'approved-model',
        baseUrl: 'https://provider.example/v1',
        apiKey: 'test',
      };
      routingService.buildPlanChain.mockReturnValue({ plans: [plan] });
      providerRunner.completeGeminiText.mockResolvedValue('ECT');
      providerRunner.completeOpenAiCompatibleText.mockResolvedValue('ECT');
      const signal = new AbortController().signal;
      const deadlineAt = Date.now() + 1_000;
      const requestScopeKey = JSON.stringify(['actor', 'conn-a', 'app']);
      await trustedAutocomplete({
        beforeCursor: 'SEL',
        signal,
        deadlineAt,
        requestScopeKey,
      });
      const params =
        provider === 'gemini'
          ? providerRunner.completeGeminiText.mock.calls[0][0]
          : providerRunner.completeOpenAiCompatibleText.mock.calls[0][1];
      expect(params).toMatchObject({
        signal,
        deadlineAt,
        requestScopeKey,
        execution,
        beforeProviderRequest,
        beforeProviderAttempt,
      });
      expect(params.execution).toBe(execution);
      expect(beforeProviderAttempt).toHaveBeenCalledWith(plan);
      const runner =
        provider === 'gemini'
          ? providerRunner.completeGeminiText
          : providerRunner.completeOpenAiCompatibleText;
      expect(beforeProviderAttempt.mock.invocationCallOrder[0]).toBeLessThan(
        runner.mock.invocationCallOrder[0],
      );
    },
  );

  it('rechecks connection approval before cache and never dispatches a denied provider', async () => {
    const denied = new ForbiddenException({ reason: 'AI_EGRESS_DENIED' });
    beforeProviderRequest.mockRejectedValueOnce(denied);
    await expect(trustedAutocomplete({ beforeCursor: 'SEL' })).rejects.toBe(
      denied,
    );
    expect(cacheManager.get).not.toHaveBeenCalled();
    cacheManager.get.mockResolvedValue(undefined);
    beforeProviderAttempt.mockRejectedValueOnce(denied);
    await expect(trustedAutocomplete({ beforeCursor: 'SEL' })).rejects.toBe(
      denied,
    );
    expect(providerRunner.completeGeminiText).not.toHaveBeenCalled();
    expect(providerRunner.completeOpenAiCompatibleText).not.toHaveBeenCalled();
  });

  it('propagates fatal attempt failures instead of continuing to an alternate provider', async () => {
    cacheManager.get.mockResolvedValue(undefined);
    routingService.buildPlanChain.mockReturnValue({
      plans: [
        { provider: 'gemini', model: 'first' },
        {
          provider: 'custom',
          model: 'fallback',
          baseUrl: 'https://provider.example/v1',
          apiKey: 'test',
        },
      ],
    });
    const fatal = Object.assign(new Error('storage secret'), {
      aiRequestFatal: true,
    });
    providerRunner.completeGeminiText.mockRejectedValueOnce(fatal);
    await expect(trustedAutocomplete({ beforeCursor: 'SEL' })).rejects.toBe(
      fatal,
    );
    expect(providerRunner.completeOpenAiCompatibleText).not.toHaveBeenCalled();
  });

  it('does not reuse autocomplete cached with a different suffix', async () => {
    const cached = new Map<string, string>();
    cacheManager.get.mockImplementation(async (key: string) => cached.get(key));
    cacheManager.set.mockImplementation(async (key: string, value: string) => {
      cached.set(key, value);
    });
    providerRunner.completeGeminiText
      .mockResolvedValueOnce('first')
      .mockResolvedValueOnce('second');
    const params = {
      beforeCursor: 'SELECT ',
      cacheScope: 'user-a',
      connectionId: 'conn-a',
      database: 'app',
    };

    await expect(
      trustedAutocomplete({ ...params, afterCursor: 'FROM users' }),
    ).resolves.toBe('first');
    await expect(
      trustedAutocomplete({ ...params, afterCursor: 'FROM orders' }),
    ).resolves.toBe('second');
    expect(providerRunner.completeGeminiText).toHaveBeenCalledTimes(2);
  });

  it('isolates otherwise identical autocomplete by trusted account scope', async () => {
    const keys: string[] = [];
    cacheManager.get.mockImplementation(async (key: string) => {
      keys.push(key);
      return undefined;
    });
    cacheManager.set.mockResolvedValue(undefined);
    providerRunner.completeGeminiText.mockResolvedValue('FROM users');
    const params = {
      beforeCursor: 'SELECT ',
      afterCursor: '',
      connectionId: 'conn-a',
      database: 'app',
    };

    await trustedAutocomplete({ ...params, cacheScope: 'user-a' });
    await trustedAutocomplete({ ...params, cacheScope: 'user-b' });
    const suggestionKeys = keys.filter((key) => !key.endsWith(':version'));
    expect(suggestionKeys).toHaveLength(2);
    expect(suggestionKeys[0]).not.toBe(suggestionKeys[1]);
  });

  it('rejects cancelled autocomplete before reading cache or starting a provider', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      trustedAutocomplete({
        beforeCursor: 'SELECT ',
        signal: controller.signal,
      }),
    ).rejects.toThrow();
    expect(cacheManager.get).not.toHaveBeenCalled();
    expect(providerRunner.completeGeminiText).not.toHaveBeenCalled();
  });

  it('routes autocomplete through the selected openai-compatible provider', async () => {
    cacheManager.get.mockResolvedValue(undefined);
    routingService.buildPlanChain.mockReturnValue({
      plans: [
        {
          provider: 'custom',
          model: 'gpt-oss-120b',
          baseUrl: 'https://provider.example.com/v1',
          apiKey: 'no-key',
        },
      ],
    });
    providerRunner.completeOpenAiCompatibleText.mockResolvedValue(
      'FROM orders',
    );

    const result = await trustedAutocomplete({
      beforeCursor: 'SELECT * ',
      schemaContext: 'TABLE orders(id int)',
      databaseType: 'postgres',
      model: 'gpt-oss-120b',
      providerOverride: {
        type: 'openai-compatible',
        name: 'custom',
        baseUrl: 'https://provider.example.com/v1',
        apiKey: '',
        model: 'gpt-oss-120b',
      },
    });

    expect(routingService.buildPlanChain).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'SELECT * ',
        model: 'gpt-oss-120b',
      }),
      true,
    );
    expect(providerRunner.completeOpenAiCompatibleText).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'custom',
        model: 'gpt-oss-120b',
      }),
      expect.objectContaining({
        prompt: 'SELECT * ',
      }),
    );
    expect(result).toBe('FROM orders');
  });

  it('normalizes MongoDB payload objects into executable JSON', async () => {
    providerRunner.completeGeminiText.mockResolvedValue(
      JSON.stringify({
        payload: {
          action: 'aggregate',
          pipeline: [{ $match: { status: 'active' } }],
        },
        explanation: 'Only active orders.',
      }),
    );

    const result = await service.generateSql({
      query: 'For collection "orders": show only active orders',
      databaseType: 'mongodb',
      schemaContext: 'TABLE: "public"."orders"',
    });

    expect(JSON.parse(result.sql)).toEqual({
      action: 'aggregate',
      collection: 'orders',
      pipeline: [{ $match: { status: 'active' } }],
    });
    expect(result.explanation).toBe('Only active orders.');
  });

  it('rejects quoted MongoDB collection names across line boundaries', async () => {
    providerRunner.completeGeminiText.mockResolvedValue(
      JSON.stringify({
        payload: { action: 'find', filter: {} },
        explanation: 'Fallback collection.',
      }),
    );

    const result = await service.generateSql({
      query: 'For collection "orders\nadmin": show all orders',
      databaseType: 'mongodb',
    });

    expect(JSON.parse(result.sql)).toEqual(
      expect.objectContaining({ collection: 'yourCollection' }),
    );
  });

  it('wraps legacy MongoDB pipeline strings with the selected collection', async () => {
    providerRunner.completeGeminiText.mockResolvedValue(
      JSON.stringify({
        sql: '[{ "$match": { "tier": "gold" } }]',
        explanation: 'Filter gold customers.',
      }),
    );

    const result = await service.generateSql({
      query: 'For collection "customers": find gold customers',
      databaseType: 'mongodb',
      schemaContext: 'TABLE: "public"."customers"',
    });

    expect(JSON.parse(result.sql)).toEqual({
      action: 'aggregate',
      collection: 'customers',
      pipeline: [{ $match: { tier: 'gold' } }],
    });
    expect(result.explanation).toBe('Filter gold customers.');
  });

  it('keeps MongoDB output empty when the model returns an empty payload', async () => {
    providerRunner.completeGeminiText.mockResolvedValue(
      JSON.stringify({
        payload: {},
        explanation: 'Not enough context.',
      }),
    );

    const result = await service.generateSql({
      query: 'For collection "customers": do something unclear',
      databaseType: 'mongodb',
      schemaContext: 'TABLE: "public"."customers"',
    });

    expect(result).toEqual({
      sql: '',
      explanation: 'Not enough context.',
    });
  });

  it('extracts SQL JSON from fenced responses without breaking the SQL path', async () => {
    providerRunner.completeGeminiText.mockResolvedValue(
      'Here is the query:\n```json\n{"sql":"SELECT 1","explanation":"Ping"}\n```',
    );

    const result = await service.generateSql({
      query: 'Run a lightweight health check',
      databaseType: 'postgres',
      schemaContext: 'TABLE: "public"."users"',
    });

    expect(result).toEqual({
      sql: 'SELECT 1',
      explanation: 'Ping',
    });
  });
});
