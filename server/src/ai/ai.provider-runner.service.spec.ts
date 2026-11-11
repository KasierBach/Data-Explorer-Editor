import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { AI_CONSTANTS } from './ai.constants';
import { AiPromptBuilderService } from './ai.prompt-builder.service';
import { AiProviderRunnerService } from './ai.provider-runner.service';
import { AiRequestStoppedError } from './ai-request-lifecycle';
import { AiGeminiProviderError } from './ai-gemini-transport';
import type {
  AiRoutingMode,
  ChatHistoryMessage,
  ChatParams,
  RouteDecision,
  StreamEvent,
} from './ai.types';
import {
  fetchAiProvider,
  readAiProviderJson,
  validateAiProviderUrl,
} from './ai-provider-transport';

jest.mock('@google/genai', () => ({
  ...jest.requireActual('@google/genai'),
  GoogleGenAI: jest.fn(),
}));

jest.mock('./ai-provider-transport', () => ({
  ...jest.requireActual('./ai-provider-transport'),
  fetchAiProvider: jest.fn(),
  readAiProviderJson: jest.fn(),
  validateAiProviderUrl: jest.fn(),
}));

const validateAiProviderUrlMock = jest.mocked(validateAiProviderUrl);
const readAiProviderJsonMock = jest.mocked(readAiProviderJson);

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
  const mockFetch = fetchAiProvider as jest.Mock;
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
    validateAiProviderUrlMock.mockImplementation((url) => new URL(url));
    readAiProviderJsonMock.mockImplementation(async (response) =>
      response.json(),
    );
    mockFetch.mockReset();
    service = new AiProviderRunnerService(
      { get: jest.fn(() => undefined) } as unknown as ConfigService,
      new AiPromptBuilderService(),
    );
  });

  describe('Beeknoee model identity contract', () => {
    const models = [
      'bee/gemini-3.8-flash',
      'bee-tok/claude-sonnet-5-5',
      'gemini-3.1-pro-preview',
      'claude-sonnet-4-6',
      'bee-tok/claude-opus-5-5',
      'bee/gemini-4-argon',
      'claude-opus-4-6',
      'claude-opus-4-6-thinking',
    ];
    it.each(models)(
      'sends the exact %s API ID in a non-stream request',
      async (model) => {
        const complete = jest.fn().mockResolvedValue(undefined);
        const fail = jest.fn().mockResolvedValue(undefined);
        const beforeAttempt = jest
          .fn()
          .mockResolvedValue({ attemptId: 'fixture-attempt', complete, fail });
        mockFetch.mockResolvedValue(
          new Response(
            JSON.stringify({
              model,
              choices: [
                {
                  message: { content: '{"message":"Fixture ready"}' },
                  finish_reason: 'stop',
                },
              ],
              usage: {
                prompt_tokens: 2,
                completion_tokens: 3,
                total_tokens: 5,
              },
            }),
          ),
        );
        const result = await service.runOpenAiCompatible(
          {
            provider: 'beeknoee',
            model,
            apiKey: 'fixture-key',
            baseUrl: 'https://platform.beeknoee.com/api/v1',
          },
          {
            prompt: 'Hello',
            execution: { generationId: 'fixture-generation', beforeAttempt },
          },
          'auto',
          structuredDbDecision,
        );
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(mockFetch.mock.calls[0][0]).toBe(
          'https://platform.beeknoee.com/api/v1/chat/completions',
        );
        expect(
          JSON.parse(String(mockFetch.mock.calls[0][1].body)),
        ).toMatchObject({ model });
        expect(result).toMatchObject({
          provider: 'beeknoee',
          model,
          providerReportedModel: model,
          contractVersion: 1,
          usage: { promptTokens: 2, completionTokens: 3, totalTokens: 5 },
        });
        expect(
          (result as { providerReportedModel?: string }).providerReportedModel,
        ).toBe(model);
        expect(beforeAttempt).toHaveBeenCalledWith({
          provider: 'beeknoee',
          model,
        });
        expect(complete).toHaveBeenCalledWith(
          expect.objectContaining({ provider: 'beeknoee', model }),
        );
        expect(fail).not.toHaveBeenCalled();
      },
    );
    it.each(models)(
      'preserves %s identity through a terminal stream',
      async (model) => {
        mockFetch.mockResolvedValue(
          createSseResponse([
            `data: ${JSON.stringify({ model, choices: [{ delta: { content: '{"message":"Fixture streamed"}' } }] })}\n\n`,
            `data: ${JSON.stringify({ model, choices: [{ delta: {}, finish_reason: 'stop' }] })}\n\n`,
            'data: [DONE]\n\n',
          ]),
        );
        const events: StreamEvent[] = [];
        for await (const event of service.streamOpenAiCompatible(
          {
            provider: 'beeknoee',
            model,
            apiKey: 'fixture-key',
            baseUrl: 'https://platform.beeknoee.com/api/v1',
          },
          { prompt: 'Hello' },
          'auto',
          structuredDbDecision,
        ))
          events.push(event);
        expect(
          JSON.parse(String(mockFetch.mock.calls[0][1].body)),
        ).toMatchObject({ model, stream: true });
        expect(events.find((event) => event.type === 'done')).toMatchObject({
          type: 'done',
          data: {
            provider: 'beeknoee',
            model,
            providerReportedModel: model,
            message: 'Fixture streamed',
          },
        });
        expect(events.some((event) => event.type === 'error')).toBe(false);
      },
    );
    it('refuses conflicting provider-reported model identities in one stream', async () => {
      mockFetch.mockResolvedValue(
        createSseResponse([
          'data: {"model":"bee/first","choices":[{"delta":{"content":"{\\"message\\":\\"partial"}}]}\n\n',
          'data: {"model":"bee/second","choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
          'data: [DONE]\n\n',
        ]),
      );
      const stream = service.streamOpenAiCompatible(
        {
          provider: 'beeknoee',
          model: 'bee/first',
          apiKey: 'fixture-key',
          baseUrl: 'https://platform.beeknoee.com/api/v1',
        },
        { prompt: 'Hello' },
        'auto',
        structuredDbDecision,
      );
      await expect(async () => {
        for await (const _event of stream) void _event;
      }).rejects.toThrow(/provider-reported model identity/i);
    });
  });

  describe('bounded retry reliability', () => {
    afterEach(() => {
      jest.useRealTimers();
      jest.restoreAllMocks();
    });
    const retryPlan = {
      provider: 'custom' as const,
      model: 'fixture',
      apiKey: 'fixture-key',
      baseUrl: 'https://fixture.example/v1',
    };
    const flushRetry = async () => {
      for (let index = 0; index < 60; index++) await Promise.resolve();
    };

    it('honors Retry-After as a minimum and preserves fresh policy on the next attempt', async () => {
      jest.useFakeTimers();
      const beforeProviderRequest = jest.fn();
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          headers: new Headers({ 'retry-after': '2' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ choices: [{ message: { content: 'Ready' } }] }),
        });
      const pending = service.completeOpenAiCompatibleText(retryPlan, {
        prompt: 'Hello',
        systemPrompt: 'Be concise',
        beforeProviderRequest,
      });
      await flushRetry();
      await jest.advanceTimersByTimeAsync(1999);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(beforeProviderRequest).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(1);
      expect(await pending).toBe('Ready');
      expect(beforeProviderRequest).toHaveBeenCalledTimes(2);
    });

    it('does not retry early when Retry-After exceeds the remaining request deadline', async () => {
      jest.useFakeTimers();
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        headers: new Headers({ 'retry-after': '2' }),
      });
      const pending = service
        .completeOpenAiCompatibleText(retryPlan, {
          prompt: 'Hello',
          systemPrompt: 'Be concise',
          deadlineAt: Date.now() + 1000,
        })
        .catch((error) => error);
      await flushRetry();
      await jest.advanceTimersByTimeAsync(1000);
      expect(await pending).toMatchObject({ code: 'AI_RETRY_DEFERRED' });
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(jest.getTimerCount()).toBe(0);
    });

    it.each([401, 403, 422])(
      'does not retry explicit terminal HTTP %s because its error mentions network',
      async (status) => {
        const error = Object.assign(new Error('network unavailable'), {
          status,
        });
        mockFetch.mockRejectedValue(error);
        await expect(
          service.completeOpenAiCompatibleText(retryPlan, {
            prompt: 'Hello',
            systemPrompt: 'Be concise',
          }),
        ).rejects.toBe(error);
        expect(mockFetch).toHaveBeenCalledTimes(1);
      },
    );

    it('keeps one three-attempt budget across Gemini schema fallback', async () => {
      jest.useFakeTimers();
      const generateContent = jest
        .fn()
        .mockRejectedValueOnce(new Error('network unavailable'))
        .mockRejectedValueOnce(
          new AiGeminiProviderError('GEMINI_HTTP', {
            status: 400,
            schemaUnsupported: true,
          }),
        )
        .mockRejectedValueOnce(new Error('network unavailable'))
        .mockResolvedValue({ text: '{"message":"Unexpected fourth attempt"}' });
      (
        service as unknown as {
          genAI: { models: { generateContent: jest.Mock } };
        }
      ).genAI = { models: { generateContent } };
      const pending = service
        .runGemini(
          { provider: 'gemini', model: 'fixture' },
          { prompt: 'Hello' },
          'auto',
          structuredDbDecision,
        )
        .catch((error) => error);
      await jest.runAllTimersAsync();
      expect(await pending).toHaveProperty('message', 'network unavailable');
      expect(generateContent).toHaveBeenCalledTimes(3);
    });

    it('cancels a Retry-After wait without another policy, ledger or provider attempt', async () => {
      jest.useFakeTimers();
      const controller = new AbortController();
      const beforeProviderRequest = jest.fn();
      const complete = jest.fn();
      const fail = jest.fn();
      const beforeAttempt = jest
        .fn()
        .mockResolvedValue({ attemptId: 'retry-attempt', complete, fail });
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        headers: new Headers({ 'retry-after': '2' }),
      });
      const pending = service
        .completeOpenAiCompatibleText(retryPlan, {
          prompt: 'Hello',
          systemPrompt: 'Be concise',
          signal: controller.signal,
          beforeProviderRequest,
          execution: { generationId: 'retry-generation', beforeAttempt },
        })
        .catch((error) => error);
      await flushRetry();
      controller.abort(new AiRequestStoppedError('AI_REQUEST_CANCELLED'));
      expect(await pending).toMatchObject({ reason: 'AI_REQUEST_CANCELLED' });
      await jest.advanceTimersByTimeAsync(3000);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(beforeProviderRequest).toHaveBeenCalledTimes(1);
      expect(beforeAttempt).toHaveBeenCalledTimes(1);
      expect(fail).toHaveBeenCalledTimes(1);
      expect(complete).not.toHaveBeenCalled();
      expect(jest.getTimerCount()).toBe(0);
    });

    it.each(['chat', 'stream'])(
      'retains the shared three-attempt budget through compatible schema fallback: %s',
      async (lane) => {
        jest.useFakeTimers();
        mockFetch
          .mockResolvedValueOnce({ ok: false, status: 503 })
          .mockResolvedValueOnce({
            ok: false,
            status: 400,
            json: async () => ({
              error: { message: 'response_format unsupported' },
            }),
          })
          .mockResolvedValueOnce({ ok: false, status: 503 })
          .mockResolvedValue({
            ok: true,
            json: async () => ({
              choices: [
                {
                  message: {
                    content: '{"message":"Unexpected fourth attempt"}',
                  },
                },
              ],
            }),
          });
        const pending = (
          lane === 'chat'
            ? service.runOpenAiCompatible(
                retryPlan,
                { prompt: 'Hello' },
                'auto',
                structuredDbDecision,
              )
            : service
                .streamOpenAiCompatible(
                  retryPlan,
                  { prompt: 'Hello' },
                  'auto',
                  structuredDbDecision,
                )
                .next()
        ).catch((error) => error);
        await jest.runAllTimersAsync();
        expect(await pending).toMatchObject({ status: 503 });
        expect(mockFetch).toHaveBeenCalledTimes(3);
      },
    );

    it('uses the same three-attempt budget across Gemini model compatibility fallback', async () => {
      jest.useFakeTimers();
      const generateContent = jest
        .fn()
        .mockRejectedValueOnce(new Error('network unavailable'))
        .mockRejectedValueOnce(
          new AiGeminiProviderError('GEMINI_HTTP', { status: 404 }),
        )
        .mockRejectedValueOnce(new Error('network unavailable'))
        .mockResolvedValue({ text: 'Unexpected fourth attempt' });
      (
        service as unknown as {
          genAI: { models: { generateContent: jest.Mock } };
        }
      ).genAI = { models: { generateContent } };
      const pending = service
        .completeGeminiText({ model: 'fixture', prompt: 'Hello' })
        .catch((error) => error);
      await jest.runAllTimersAsync();
      expect(await pending).toHaveProperty('message', 'network unavailable');
      expect(generateContent).toHaveBeenCalledTimes(3);
      expect(generateContent.mock.calls[2][0].model).toBe(
        'gemini-3.5-flash-lite',
      );
    });

    it('honors normalized Gemini Retry-After without starting a replacement request early', async () => {
      jest.useFakeTimers();
      const generateContent = jest
        .fn()
        .mockRejectedValueOnce(
          new AiGeminiProviderError('GEMINI_HTTP', {
            status: 429,
            retryAfterMs: 2000,
          }),
        )
        .mockResolvedValue({ text: 'Ready' });
      (
        service as unknown as {
          genAI: { models: { generateContent: jest.Mock } };
        }
      ).genAI = { models: { generateContent } };
      const pending = service.completeGeminiText({
        model: 'fixture',
        prompt: 'Hello',
      });
      await flushRetry();
      await jest.advanceTimersByTimeAsync(1999);
      expect(generateContent).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(1);
      expect(await pending).toBe('Ready');
      expect(generateContent).toHaveBeenCalledTimes(2);
    });

    it('keeps error-body limits terminal even when HTTP status is transient', async () => {
      const { AiProviderTransportError } = jest.requireActual<
        typeof import('./ai-provider-transport')
      >('./ai-provider-transport');
      mockFetch.mockResolvedValue({ ok: false, status: 503 });
      readAiProviderJsonMock.mockRejectedValueOnce(
        new AiProviderTransportError(
          'LIMIT_EXCEEDED',
          'Provider response is too large',
        ),
      );
      await expect(
        service.runOpenAiCompatible(
          retryPlan,
          { prompt: 'Hello' },
          'auto',
          structuredDbDecision,
        ),
      ).rejects.toMatchObject({ code: 'LIMIT_EXCEEDED' });
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('rejects streaming refusal before forwarding blocked text', async () => {
      mockFetch.mockResolvedValue(
        createSseResponse([
          'data: {"choices":[{"delta":{"content":"Forbidden answer","refusal":"Blocked"},"finish_reason":"content_filter"}]}\n',
          'data: [DONE]\n',
        ]),
      );
      await expect(
        service
          .streamOpenAiCompatible(
            retryPlan,
            { prompt: 'Hello' },
            'auto',
            liveSearchDecision,
          )
          .next(),
      ).rejects.toMatchObject({ code: 'AI_PROVIDER_REFUSED' });
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('rejects compatible refusal before treating valid-looking JSON as an answer', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: '{"message":"Forged allowed answer"}',
                refusal: 'Not allowed',
              },
              finish_reason: 'content_filter',
            },
          ],
        }),
      });
      await expect(
        service.runOpenAiCompatible(
          retryPlan,
          { prompt: 'Hello' },
          'auto',
          structuredDbDecision,
        ),
      ).rejects.toMatchObject({ code: 'AI_PROVIDER_REFUSED' });
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  it.each(['chat', 'completion', 'stream'])(
    'routes configured Gemini %s through pinned transport, never SDK networking',
    async (lane) => {
      const sdkCall = jest
        .fn()
        .mockRejectedValue(new Error('Direct SDK networking is forbidden'));
      jest.mocked(GoogleGenAI).mockImplementation(
        () =>
          ({
            models: {
              generateContent: sdkCall,
              generateContentStream: sdkCall,
            },
          }) as unknown as GoogleGenAI,
      );
      const configured = new AiProviderRunnerService(
        {
          get: (key: string) =>
            key === 'GEMINI_API_KEY' ? 'fixture-key' : undefined,
        } as ConfigService,
        new AiPromptBuilderService(),
      );
      const reply = {
        candidates: [
          {
            index: 0,
            content: { role: 'model', parts: [{ text: 'Ready' }] },
            finishReason: 'STOP',
          },
        ],
        usageMetadata: {
          promptTokenCount: 3,
          candidatesTokenCount: 2,
          totalTokenCount: 5,
        },
      };
      mockFetch.mockResolvedValue(
        lane === 'stream'
          ? new Response(`data: ${JSON.stringify(reply)}\n\n`, {
              headers: { 'content-type': 'text/event-stream' },
            })
          : new Response(JSON.stringify(reply), {
              headers: { 'content-type': 'application/json' },
            }),
      );
      if (lane === 'chat')
        await expect(
          configured.runGemini(
            { provider: 'gemini', model: 'gemini-fixture' },
            { prompt: 'Hello' },
            'auto',
            liveSearchDecision,
          ),
        ).resolves.toMatchObject({ message: expect.stringContaining('Ready') });
      else if (lane === 'completion')
        await expect(
          configured.completeGeminiText({
            model: 'gemini-fixture',
            prompt: 'Hello',
          }),
        ).resolves.toBe('Ready');
      else {
        const events: StreamEvent[] = [];
        for await (const event of configured.streamGemini(
          { provider: 'gemini', model: 'gemini-fixture' },
          { prompt: 'Hello' },
          'auto',
          liveSearchDecision,
        ))
          events.push(event);
        expect(events.at(-1)).toMatchObject({
          type: 'done',
          data: { message: expect.stringContaining('Ready') },
        });
      }
      expect(sdkCall).not.toHaveBeenCalled();
      expect(GoogleGenAI).not.toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch.mock.calls[0]?.[0]).toMatch(
        /^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-fixture:/,
      );
    },
  );

  it('does not carry failed bootstrap usage into a successful Gemini stream retry', async () => {
    jest.useFakeTimers();
    try {
      const handles: Array<{ complete: jest.Mock; fail: jest.Mock }> = [];
      const execution = {
        generationId: 'generation-fixture',
        beforeAttempt: jest.fn(async () => {
          const handle = {
            attemptId: `attempt-${handles.length + 1}`,
            complete: jest.fn(),
            fail: jest.fn(),
          };
          handles.push(handle);
          return handle;
        }),
      };
      const generateContentStream = jest
        .fn()
        .mockRejectedValueOnce(
          new AiGeminiProviderError('GEMINI_HTTP', {
            status: 503,
            usageMetadata: { promptTokenCount: 9 },
          }),
        )
        .mockResolvedValueOnce(
          (async function* () {
            yield { text: 'Ready after retry' };
          })(),
        );
      (
        service as unknown as {
          genAI: { models: { generateContentStream: jest.Mock } };
        }
      ).genAI = { models: { generateContentStream } };
      const pending = (async () => {
        const values: StreamEvent[] = [];
        for await (const value of service.streamGemini(
          { provider: 'gemini', model: 'gemini-fixture' },
          { prompt: 'Hello', execution },
          'auto',
          liveSearchDecision,
        ))
          values.push(value);
        return values;
      })();
      for (let index = 0; index < 60; index++) await Promise.resolve();
      await jest.advanceTimersByTimeAsync(
        AI_CONSTANTS.OPENAI_COMPATIBLE_RETRY_BASE_DELAY_MS,
      );
      expect((await pending).at(-1)).toMatchObject({ type: 'done' });
      expect(handles).toHaveLength(2);
      expect(handles[0].fail).toHaveBeenCalledWith('failed', {
        provider: 'gemini',
        model: 'gemini-fixture',
        usage: { promptTokens: 9 },
      });
      expect(handles[1].complete).toHaveBeenCalledWith({
        provider: 'gemini',
        model: 'gemini-fixture',
        usage: undefined,
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('preserves partial Gemini error usage in a single failed tracked attempt', async () => {
    const fail = jest.fn();
    const complete = jest.fn();
    const beforeAttempt = jest
      .fn()
      .mockResolvedValue({ attemptId: 'attempt-fixture', fail, complete });
    const generateContent = jest.fn().mockRejectedValue(
      new AiGeminiProviderError('GEMINI_BLOCKED', {
        usageMetadata: { promptTokenCount: 4 },
      }),
    );
    (
      service as unknown as {
        genAI: { models: { generateContent: jest.Mock } };
      }
    ).genAI = { models: { generateContent } };
    await expect(
      service.completeGeminiText({
        model: 'gemini-fixture',
        prompt: 'Hello',
        execution: { generationId: 'generation-fixture', beforeAttempt },
      }),
    ).rejects.toMatchObject({ code: 'GEMINI_BLOCKED' });
    expect(beforeAttempt).toHaveBeenCalledTimes(1);
    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(complete).not.toHaveBeenCalled();
    expect(fail).toHaveBeenCalledWith('failed', {
      provider: 'gemini',
      model: 'gemini-fixture',
      usage: { promptTokens: 4 },
    });
  });

  it.each(['chat', 'completion', 'stream'])(
    'denies Gemini at post-DNS transport boundary without a second ledger reservation: %s',
    async (lane) => {
      const denied = new Error('Recipient revoked after DNS');
      const beforeProviderAttempt = jest
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValue(denied);
      const beforeProviderRequest = jest.fn().mockResolvedValue(undefined);
      const fail = jest.fn();
      const complete = jest.fn();
      const beforeAttempt = jest
        .fn()
        .mockResolvedValue({ attemptId: 'attempt-fixture', fail, complete });
      const configured = new AiProviderRunnerService(
        {
          get: (key: string) =>
            key === 'GEMINI_API_KEY' ? 'fixture-key' : undefined,
        } as ConfigService,
        new AiPromptBuilderService(),
      );
      mockFetch.mockImplementationOnce(async (_url, _init, options) => {
        await options.beforeDispatch();
        throw new Error('Cannot dispatch after denial');
      });
      const params = {
        prompt: 'Hello',
        beforeProviderAttempt,
        beforeProviderRequest,
        execution: { generationId: 'generation-fixture', beforeAttempt },
      };
      const pending =
        lane === 'chat'
          ? configured.runGemini(
              { provider: 'gemini', model: 'gemini-fixture' },
              params,
              'auto',
              liveSearchDecision,
            )
          : lane === 'completion'
            ? configured.completeGeminiText({
                ...params,
                model: 'gemini-fixture',
              })
            : configured
                .streamGemini(
                  { provider: 'gemini', model: 'gemini-fixture' },
                  params,
                  'auto',
                  liveSearchDecision,
                )
                .next();
      await expect(pending).rejects.toMatchObject({
        aiRequestFatal: true,
        cause: denied,
      });
      expect(beforeAttempt).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(fail).toHaveBeenCalledTimes(1);
      expect(complete).not.toHaveBeenCalled();
      expect(beforeProviderRequest).toHaveBeenCalledTimes(2);
    },
  );

  it('blocks unsafe openai-compatible URLs before sending credentials', async () => {
    validateAiProviderUrlMock.mockImplementationOnce(() => {
      throw new Error('Unsafe provider URL');
    });

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

  it('omits upstream provider error bodies rather than echoing credentials or queries', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({
        error: {
          message: 'Project rejected the request. Bearer sk-sensitive-token',
        },
      }),
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

    expect(thrown).toHaveProperty(
      'message',
      'custom error (401). The provider request failed.',
    );
    expect((thrown as Error).message).not.toContain('sk-sensitive-token');
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
      { ...liveSearchDecision, needsLiveSearch: false },
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
      '[Source 1 - example.com](https://example.com/news)',
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

  it.each(['plain text', '{"sql":', '{"message":["wrong"]}', 'null'])(
    'rejects malformed structured completion content %s',
    async (content) => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content } }] }),
      });

      await expect(
        service.runOpenAiCompatible(
          {
            provider: 'custom',
            model: 'fixture-model',
            apiKey: 'fixture-key',
            baseUrl: 'https://fixture.example/v1',
          },
          { prompt: 'Generate SQL' },
          'auto',
          structuredDbDecision,
        ),
      ).rejects.toThrow(/structured/i);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    },
  );

  it('preserves final stream usage without turning it into generated text', async () => {
    mockFetch.mockResolvedValue(
      createSseResponse([
        'data: {"choices":[{"delta":{"content":[{"text":"Plain chat"}]}}]}\n\n',
        'data: {"choices":[],"usage":{"prompt_tokens":12,"completion_tokens":3,"total_tokens":15}}\n\n',
        'data: [DONE]\n\n',
      ]),
    );
    const events: StreamEvent[] = [];
    for await (const event of service.streamOpenAiCompatible(
      {
        provider: 'custom',
        model: 'fixture-model',
        apiKey: 'fixture-key',
        baseUrl: 'https://fixture.example/v1',
      },
      { prompt: 'Hello' },
      'auto',
      { ...liveSearchDecision, needsLiveSearch: false },
    ))
      events.push(event);

    expect(events).toEqual([
      { type: 'chunk', text: 'Plain chat' },
      {
        type: 'done',
        data: expect.objectContaining({
          message: 'Plain chat',
          contractVersion: 1,
          usage: { promptTokens: 12, completionTokens: 3, totalTokens: 15 },
        }),
      },
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

  const geminiHistoryFixtures: Array<{
    name: string;
    params: ChatParams;
    expectedContents: ReturnType<AiPromptBuilderService['buildGeminiContents']>;
  }> = [
    {
      name: 'omitted history',
      params: { prompt: 'Continue' },
      expectedContents: [{ role: 'user', parts: [{ text: 'Continue' }] }],
    },
    {
      name: 'ordered roles, blank turns, duplicate prompt and current attachments',
      params: {
        prompt: 'Compare these plans',
        context: 'TABLE users(id uuid, email text)',
        history: [
          { role: 'user', content: 'Compare these plans' },
          { role: 'ai', content: '  Prior analysis  ' },
          { role: 'user', content: '   ' },
          { role: 'user', content: 'Is the email index useful?' },
          { role: 'ai', content: 'Use users_email_idx' },
          { role: 'user', content: 'Compare these plans' },
        ],
        image: 'data:image/png;base64,aW1hZ2U=',
        document: {
          name: 'schema.pdf',
          mimeType: 'application/pdf',
          data: 'data:application/pdf;base64,cGRm',
        },
      },
      expectedContents: [
        { role: 'user', parts: [{ text: 'Compare these plans' }] },
        { role: 'model', parts: [{ text: 'Prior analysis' }] },
        { role: 'user', parts: [{ text: 'Is the email index useful?' }] },
        { role: 'model', parts: [{ text: 'Use users_email_idx' }] },
        {
          role: 'user',
          parts: [
            {
              text: 'Compare these plans\n\nAdditional context:\nTABLE users(id uuid, email text)',
            },
            { inlineData: { mimeType: 'image/png', data: 'aW1hZ2U=' } },
            { inlineData: { mimeType: 'application/pdf', data: 'cGRm' } },
          ],
        },
      ],
    },
    {
      name: 'history message-count bound',
      params: {
        prompt: 'Continue',
        history: Array.from(
          { length: AI_CONSTANTS.CHAT_HISTORY_MAX_MESSAGES + 2 },
          (_, index): ChatHistoryMessage => ({
            role: index % 2 === 0 ? 'user' : 'ai',
            content: `turn ${index}`,
          }),
        ),
      },
      expectedContents: [
        ...Array.from(
          { length: AI_CONSTANTS.CHAT_HISTORY_MAX_MESSAGES },
          (_, index) => ({
            role:
              (index + 2) % 2 === 0 ? ('user' as const) : ('model' as const),
            parts: [{ text: `turn ${index + 2}` }],
          }),
        ),
        { role: 'user', parts: [{ text: 'Continue' }] },
      ],
    },
    {
      name: 'history character bound',
      params: {
        prompt: 'Continue',
        history: [
          {
            role: 'user',
            content: 'x'.repeat(AI_CONSTANTS.CHAT_HISTORY_MAX_CHARACTERS + 100),
          },
          { role: 'ai', content: 'Recent answer' },
        ],
      },
      expectedContents: [
        {
          role: 'user',
          parts: [
            {
              text: expect.stringContaining(
                '...[earlier content truncated]...',
              ),
            },
          ],
        },
        { role: 'model', parts: [{ text: 'Recent answer' }] },
        { role: 'user', parts: [{ text: 'Continue' }] },
      ],
    },
  ];

  it.each(geminiHistoryFixtures)(
    'sends Gemini sync history matching streaming and OpenAI for $name',
    async ({ params, expectedContents }) => {
      const generateContent = jest.fn().mockResolvedValue({
        text: '{"message":"Gemini ready"}',
      });
      const generateContentStream = jest.fn().mockResolvedValue(
        (async function* () {
          yield { text: '{"message":"Gemini ready"}' };
        })(),
      );
      const beforeProviderRequest = jest.fn().mockResolvedValue(undefined);
      (
        service as unknown as {
          genAI: {
            models: {
              generateContent: jest.Mock;
              generateContentStream: jest.Mock;
            };
          };
        }
      ).genAI = { models: { generateContent, generateContentStream } };
      const plan = { provider: 'gemini' as const, model: 'gemini-test' };
      const requestParams = { ...params, beforeProviderRequest };

      const result = await service.runGemini(
        plan,
        requestParams,
        'auto',
        structuredDbDecision,
      );
      expect(beforeProviderRequest).toHaveBeenCalledTimes(1);
      for await (const _event of service.streamGemini(
        plan,
        requestParams,
        'auto',
        structuredDbDecision,
      )) {
        // drain the mocked stream
      }

      const contents = generateContent.mock.calls[0]?.[0]
        ?.contents as ReturnType<AiPromptBuilderService['buildGeminiContents']>;
      expect(contents).toEqual(expectedContents);
      expect(generateContentStream.mock.calls[0]?.[0]?.contents).toEqual(
        contents,
      );
      const sentHistory = contents.slice(0, -1);
      expect(sentHistory.length).toBeLessThanOrEqual(
        AI_CONSTANTS.CHAT_HISTORY_MAX_MESSAGES,
      );
      expect(
        sentHistory
          .flatMap((turn) => turn.parts)
          .reduce(
            (length, part) => length + ('text' in part ? part.text.length : 0),
            0,
          ),
      ).toBeLessThanOrEqual(AI_CONSTANTS.CHAT_HISTORY_MAX_CHARACTERS);
      const openAiMessages = new AiPromptBuilderService().buildOpenAiMessages(
        params.prompt,
        'system',
        params.context,
        params.history,
        params.image,
        params.document,
      );
      expect(
        sentHistory.map((turn) => ({
          role: turn.role === 'model' ? 'assistant' : 'user',
          content: turn.parts
            .map((part) => ('text' in part ? part.text : ''))
            .join(''),
        })),
      ).toEqual(openAiMessages.slice(1, -1));
      expect(result.message).toBe('Gemini ready');
      expect(beforeProviderRequest).toHaveBeenCalledTimes(2);
      expect(generateContent).toHaveBeenCalledTimes(1);
      expect(generateContentStream).toHaveBeenCalledTimes(1);
      expect(mockFetch).not.toHaveBeenCalled();
    },
  );

  it('preserves Gemini sync history on structured-output fallback with policy rechecks and result metadata', async () => {
    const beforeProviderRequest = jest.fn().mockResolvedValue(undefined);
    const generateContent = jest
      .fn()
      .mockRejectedValueOnce(
        new Error('response schema is not supported for this model'),
      )
      .mockResolvedValueOnce({
        text: '{"message":"Gemini ready","sources":["https://example.com/schema"]}',
        usageMetadata: {
          promptTokenCount: 13,
          candidatesTokenCount: 7,
          totalTokenCount: 20,
        },
      });
    (
      service as unknown as {
        genAI: { models: { generateContent: jest.Mock } };
      }
    ).genAI = { models: { generateContent } };

    const result = await service.runGemini(
      { provider: 'gemini', model: 'gemini-test', displayName: 'Gemini test' },
      {
        prompt: 'Continue',
        history: [
          { role: 'user', content: 'List user tables' },
          { role: 'ai', content: 'There is a users table' },
          { role: 'user', content: 'Continue' },
        ],
        beforeProviderRequest,
      },
      'auto',
      structuredDbDecision,
    );

    expect(generateContent).toHaveBeenCalledTimes(2);
    for (const [request] of generateContent.mock.calls) {
      expect(request.contents).toEqual([
        { role: 'user', parts: [{ text: 'List user tables' }] },
        { role: 'model', parts: [{ text: 'There is a users table' }] },
        { role: 'user', parts: [{ text: 'Continue' }] },
      ]);
    }
    expect(generateContent.mock.calls[0]?.[0]?.config?.responseMimeType).toBe(
      'application/json',
    );
    expect(
      generateContent.mock.calls[1]?.[0]?.config?.responseMimeType,
    ).toBeUndefined();
    expect(beforeProviderRequest).toHaveBeenCalledTimes(2);
    expect(beforeProviderRequest.mock.invocationCallOrder[0]).toBeLessThan(
      generateContent.mock.invocationCallOrder[0],
    );
    expect(beforeProviderRequest.mock.invocationCallOrder[1]).toBeLessThan(
      generateContent.mock.invocationCallOrder[1],
    );
    expect(result).toMatchObject({
      message: expect.stringContaining('https://example.com/schema'),
      sources: ['https://example.com/schema'],
      provider: 'gemini',
      providerLabel: 'Gemini test',
      model: 'gemini-test',
      routingMode: 'auto',
      usage: { promptTokens: 13, completionTokens: 7, totalTokens: 20 },
    });
    expect(mockFetch).not.toHaveBeenCalled();
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
        message: expect.stringContaining(
          '[Gemini docs - ai.google.dev](https://ai.google.dev/gemini-api/docs)',
        ),
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
  describe('request cancellation and total budget', () => {
    const plan = {
      provider: 'custom' as const,
      model: 'fixture-model',
      apiKey: 'fixture-key',
      baseUrl: 'https://fixture.example/v1',
    };
    const chatDecision = { ...liveSearchDecision, needsLiveSearch: false };
    const cancelled = () => new AiRequestStoppedError('AI_REQUEST_CANCELLED');
    const never = <T>() => new Promise<T>(() => undefined);
    const flushProviderWork = async () => {
      for (let index = 0; index < 30; index += 1) await Promise.resolve();
    };
    const drain = async (stream: AsyncGenerator<StreamEvent>) => {
      const events: StreamEvent[] = [];
      for await (const event of stream) events.push(event);
      return events;
    };

    afterEach(() => {
      jest.useRealTimers();
      jest.restoreAllMocks();
    });

    it.each(['cancelled', 'expired'])(
      'does zero URL/policy/provider work for a pre-%s request on every lane',
      async (stop) => {
        const controller = new AbortController();
        if (stop === 'cancelled') controller.abort(cancelled());
        const beforeProviderRequest = jest.fn().mockResolvedValue(undefined);
        const generateContent = jest.fn();
        const generateContentStream = jest.fn();
        (service as any).genAI = {
          models: { generateContent, generateContentStream },
        };
        const params = {
          prompt: 'Hello',
          signal: controller.signal,
          deadlineAt: stop === 'expired' ? Date.now() - 1 : undefined,
          beforeProviderRequest,
        };
        const reason =
          stop === 'expired' ? 'AI_REQUEST_TIMEOUT' : 'AI_REQUEST_CANCELLED';
        const requests = [
          () =>
            service.runGemini(
              { provider: 'gemini', model: 'fixture' },
              params,
              'auto',
              chatDecision,
            ),
          () => service.runOpenAiCompatible(plan, params, 'auto', chatDecision),
          () => service.completeGeminiText({ ...params, model: 'fixture' }),
          () =>
            service.completeOpenAiCompatibleText(plan, {
              ...params,
              systemPrompt: 'Be concise.',
            }),
          () =>
            service
              .streamGemini(
                { provider: 'gemini', model: 'fixture' },
                params,
                'auto',
                chatDecision,
              )
              .next(),
          () =>
            service
              .streamOpenAiCompatible(plan, params, 'auto', chatDecision)
              .next(),
        ];
        for (const request of requests)
          await expect(request()).rejects.toMatchObject({ reason });
        expect(validateAiProviderUrlMock).not.toHaveBeenCalled();
        expect(beforeProviderRequest).not.toHaveBeenCalled();
        expect(mockFetch).not.toHaveBeenCalled();
        expect(generateContent).not.toHaveBeenCalled();
        expect(generateContentStream).not.toHaveBeenCalled();
      },
    );

    it.each(['openai', 'gemini'])(
      'cancels %s retry backoff without a second policy/provider attempt or timers',
      async (provider) => {
        jest.useFakeTimers();
        const controller = new AbortController();
        const beforeProviderRequest = jest.fn().mockResolvedValue(undefined);
        const generateContent = jest
          .fn()
          .mockRejectedValue(new Error('network unavailable'));
        (service as any).genAI = { models: { generateContent } };
        mockFetch.mockResolvedValue({ ok: false, status: 503 });
        const params = {
          prompt: 'Hello',
          signal: controller.signal,
          beforeProviderRequest,
        };
        const request =
          provider === 'openai'
            ? service.runOpenAiCompatible(plan, params, 'auto', chatDecision)
            : service.completeGeminiText({ ...params, model: 'fixture' });
        const outcome = request.then(
          () => undefined,
          (error: unknown) => error,
        );
        await flushProviderWork();
        expect(beforeProviderRequest).toHaveBeenCalledTimes(1);
        controller.abort(cancelled());
        expect(await outcome).toMatchObject({ reason: 'AI_REQUEST_CANCELLED' });
        await jest.advanceTimersByTimeAsync(1000);
        expect(beforeProviderRequest).toHaveBeenCalledTimes(1);
        expect(
          provider === 'openai' ? mockFetch : generateContent,
        ).toHaveBeenCalledTimes(1);
        expect(jest.getTimerCount()).toBe(0);
      },
    );

    it('asserts cancellation after a policy recheck before sending any provider request', async () => {
      const controller = new AbortController();
      const beforeProviderRequest = jest.fn(async () =>
        controller.abort(cancelled()),
      );
      await expect(
        service.runOpenAiCompatible(
          plan,
          { prompt: 'Hello', signal: controller.signal, beforeProviderRequest },
          'auto',
          chatDecision,
        ),
      ).rejects.toMatchObject({ reason: 'AI_REQUEST_CANCELLED' });
      expect(beforeProviderRequest).toHaveBeenCalledTimes(1);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('does not hang on a policy recheck that ignores caller cancellation', async () => {
      const controller = new AbortController();
      const beforeProviderRequest = jest.fn(() => never<void>());
      const request = service.runOpenAiCompatible(
        plan,
        { prompt: 'Hello', signal: controller.signal, beforeProviderRequest },
        'auto',
        chatDecision,
      );
      const outcome = request.then(
        () => undefined,
        (error: unknown) => error,
      );
      await flushProviderWork();
      controller.abort(cancelled());
      expect(await outcome).toMatchObject({ reason: 'AI_REQUEST_CANCELLED' });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it.each(['headers', 'body'])(
      'aborts a stalled fetch %s wait even if fetch/body ignores the signal',
      async (phase) => {
        const controller = new AbortController();
        mockFetch.mockImplementation(() =>
          phase === 'headers'
            ? never<Response>()
            : Promise.resolve({ ok: true, json: () => never<unknown>() }),
        );
        const request = service.runOpenAiCompatible(
          plan,
          { prompt: 'Hello', signal: controller.signal },
          'auto',
          chatDecision,
        );
        const outcome = request.then(
          () => undefined,
          (error: unknown) => error,
        );
        await flushProviderWork();
        const upstreamSignal = mockFetch.mock.calls[0]?.[1]
          ?.signal as AbortSignal;
        expect(upstreamSignal.aborted).toBe(false);
        controller.abort(cancelled());
        expect(await outcome).toMatchObject({ reason: 'AI_REQUEST_CANCELLED' });
        expect(upstreamSignal.aborted).toBe(true);
        expect(mockFetch).toHaveBeenCalledTimes(1);
      },
    );

    it.each(['chat', 'completion', 'stream'])(
      'forwards merged abortSignal and remaining HTTP timeout to Gemini %s',
      async (lane) => {
        const controller = new AbortController();
        const deadlineAt = Date.now() + 1000;
        const generateContent = jest.fn(() => never<unknown>());
        const generateContentStream = jest.fn(() => never<unknown>());
        (service as any).genAI = {
          models: { generateContent, generateContentStream },
        };
        const params = {
          prompt: 'Hello',
          signal: controller.signal,
          deadlineAt,
        };
        const request =
          lane === 'chat'
            ? service.runGemini(
                { provider: 'gemini', model: 'fixture' },
                params,
                'auto',
                structuredDbDecision,
              )
            : lane === 'completion'
              ? service.completeGeminiText({
                  ...params,
                  model: 'fixture',
                  timeoutMs: 500,
                })
              : service
                  .streamGemini(
                    { provider: 'gemini', model: 'fixture' },
                    params,
                    'auto',
                    structuredDbDecision,
                  )
                  .next();
        const outcome = request.then(
          () => undefined,
          (error: unknown) => error,
        );
        await flushProviderWork();
        const providerCall =
          lane === 'stream' ? generateContentStream : generateContent;
        const config = (providerCall.mock.calls[0] as any)?.[0]?.config;
        expect(config.abortSignal).toBeInstanceOf(AbortSignal);
        expect(config.abortSignal).not.toBe(controller.signal);
        expect(config.abortSignal.aborted).toBe(false);
        expect(config.httpOptions.timeout).toBeGreaterThan(0);
        expect(config.httpOptions.timeout).toBeLessThanOrEqual(
          lane === 'completion' ? 500 : 1000,
        );
        // Even an arbitrary abort reason that resembles a model/schema error is terminal.
        const reason = new Error('404 response schema not found');
        controller.abort(reason);
        expect(await outcome).toBe(reason);
        expect(config.abortSignal.aborted).toBe(true);
        expect(providerCall).toHaveBeenCalledTimes(1);
      },
    );

    it('does not fallback to another Gemini model for a native AbortError', async () => {
      const reason = Object.assign(new Error('404 not found'), {
        name: 'AbortError',
      });
      const generateContent = jest.fn().mockRejectedValue(reason);
      (service as any).genAI = { models: { generateContent } };
      await expect(
        service.completeGeminiText({ model: 'fixture', prompt: 'Hello' }),
      ).rejects.toBe(reason);
      expect(generateContent).toHaveBeenCalledTimes(1);
    });

    it('retains one direct total deadline across attempt timeouts and backoff', async () => {
      jest.useFakeTimers();
      jest.spyOn(Math, 'random').mockReturnValue(1);
      service = new AiProviderRunnerService(
        {
          get: jest.fn((key) =>
            key === 'AI_PROVIDER_TIMEOUT_MS' ? '300' : undefined,
          ),
        } as unknown as ConfigService,
        new AiPromptBuilderService(),
      );
      const generateContent = jest.fn(() => never<unknown>());
      const beforeProviderRequest = jest.fn().mockResolvedValue(undefined);
      (service as any).genAI = { models: { generateContent } };
      const request = service.completeGeminiText({
        model: 'fixture',
        prompt: 'Hello',
        timeoutMs: 30,
        beforeProviderRequest,
      });
      const outcome = request.then(
        () => undefined,
        (error: unknown) => error,
      );
      await flushProviderWork();
      await jest.advanceTimersByTimeAsync(30);
      expect(generateContent).toHaveBeenCalledTimes(1);
      expect(
        (generateContent.mock.calls[0] as any)[0].config.abortSignal.aborted,
      ).toBe(true);
      await jest.advanceTimersByTimeAsync(250);
      expect(generateContent).toHaveBeenCalledTimes(2);
      expect(
        (generateContent.mock.calls[1] as any)[0].config.httpOptions.timeout,
      ).toBeLessThanOrEqual(20);
      await jest.advanceTimersByTimeAsync(20);
      expect(await outcome).toMatchObject({ reason: 'AI_REQUEST_TIMEOUT' });
      expect(generateContent).toHaveBeenCalledTimes(2);
      expect(beforeProviderRequest).toHaveBeenCalledTimes(2);
      expect(jest.getTimerCount()).toBe(0);
    });

    it.each(['schema', 'model'])(
      'does not renew the absolute deadline during Gemini %s fallback',
      async (fallback) => {
        jest.useFakeTimers();
        const generateContent = jest
          .fn()
          .mockImplementationOnce(
            () =>
              new Promise((_, reject) =>
                setTimeout(
                  () =>
                    reject(
                      new Error(
                        fallback === 'schema'
                          ? 'response schema is unsupported'
                          : '404 model not found',
                      ),
                    ),
                  40,
                ),
              ),
          )
          .mockImplementation(() => never<unknown>());
        (service as any).genAI = { models: { generateContent } };
        const params = { prompt: 'Hello', deadlineAt: Date.now() + 100 };
        const request =
          fallback === 'schema'
            ? service.runGemini(
                { provider: 'gemini', model: 'fixture' },
                params,
                'auto',
                structuredDbDecision,
              )
            : service.completeGeminiText({ ...params, model: 'fixture' });
        const outcome = request.then(
          () => undefined,
          (error: unknown) => error,
        );
        await flushProviderWork();
        await jest.advanceTimersByTimeAsync(40);
        expect(generateContent).toHaveBeenCalledTimes(2);
        expect(
          generateContent.mock.calls[1][0].config.httpOptions.timeout,
        ).toBeLessThanOrEqual(60);
        await jest.advanceTimersByTimeAsync(60);
        expect(await outcome).toMatchObject({ reason: 'AI_REQUEST_TIMEOUT' });
        expect(generateContent).toHaveBeenCalledTimes(2);
        expect(jest.getTimerCount()).toBe(0);
      },
    );

    it('stops OpenAI structured fallback if cancellation happens during error-body decoding', async () => {
      const controller = new AbortController();
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => {
          controller.abort(cancelled());
          return {
            error: { message: 'response_format json_schema unsupported' },
          };
        },
      });
      await expect(
        service.runOpenAiCompatible(
          plan,
          { prompt: 'Hello', signal: controller.signal },
          'auto',
          structuredDbDecision,
        ),
      ).rejects.toMatchObject({ reason: 'AI_REQUEST_CANCELLED' });
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it.each(['cancel', 'idle'])(
      'cancels upstream/reader and releases a stalled read lock on %s',
      async (stop) => {
        jest.useFakeTimers();
        service = new AiProviderRunnerService(
          {
            get: jest.fn((key) =>
              key === 'AI_STREAM_IDLE_TIMEOUT_MS' ? '10' : undefined,
            ),
          } as unknown as ConfigService,
          new AiPromptBuilderService(),
        );
        const cancel = jest.fn();
        const body = new ReadableStream<Uint8Array>({
          pull: () => never<void>(),
          cancel,
        });
        const response = new Response(body);
        mockFetch.mockResolvedValue(response);
        const controller = new AbortController();
        const stream = service.streamOpenAiCompatible(
          plan,
          { prompt: 'Hello', signal: controller.signal },
          'auto',
          chatDecision,
        );
        const outcome = stream.next().then(
          () => undefined,
          (error: unknown) => error,
        );
        await flushProviderWork();
        expect(body.locked).toBe(true);
        if (stop === 'cancel') controller.abort(cancelled());
        else await jest.advanceTimersByTimeAsync(10);
        const error = await outcome;
        if (stop === 'cancel')
          expect(error).toMatchObject({ reason: 'AI_REQUEST_CANCELLED' });
        else
          expect(error).toHaveProperty(
            'message',
            expect.stringContaining('timed out after 10ms'),
          );
        expect(cancel).toHaveBeenCalledTimes(1);
        expect(body.locked).toBe(false);
        expect(mockFetch.mock.calls[0][1].signal.aborted).toBe(true);
        expect(await stream.next()).toEqual({ done: true, value: undefined });
        expect(jest.getTimerCount()).toBe(0);
      },
    );

    it('bounds iterator.return cleanup when a native Gemini iterator ignores abort', async () => {
      jest.useFakeTimers();
      service = new AiProviderRunnerService(
        {
          get: jest.fn((key) =>
            key === 'AI_STREAM_IDLE_TIMEOUT_MS' ? '10' : undefined,
          ),
        } as unknown as ConfigService,
        new AiPromptBuilderService(),
      );
      const iterator = {
        next: jest.fn(() => never<unknown>()),
        return: jest.fn(() => never<unknown>()),
      };
      const generateContentStream = jest.fn().mockResolvedValue(iterator);
      (service as any).genAI = { models: { generateContentStream } };
      const stream = service.streamGemini(
        { provider: 'gemini', model: 'fixture' },
        { prompt: 'Hello' },
        'auto',
        chatDecision,
      );
      const outcome = stream.next().then(
        () => undefined,
        (error: unknown) => error,
      );
      await flushProviderWork();
      await jest.advanceTimersByTimeAsync(10);
      expect(iterator.return).toHaveBeenCalledTimes(1);
      expect(
        generateContentStream.mock.calls[0][0].config.abortSignal.aborted,
      ).toBe(true);
      await jest.advanceTimersByTimeAsync(100);
      expect(await outcome).toHaveProperty(
        'message',
        expect.stringContaining('timed out after 10ms'),
      );
      expect(generateContentStream).toHaveBeenCalledTimes(1);
      expect(jest.getTimerCount()).toBe(0);
    });

    it('treats provider DONE as terminal and discards all subsequent chunks', async () => {
      const response = createSseResponse([
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n',
        'data: [DONE]\ndata: {"choices":[{"delta":{"content":"Late"}}]}\n',
        'data: {"choices":[{"delta":{"content":"Even later"}}]}\n',
      ]);
      mockFetch.mockResolvedValue(response);
      const events = await drain(
        service.streamOpenAiCompatible(
          plan,
          { prompt: 'Hello' },
          'auto',
          chatDecision,
        ),
      );
      expect(events).toEqual([
        { type: 'chunk', text: 'Hello' },
        {
          type: 'done',
          data: expect.objectContaining({
            message: 'Hello',
            contractVersion: 1,
          }),
        },
      ]);
      expect(response.body?.locked).toBe(false);
    });

    it('does not emit buffered late text or success after caller stop between chunks', async () => {
      const controller = new AbortController();
      const response = createSseResponse([
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\ndata: {"choices":[{"delta":{"content":"Late"}}]}\ndata: [DONE]\n',
      ]);
      mockFetch.mockResolvedValue(response);
      const stream = service.streamOpenAiCompatible(
        plan,
        { prompt: 'Hello', signal: controller.signal },
        'auto',
        chatDecision,
      );
      expect(await stream.next()).toMatchObject({
        value: { type: 'chunk', text: 'Hello' },
      });
      controller.abort(cancelled());
      await expect(stream.next()).rejects.toMatchObject({
        reason: 'AI_REQUEST_CANCELLED',
      });
      expect(response.body?.locked).toBe(false);
      expect(await stream.next()).toEqual({ done: true, value: undefined });
    });

    it('does not swallow a control error while processing a malformed provider event', async () => {
      const builder = new AiPromptBuilderService();
      const reason = cancelled();
      jest.spyOn(builder, 'extractOpenAiStreamText').mockImplementation(() => {
        throw reason;
      });
      service = new AiProviderRunnerService(
        { get: jest.fn() } as unknown as ConfigService,
        builder,
      );
      mockFetch.mockResolvedValue(
        createSseResponse([
          'data: invalid json\ndata: {"choices":[]}\ndata: [DONE]\n',
        ]),
      );
      await expect(
        drain(
          service.streamOpenAiCompatible(
            plan,
            { prompt: 'Hello' },
            'auto',
            chatDecision,
          ),
        ),
      ).rejects.toBe(reason);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it.each(['text', 'event'])(
      'enforces the finite stream %s bound before emitting excess output or success',
      async (bound) => {
        const maxText = AI_CONSTANTS.MAX_OUTPUT_TOKENS * 16;
        const response = createSseResponse(
          bound === 'event'
            ? ['data: ' + 'x'.repeat(256 * 1024 + 1)]
            : [
                'data: ' +
                  JSON.stringify({
                    choices: [{ delta: { content: 'x'.repeat(maxText) } }],
                  }) +
                  '\n',
                'data: {"choices":[{"delta":{"content":"x"}}]}\ndata: [DONE]\n',
              ],
        );
        mockFetch.mockResolvedValue(response);
        const stream = service.streamOpenAiCompatible(
          plan,
          { prompt: 'Hello' },
          'auto',
          chatDecision,
        );
        if (bound === 'text')
          expect(await stream.next()).toMatchObject({
            value: { type: 'chunk' },
          });
        await expect(stream.next()).rejects.toThrow(
          bound === 'text'
            ? 'parsing size limit'
            : 'event exceeded the size limit',
        );
        expect(response.body?.locked).toBe(false);
        expect(mockFetch.mock.calls[0][1].signal.aborted).toBe(true);
        expect(await stream.next()).toEqual({ done: true, value: undefined });
      },
    );

    it('enforces the same parsing-size buffer limit for Gemini streams', async () => {
      const generateContentStream = jest.fn().mockResolvedValue(
        (async function* () {
          yield { text: 'x'.repeat(AI_CONSTANTS.MAX_OUTPUT_TOKENS * 16 + 1) };
        })(),
      );
      (service as any).genAI = { models: { generateContentStream } };
      await expect(
        drain(
          service.streamGemini(
            { provider: 'gemini', model: 'fixture' },
            { prompt: 'Hello' },
            'auto',
            chatDecision,
          ),
        ),
      ).rejects.toThrow('parsing size limit');
      expect(
        generateContentStream.mock.calls[0][0].config.abortSignal.aborted,
      ).toBe(true);
    });
  });

  describe('actual outbound attempt gates and ledger', () => {
    const plan = {
      provider: 'custom' as const,
      model: 'fixture-model',
      apiKey: 'never-persist-this-key',
      baseUrl: 'https://fixture.example/v1',
    };
    const geminiPlan = { provider: 'gemini' as const, model: 'gemini-fixture' };
    const chatDecision = { ...liveSearchDecision, needsLiveSearch: false };
    const usage = { promptTokens: 11, completionTokens: 5, totalTokens: 16 };
    const openAiUsage = {
      prompt_tokens: 11,
      completion_tokens: 5,
      total_tokens: 16,
    };
    const geminiUsage = {
      promptTokenCount: 11,
      candidatesTokenCount: 5,
      totalTokenCount: 16,
    };
    const successfulBody = {
      choices: [{ message: { content: '{"message":"Ready"}' } }],
      usage: openAiUsage,
    };
    const flush = async () => {
      for (let index = 0; index < 60; index += 1) await Promise.resolve();
    };
    const makeLedger = () => {
      const handles: Array<{
        attemptId: string;
        complete: jest.Mock;
        fail: jest.Mock;
      }> = [];
      const execution = {
        generationId: 'generation-fixture',
        beforeAttempt: jest.fn(
          async (_recipient: { provider: string; model: string }) => {
            const handle = {
              attemptId: `attempt-${handles.length + 1}`,
              complete: jest.fn().mockResolvedValue(undefined),
              fail: jest.fn().mockResolvedValue(undefined),
            };
            handles.push(handle);
            return handle;
          },
        ),
      };
      return { handles, execution };
    };

    afterEach(() => {
      jest.useRealTimers();
      jest.restoreAllMocks();
    });

    it('denies a root recipient before DNS, reservation or provider calls on every lane', async () => {
      const { handles, execution } = makeLedger();
      const denied = new Error('recipient policy denied');
      const beforeProviderAttempt = jest.fn().mockRejectedValue(denied);
      const generateContent = jest.fn();
      const generateContentStream = jest.fn();
      (service as any).genAI = {
        models: { generateContent, generateContentStream },
      };
      const params = { prompt: 'Hello', execution, beforeProviderAttempt };
      const operations = [
        () => service.runOpenAiCompatible(plan, params, 'auto', chatDecision),
        () =>
          service.completeOpenAiCompatibleText(plan, {
            ...params,
            systemPrompt: 'Be concise.',
          }),
        () =>
          service
            .streamOpenAiCompatible(plan, params, 'auto', chatDecision)
            .next(),
        () => service.runGemini(geminiPlan, params, 'auto', chatDecision),
        () =>
          service.completeGeminiText({ ...params, model: geminiPlan.model }),
        () =>
          service.streamGemini(geminiPlan, params, 'auto', chatDecision).next(),
      ];
      for (const operation of operations) {
        await expect(operation()).rejects.toMatchObject({
          aiRequestFatal: true,
          cause: denied,
        });
      }
      expect(beforeProviderAttempt).toHaveBeenCalledTimes(6);
      expect(validateAiProviderUrlMock).not.toHaveBeenCalled();
      expect(execution.beforeAttempt).not.toHaveBeenCalled();
      expect(handles).toHaveLength(0);
      expect(mockFetch).not.toHaveBeenCalled();
      expect(generateContent).not.toHaveBeenCalled();
      expect(generateContentStream).not.toHaveBeenCalled();
    });

    it.each(['chat', 'completion'])(
      'pairs exactly two OpenAI %s outbound handles as failed/success with received usage',
      async (lane) => {
        jest.useFakeTimers();
        const { handles, execution } = makeLedger();
        const beforeProviderAttempt = jest.fn().mockResolvedValue(undefined);
        const beforeProviderRequest = jest.fn().mockResolvedValue(undefined);
        mockFetch
          .mockResolvedValueOnce({ ok: false, status: 503 })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => successfulBody,
          });
        const params = {
          prompt: 'Hello',
          execution,
          beforeProviderAttempt,
          beforeProviderRequest,
        };
        const request =
          lane === 'chat'
            ? service.runOpenAiCompatible(plan, params, 'auto', chatDecision)
            : service.completeOpenAiCompatibleText(plan, {
                ...params,
                systemPrompt: 'Be concise.',
              });
        await flush();
        expect(handles).toHaveLength(1);
        expect(handles[0].fail).toHaveBeenCalledTimes(1);
        expect(handles[0].complete).not.toHaveBeenCalled();
        await jest.advanceTimersByTimeAsync(
          AI_CONSTANTS.OPENAI_COMPATIBLE_RETRY_BASE_DELAY_MS,
        );
        await request;
        expect(execution.beforeAttempt.mock.calls).toEqual([
          [{ provider: plan.provider, model: plan.model }],
          [{ provider: plan.provider, model: plan.model }],
        ]);
        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(beforeProviderRequest).toHaveBeenCalledTimes(2);
        expect(beforeProviderAttempt).toHaveBeenCalledTimes(3); // root plus each actual attempt
        expect(handles[0].fail).toHaveBeenCalledWith(
          'failed',
          expect.objectContaining({
            provider: plan.provider,
            model: plan.model,
            usage: undefined,
          }),
        );
        expect(handles[1].complete).toHaveBeenCalledTimes(1);
        expect(handles[1].complete).toHaveBeenCalledWith({
          provider: plan.provider,
          model: plan.model,
          usage,
        });
        expect(handles[1].fail).not.toHaveBeenCalled();
        expect(
          JSON.stringify(execution.beforeAttempt.mock.calls),
        ).not.toContain(plan.apiKey);
        expect(
          JSON.stringify(execution.beforeAttempt.mock.calls),
        ).not.toContain(plan.baseUrl);
        expect(jest.getTimerCount()).toBe(0);
      },
    );

    it('creates and pairs a fresh tracked Gemini text attempt for each retry', async () => {
      jest.useFakeTimers();
      const { handles, execution } = makeLedger();
      const generateContent = jest
        .fn()
        .mockRejectedValueOnce(new Error('network unavailable'))
        .mockResolvedValueOnce({ text: ' Ready ', usageMetadata: geminiUsage });
      (service as any).genAI = { models: { generateContent } };
      const request = service.completeGeminiText({
        model: geminiPlan.model,
        prompt: 'Hello',
        execution,
      });
      await flush();
      await jest.advanceTimersByTimeAsync(
        AI_CONSTANTS.OPENAI_COMPATIBLE_RETRY_BASE_DELAY_MS,
      );
      expect(await request).toBe('Ready');
      expect(handles).toHaveLength(2);
      expect(handles[0].fail).toHaveBeenCalledWith('failed', {
        provider: 'gemini',
        model: geminiPlan.model,
        usage: undefined,
      });
      expect(handles[0].complete).not.toHaveBeenCalled();
      expect(handles[1].complete).toHaveBeenCalledWith({
        provider: 'gemini',
        model: geminiPlan.model,
        usage,
      });
      expect(handles[1].fail).not.toHaveBeenCalled();
      expect(generateContent).toHaveBeenCalledTimes(2);
      expect(jest.getTimerCount()).toBe(0);
    });

    it.each(['openai', 'gemini'])(
      'tracks cancellation of an in-flight %s attempt with no retry or success',
      async (provider) => {
        const { handles, execution } = makeLedger();
        const controller = new AbortController();
        mockFetch.mockImplementation(() => new Promise(() => undefined));
        const generateContent = jest.fn(() => new Promise(() => undefined));
        (service as any).genAI = { models: { generateContent } };
        const params = {
          prompt: 'Hello',
          execution,
          signal: controller.signal,
        };
        const request =
          provider === 'openai'
            ? service.runOpenAiCompatible(plan, params, 'auto', chatDecision)
            : service.completeGeminiText({
                ...params,
                model: geminiPlan.model,
              });
        const outcome = request.catch((error: unknown) => error);
        await flush();
        expect(handles).toHaveLength(1);
        controller.abort(new AiRequestStoppedError('AI_REQUEST_CANCELLED'));
        expect(await outcome).toMatchObject({ reason: 'AI_REQUEST_CANCELLED' });
        expect(handles[0].fail).toHaveBeenCalledTimes(1);
        expect(handles[0].fail.mock.calls[0][0]).toBe('cancelled');
        expect(handles[0].fail.mock.calls[0][1]?.usage).toBeUndefined();
        expect(handles[0].complete).not.toHaveBeenCalled();
        expect(execution.beforeAttempt).toHaveBeenCalledTimes(1);
        expect(
          provider === 'openai' ? mockFetch : generateContent,
        ).toHaveBeenCalledTimes(1);
      },
    );

    it('does not retry a reservation denial whose message resembles a transport error', async () => {
      const { execution } = makeLedger();
      const denied = new Error('network budget unavailable');
      execution.beforeAttempt.mockRejectedValue(denied);
      await expect(
        service.runOpenAiCompatible(
          plan,
          { prompt: 'Hello', execution },
          'auto',
          chatDecision,
        ),
      ).rejects.toMatchObject({ aiRequestFatal: true, cause: denied });
      expect(execution.beforeAttempt).toHaveBeenCalledTimes(1);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('does not send the second outbound retry when its fresh recipient gate denies', async () => {
      jest.useFakeTimers();
      const { handles, execution } = makeLedger();
      const beforeProviderAttempt = jest
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValue(new Error('network policy denied'));
      mockFetch.mockResolvedValue({ ok: false, status: 503 });
      const request = service.runOpenAiCompatible(
        plan,
        { prompt: 'Hello', execution, beforeProviderAttempt },
        'auto',
        chatDecision,
      );
      const outcome = request.catch((error: unknown) => error);
      await flush();
      await jest.advanceTimersByTimeAsync(
        AI_CONSTANTS.OPENAI_COMPATIBLE_RETRY_BASE_DELAY_MS,
      );
      expect(await outcome).toMatchObject({ aiRequestFatal: true });
      expect(handles).toHaveLength(1);
      expect(handles[0].fail).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(execution.beforeAttempt).toHaveBeenCalledTimes(1);
      expect(jest.getTimerCount()).toBe(0);
    });

    it.each(['openai', 'gemini', 'model'])(
      'tracks %s schema/model fallback once per actual recipient request',
      async (lane) => {
        const { handles, execution } = makeLedger();
        const beforeProviderAttempt = jest.fn().mockResolvedValue(undefined);
        mockFetch
          .mockResolvedValueOnce({
            ok: false,
            status: 400,
            json: async () => ({
              error: { message: 'response_format unsupported' },
            }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => successfulBody,
          });
        const generateContent = jest
          .fn()
          .mockRejectedValueOnce(
            new Error(
              lane === 'model'
                ? '404 model not found'
                : 'response schema unsupported',
            ),
          )
          .mockResolvedValueOnce({
            text: '{"message":"Ready"}',
            usageMetadata: geminiUsage,
          });
        (service as any).genAI = { models: { generateContent } };
        const params = { prompt: 'Hello', execution, beforeProviderAttempt };
        if (lane === 'openai')
          await service.runOpenAiCompatible(
            plan,
            params,
            'auto',
            structuredDbDecision,
          );
        else if (lane === 'gemini')
          await service.runGemini(
            geminiPlan,
            params,
            'auto',
            structuredDbDecision,
          );
        else
          await service.completeGeminiText({
            ...params,
            model: geminiPlan.model,
          });
        expect(handles).toHaveLength(2);
        expect(handles[0].fail).toHaveBeenCalledTimes(1);
        expect(handles[0].complete).not.toHaveBeenCalled();
        expect(handles[1].complete).toHaveBeenCalledTimes(1);
        expect(handles[1].complete).toHaveBeenCalledWith(
          expect.objectContaining({ usage }),
        );
        expect(handles[1].fail).not.toHaveBeenCalled();
        expect(beforeProviderAttempt).toHaveBeenCalledTimes(3);
        const expectedModel =
          lane === 'model'
            ? 'gemini-3.5-flash-lite'
            : lane === 'openai'
              ? plan.model
              : geminiPlan.model;
        expect(execution.beforeAttempt.mock.calls[1][0].model).toBe(
          expectedModel,
        );
        expect(beforeProviderAttempt.mock.calls[2][0].model).toBe(
          expectedModel,
        );
      },
    );

    it.each(['openai', 'gemini'])(
      'retains %s stream attempt beyond headers/chunks and completes only with terminal usage',
      async (provider) => {
        const { handles, execution } = makeLedger();
        mockFetch.mockResolvedValue(
          createSseResponse([
            'data: {"choices":[{"delta":{"content":"Ready"}}]}\n',
            'data: ' +
              JSON.stringify({ choices: [], usage: openAiUsage }) +
              '\ndata: [DONE]\n',
          ]),
        );
        const generateContentStream = jest.fn().mockResolvedValue(
          (async function* () {
            yield { text: 'Ready' };
            yield { text: '', usageMetadata: geminiUsage };
          })(),
        );
        (service as any).genAI = { models: { generateContentStream } };
        const params = { prompt: 'Hello', execution };
        const stream =
          provider === 'openai'
            ? service.streamOpenAiCompatible(plan, params, 'auto', chatDecision)
            : service.streamGemini(geminiPlan, params, 'auto', chatDecision);
        expect(await stream.next()).toMatchObject({
          value: { type: 'chunk', text: 'Ready' },
        });
        expect(handles).toHaveLength(1);
        expect(handles[0].complete).not.toHaveBeenCalled();
        expect(handles[0].fail).not.toHaveBeenCalled();
        expect(await stream.next()).toMatchObject({
          value: { type: 'done', data: { usage } },
        });
        expect(handles[0].complete).toHaveBeenCalledTimes(1);
        expect(handles[0].complete).toHaveBeenCalledWith(
          expect.objectContaining({ usage }),
        );
        expect(await stream.next()).toEqual({ done: true, value: undefined });
        expect(handles[0].fail).not.toHaveBeenCalled();
        expect(execution.beforeAttempt).toHaveBeenCalledTimes(1);
      },
    );

    it.each(['openai', 'gemini'])(
      'settles %s stream consumer return as cancelled with received usage and no done',
      async (provider) => {
        const { handles, execution } = makeLedger();
        mockFetch.mockResolvedValue(
          createSseResponse([
            'data: ' +
              JSON.stringify({
                choices: [{ delta: { content: 'Ready' } }],
                usage: openAiUsage,
              }) +
              '\n',
            'data: [DONE]\n',
          ]),
        );
        const generateContentStream = jest.fn().mockResolvedValue(
          (async function* () {
            yield { text: 'Ready', usageMetadata: geminiUsage };
            yield { text: 'Late' };
          })(),
        );
        (service as any).genAI = { models: { generateContentStream } };
        const params = { prompt: 'Hello', execution };
        const stream =
          provider === 'openai'
            ? service.streamOpenAiCompatible(plan, params, 'auto', chatDecision)
            : service.streamGemini(geminiPlan, params, 'auto', chatDecision);
        await stream.next();
        expect(await stream.return(undefined)).toEqual({
          done: true,
          value: undefined,
        });
        expect(handles[0].fail).toHaveBeenCalledTimes(1);
        expect(handles[0].fail).toHaveBeenCalledWith(
          'cancelled',
          expect.objectContaining({ usage }),
        );
        expect(handles[0].complete).not.toHaveBeenCalled();
      },
    );

    it('tracks unknown usage for a terminal HTTP failure even when its error body advertises usage', async () => {
      const { handles, execution } = makeLedger();
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({
          error: { message: 'denied' },
          usage: openAiUsage,
        }),
      });
      await expect(
        service.runOpenAiCompatible(
          plan,
          { prompt: 'Hello', execution },
          'auto',
          chatDecision,
        ),
      ).rejects.toThrow('401');
      expect(handles[0].fail).toHaveBeenCalledWith(
        'failed',
        expect.objectContaining({ usage: undefined }),
      );
      expect(handles[0].fail).toHaveBeenCalledTimes(1);
      expect(handles[0].complete).not.toHaveBeenCalled();
    });

    it.each(['complete', 'fail'])(
      'propagates fatal ledger %s persistence errors without retry/fallback or double settlement',
      async (settlement) => {
        const { handles, execution } = makeLedger();
        const fatal = new Error('network response schema ledger unavailable');
        execution.beforeAttempt.mockImplementationOnce(async () => {
          const handle = {
            attemptId: 'fatal-attempt',
            complete: jest.fn().mockResolvedValue(undefined),
            fail: jest.fn().mockResolvedValue(undefined),
          };
          handle[settlement].mockRejectedValue(fatal);
          handles.push(handle);
          return handle;
        });
        const generateContent =
          settlement === 'complete'
            ? jest.fn().mockResolvedValue({
                text: '{"message":"Ready"}',
                usageMetadata: geminiUsage,
              })
            : jest
                .fn()
                .mockRejectedValue(new Error('response schema unsupported'));
        (service as any).genAI = { models: { generateContent } };
        await expect(
          service.runGemini(
            geminiPlan,
            { prompt: 'Hello', execution },
            'auto',
            structuredDbDecision,
          ),
        ).rejects.toMatchObject({ aiRequestFatal: true, cause: fatal });
        expect(execution.beforeAttempt).toHaveBeenCalledTimes(1);
        expect(generateContent).toHaveBeenCalledTimes(1);
        expect(handles[0][settlement]).toHaveBeenCalledTimes(1);
        expect(
          handles[0][settlement === 'complete' ? 'fail' : 'complete'],
        ).not.toHaveBeenCalled();
      },
    );

    it('propagates terminal OpenAI stream persistence failure instead of emitting done', async () => {
      const { handles, execution } = makeLedger();
      mockFetch.mockResolvedValue(
        createSseResponse([
          'data: {"choices":[{"delta":{"content":"Ready"}}]}\ndata: [DONE]\n',
        ]),
      );
      const stream = service.streamOpenAiCompatible(
        plan,
        { prompt: 'Hello', execution },
        'auto',
        chatDecision,
      );
      await stream.next();
      handles[0].complete.mockRejectedValue(new Error('ledger failed'));
      await expect(stream.next()).rejects.toMatchObject({
        aiRequestFatal: true,
      });
      expect(handles[0].complete).toHaveBeenCalledTimes(1);
      expect(handles[0].fail).not.toHaveBeenCalled();
      expect(await stream.next()).toEqual({ done: true, value: undefined });
    });
  });

  it('uses only pinned AI transport with bounded body decoding and a fresh boundary gate', async () => {
    const ordinaryFetch = jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('Ordinary fetch is forbidden'));
    const beforeProviderRequest = jest.fn().mockResolvedValue(undefined);
    const beforeProviderAttempt = jest.fn().mockResolvedValue(undefined);
    const beforeAttempt = jest.fn().mockResolvedValue({
      attemptId: 'attempt-fixture',
      complete: jest.fn(),
      fail: jest.fn(),
    });
    const plan = {
      provider: 'custom' as const,
      model: 'fixture',
      apiKey: 'key-fixture',
      baseUrl: 'https://fixture.example/v1',
    };
    const response = new Response(
      JSON.stringify({
        choices: [{ message: { content: '{"message":"Ready"}' } }],
      }),
      {
        headers: { 'content-type': 'application/json' },
      },
    );
    mockFetch.mockImplementationOnce(async (_url, _init, options) => {
      await options.beforeDispatch();
      return response;
    });
    try {
      await expect(
        service.runOpenAiCompatible(
          plan,
          {
            prompt: 'Hello',
            beforeProviderRequest,
            beforeProviderAttempt,
            execution: { generationId: 'generation-fixture', beforeAttempt },
          },
          'auto',
          structuredDbDecision,
        ),
      ).resolves.toMatchObject({ message: 'Ready' });
      expect(ordinaryFetch).not.toHaveBeenCalled();
      expect(beforeAttempt).toHaveBeenCalledTimes(1);
      expect(beforeProviderRequest).toHaveBeenCalledTimes(2);
      expect(beforeProviderAttempt).toHaveBeenCalledTimes(3);
      expect(mockFetch.mock.calls[0]?.[2]).toMatchObject({
        maxRequestBytes: 10 * 1024 * 1024,
        maxResponseBytes: 2 * 1024 * 1024,
        timeoutMs: expect.any(Number),
        beforeDispatch: expect.any(Function),
      });
      expect(readAiProviderJsonMock).toHaveBeenCalledWith(
        response,
        2 * 1024 * 1024,
      );
    } finally {
      ordinaryFetch.mockRestore();
    }
  });

  it('denies a revoked recipient at the pinned boundary without a second reservation', async () => {
    const denied = new Error('recipient revoked after DNS');
    const beforeProviderAttempt = jest
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValue(denied);
    const fail = jest.fn();
    const complete = jest.fn();
    const beforeAttempt = jest
      .fn()
      .mockResolvedValue({ attemptId: 'attempt-fixture', fail, complete });
    mockFetch.mockImplementationOnce(async (_url, _init, options) => {
      await options.beforeDispatch();
      throw new Error('Unreachable after policy denial');
    });
    await expect(
      service.completeOpenAiCompatibleText(
        {
          provider: 'custom',
          model: 'fixture',
          apiKey: 'key-fixture',
          baseUrl: 'https://fixture.example/v1',
        },
        {
          prompt: 'Hello',
          systemPrompt: 'Be concise',
          beforeProviderAttempt,
          execution: { generationId: 'generation-fixture', beforeAttempt },
        },
      ),
    ).rejects.toMatchObject({ aiRequestFatal: true, cause: denied });
    expect(beforeAttempt).toHaveBeenCalledTimes(1);
    expect(fail).toHaveBeenCalledTimes(1);
    expect(complete).not.toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('rejects a valid-looking partial stream if the provider omits its terminal marker', async () => {
    const response = createSseResponse([
      'data: {"choices":[{"delta":{"content":"Partial answer"}}]}\n',
    ]);
    mockFetch.mockResolvedValue(response);
    const stream = service.streamOpenAiCompatible(
      {
        provider: 'custom',
        model: 'fixture',
        apiKey: 'key-fixture',
        baseUrl: 'https://fixture.example/v1',
      },
      { prompt: 'Hello' },
      'auto',
      liveSearchDecision,
    );
    expect(await stream.next()).toMatchObject({
      value: { type: 'chunk', text: 'Partial answer' },
    });
    await expect(stream.next()).rejects.toThrow('without a terminal marker');
    expect(response.body?.locked).toBe(false);
  });

  it('does not retry unsafe-address or body-limit transport failures', async () => {
    const { AiProviderTransportError } = jest.requireActual<
      typeof import('./ai-provider-transport')
    >('./ai-provider-transport');
    mockFetch.mockRejectedValue(
      new AiProviderTransportError('UNSAFE_ADDRESS', 'Unsafe provider address'),
    );
    await expect(
      service.completeOpenAiCompatibleText(
        {
          provider: 'custom',
          model: 'fixture',
          apiKey: 'key-fixture',
          baseUrl: 'https://fixture.example/v1',
        },
        { prompt: 'Hello', systemPrompt: 'Be concise' },
      ),
    ).rejects.toThrow('Unsafe provider address');
    expect(mockFetch).toHaveBeenCalledTimes(1);
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
