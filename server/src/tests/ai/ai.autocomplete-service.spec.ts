import { AiAutocompleteService } from '../../ai/ai.autocomplete-service';

describe('AiAutocompleteService', () => {
  let service: AiAutocompleteService;

  const cacheManager = {
    get: jest.fn(),
    set: jest.fn(),
  };

  const providerRunner = {
    isGeminiAvailable: jest.fn(),
    completeGeminiText: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    providerRunner.isGeminiAvailable.mockReturnValue(true);
    service = new AiAutocompleteService(
      cacheManager as never,
      providerRunner as never,
    );
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
