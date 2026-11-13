import { GenerateContentResponse, type Candidate } from '@google/genai';
import { parseAiRetryAfter } from './ai-retry-policy';
import { AI_CONSTANTS } from './ai.constants';
import {
  AI_INPUT_BOUNDS,
  assertAiBinaryDataUrl,
  assertAiSerializedInputBounds,
} from './ai-input-bounds';
import {
  fetchAiProvider,
  readAiProviderJson,
  AiProviderTransportError,
  type AiProviderTransportOptions,
} from './ai-provider-transport';
import {
  assertAiRequestActive,
  createAiRequestScope,
  waitForAiResult,
} from './ai-request-lifecycle';

const ORIGIN = 'https://generativelanguage.googleapis.com';
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_EVENT_CHARACTERS = 256 * 1024;
const MAX_TEXT_CHARACTERS = AI_CONSTANTS.MAX_OUTPUT_TOKENS * 16;
const CLEANUP_TIMEOUT_MS = 100;

type UsageMetadata = GenerateContentResponse['usageMetadata'];
type GeminiPart = {
  text?: string;
  inlineData?: { mimeType: string; data: string };
};
export interface AiGeminiRequest {
  model: string;
  contents: string | Array<{ role: 'user' | 'model'; parts: GeminiPart[] }>;
  config?: {
    systemInstruction?: string;
    temperature?: number;
    maxOutputTokens?: number;
    responseMimeType?: string;
    responseJsonSchema?: unknown;
    tools?: Array<{ googleSearch: Record<string, never> }>;
    abortSignal?: AbortSignal;
    httpOptions?: { timeout?: number };
  };
}

type GeminiErrorCode =
  | 'GEMINI_INVALID_REQUEST'
  | 'GEMINI_INVALID_RESPONSE'
  | 'GEMINI_HTTP'
  | 'GEMINI_BLOCKED'
  | 'GEMINI_TRUNCATED'
  | 'GEMINI_INCOMPLETE_STREAM';

export class AiGeminiProviderError extends Error {
  readonly status?: number;
  readonly schemaUnsupported: boolean;
  readonly usageMetadata?: UsageMetadata;
  readonly retryAfterMs?: number;

  constructor(
    readonly code: GeminiErrorCode,
    options: {
      status?: number;
      schemaUnsupported?: boolean;
      usageMetadata?: UsageMetadata;
      retryAfterMs?: number;
    } = {},
  ) {
    super(
      code === 'GEMINI_HTTP'
        ? `Gemini request failed (${options.status ?? 500}).`
        : code === 'GEMINI_INCOMPLETE_STREAM'
          ? 'Gemini stream ended without a complete terminal response.'
          : code === 'GEMINI_BLOCKED'
            ? 'Gemini did not return an allowed answer.'
            : code === 'GEMINI_TRUNCATED'
              ? 'Gemini response was truncated.'
              : code === 'GEMINI_INVALID_REQUEST'
                ? 'Invalid Gemini request.'
                : 'Gemini returned an invalid response.',
    );
    this.name = 'AiGeminiProviderError';
    this.status = options.status;
    this.schemaUnsupported = options.schemaUnsupported === true;
    this.usageMetadata = options.usageMetadata;
    this.retryAfterMs = options.retryAfterMs;
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function requestFields(
  value: unknown,
  fields: string[],
): Record<string, unknown> {
  if (
    !record(value) ||
    Object.keys(value).some((key) => !fields.includes(key))
  ) {
    throw new AiGeminiProviderError('GEMINI_INVALID_REQUEST');
  }
  return value;
}

function boundedPositive(value: unknown, maximum: number): number {
  if (
    !Number.isSafeInteger(value) ||
    (value as number) < 1 ||
    (value as number) > maximum
  ) {
    throw new AiGeminiProviderError('GEMINI_INVALID_REQUEST');
  }
  return value as number;
}

function buildGeminiRequest(request: AiGeminiRequest) {
  requestFields(request, ['model', 'contents', 'config']);
  if (
    typeof request.model !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/.test(request.model)
  ) {
    throw new AiGeminiProviderError('GEMINI_INVALID_REQUEST');
  }
  const config = requestFields(request.config ?? {}, [
    'systemInstruction',
    'temperature',
    'maxOutputTokens',
    'responseMimeType',
    'responseJsonSchema',
    'tools',
    'abortSignal',
    'httpOptions',
  ]);
  const http = requestFields(config.httpOptions ?? {}, ['timeout']);
  if (
    config.abortSignal !== undefined &&
    !(config.abortSignal instanceof AbortSignal)
  ) {
    throw new AiGeminiProviderError('GEMINI_INVALID_REQUEST');
  }
  const contents =
    typeof request.contents === 'string'
      ? [{ role: 'user', parts: [{ text: request.contents }] }]
      : request.contents;
  if (
    !Array.isArray(contents) ||
    !contents.length ||
    contents.length > AI_CONSTANTS.CHAT_HISTORY_MAX_MESSAGES + 1
  ) {
    throw new AiGeminiProviderError('GEMINI_INVALID_REQUEST');
  }
  const normalized = contents.map((content) => {
    const entry = requestFields(content, ['role', 'parts']);
    if (
      !['user', 'model'].includes(entry.role as string) ||
      !Array.isArray(entry.parts) ||
      !entry.parts.length ||
      entry.parts.length > 3
    ) {
      throw new AiGeminiProviderError('GEMINI_INVALID_REQUEST');
    }
    const parts = entry.parts.map((part: unknown) => {
      const value = requestFields(part, ['text', 'inlineData']);
      if (Object.keys(value).length !== 1)
        throw new AiGeminiProviderError('GEMINI_INVALID_REQUEST');
      if (typeof value.text === 'string') return { text: value.text };
      const binary = requestFields(value.inlineData, ['mimeType', 'data']);
      if (
        typeof binary.mimeType !== 'string' ||
        typeof binary.data !== 'string'
      ) {
        throw new AiGeminiProviderError('GEMINI_INVALID_REQUEST');
      }
      const kind = binary.mimeType === 'application/pdf' ? 'pdf' : 'image';
      const characters =
        kind === 'pdf'
          ? AI_INPUT_BOUNDS.maxPdfDataUrlCharacters
          : AI_INPUT_BOUNDS.maxImageDataUrlCharacters;
      if (binary.data.length > characters)
        throw new AiGeminiProviderError('GEMINI_INVALID_REQUEST');
      try {
        assertAiBinaryDataUrl(
          `data:${binary.mimeType};base64,${binary.data}`,
          kind,
        );
      } catch {
        throw new AiGeminiProviderError('GEMINI_INVALID_REQUEST');
      }
      return { inlineData: { mimeType: binary.mimeType, data: binary.data } };
    });
    return { role: entry.role, parts };
  });
  const generationConfig: Record<string, unknown> = {};
  if (config.temperature !== undefined) {
    if (
      typeof config.temperature !== 'number' ||
      !Number.isFinite(config.temperature) ||
      config.temperature < 0 ||
      config.temperature > 2
    ) {
      throw new AiGeminiProviderError('GEMINI_INVALID_REQUEST');
    }
    generationConfig.temperature = config.temperature;
  }
  if (config.maxOutputTokens !== undefined) {
    generationConfig.maxOutputTokens = boundedPositive(
      config.maxOutputTokens,
      AI_CONSTANTS.MAX_OUTPUT_TOKENS,
    );
  }
  if (config.responseMimeType !== undefined) {
    if (config.responseMimeType !== 'application/json')
      throw new AiGeminiProviderError('GEMINI_INVALID_REQUEST');
    generationConfig.responseMimeType = config.responseMimeType;
  }
  if (config.responseJsonSchema !== undefined) {
    if (
      !record(config.responseJsonSchema) ||
      config.responseMimeType !== 'application/json'
    ) {
      throw new AiGeminiProviderError('GEMINI_INVALID_REQUEST');
    }
    generationConfig.responseJsonSchema = config.responseJsonSchema;
  }
  if (
    config.systemInstruction !== undefined &&
    typeof config.systemInstruction !== 'string'
  ) {
    throw new AiGeminiProviderError('GEMINI_INVALID_REQUEST');
  }
  if (
    config.tools !== undefined &&
    (!Array.isArray(config.tools) ||
      config.tools.length !== 1 ||
      !record(config.tools[0]) ||
      Object.keys(config.tools[0]).length !== 1 ||
      !record(config.tools[0].googleSearch) ||
      Object.keys(config.tools[0].googleSearch).length !== 0)
  )
    throw new AiGeminiProviderError('GEMINI_INVALID_REQUEST');
  const body = {
    contents: normalized,
    ...(config.systemInstruction !== undefined
      ? {
          systemInstruction: {
            role: 'user',
            parts: [{ text: config.systemInstruction }],
          },
        }
      : {}),
    ...(Object.keys(generationConfig).length ? { generationConfig } : {}),
    ...(config.tools !== undefined ? { tools: config.tools } : {}),
  };
  try {
    assertAiSerializedInputBounds(body);
  } catch {
    throw new AiGeminiProviderError('GEMINI_INVALID_REQUEST');
  }
  return {
    model: request.model,
    body: JSON.stringify(body),
    signal: config.abortSignal,
    timeoutMs:
      http.timeout === undefined
        ? AI_CONSTANTS.DEFAULT_PROVIDER_TIMEOUT_MS
        : boundedPositive(
            http.timeout,
            AI_CONSTANTS.DEFAULT_PROVIDER_TIMEOUT_MS,
          ),
  };
}

function normalizeGeminiUsage(value: unknown): UsageMetadata {
  if (!record(value)) return undefined;
  const result: NonNullable<UsageMetadata> = {};
  for (const key of [
    'promptTokenCount',
    'candidatesTokenCount',
    'totalTokenCount',
  ] as const) {
    const count = value[key];
    if (
      typeof count === 'number' &&
      Number.isSafeInteger(count) &&
      count >= 0 &&
      count <= 2_147_483_647
    )
      result[key] = count;
  }
  return Object.keys(result).length ? result : undefined;
}

function geminiHttpError(
  status: number,
  payload: unknown,
  retryAfterMs?: number,
): AiGeminiProviderError {
  const data = record(payload) ? payload : {};
  const error = record(data.error) ? data.error : {};
  // Inspect only for the runner's schema fallback decision; never expose a body.
  const message =
    typeof error.message === 'string'
      ? error.message.slice(0, 4096).toLowerCase()
      : '';
  return new AiGeminiProviderError('GEMINI_HTTP', {
    status,
    retryAfterMs,
    schemaUnsupported:
      [400, 404, 415, 422].includes(status) &&
      /response[_ ]?(?:json[_ ]?)?schema|structured output|response[_ ]?mime|application\/json/.test(
        message,
      ),
    usageMetadata: normalizeGeminiUsage(data.usageMetadata),
  });
}

function normalizeGeminiResponse(payload: unknown, streaming: boolean) {
  try {
    assertAiSerializedInputBounds(payload);
  } catch {
    throw new AiGeminiProviderError('GEMINI_INVALID_RESPONSE');
  }
  if (!record(payload))
    throw new AiGeminiProviderError('GEMINI_INVALID_RESPONSE');
  const usageMetadata = normalizeGeminiUsage(payload.usageMetadata);
  if (record(payload.error)) {
    const status =
      typeof payload.error.code === 'number' &&
      Number.isInteger(payload.error.code) &&
      payload.error.code >= 400 &&
      payload.error.code <= 599
        ? payload.error.code
        : 500;
    throw geminiHttpError(status, payload);
  }
  if (payload.promptFeedback !== undefined && !record(payload.promptFeedback)) {
    throw new AiGeminiProviderError('GEMINI_INVALID_RESPONSE', {
      usageMetadata,
    });
  }
  if (record(payload.promptFeedback)) {
    const reason = payload.promptFeedback.blockReason;
    if (reason !== undefined && typeof reason !== 'string')
      throw new AiGeminiProviderError('GEMINI_INVALID_RESPONSE', {
        usageMetadata,
      });
    if (reason && reason !== 'BLOCK_REASON_UNSPECIFIED')
      throw new AiGeminiProviderError('GEMINI_BLOCKED', { usageMetadata });
    const ratings = payload.promptFeedback.safetyRatings;
    if (ratings !== undefined) {
      if (
        !Array.isArray(ratings) ||
        ratings.length > 64 ||
        ratings.some(
          (rating) =>
            !record(rating) ||
            (rating.blocked !== undefined &&
              typeof rating.blocked !== 'boolean'),
        )
      )
        throw new AiGeminiProviderError('GEMINI_INVALID_RESPONSE', {
          usageMetadata,
        });
      if (ratings.some((rating) => rating.blocked === true))
        throw new AiGeminiProviderError('GEMINI_BLOCKED', { usageMetadata });
    }
  }
  const response = new GenerateContentResponse();
  response.usageMetadata = usageMetadata;
  if (payload.candidates === undefined && streaming && usageMetadata)
    return { response, terminal: false };
  if (
    !Array.isArray(payload.candidates) ||
    payload.candidates.length !== 1 ||
    !record(payload.candidates[0])
  ) {
    throw new AiGeminiProviderError('GEMINI_INVALID_RESPONSE', {
      usageMetadata,
    });
  }
  const raw = payload.candidates[0];
  if (raw.index !== undefined && raw.index !== 0)
    throw new AiGeminiProviderError('GEMINI_INVALID_RESPONSE', {
      usageMetadata,
    });
  if (
    raw.safetyRatings !== undefined &&
    (!Array.isArray(raw.safetyRatings) ||
      raw.safetyRatings.length > 64 ||
      raw.safetyRatings.some(
        (rating: unknown) =>
          !record(rating) ||
          (rating.blocked !== undefined && typeof rating.blocked !== 'boolean'),
      ))
  ) {
    throw new AiGeminiProviderError('GEMINI_INVALID_RESPONSE', {
      usageMetadata,
    });
  }
  if (
    Array.isArray(raw.safetyRatings) &&
    raw.safetyRatings.some(
      (rating: unknown) => record(rating) && rating.blocked === true,
    )
  ) {
    throw new AiGeminiProviderError('GEMINI_BLOCKED', { usageMetadata });
  }
  const finish = raw.finishReason;
  if (finish !== undefined && typeof finish !== 'string')
    throw new AiGeminiProviderError('GEMINI_INVALID_RESPONSE', {
      usageMetadata,
    });
  if (finish && finish !== 'STOP' && finish !== 'FINISH_REASON_UNSPECIFIED') {
    throw new AiGeminiProviderError(
      finish === 'MAX_TOKENS' ? 'GEMINI_TRUNCATED' : 'GEMINI_BLOCKED',
      { usageMetadata },
    );
  }
  if (!streaming && finish !== 'STOP')
    throw new AiGeminiProviderError('GEMINI_INVALID_RESPONSE', {
      usageMetadata,
    });
  const candidate: Candidate = {
    index: 0,
    ...(finish === 'STOP'
      ? { finishReason: 'STOP' as Candidate['finishReason'] }
      : {}),
  };
  if (raw.content !== undefined) {
    if (
      !record(raw.content) ||
      (raw.content.role !== undefined && raw.content.role !== 'model') ||
      !Array.isArray(raw.content.parts) ||
      raw.content.parts.length > 64
    ) {
      throw new AiGeminiProviderError('GEMINI_INVALID_RESPONSE', {
        usageMetadata,
      });
    }
    const parts: Array<{ text: string }> = [];
    let textLength = 0;
    for (const part of raw.content.parts) {
      if (
        !record(part) ||
        typeof part.text !== 'string' ||
        (part.thought !== undefined && typeof part.thought !== 'boolean')
      )
        throw new AiGeminiProviderError('GEMINI_INVALID_RESPONSE', {
          usageMetadata,
        });
      if (part.thought === true) continue;
      textLength += part.text.length;
      if (textLength > MAX_TEXT_CHARACTERS)
        throw new AiGeminiProviderError('GEMINI_INVALID_RESPONSE', {
          usageMetadata,
        });
      parts.push({ text: part.text });
    }
    candidate.content = { role: 'model', parts };
  }
  if (
    record(raw.groundingMetadata) &&
    raw.groundingMetadata.groundingChunks !== undefined
  ) {
    const chunks = raw.groundingMetadata.groundingChunks;
    if (!Array.isArray(chunks) || chunks.length > 64)
      throw new AiGeminiProviderError('GEMINI_INVALID_RESPONSE', {
        usageMetadata,
      });
    candidate.groundingMetadata = {
      groundingChunks: chunks.flatMap((chunk: unknown) => {
        if (
          !record(chunk) ||
          !record(chunk.web) ||
          typeof chunk.web.uri !== 'string' ||
          typeof chunk.web.title !== 'string' ||
          chunk.web.uri.length > 8192 ||
          chunk.web.title.length > 1024
        )
          return [];
        return [{ web: { uri: chunk.web.uri, title: chunk.web.title } }];
      }),
    };
  }
  response.candidates = [candidate];
  if (
    typeof payload.modelVersion === 'string' &&
    payload.modelVersion.length <= 200
  )
    response.modelVersion = payload.modelVersion;
  return { response, terminal: finish === 'STOP' };
}

async function cancelGeminiBody(cancel: () => Promise<unknown>): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.resolve()
        .then(cancel)
        .catch(() => undefined),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, CLEANUP_TIMEOUT_MS);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** Only the app's Gemini Developer API subset. No SDK HTTP or internal retry. */
export class AiGeminiTransport {
  readonly models = {
    generateContent: (
      request: AiGeminiRequest,
      options: AiProviderTransportOptions = {},
    ) => this.generateContent(request, options),
    generateContentStream: (
      request: AiGeminiRequest,
      options: AiProviderTransportOptions = {},
    ) => this.generateContentStream(request, options),
  };

  constructor(private readonly apiKey: string) {
    if (
      typeof apiKey !== 'string' ||
      !apiKey ||
      apiKey.length > 8192 ||
      /\s/.test(apiKey)
    )
      throw new AiGeminiProviderError('GEMINI_INVALID_REQUEST');
    for (let index = 0; index < apiKey.length; index++) {
      const code = apiKey.charCodeAt(index);
      if (code < 32 || code >= 127)
        throw new AiGeminiProviderError('GEMINI_INVALID_REQUEST');
    }
  }

  private async open(
    request: AiGeminiRequest,
    streaming: boolean,
    options: AiProviderTransportOptions,
  ) {
    const built = buildGeminiRequest(request);
    requestFields(options, [
      'maxRequestBytes',
      'maxResponseBytes',
      'maxHeaderBytes',
      'timeoutMs',
      'beforeDispatch',
    ]);
    const timeoutMs = Math.min(
      built.timeoutMs,
      options.timeoutMs === undefined
        ? built.timeoutMs
        : boundedPositive(
            options.timeoutMs,
            AI_CONSTANTS.DEFAULT_PROVIDER_TIMEOUT_MS,
          ),
    );
    const scope = createAiRequestScope({ signal: built.signal, timeoutMs });
    let response: Response | undefined;
    try {
      assertAiRequestActive(scope);
      const url = `${ORIGIN}/v1beta/models/${encodeURIComponent(built.model)}:${streaming ? 'streamGenerateContent?alt=sse' : 'generateContent'}`;
      const pending = fetchAiProvider(
        url,
        {
          method: 'POST',
          body: built.body,
          signal: scope.signal,
          redirect: 'manual',
          headers: {
            'content-type': 'application/json',
            'x-goog-api-key': this.apiKey,
            accept: streaming ? 'text/event-stream' : 'application/json',
          },
        },
        {
          maxRequestBytes:
            options.maxRequestBytes === undefined
              ? AI_INPUT_BOUNDS.maxSerializedBytes
              : boundedPositive(
                  options.maxRequestBytes,
                  AI_INPUT_BOUNDS.maxSerializedBytes,
                ),
          maxResponseBytes:
            options.maxResponseBytes === undefined
              ? MAX_RESPONSE_BYTES
              : boundedPositive(options.maxResponseBytes, MAX_RESPONSE_BYTES),
          maxHeaderBytes:
            options.maxHeaderBytes === undefined
              ? 16 * 1024
              : boundedPositive(options.maxHeaderBytes, 16 * 1024),
          timeoutMs,
          beforeDispatch: async () => {
            assertAiRequestActive(scope);
            await options.beforeDispatch?.();
            assertAiRequestActive(scope);
          },
        },
      );
      // An abort can win before headers arrive. A late fixture/native result
      // must still release the body rather than outlive its HTTP owner.
      void pending.then(
        async (late) => {
          if (scope.signal.aborted && late.body && !late.body.locked) {
            await cancelGeminiBody(() => late.body!.cancel());
          }
        },
        () => undefined,
      );
      response = await waitForAiResult(pending, scope.signal);
      assertAiRequestActive(scope);
      if (!response.ok) {
        let payload: unknown;
        try {
          payload = await waitForAiResult(
            readAiProviderJson(response, MAX_RESPONSE_BYTES),
            scope.signal,
          );
        } catch (error) {
          assertAiRequestActive(scope);
          if (
            error instanceof AiProviderTransportError &&
            error.code !== 'INVALID_JSON'
          )
            throw error;
        }
        throw geminiHttpError(
          response.status,
          payload,
          parseAiRetryAfter(response.headers.get('retry-after')),
        );
      }
      return { response, scope };
    } catch (error) {
      scope.abort();
      try {
        if (response?.body && !response.body.locked)
          await cancelGeminiBody(() => response!.body!.cancel());
      } finally {
        scope.dispose();
      }
      throw error;
    }
  }

  private async generateContent(
    request: AiGeminiRequest,
    options: AiProviderTransportOptions,
  ): Promise<GenerateContentResponse> {
    const { response, scope } = await this.open(request, false, options);
    try {
      const payload = await waitForAiResult(
        readAiProviderJson(response, MAX_RESPONSE_BYTES),
        scope.signal,
      );
      const result = normalizeGeminiResponse(payload, false).response;
      if (!result.text?.trim())
        throw new AiGeminiProviderError('GEMINI_INVALID_RESPONSE', {
          usageMetadata: result.usageMetadata,
        });
      assertAiRequestActive(scope);
      return result;
    } finally {
      scope.abort();
      try {
        if (response.body && !response.body.locked)
          await cancelGeminiBody(() => response.body!.cancel());
      } finally {
        scope.dispose();
      }
    }
  }

  private async generateContentStream(
    request: AiGeminiRequest,
    options: AiProviderTransportOptions,
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    const { response, scope } = await this.open(request, true, options);
    if (
      !/^text\/event-stream(?:\s*;|$)/i.test(
        response.headers.get('content-type') ?? '',
      ) ||
      !response.body
    ) {
      scope.abort();
      try {
        if (response.body)
          await cancelGeminiBody(() => response.body!.cancel());
      } finally {
        scope.dispose();
      }
      throw new AiGeminiProviderError('GEMINI_INVALID_RESPONSE');
    }
    const reader = response.body.getReader();
    let cleaned = false;
    let cleaning: Promise<void> | undefined;
    const cleanup = (): Promise<void> => {
      if (cleaned) return cleaning ?? Promise.resolve();
      cleaned = true;
      scope.signal.removeEventListener('abort', onAbort);
      scope.abort();
      cleaning = (async () => {
        try {
          await cancelGeminiBody(() => reader.cancel());
        } finally {
          reader.releaseLock();
          scope.dispose();
        }
      })();
      return cleaning;
    };
    const onAbort = () => {
      void cleanup();
    };
    scope.signal.addEventListener('abort', onAbort, { once: true });
    if (scope.signal.aborted) {
      await cleanup();
      assertAiRequestActive(scope);
    }
    const iterator = decodeGeminiStream(reader, scope, cleanup);
    const stop = iterator.return.bind(iterator);
    const fail = iterator.throw.bind(iterator);
    iterator.return = async (value) => {
      await cleanup();
      return stop(value);
    };
    iterator.throw = async (error) => {
      await cleanup();
      return fail(error);
    };
    return iterator;
  }
}

async function* decodeGeminiStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  scope: ReturnType<typeof createAiRequestScope>,
  cleanup: () => Promise<void>,
): AsyncGenerator<GenerateContentResponse> {
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let buffer = '';
  let data: string[] = [];
  let eventType = '';
  let eventLength = 0;
  let bytes = 0;
  let textLength = 0;
  let terminal = false;
  let usageMetadata: UsageMetadata;
  const event = (): GenerateContentResponse | undefined => {
    const type = eventType;
    eventType = '';
    if (!data.length) {
      if (type === 'error')
        throw new AiGeminiProviderError('GEMINI_INVALID_RESPONSE', {
          usageMetadata,
        });
      return undefined;
    }
    const encoded = data.join('\n');
    data = [];
    eventLength = 0;
    let payload: unknown;
    try {
      payload = JSON.parse(encoded);
      assertAiSerializedInputBounds(payload);
    } catch {
      throw new AiGeminiProviderError('GEMINI_INVALID_RESPONSE', {
        usageMetadata,
      });
    }
    if (type === 'error' && !(record(payload) && record(payload.error)))
      throw new AiGeminiProviderError('GEMINI_INVALID_RESPONSE', {
        usageMetadata: {
          ...usageMetadata,
          ...normalizeGeminiUsage(
            record(payload) ? payload.usageMetadata : undefined,
          ),
        },
      });
    const result = normalizeGeminiResponse(payload, true);
    const text = result.response.text ?? '';
    if (terminal && (text || result.terminal))
      throw new AiGeminiProviderError('GEMINI_INVALID_RESPONSE', {
        usageMetadata,
      });
    textLength += text.length;
    if (textLength > MAX_TEXT_CHARACTERS)
      throw new AiGeminiProviderError('GEMINI_INVALID_RESPONSE', {
        usageMetadata,
      });
    const receivedUsage = result.response.usageMetadata;
    if (receivedUsage) usageMetadata = { ...usageMetadata, ...receivedUsage };
    terminal ||= result.terminal;
    return result.response;
  };
  try {
    while (true) {
      assertAiRequestActive(scope);
      const { done, value } = await waitForAiResult(
        reader.read(),
        scope.signal,
      );
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES)
        throw new AiGeminiProviderError('GEMINI_INVALID_RESPONSE', {
          usageMetadata,
        });
      buffer += decoder.decode(value, { stream: true });
      let match: RegExpExecArray | null;
      while ((match = /[\r\n]/.exec(buffer))) {
        const at = match.index;
        if (buffer[at] === '\r' && at === buffer.length - 1) break;
        const line = buffer.slice(0, at);
        buffer = buffer.slice(
          at + (buffer[at] === '\r' && buffer[at + 1] === '\n' ? 2 : 1),
        );
        if (line.length > MAX_EVENT_CHARACTERS)
          throw new AiGeminiProviderError('GEMINI_INVALID_RESPONSE', {
            usageMetadata,
          });
        if (!line) {
          const result = event();
          if (result) {
            assertAiRequestActive(scope);
            yield result;
          }
        } else if (line.startsWith('event:')) {
          const type = line.slice(6).trim();
          if (!['message', 'error'].includes(type))
            throw new AiGeminiProviderError('GEMINI_INVALID_RESPONSE', {
              usageMetadata,
            });
          eventType = type;
        } else if (line.startsWith('data:')) {
          const value = line.slice(5).replace(/^ /, '');
          eventLength += value.length + 1;
          if (eventLength > MAX_EVENT_CHARACTERS)
            throw new AiGeminiProviderError('GEMINI_INVALID_RESPONSE', {
              usageMetadata,
            });
          data.push(value);
        }
      }
      if (buffer.length > MAX_EVENT_CHARACTERS)
        throw new AiGeminiProviderError('GEMINI_INVALID_RESPONSE', {
          usageMetadata,
        });
    }
    buffer += decoder.decode();
    assertAiRequestActive(scope);
    if (buffer || data.length || eventType || !terminal || !textLength)
      throw new AiGeminiProviderError('GEMINI_INCOMPLETE_STREAM', {
        usageMetadata,
      });
  } catch (error) {
    if (error instanceof AiGeminiProviderError && usageMetadata) {
      throw new AiGeminiProviderError(error.code, {
        status: error.status,
        schemaUnsupported: error.schemaUnsupported,
        retryAfterMs: error.retryAfterMs,
        usageMetadata: { ...usageMetadata, ...error.usageMetadata },
      });
    }
    throw error;
  } finally {
    await cleanup();
  }
}
