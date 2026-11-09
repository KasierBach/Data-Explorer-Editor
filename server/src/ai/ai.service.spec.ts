import { AiAutocompleteService } from './ai.autocomplete-service';
import { AiChatCompletionService } from './ai.chat-completion.service';
import { AiSchemaService } from './ai.schema-service';
import { AiService } from './ai.service';
import type { ChatParams, ChatResult, StreamEvent } from './ai.types';

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

  it('preserves recipient approval, execution and request scope on Mongo repair', async () => {
    const beforeProviderAttempt = jest.fn().mockResolvedValue(undefined);
    const beforeProviderRequest = jest.fn().mockResolvedValue(undefined);
    const execution = {
      generationId: 'generation-fixture',
      beforeAttempt: jest.fn(),
    };
    chat
      .mockResolvedValueOnce({
        sql: '{"action":"aggregate","collection":"orders","pipeline":[{"$group":{"_id":"$region","count":1}}]}',
        message: 'Invalid first result',
        provider: 'groq',
        model: 'fixture',
        routingMode: 'auto',
      })
      .mockResolvedValueOnce({
        sql: '{"action":"find","collection":"orders","filter":{}}',
        message: 'Repaired',
        provider: 'groq',
        model: 'fixture',
        routingMode: 'auto',
      });
    const params = {
      query: 'For collection "orders": count orders by region',
      databaseType: 'mongodb',
      beforeProviderAttempt,
      beforeProviderRequest,
      execution,
      requestScopeKey: 'actor/connection/database',
    };
    await service.generateSql(params);
    expect(chat).toHaveBeenCalledTimes(2);
    for (const [request] of chat.mock.calls) {
      expect(request.execution).toBe(execution);
      expect(request.beforeProviderAttempt).toBe(beforeProviderAttempt);
      expect(request.beforeProviderRequest).toBe(beforeProviderRequest);
      expect(request.requestScopeKey).toBe(params.requestScopeKey);
      expect(request.signal).toBeInstanceOf(AbortSignal);
      expect(request.deadlineAt).toBe(chat.mock.calls[0][0].deadlineAt);
    }
  });

  it('does not bypass a denied recipient by issuing an untracked Mongo repair', async () => {
    const denied = new Error('Repair recipient is not approved');
    const beforeProviderAttempt = jest.fn().mockRejectedValue(denied);
    chat
      .mockResolvedValueOnce({
        sql: '{"action":"aggregate","collection":"orders","pipeline":[{"$group":{"_id":null,"count":1}}]}',
        message: 'Invalid first result',
        provider: 'groq',
        model: 'fixture',
        routingMode: 'auto',
      })
      .mockImplementationOnce(async (request: ChatParams) => {
        await request.beforeProviderAttempt?.({
          provider: 'custom',
          model: 'fixture',
          baseUrl: 'https://unapproved.example',
        });
        return {
          sql: '{"action":"find","collection":"orders","filter":{}}',
          message: 'Unexpected repair',
          provider: 'custom',
          model: 'fixture',
          routingMode: 'auto',
        };
      });
    await expect(
      service.generateSql({
        query: 'For collection "orders": count orders',
        databaseType: 'mongodb',
        beforeProviderAttempt,
        execution: {
          generationId: 'generation-fixture',
          beforeAttempt: jest.fn(),
        },
      }),
    ).rejects.toBe(denied);
    expect(beforeProviderAttempt).toHaveBeenCalledTimes(1);
    expect(chat).toHaveBeenCalledTimes(2);
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

describe.each(['sync', 'stream'] as const)(
  'AiService %s MongoDB chat validation',
  (delivery) => {
    const chat = jest.fn();
    const chatStream = jest.fn();
    const service = new AiService(
      { chat, chatStream } as unknown as AiChatCompletionService,
      {} as AiSchemaService,
      {} as AiAutocompleteService,
    );
    const params: ChatParams = {
      prompt: 'For collection "orders": show completed orders',
      databaseType: 'MongoDB',
    };
    const response: ChatResult = {
      message: 'Original provider message.',
      explanation: 'Original explanation.',
      provider: 'groq',
      providerLabel: 'Groq',
      model: 'openai/gpt-oss-120b',
      routingMode: 'auto',
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      sources: ['https://example.test/orders'],
      generationId: 'generation-test',
      contractVersion: 1,
      warnings: ['Original provider warning.'],
    };
    const chunk: StreamEvent = {
      type: 'chunk',
      text: 'Original streamed text.',
    };
    const findPayload = {
      action: 'find',
      collection: 'orders',
      filter: { status: 'complete' },
      options: {},
    };
    const aggregatePayload = {
      action: 'aggregate',
      collection: 'orders',
      pipeline: [
        { $match: { status: 'complete' } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ],
    };
    let providerResult: ChatResult;

    beforeEach(() => {
      providerResult = { ...response };
      chat.mockReset();
      chatStream.mockReset();
      chat.mockImplementation(async (actual: ChatParams) => {
        await actual.beforeProviderRequest?.();
        return providerResult;
      });
      chatStream.mockImplementation(async function* (actual: ChatParams) {
        await actual.beforeProviderRequest?.();
        yield chunk;
        yield { type: 'done', data: providerResult };
      });
    });

    const request = async (actual = params): Promise<ChatResult> => {
      if (delivery === 'sync') return service.chat(actual);
      const events: StreamEvent[] = [];
      for await (const event of service.chatStream(actual)) events.push(event);
      expect(events[0]).toBe(chunk);
      const done = events[1];
      if (done?.type !== 'done') throw new Error('Expected stream completion');
      return done.data;
    };
    const completion = delivery === 'sync' ? chat : chatStream;

    it.each([
      ['canonical JSON', JSON.stringify(findPayload), findPayload],
      [
        'fenced JSON',
        `\`\`\`json\n${JSON.stringify(findPayload)}\n\`\`\``,
        findPayload,
      ],
      ['inferred JSON', '{"filter":{"status":"complete"}}', findPayload],
      ['direct object', findPayload, findPayload],
      [
        'canonical aggregation',
        JSON.stringify(aggregatePayload),
        aggregatePayload,
      ],
      ['bare pipeline', aggregatePayload.pipeline, aggregatePayload],
    ])(
      'normalizes valid %s with the shared normalizer',
      async (_form, sql, expected) => {
        providerResult = { ...response, sql } as ChatResult;

        expect(await request()).toEqual({
          ...response,
          sql: JSON.stringify(expected, null, 2),
        });
        expect(providerResult.sql).toBe(sql);
        expect(completion).toHaveBeenCalledTimes(1);
        expect(completion).toHaveBeenCalledWith(params);
      },
    );

    it.each([
      ['malformed JSON', '{not-json}'],
      ['unsupported shell', 'db.orders.find({"status":"complete"})'],
      ['unsupported action', '{"action":"drop","collection":"orders"}'],
      [
        'unsupported action with pipeline',
        '{"action":"drop","collection":"orders","pipeline":[{"$match":{}}]}',
      ],
      [
        'unsupported stage',
        '{"action":"aggregate","collection":"orders","pipeline":[{"$out":"archive"}]}',
      ],
      [
        'invalid group',
        '{"action":"aggregate","collection":"orders","pipeline":[{"$group":{"_id":"$status","count":1}}]}',
      ],
      [
        'empty pipeline',
        '{"action":"aggregate","collection":"orders","pipeline":[]}',
      ],
      ['invalid action type', '{"action":42,"collection":"orders"}'],
    ])('withholds %s without a provider repair', async (_form, sql) => {
      providerResult = { ...response, sql };
      const result = await request();

      expect(result).toEqual({
        ...response,
        sql: undefined,
        explanation: expect.stringContaining(response.explanation!),
      });
      expect(result.explanation).toContain(
        'could not be converted into a safe executable MongoDB payload:',
      );
      expect(providerResult.sql).toBe(sql);
      expect(completion).toHaveBeenCalledTimes(1);
    });

    it.each([undefined, ''])(
      'preserves plain MongoDB chat with sql=%s',
      async (sql) => {
        if (sql !== undefined) providerResult = { ...response, sql };
        expect(await request()).toBe(providerResult);
        expect(completion).toHaveBeenCalledTimes(1);
      },
    );

    it.each(['postgres', 'redis', undefined])(
      'leaves non-Mongo response text and SQL unchanged for %s',
      async (databaseType) => {
        providerResult = { ...response, sql: '  ```sql\nSELECT 1;\n```  ' };
        expect(await request({ ...params, databaseType })).toBe(providerResult);
        expect(completion).toHaveBeenCalledTimes(1);
      },
    );

    it('forwards the fresh account policy hook on every request', async () => {
      let enabled = true;
      const beforeProviderRequest = jest.fn(async () => {
        if (!enabled) throw new Error('AI is disabled for this account');
      });
      const actual = { ...params, beforeProviderRequest };

      expect(await request(actual)).toBe(providerResult);
      enabled = false;
      await expect(request(actual)).rejects.toThrow(
        'AI is disabled for this account',
      );
      expect(beforeProviderRequest).toHaveBeenCalledTimes(2);
      expect(completion).toHaveBeenCalledTimes(2);
      expect(completion.mock.calls[0][0]).toBe(actual);
      expect(completion.mock.calls[1][0]).toBe(actual);
    });

    if (delivery === 'stream') {
      it('passes through chunk and error events unchanged', async () => {
        const error: StreamEvent = { type: 'error', text: 'Original error.' };
        chatStream.mockImplementation(async function* () {
          yield chunk;
          yield error;
        });
        const events: StreamEvent[] = [];
        for await (const event of service.chatStream(params))
          events.push(event);

        expect(events).toEqual([chunk, error]);
        expect(events[0]).toBe(chunk);
        expect(events[1]).toBe(error);
        expect(chatStream).toHaveBeenCalledTimes(1);
        expect(chat).not.toHaveBeenCalled();
      });
    }
  },
);
