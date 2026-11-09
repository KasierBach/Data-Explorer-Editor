import {
  AiGeminiProviderError,
  AiGeminiTransport,
  type AiGeminiRequest,
} from './ai-gemini-transport';
import { fetchAiProvider, readAiProviderJson } from './ai-provider-transport';
import { AiRequestStoppedError } from './ai-request-lifecycle';

jest.mock('./ai-provider-transport', () => ({
  ...jest.requireActual('./ai-provider-transport'),
  fetchAiProvider: jest.fn(),
  readAiProviderJson: jest.fn(),
}));

const fetchMock = jest.mocked(fetchAiProvider);
const jsonMock = jest.mocked(readAiProviderJson);
const usage = {
  promptTokenCount: 7,
  candidatesTokenCount: 3,
  totalTokenCount: 10,
};
const request: AiGeminiRequest = {
  model: 'gemini-fixture',
  contents: 'Hello',
  config: { maxOutputTokens: 32 },
};
const reply = (text = 'Ready', finishReason: string | null = 'STOP') => ({
  candidates: [
    {
      index: 0,
      content: { role: 'model', parts: [{ text }] },
      ...(finishReason ? { finishReason } : {}),
    },
  ],
  usageMetadata: usage,
});
const jsonResponse = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
const sseResponse = (values: unknown[], suffix = '') =>
  new Response(
    values.map((value) => `data: ${JSON.stringify(value)}\n\n`).join('') +
      suffix,
    { headers: { 'content-type': 'text/event-stream' } },
  );
const collect = async (iterator: AsyncGenerator<unknown>) => {
  const values: unknown[] = [];
  for await (const value of iterator) values.push(value);
  return values;
};

async function flush() {
  for (let index = 0; index < 30; index++) await Promise.resolve();
}

describe('owned Gemini transport', () => {
  let transport: AiGeminiTransport;
  beforeEach(() => {
    jest.clearAllMocks();
    fetchMock.mockReset();
    jsonMock.mockImplementation((response) => response.json());
    transport = new AiGeminiTransport('fixture-key');
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('serializes only the supported request subset with credentials in headers', async () => {
    const beforeDispatch = jest.fn();
    fetchMock.mockImplementationOnce(async (_url, _init, options) => {
      await options?.beforeDispatch?.();
      return jsonResponse(reply());
    });
    const result = await transport.models.generateContent(
      {
        ...request,
        contents: [
          { role: 'user', parts: [{ text: 'Prior question' }] },
          { role: 'model', parts: [{ text: 'Prior answer' }] },
          { role: 'user', parts: [{ text: 'Current question' }] },
        ],
        config: {
          temperature: 0.1,
          maxOutputTokens: 32,
          systemInstruction: 'Use the supplied schema',
          responseMimeType: 'application/json',
          responseJsonSchema: { type: 'object' },
          tools: [{ googleSearch: {} }],
        },
      },
      { beforeDispatch },
    );
    const [url, init, options] = fetchMock.mock.calls[0];
    expect(url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-fixture:generateContent',
    );
    expect(String(url)).not.toContain('fixture-key');
    expect(init?.headers).toMatchObject({
      'x-goog-api-key': 'fixture-key',
      'content-type': 'application/json',
    });
    expect(JSON.parse(init?.body as string)).toEqual({
      contents: [
        { role: 'user', parts: [{ text: 'Prior question' }] },
        { role: 'model', parts: [{ text: 'Prior answer' }] },
        { role: 'user', parts: [{ text: 'Current question' }] },
      ],
      systemInstruction: {
        role: 'user',
        parts: [{ text: 'Use the supplied schema' }],
      },
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 32,
        responseMimeType: 'application/json',
        responseJsonSchema: { type: 'object' },
      },
      tools: [{ googleSearch: {} }],
    });
    expect(options).toMatchObject({
      maxRequestBytes: 10 * 1024 * 1024,
      maxResponseBytes: 2 * 1024 * 1024,
      timeoutMs: 90_000,
    });
    expect(beforeDispatch).toHaveBeenCalledTimes(1);
    expect(result.text).toBe('Ready');
    expect(result.usageMetadata).toEqual(usage);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('preserves validated inline image and PDF contents', async () => {
    fetchMock.mockResolvedValue(jsonResponse(reply()));
    const parts = [
      { text: 'Inspect these' },
      {
        inlineData: {
          mimeType: 'image/png',
          data: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).toString(
            'base64',
          ),
        },
      },
      {
        inlineData: {
          mimeType: 'application/pdf',
          data: Buffer.from('%PDF-1.7').toString('base64'),
        },
      },
    ];
    await transport.models.generateContent({
      ...request,
      contents: [{ role: 'user', parts }],
    });
    expect(
      JSON.parse(fetchMock.mock.calls[0][1]?.body as string).contents[0].parts,
    ).toEqual(parts);
  });

  it.each([
    '../fixture',
    'models/gemini-fixture',
    'gemini?key=secret',
    'fixture:generateContent',
    'https://other.example',
    '',
    'x'.repeat(201),
  ])('refuses unsafe model %s before transport', async (model) => {
    await expect(
      transport.models.generateContent({ ...request, model }),
    ).rejects.toMatchObject({ code: 'GEMINI_INVALID_REQUEST' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(['', 'Bearer key', 'secret\nheader', 'x'.repeat(8193)])(
    'rejects invalid API key without echo %j',
    (apiKey) => {
      expect(() => new AiGeminiTransport(apiKey)).toThrow(
        'Invalid Gemini request',
      );
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it.each([
    { tools: [{ functionDeclarations: [] }] },
    { candidateCount: 2 },
    { httpOptions: { baseUrl: 'https://other.example' } },
    { responseJsonSchema: { type: 'object' } },
    { temperature: Infinity },
    { maxOutputTokens: 12_289 },
  ])(
    'rejects unsupported generation control %j rather than silently dropping it',
    async (config) => {
      await expect(
        transport.models.generateContent({
          ...request,
          config,
        } as AiGeminiRequest),
      ).rejects.toMatchObject({ code: 'GEMINI_INVALID_REQUEST' });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it('rejects aggregate input and false image signatures before fetching', async () => {
    await expect(
      transport.models.generateContent({
        ...request,
        contents: 'x'.repeat(10 * 1024 * 1024),
      }),
    ).rejects.toMatchObject({ code: 'GEMINI_INVALID_REQUEST' });
    await expect(
      transport.models.generateContent({
        ...request,
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: 'image/png',
                  data: Buffer.from('not an image').toString('base64'),
                },
              },
            ],
          },
        ],
      }),
    ).rejects.toMatchObject({ code: 'GEMINI_INVALID_REQUEST' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([401, 404, 429, 503])(
    'retains safe HTTP status %s without retrying or echoing provider body',
    async (status) => {
      fetchMock.mockResolvedValue(
        jsonResponse(
          {
            error: {
              code: status,
              message: 'secret-key SELECT private_column',
            },
          },
          status,
        ),
      );
      await expect(
        transport.models.generateContent(request),
      ).rejects.toMatchObject({
        status,
        code: 'GEMINI_HTTP',
        schemaUnsupported: false,
        message: `Gemini request failed (${status}).`,
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it('propagates only normalized Retry-After metadata without adapter retries', async () => {
    const response = jsonResponse(
      { error: { code: 429, message: 'private token and prompt' } },
      429,
    );
    response.headers.set('retry-after', '3');
    fetchMock.mockResolvedValue(response);
    await expect(
      transport.models.generateContent(request),
    ).rejects.toMatchObject({
      code: 'GEMINI_HTTP',
      status: 429,
      retryAfterMs: 3000,
      message: 'Gemini request failed (429).',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    'responseJsonSchema unsupported',
    'response schema unsupported',
    'responseMimeType application/json unsupported',
  ])('retains only schema fallback intent for %s', async (message) => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: { code: 400, message } }, 400),
    );
    await expect(
      transport.models.generateContent(request),
    ).rejects.toMatchObject({ status: 400, schemaUnsupported: true });
  });

  it('preserves partial received usage on blocked responses without inventing missing counters', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        promptFeedback: { blockReason: 'SAFETY' },
        usageMetadata: { promptTokenCount: 2, totalTokenCount: 'unknown' },
      }),
    );
    await expect(
      transport.models.generateContent(request),
    ).rejects.toMatchObject({
      code: 'GEMINI_BLOCKED',
      usageMetadata: { promptTokenCount: 2 },
    });
  });

  it.each(['MAX_TOKENS', 'SAFETY', 'RECITATION', 'OTHER'])(
    'does not accept valid-looking text stopped by %s',
    async (finish) => {
      fetchMock.mockResolvedValue(jsonResponse(reply('Ready', finish)));
      await expect(
        transport.models.generateContent(request),
      ).rejects.toMatchObject({
        code: finish === 'MAX_TOKENS' ? 'GEMINI_TRUNCATED' : 'GEMINI_BLOCKED',
        usageMetadata: usage,
      });
    },
  );

  it.each([
    null,
    {},
    { candidates: [] },
    { candidates: [{ content: { parts: [{ text: 'Ready' }] } }] },
    {
      candidates: [
        {
          index: 1,
          finishReason: 'STOP',
          content: { parts: [{ text: 'Ready' }] },
        },
      ],
    },
  ])('rejects malformed or unterminated JSON reply %j', async (payload) => {
    fetchMock.mockResolvedValue(jsonResponse(payload));
    await expect(
      transport.models.generateContent(request),
    ).rejects.toBeInstanceOf(AiGeminiProviderError);
  });

  it('excludes thought text and retains grounding metadata used by the existing reader', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        candidates: [
          {
            finishReason: 'STOP',
            content: {
              parts: [
                { text: 'Hidden reasoning', thought: true },
                { text: 'Visible answer' },
              ],
            },
            groundingMetadata: {
              groundingChunks: [
                { web: { title: 'Source', uri: 'https://example.com/source' } },
              ],
            },
          },
        ],
      }),
    );
    const result = await transport.models.generateContent(request);
    expect(result.text).toBe('Visible answer');
    expect(result.candidates?.[0].groundingMetadata?.groundingChunks).toEqual([
      { web: { title: 'Source', uri: 'https://example.com/source' } },
    ]);
    expect(result.usageMetadata).toBeUndefined();
  });

  it('checks HTTP errors eagerly before returning a stream iterator', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { error: { code: 400, message: 'responseJsonSchema unsupported' } },
        400,
      ),
    );
    await expect(
      transport.models.generateContentStream(request),
    ).rejects.toMatchObject({ status: 400, schemaUnsupported: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('decodes fragmented UTF-8/SSE and preserves final usage after STOP', async () => {
    const bytes = new TextEncoder().encode(
      `data: ${JSON.stringify(reply('Xin chào', null))}\r\n\r\ndata: ${JSON.stringify(reply('', 'STOP'))}\n\ndata: ${JSON.stringify({ usageMetadata: usage })}\n\n`,
    );
    fetchMock.mockResolvedValue(
      new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            for (const byte of bytes)
              controller.enqueue(new Uint8Array([byte]));
            controller.close();
          },
        }),
        { headers: { 'content-type': 'text/event-stream' } },
      ),
    );
    const iterator = await transport.models.generateContentStream(request);
    const values = (await collect(iterator)) as Array<{
      text?: string;
      usageMetadata?: unknown;
    }>;
    expect(values.map((value) => value.text ?? '').join('')).toBe('Xin chào');
    expect(values.at(-1)?.usageMetadata).toEqual(usage);
  });

  it.each([
    sseResponse([reply('Partial', null)]),
    sseResponse([reply('Ready')], 'data: {"incomplete":'),
    sseResponse([reply('Ready')], 'data: {"usageMetadata":{}}\n'),
  ])(
    'rejects partial EOF instead of emitting stream success',
    async (response) => {
      fetchMock.mockResolvedValue(response);
      await expect(
        collect(await transport.models.generateContentStream(request)),
      ).rejects.toMatchObject({ code: 'GEMINI_INCOMPLETE_STREAM' });
      expect(response.body?.locked).toBe(false);
    },
  );

  it('does not accept late answer text or a duplicate STOP after a completed candidate', async () => {
    fetchMock.mockResolvedValue(
      sseResponse([reply('Ready'), reply('Late text')]),
    );
    await expect(
      collect(await transport.models.generateContentStream(request)),
    ).rejects.toMatchObject({ code: 'GEMINI_INVALID_RESPONSE' });
  });

  it('retains received usage when a stream ends with a provider error', async () => {
    fetchMock.mockResolvedValue(
      sseResponse([
        reply('Partial', null),
        {
          error: { code: 429, message: 'secret echoed' },
          usageMetadata: usage,
        },
      ]),
    );
    await expect(
      collect(await transport.models.generateContentStream(request)),
    ).rejects.toMatchObject({
      status: 429,
      usageMetadata: usage,
      message: 'Gemini request failed (429).',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('releases a late headers response after cancellation won the owner race', async () => {
    let resolve!: (value: Response) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((done) => {
          resolve = done;
        }),
    );
    const controller = new AbortController();
    const pending = transport.models
      .generateContent({
        ...request,
        config: { abortSignal: controller.signal },
      })
      .catch((error) => error);
    await flush();
    controller.abort(new AiRequestStoppedError('AI_REQUEST_CANCELLED'));
    expect(await pending).toMatchObject({ reason: 'AI_REQUEST_CANCELLED' });
    const cancel = jest.fn();
    resolve(
      new Response(new ReadableStream<Uint8Array>({ cancel }), {
        headers: { 'content-type': 'application/json' },
      }),
    );
    await flush();
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('bounds return cleanup when an upstream body ignores cancellation', async () => {
    jest.useFakeTimers();
    const cancel = jest.fn(() => new Promise<void>(() => undefined));
    const body = new ReadableStream<Uint8Array>({ cancel });
    fetchMock.mockResolvedValue(
      new Response(body, { headers: { 'content-type': 'text/event-stream' } }),
    );
    const iterator = await transport.models.generateContentStream(request);
    const pending = iterator.return(undefined);
    await flush();
    await jest.advanceTimersByTimeAsync(100);
    expect(await pending).toEqual({ done: true, value: undefined });
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(body.locked).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('does not accept an error-named SSE event containing a forged successful candidate', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        `event: error\ndata: ${JSON.stringify(reply('Forged success'))}\n\n`,
        { headers: { 'content-type': 'text/event-stream' } },
      ),
    );
    await expect(
      collect(await transport.models.generateContentStream(request)),
    ).rejects.toMatchObject({ code: 'GEMINI_INVALID_RESPONSE' });
  });

  it.each([
    { promptFeedback: { blockReason: 123 } },
    { promptFeedback: { safetyRatings: [{ blocked: 'true' }] } },
    {
      candidates: [
        {
          finishReason: 'STOP',
          safetyRatings: 'invalid',
          content: { parts: [{ text: 'Forged answer' }] },
        },
      ],
    },
  ])(
    'fails closed for malformed provider safety evidence %j',
    async (extra) => {
      fetchMock.mockResolvedValue(jsonResponse({ ...reply(), ...extra }));
      await expect(
        transport.models.generateContent(request),
      ).rejects.toMatchObject({ code: 'GEMINI_INVALID_RESPONSE' });
    },
  );

  it('propagates transport body limits without classifying them as retryable HTTP errors', async () => {
    const { AiProviderTransportError } = jest.requireActual<
      typeof import('./ai-provider-transport')
    >('./ai-provider-transport');
    fetchMock.mockResolvedValue(jsonResponse({ error: { code: 503 } }, 503));
    jsonMock.mockRejectedValueOnce(
      new AiProviderTransportError(
        'LIMIT_EXCEEDED',
        'Provider response is too large',
      ),
    );
    await expect(
      transport.models.generateContent(request),
    ).rejects.toMatchObject({ code: 'LIMIT_EXCEEDED' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retains partial cumulative observed counters on stream failure', async () => {
    fetchMock.mockResolvedValue(
      sseResponse([
        {
          candidates: [{ content: { parts: [{ text: 'Partial' }] } }],
          usageMetadata: { promptTokenCount: 5 },
        },
        { usageMetadata: { candidatesTokenCount: 2 } },
        {
          error: { code: 400, message: 'Untrusted body' },
          usageMetadata: { totalTokenCount: 7 },
        },
      ]),
    );
    await expect(
      collect(await transport.models.generateContentStream(request)),
    ).rejects.toMatchObject({
      usageMetadata: {
        promptTokenCount: 5,
        candidatesTokenCount: 2,
        totalTokenCount: 7,
      },
    });
  });

  it('cancels an eagerly opened stream on return before first next', async () => {
    const cancel = jest.fn();
    const body = new ReadableStream<Uint8Array>({ cancel });
    fetchMock.mockResolvedValue(
      new Response(body, { headers: { 'content-type': 'text/event-stream' } }),
    );
    const iterator = await transport.models.generateContentStream(request);
    expect(body.locked).toBe(true);
    await iterator.return(undefined);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(body.locked).toBe(false);
    expect(await iterator.next()).toEqual({ value: undefined, done: true });
  });

  it('does no provider work for an already aborted request', async () => {
    const controller = new AbortController();
    controller.abort(new AiRequestStoppedError('AI_REQUEST_CANCELLED'));
    await expect(
      transport.models.generateContent({
        ...request,
        config: { abortSignal: controller.signal },
      }),
    ).rejects.toMatchObject({ reason: 'AI_REQUEST_CANCELLED' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('cancels an opened but unread stream at its deadline and releases its lock', async () => {
    jest.useFakeTimers();
    const cancel = jest.fn();
    const body = new ReadableStream<Uint8Array>({ cancel });
    fetchMock.mockResolvedValue(
      new Response(body, { headers: { 'content-type': 'text/event-stream' } }),
    );
    const iterator = await transport.models.generateContentStream({
      ...request,
      config: { httpOptions: { timeout: 10 } },
    });
    expect(body.locked).toBe(true);
    await jest.advanceTimersByTimeAsync(10);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(body.locked).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
    await expect(iterator.next()).rejects.toMatchObject({
      reason: 'AI_REQUEST_TIMEOUT',
    });
  });

  it('bounds stalled headers even when a fixture ignores the abort signal', async () => {
    jest.useFakeTimers();
    fetchMock.mockImplementation(() => new Promise(() => undefined));
    const pending = transport.models.generateContent({
      ...request,
      config: { httpOptions: { timeout: 10 } },
    });
    const outcome = pending.catch((error) => error);
    await flush();
    await jest.advanceTimersByTimeAsync(10);
    expect(await outcome).toMatchObject({ reason: 'AI_REQUEST_TIMEOUT' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('cancels stalled stream reads and releases lock/timers on caller stop', async () => {
    const cancel = jest.fn();
    const body = new ReadableStream<Uint8Array>({
      pull: () => new Promise(() => undefined),
      cancel,
    });
    fetchMock.mockResolvedValue(
      new Response(body, { headers: { 'content-type': 'text/event-stream' } }),
    );
    const controller = new AbortController();
    const iterator = await transport.models.generateContentStream({
      ...request,
      config: { abortSignal: controller.signal },
    });
    const pending = iterator.next().catch((error) => error);
    await flush();
    controller.abort(new AiRequestStoppedError('AI_REQUEST_CANCELLED'));
    expect(await pending).toMatchObject({ reason: 'AI_REQUEST_CANCELLED' });
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(body.locked).toBe(false);
  });

  it('bounds oversized response events and malformed UTF-8', async () => {
    fetchMock.mockResolvedValue(
      new Response('data: ' + 'x'.repeat(256 * 1024 + 1), {
        headers: { 'content-type': 'text/event-stream' },
      }),
    );
    await expect(
      collect(await transport.models.generateContentStream(request)),
    ).rejects.toMatchObject({ code: 'GEMINI_INVALID_RESPONSE' });
    fetchMock.mockResolvedValue(
      new Response(new Uint8Array([255]), {
        headers: { 'content-type': 'text/event-stream' },
      }),
    );
    await expect(
      collect(await transport.models.generateContentStream(request)),
    ).rejects.toThrow();
  });
});
