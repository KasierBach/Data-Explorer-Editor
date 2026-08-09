import { AiAutocompleteService } from './ai.autocomplete-service';
import { AiChatCompletionService } from './ai.chat-completion.service';
import { AiSchemaService } from './ai.schema-service';
import { AiService } from './ai.service';

describe('AiService MongoDB command normalization', () => {
  const chat = jest.fn();
  const service = new AiService(
    { chat } as unknown as AiChatCompletionService,
    {} as AiSchemaService,
    {} as AiAutocompleteService,
  );

  beforeEach(() => {
    chat.mockReset();
    chat.mockResolvedValue({
      sql: '{"action":"find","filter":{}}',
      message: 'Ready',
      provider: 'groq',
      model: 'openai/gpt-oss-120b',
      routingMode: 'auto',
    });
  });

  it('uses a quoted collection name from the user request', async () => {
    const result = await service.generateSql({
      query: 'For collection "orders": show all orders',
      databaseType: 'mongodb',
    });

    expect(JSON.parse(result.sql)).toEqual(
      expect.objectContaining({
        action: 'find',
        collection: 'orders',
        filter: {},
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        provider: 'groq',
        model: 'openai/gpt-oss-120b',
        routingMode: 'auto',
      }),
    );
  });

  it('does not accept a quoted collection name across line boundaries', async () => {
    const result = await service.generateSql({
      query: 'For collection "orders\nadmin": show all orders',
      databaseType: 'mongodb',
    });

    expect(JSON.parse(result.sql)).toEqual(
      expect.objectContaining({ collection: 'yourCollection' }),
    );
  });

  it('teaches the provider valid aggregation semantics', async () => {
    await service.generateSql({
      query: 'For collection "movies": show the top genres',
      databaseType: 'mongodb',
    });

    expect(chat).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining(
          '{ "$group": { "_id": "$genres", "count": { "$sum": 1 } } }',
        ),
      }),
    );
  });

  it('repairs an invalid aggregation once before returning it', async () => {
    chat
      .mockResolvedValueOnce({
        sql: JSON.stringify({
          action: 'aggregate',
          collection: 'movies',
          pipeline: [{ $group: { _id: '$genres', count: 1 } }],
        }),
        explanation: 'Initial attempt',
        provider: 'groq',
        model: 'openai/gpt-oss-120b',
        routingMode: 'auto',
      })
      .mockResolvedValueOnce({
        sql: JSON.stringify({
          action: 'aggregate',
          collection: 'movies',
          pipeline: [
            { $unwind: '$genres' },
            { $group: { _id: '$genres', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
          ],
        }),
        explanation: 'Validated top genres pipeline',
        provider: 'groq',
        model: 'openai/gpt-oss-120b',
        routingMode: 'auto',
      });

    const result = await service.generateSql({
      query: 'For collection "movies": show the top genres',
      databaseType: 'mongodb',
    });

    expect(chat).toHaveBeenCalledTimes(2);
    expect(chat.mock.calls[1][0].prompt).toContain(
      '$group field "count" must be an accumulator object',
    );
    expect(JSON.parse(result.sql)).toEqual(
      expect.objectContaining({
        action: 'aggregate',
        pipeline: expect.arrayContaining([
          { $group: { _id: '$genres', count: { $sum: 1 } } },
        ]),
      }),
    );
    expect(result.explanation).toBe('Validated top genres pipeline');
  });

  it('normalizes a provider that returns an array directly in the sql field', async () => {
    chat.mockResolvedValue({
      sql: [
        { $unwind: { path: '$genres' } },
        { $group: { _id: '$genres', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ],
      explanation: 'Top genres',
      provider: 'groq',
      model: 'openai/gpt-oss-120b',
      routingMode: 'auto',
    });

    const result = await service.generateSql({
      query: 'For collection "movies": show the top genres',
      databaseType: 'mongodb',
    });

    expect(chat).toHaveBeenCalledTimes(1);
    expect(JSON.parse(result.sql)).toEqual({
      action: 'aggregate',
      collection: 'movies',
      pipeline: [
        { $unwind: { path: '$genres' } },
        { $group: { _id: '$genres', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ],
    });
  });

  it('returns no executable command when the repair is still invalid', async () => {
    chat.mockResolvedValue({
      sql: JSON.stringify({
        action: 'aggregate',
        collection: 'movies',
        pipeline: [{ $group: { _id: '$genres', count: 1 } }],
      }),
      explanation: 'Invalid attempt',
      provider: 'groq',
      model: 'openai/gpt-oss-120b',
      routingMode: 'auto',
    });

    const result = await service.generateSql({
      query: 'For collection "movies": show the top genres',
      databaseType: 'mongodb',
    });

    expect(chat).toHaveBeenCalledTimes(2);
    expect(result.sql).toBe('');
    expect(result.explanation).toContain('could not be converted');
  });
});
