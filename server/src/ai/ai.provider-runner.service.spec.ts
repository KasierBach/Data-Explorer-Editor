import { ConfigService } from '@nestjs/config';
import { AiPromptBuilderService } from './ai.prompt-builder.service';
import { AiProviderRunnerService } from './ai.provider-runner.service';
import type { AiRoutingMode, RouteDecision, StreamEvent } from './ai.types';

function createSseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    }),
  );
}

describe('AiProviderRunnerService streaming', () => {
  let service: AiProviderRunnerService;
  const mockFetch = jest.fn();
  const structuredDbDecision: RouteDecision = {
    preferGemini: false,
    complexityScore: 0,
    reasons: ['structured-db-response'],
    needsLiveSearch: false,
    responseFormat: 'structured',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
    (globalThis as { fetch?: typeof fetch }).fetch = mockFetch as unknown as typeof fetch;
    service = new AiProviderRunnerService(
      { get: jest.fn(() => undefined) } as unknown as ConfigService,
      new AiPromptBuilderService(),
    );
  });

  it('retries transient completion failures from openai-compatible providers before falling through', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        json: async () => ({ error: { message: 'upstream busy' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: '{"message":"Ready after retry"}',
              },
            },
          ],
        }),
      });

    const result = await service.runOpenAiCompatible(
      {
        provider: 'openrouter',
        model: 'openai/gpt-4o-mini',
        apiKey: 'sk-test',
        baseUrl: 'https://openrouter.ai/api/v1',
      },
      {
        prompt: 'Summarize this schema',
        schemaContext: 'TABLE users(id uuid)',
        databaseType: 'postgres',
      },
      'auto',
      structuredDbDecision,
    );

    expect(result.message).toBe('Ready after retry');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('sends json_schema response_format for structured openai-compatible completion requests', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: '{"message":"Ready"}',
            },
          },
        ],
      }),
    });

    await service.runOpenAiCompatible(
      {
        provider: 'openrouter',
        model: 'openai/gpt-4o-mini',
        apiKey: 'sk-test',
        baseUrl: 'https://openrouter.ai/api/v1',
      },
      {
        prompt: 'List user tables',
        schemaContext: 'TABLE users(id uuid)',
        databaseType: 'postgres',
      },
      'auto',
      structuredDbDecision,
    );

    const body = JSON.parse(String(mockFetch.mock.calls[0]?.[1]?.body));
    expect(body.response_format?.type).toBe('json_schema');
    expect(body.response_format?.json_schema?.name).toBe(
      'data_explorer_ai_response',
    );
    expect(body.response_format?.json_schema?.strict).toBe(true);
  });

  it('falls back when openai-compatible providers reject json_schema response_format', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({
          error: {
            message:
              'response_format json_schema is not supported for this model',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: '{"message":"Ready after fallback"}',
              },
            },
          ],
        }),
      });

    const result = await service.runOpenAiCompatible(
      {
        provider: 'openrouter',
        model: 'openai/gpt-4o-mini',
        apiKey: 'sk-test',
        baseUrl: 'https://openrouter.ai/api/v1',
      },
      {
        prompt: 'List user tables',
        schemaContext: 'TABLE users(id uuid)',
        databaseType: 'postgres',
      },
      'auto',
      structuredDbDecision,
    );

    const firstBody = JSON.parse(String(mockFetch.mock.calls[0]?.[1]?.body));
    const secondBody = JSON.parse(String(mockFetch.mock.calls[1]?.[1]?.body));
    expect(firstBody.response_format?.type).toBe('json_schema');
    expect(secondBody.response_format).toBeUndefined();
    expect(result.message).toBe('Ready after fallback');
  });

  it('retries transient stream setup failures from openai-compatible providers before yielding chunks', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        json: async () => ({ error: { message: 'upstream busy' } }),
      })
      .mockResolvedValueOnce(
        createSseResponse([
          'data: {"choices":[{"delta":{"content":"Hello after retry"}}]}\n',
          'data: [DONE]\n',
        ]),
      );

    const events: StreamEvent[] = [];
    for await (const event of service.streamOpenAiCompatible(
      {
        provider: 'openrouter',
        model: 'openai/gpt-4o-mini',
        apiKey: 'sk-test',
        baseUrl: 'https://openrouter.ai/api/v1',
      },
      {
        prompt: 'Summarize this schema',
        schemaContext: 'TABLE users(id uuid)',
        databaseType: 'postgres',
      },
      'auto',
      structuredDbDecision,
    )) {
      events.push(event);
    }

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(events[0]).toEqual({ type: 'chunk', text: 'Hello after retry' });
    expect(events[1]).toEqual({
      type: 'done',
      data: {
        message: 'Hello after retry',
        provider: 'openrouter',
        model: 'openai/gpt-4o-mini',
        routingMode: 'auto',
        recommendations: undefined,
        sources: undefined,
        sql: undefined,
        explanation: undefined,
      },
    });
  });

  it('preserves SSE JSON lines split across network chunks', async () => {
    const response = createSseResponse([
      'data: {"choices":[{"delta"',
      ':{"content":"Hello"}}]}\n',
      'data: [DONE]\n',
    ]);
    const streamFetch = (
      service as unknown as {
        streamFetch: (
          response: Response,
          abortController: { clear: () => void; signal: AbortSignal },
          model: string,
          provider: string,
          routingMode: AiRoutingMode,
        ) => AsyncGenerator<StreamEvent>;
      }
    ).streamFetch.bind(service);

    const events: StreamEvent[] = [];
    for await (const event of streamFetch(
      response,
      { clear: jest.fn(), signal: new AbortController().signal },
      'test-model',
      'openrouter',
      'auto',
    )) {
      events.push(event);
    }

    expect(events[0]).toEqual({ type: 'chunk', text: 'Hello' });
    expect(events[1]).toEqual({
      type: 'done',
      data: {
        message: 'Hello',
        provider: 'openrouter',
        model: 'test-model',
        routingMode: 'auto',
        recommendations: undefined,
        sources: undefined,
        sql: undefined,
        explanation: undefined,
      },
    });
  });

  it('appends structured sources to the visible message for openai-compatible responses', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content:
                '{"message":"Latest market snapshot","sources":["https://example.com/news"]}',
            },
          },
        ],
      }),
    });

    const result = await service.runOpenAiCompatible(
      {
        provider: 'openrouter',
        model: 'openai/gpt-4o-mini',
        apiKey: 'sk-test',
        baseUrl: 'https://openrouter.ai/api/v1',
      },
      {
        prompt: 'What is the latest market snapshot?',
      },
      'auto',
      {
        preferGemini: false,
        complexityScore: 0,
        reasons: ['current-info'],
        needsLiveSearch: true,
        responseFormat: 'chat',
      },
    );

    expect(result.sources).toEqual(['https://example.com/news']);
    expect(result.message).toContain('Latest market snapshot');
    expect(result.message).toContain('[https://example.com/news](https://example.com/news)');
  });

  it('rejects empty structured responses from openai-compatible completion lanes', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: '{"message":"","sql":"","explanation":""}',
            },
          },
        ],
      }),
    });

    await expect(
      service.runOpenAiCompatible(
        {
          provider: 'openrouter',
          model: 'openai/gpt-4o-mini',
          apiKey: 'sk-test',
          baseUrl: 'https://openrouter.ai/api/v1',
        },
        {
          prompt: 'List user tables',
          schemaContext: 'TABLE: users',
          databaseType: 'postgres',
        },
        'auto',
        structuredDbDecision,
      ),
    ).rejects.toThrow('empty structured response');
  });

  it('rejects empty structured responses from openai-compatible stream lanes', async () => {
    const payload = JSON.stringify({
      choices: [
        {
          delta: {
            content: '{"message":"","sql":"","explanation":""}',
          },
        },
      ],
    });
    const response = createSseResponse([`data: ${payload}\n`, 'data: [DONE]\n']);
    const streamFetch = (
      service as unknown as {
        streamFetch: (
          response: Response,
          abortController: { clear: () => void; signal: AbortSignal },
          model: string,
          provider: string,
          routingMode: AiRoutingMode,
        ) => AsyncGenerator<StreamEvent>;
      }
    ).streamFetch.bind(service);

    await expect(
      (async () => {
        for await (const _event of streamFetch(
          response,
          { clear: jest.fn(), signal: new AbortController().signal },
          'test-model',
          'openrouter',
          'auto',
        )) {
          // drain stream
        }
      })(),
    ).rejects.toThrow('empty structured response');
  });

  it('passes provider-level structured output config to Gemini for structured requests', async () => {
    const generateContent = jest.fn().mockResolvedValue({
      response: {
        text: () => '{"message":"Gemini ready"}',
      },
    });
    const getGenerativeModel = jest.fn(() => ({
      generateContent,
    }));
    (
      service as unknown as {
        genAI: { getGenerativeModel: typeof getGenerativeModel };
      }
    ).genAI = {
      getGenerativeModel,
    };

    const result = await service.runGemini(
      {
        provider: 'gemini',
        model: 'gemini-2.5-flash',
      },
      {
        prompt: 'List user tables',
        schemaContext: 'TABLE users(id uuid)',
        databaseType: 'postgres',
      },
      'auto',
      structuredDbDecision,
    );

    const call = generateContent.mock.calls[0]?.[0];
    expect(call?.generationConfig?.responseMimeType).toBe('application/json');
    expect(call?.generationConfig?.responseSchema?.type).toBe('object');
    expect(call?.generationConfig?.responseSchema?.properties?.message?.type).toBe(
      'string',
    );
    expect(result.message).toBe('Gemini ready');
  });
});
