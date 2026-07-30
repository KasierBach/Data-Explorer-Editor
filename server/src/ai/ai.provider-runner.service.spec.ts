import { ConfigService } from '@nestjs/config';
import { AiPromptBuilderService } from './ai.prompt-builder.service';
import { AiProviderRunnerService } from './ai.provider-runner.service';
import type { AiRoutingMode, RouteDecision, StreamEvent } from './ai.types';
import { validateExternalUrl } from '../common/utils/ssrf-validator.util';

jest.mock('../common/utils/ssrf-validator.util', () => ({
  validateExternalUrl: jest.fn(),
}));

const validateExternalUrlMock = validateExternalUrl as jest.MockedFunction<
  typeof validateExternalUrl
>;

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
  const liveSearchDecision: RouteDecision = {
    preferGemini: false,
    complexityScore: 0,
    reasons: ['current-info'],
    needsLiveSearch: true,
    responseFormat: 'chat',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    validateExternalUrlMock.mockResolvedValue(true);
    mockFetch.mockReset();
    (globalThis as { fetch?: typeof fetch }).fetch =
      mockFetch as unknown as typeof fetch;
    service = new AiProviderRunnerService(
      { get: jest.fn(() => undefined) } as unknown as ConfigService,
      new AiPromptBuilderService(),
    );
  });

  it('blocks unsafe openai-compatible URLs before sending credentials', async () => {
    validateExternalUrlMock.mockResolvedValueOnce(false);

    await expect(
      service.runOpenAiCompatible(
        {
          provider: 'custom',
          model: 'test-model',
          apiKey: 'sk-sensitive',
          baseUrl: 'http://127.0.0.1:3000/v1',
        },
        { prompt: 'hello' },
        'auto',
        structuredDbDecision,
      ),
    ).rejects.toThrow('Unsafe provider URL');

    expect(mockFetch).not.toHaveBeenCalled();
  });
  it('uses OpenRouter web and free PDF tools without silently retrying offline', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({ error: { message: 'search rejected' } }),
    });

    await expect(
      service.runOpenAiCompatible(
        {
          provider: 'openrouter',
          model: 'google/gemma-4-31b-it:free',
          apiKey: 'sk-test',
          baseUrl: 'https://openrouter.ai/api/v1',
        },
        {
          prompt: 'What is the latest PostgreSQL news?',
          document: {
            name: 'schema.pdf',
            mimeType: 'application/pdf',
            data: 'data:application/pdf;base64,aGVsbG8=',
          },
        },
        'auto',
        liveSearchDecision,
      ),
    ).rejects.toThrow('openrouter error (400)');

    const body = JSON.parse(String(mockFetch.mock.calls[0]?.[1]?.body));
    expect(body.model).toBe('google/gemma-4-31b-it:free');
    expect(body.tools).toEqual([{ type: 'openrouter:web_search' }]);
    expect(body.plugins).toEqual([
      { id: 'file-parser', pdf: { engine: 'cloudflare-ai' } },
    ]);
    expect(body.max_tokens).toBe(12_288);
    expect(body.messages.at(-1)?.content).toEqual(
      expect.arrayContaining([
        {
          type: 'file',
          file: {
            filename: 'schema.pdf',
            file_data: 'data:application/pdf;base64,aGVsbG8=',
          },
        },
      ]),
    );
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('enables Groq Compound web search for streaming requests', async () => {
    mockFetch.mockResolvedValue(
      createSseResponse([
        'data: {"choices":[{"delta":{"content":"Current result"}}]}\n',
        'data: [DONE]\n',
      ]),
    );

    for await (const _event of service.streamOpenAiCompatible(
      {
        provider: 'groq',
        model: 'groq/compound',
        apiKey: 'gsk-test',
        baseUrl: 'https://api.groq.com/openai/v1',
      },
      { prompt: 'What is the latest PostgreSQL news?' },
      'auto',
      liveSearchDecision,
    )) {
      // drain stream
    }

    const body = JSON.parse(String(mockFetch.mock.calls[0]?.[1]?.body));
    expect(body.compound_custom).toBeUndefined();
    expect(body.max_tokens).toBe(4_096);
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

  it('retries transient openai-compatible text completion failures before returning plain text', async () => {
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
                content: '  Ready after completion retry  ',
              },
            },
          ],
        }),
      });

    const result = await service.completeOpenAiCompatibleText(
      {
        provider: 'openrouter',
        model: 'openai/gpt-4o-mini',
        apiKey: 'sk-test',
        baseUrl: 'https://openrouter.ai/api/v1',
      },
      {
        systemPrompt: 'You are concise.',
        prompt: 'Return a short answer',
      },
    );

    expect(result).toBe('Ready after completion retry');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('does not include provider error payloads in thrown errors', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({ error: { message: 'Bearer sk-sensitive-token' } }),
    });

    let thrown: unknown;
    try {
      await service.runOpenAiCompatible(
        {
          provider: 'custom',
          model: 'test-model',
          apiKey: 'sk-sensitive-token',
          baseUrl: 'https://provider.example/v1',
        },
        { prompt: 'hello' },
        'auto',
        structuredDbDecision,
      );
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toHaveProperty('message', 'custom error (401)');
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

  it('retries transient Gemini completion failures before returning text', async () => {
    const generateContent = jest
      .fn()
      .mockRejectedValueOnce(
        new Error('Gemini completion (gemini-test) timed out after 100ms'),
      )
      .mockResolvedValueOnce({
        text: 'Gemini retry succeeded',
      });
    (
      service as unknown as {
        genAI: { models: { generateContent: jest.Mock } };
      }
    ).genAI = {
      models: { generateContent },
    };

    const result = await service.completeGeminiText({
      model: 'gemini-test',
      prompt: 'hello',
      timeoutMs: 100,
    });

    expect(result).toBe('Gemini retry succeeded');
    expect(generateContent).toHaveBeenCalledTimes(2);
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
    expect(events[1]).toMatchObject({
      type: 'done',
      data: {
        message: 'Hello after retry',
        provider: 'openrouter',
        providerLabel: 'openrouter',
        model: 'openai/gpt-4o-mini',
        routingMode: 'auto',
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
          providerLabel: string,
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
      'openrouter',
      'auto',
    )) {
      events.push(event);
    }

    expect(events[0]).toEqual({ type: 'chunk', text: 'Hello' });
    expect(events[1]).toMatchObject({
      type: 'done',
      data: {
        message: 'Hello',
        provider: 'openrouter',
        providerLabel: 'openrouter',
        model: 'test-model',
        routingMode: 'auto',
      },
    });
  });

  it('preserves provider citations from openai-compatible streams', async () => {
    const payload = JSON.stringify({
      choices: [
        {
          delta: {
            content: 'Grounded stream',
            annotations: [
              {
                url_citation: { url: 'https://example.com/stream' },
              },
            ],
          },
        },
      ],
    });
    mockFetch.mockResolvedValue(
      createSseResponse(['data: ' + payload + '\n', 'data: [DONE]\n']),
    );

    const events: StreamEvent[] = [];
    for await (const event of service.streamOpenAiCompatible(
      {
        provider: 'openrouter',
        model: 'google/gemma-4-26b-a4b-it:free',
        apiKey: 'sk-test',
        baseUrl: 'https://openrouter.ai/api/v1',
      },
      { prompt: 'Search for current data' },
      'auto',
      liveSearchDecision,
    )) {
      events.push(event);
    }

    expect(events.at(-1)).toMatchObject({
      type: 'done',
      data: {
        sources: ['https://example.com/stream'],
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
    expect(result.message).toContain(
      '[https://example.com/news](https://example.com/news)',
    );
  });

  it('extracts citations and tool search results from provider metadata', () => {
    const extractOpenAiSources = (
      service as unknown as {
        extractOpenAiSources: (payload: unknown) => string[];
      }
    ).extractOpenAiSources.bind(service);

    expect(
      extractOpenAiSources({
        choices: [
          {
            message: {
              annotations: [
                {
                  url_citation: { url: 'https://example.com/citation' },
                },
              ],
              executed_tools: [
                {
                  arguments: JSON.stringify({
                    url: 'https://example.com/visited',
                  }),
                  search_results: {
                    results: [{ url: 'https://example.com/search' }],
                  },
                },
              ],
            },
          },
        ],
      }),
    ).toEqual([
      'https://example.com/citation',
      'https://example.com/search',
      'https://example.com/visited',
    ]);
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
    const response = createSseResponse([
      `data: ${payload}\n`,
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

  it('streams Gemini through the new SDK and preserves grounded sources', async () => {
    const generateContentStream = jest.fn().mockResolvedValue(
      (async function* () {
        yield {
          text: 'Gemini ',
          candidates: [
            {
              groundingMetadata: {
                groundingChunks: [
                  {
                    web: {
                      title: 'Gemini docs',
                      uri: 'https://ai.google.dev/gemini-api/docs',
                    },
                  },
                ],
              },
            },
          ],
        };
        yield { text: 'ready' };
      })(),
    );
    (
      service as unknown as {
        genAI: { models: { generateContentStream: jest.Mock } };
      }
    ).genAI = {
      models: { generateContentStream },
    };

    const events: StreamEvent[] = [];
    for await (const event of service.streamGemini(
      {
        provider: 'gemini',
        model: 'gemini-3.5-flash',
      },
      { prompt: 'Latest Gemini docs?' },
      'auto',
      liveSearchDecision,
    )) {
      events.push(event);
    }

    const call = generateContentStream.mock.calls[0]?.[0];
    expect(call?.config?.tools).toEqual([{ googleSearch: {} }]);
    expect(events.filter((event) => event.type === 'chunk')).toEqual([
      { type: 'chunk', text: 'Gemini ' },
      { type: 'chunk', text: 'ready' },
    ]);
    expect(events.at(-1)).toMatchObject({
      type: 'done',
      data: {
        sources: ['https://ai.google.dev/gemini-api/docs'],
      },
    });
  });

  it('passes provider-level structured output config to Gemini for structured requests', async () => {
    const generateContent = jest.fn().mockResolvedValue({
      text: '{"message":"Gemini ready"}',
    });
    (
      service as unknown as {
        genAI: { models: { generateContent: typeof generateContent } };
      }
    ).genAI = {
      models: { generateContent },
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
    expect(call?.config?.responseMimeType).toBe('application/json');
    expect(call?.config?.responseJsonSchema?.type).toBe('object');
    expect(call?.config?.responseJsonSchema?.properties?.message?.type).toBe(
      'string',
    );
    expect(result.message).toBe('Gemini ready');
  });
  it.each([
    [429, 'temporarily rate limited'],
    [402, 'requires provider credits'],
    [404, 'is unavailable'],
  ])(
    'returns a safe actionable message for provider status %s',
    async (status, expected) => {
      mockFetch.mockResolvedValue({
        ok: false,
        status,
        statusText: 'Provider failure',
        json: async () => ({
          error: { message: 'sk-sensitive-provider-payload' },
        }),
      });

      await expect(
        service.runOpenAiCompatible(
          {
            provider: 'openrouter',
            model: 'test-model',
            apiKey: 'sk-sensitive',
            baseUrl: 'https://openrouter.ai/api/v1',
          },
          { prompt: 'hello' },
          'auto',
          structuredDbDecision,
        ),
      ).rejects.toThrow(expected);
    },
  );
});
