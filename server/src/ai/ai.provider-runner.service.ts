import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI, type GenerateContentResponse } from '@google/genai';
import { AiPromptBuilderService } from './ai.prompt-builder.service';
import {
  buildGeminiStructuredGenerationConfig,
  buildOpenAiStructuredResponseFormat,
} from './ai.structured-output';
import { AI_CONSTANTS } from './ai.constants';
import type {
  AiPromptCapabilities,
  AiProvider,
  AiRoutingMode,
  ChatParams,
  ChatHistoryMessage,
  ChatResult,
  ProviderPlan,
  RouteDecision,
  StreamEvent,
} from './ai.types';
import { validateExternalUrl } from '../common/utils/ssrf-validator.util';
import { normalizeProviderBaseUrl } from './ai-url.util';
import { supportsLiveWebSearch } from './ai.provider-capabilities';

@Injectable()
export class AiProviderRunnerService {
  private readonly genAI: GoogleGenAI | null;
  private readonly logger = new Logger(AiProviderRunnerService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly promptBuilder: AiPromptBuilderService,
  ) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      this.logger.warn('GEMINI_API_KEY not set - Gemini lane disabled');
      this.genAI = null;
    } else {
      this.genAI = new GoogleGenAI({ apiKey });
    }
  }

  private async getSafeOpenAiCompatibleUrl(baseUrl: string): Promise<string> {
    const requestUrl = `${normalizeProviderBaseUrl(baseUrl)}/chat/completions`;
    if (!(await validateExternalUrl(requestUrl))) {
      throw new Error('Unsafe provider URL');
    }
    return requestUrl;
  }

  isGeminiAvailable(): boolean {
    return !!this.genAI;
  }

  private getProviderTimeoutMs(): number {
    const raw = Number(
      this.configService.get<string>('AI_PROVIDER_TIMEOUT_MS') ||
        AI_CONSTANTS.DEFAULT_PROVIDER_TIMEOUT_MS,
    );
    return Number.isFinite(raw) && raw > 0
      ? raw
      : AI_CONSTANTS.DEFAULT_PROVIDER_TIMEOUT_MS;
  }

  private getStreamIdleTimeoutMs(): number {
    const raw = Number(
      this.configService.get<string>('AI_STREAM_IDLE_TIMEOUT_MS') ||
        this.getProviderTimeoutMs(),
    );
    return Number.isFinite(raw) && raw > 0 ? raw : this.getProviderTimeoutMs();
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    label: string,
    timeoutMs = this.getProviderTimeoutMs(),
  ): Promise<T> {
    let timer: NodeJS.Timeout | null = null;
    try {
      return await Promise.race<T>([
        promise,
        new Promise<T>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
            timeoutMs,
          );
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private createAbortController(
    label: string,
    timeoutMs = this.getProviderTimeoutMs(),
  ) {
    const controller = new AbortController();
    const timer = setTimeout(
      () =>
        controller.abort(new Error(`${label} timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );
    return {
      signal: controller.signal,
      clear: () => clearTimeout(timer),
    };
  }

  private isModelNotFoundError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) return false;

    const candidate = error as {
      status?: number;
      code?: string;
      response?: { status?: number };
      message?: string;
    };
    const message =
      typeof candidate.message === 'string'
        ? candidate.message.toLowerCase()
        : '';

    return (
      candidate.status === 404 ||
      candidate.code === 'NOT_FOUND' ||
      candidate.code === 'notFound' ||
      candidate.response?.status === 404 ||
      message.includes('404') ||
      message.includes('not found')
    );
  }

  private buildCapabilities(
    searchEnabled: boolean,
    visionInput = false,
  ): AiPromptCapabilities {
    return {
      liveWebSearch: searchEnabled,
      citations: searchEnabled,
      visionInput,
    };
  }

  private isTransientOpenAiStatus(status: number): boolean {
    return [408, 409, 425, 429, 500, 502, 503, 504].includes(status);
  }

  private isRetryableTransportError(error: unknown): boolean {
    if (typeof error === 'object' && error !== null) {
      const candidate = error as {
        status?: number;
        code?: number | string;
        response?: { status?: number };
        message?: string;
      };
      const status = candidate.status ?? candidate.response?.status;
      const code =
        typeof candidate.code === 'string'
          ? candidate.code.toLowerCase()
          : undefined;

      if (typeof status === 'number' && this.isTransientOpenAiStatus(status)) {
        return true;
      }

      if (
        code &&
        [
          'aborted',
          'deadline_exceeded',
          'resource_exhausted',
          'unavailable',
        ].includes(code)
      ) {
        return true;
      }
    }

    if (!(error instanceof Error)) return false;

    const message = error.message.toLowerCase();
    return (
      error.name === 'AbortError' ||
      message.includes('timed out') ||
      message.includes('fetch failed') ||
      message.includes('network') ||
      message.includes('econnreset') ||
      message.includes('econnrefused') ||
      message.includes('etimedout') ||
      message.includes('socket hang up')
    );
  }

  private getRetryDelayMs(attempt: number): number {
    return (
      AI_CONSTANTS.OPENAI_COMPATIBLE_RETRY_BASE_DELAY_MS * Math.pow(2, attempt)
    );
  }

  private async sleep(ms: number) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async executeRetriableOperation<T>(
    label: string,
    execute: (attempt: number) => Promise<T>,
  ): Promise<T> {
    const maxAttempts = AI_CONSTANTS.OPENAI_COMPATIBLE_RETRY_ATTEMPTS;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        return await execute(attempt);
      } catch (error) {
        if (
          !this.isRetryableTransportError(error) ||
          attempt >= maxAttempts - 1
        ) {
          throw error;
        }

        const message =
          error instanceof Error ? error.message : 'Unknown transient error';
        this.logger.warn(
          `${label} failed with transient error: ${message}. Retrying (${attempt + 2}/${maxAttempts})...`,
        );
        await this.sleep(this.getRetryDelayMs(attempt));
      }
    }

    throw new Error(`${label} failed before a result was returned`);
  }

  private async executeOpenAiRequestWithRetry(
    label: string,
    send: (attempt: number) => Promise<Response>,
  ): Promise<Response> {
    const maxAttempts = AI_CONSTANTS.OPENAI_COMPATIBLE_RETRY_ATTEMPTS;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        const response = await send(attempt);
        if (
          !response.ok &&
          this.isTransientOpenAiStatus(response.status) &&
          attempt < maxAttempts - 1
        ) {
          this.logger.warn(
            `${label} failed with ${response.status}. Retrying (${attempt + 2}/${maxAttempts})...`,
          );
          await this.sleep(this.getRetryDelayMs(attempt));
          continue;
        }

        return response;
      } catch (error) {
        if (
          !this.isRetryableTransportError(error) ||
          attempt >= maxAttempts - 1
        ) {
          throw error;
        }

        const message =
          error instanceof Error ? error.message : 'Unknown transport error';
        this.logger.warn(
          `${label} failed with transient transport error: ${message}. Retrying (${attempt + 2}/${maxAttempts})...`,
        );
        await this.sleep(this.getRetryDelayMs(attempt));
      }
    }

    throw new Error(`${label} failed before a response was returned`);
  }

  private buildSystemPromptForRequest(
    params: ChatParams,
    routeDecision: RouteDecision,
    capabilities: AiPromptCapabilities,
  ): string {
    return this.promptBuilder.buildSystemPrompt({
      mode: params.mode,
      schemaContext: params.schemaContext,
      databaseType: params.databaseType,
      responseFormat: routeDecision.responseFormat,
      capabilities,
    });
  }

  private async readProviderErrorPayload(response: Response): Promise<unknown> {
    const candidate = response as Response & {
      clone?: () => Response;
      json?: () => Promise<unknown>;
      text?: () => Promise<string>;
    };
    const jsonSource =
      typeof candidate.clone === 'function' ? candidate.clone() : candidate;
    const jsonPayload =
      typeof jsonSource.json === 'function'
        ? await jsonSource.json().catch(() => undefined)
        : undefined;
    if (jsonPayload !== undefined) {
      return jsonPayload;
    }

    const textSource =
      typeof candidate.clone === 'function' ? candidate.clone() : candidate;
    const textPayload =
      typeof textSource.text === 'function'
        ? await textSource.text().catch(() => '')
        : '';
    return textPayload ? { error: { message: textPayload } } : {};
  }

  private extractProviderErrorMessage(errorPayload: unknown): string {
    if (typeof errorPayload === 'string') {
      return errorPayload;
    }
    if (typeof errorPayload !== 'object' || errorPayload === null) {
      return '';
    }

    const candidate = errorPayload as {
      error?: { message?: string };
      message?: string;
    };
    if (typeof candidate.error?.message === 'string') {
      return candidate.error.message;
    }
    if (typeof candidate.message === 'string') {
      return candidate.message;
    }
    return '';
  }

  private shouldRetryWithoutStructuredOutput(
    response: Response,
    errorPayload: unknown,
  ): boolean {
    if (![400, 404, 415, 422].includes(response.status)) {
      return false;
    }

    const message =
      this.extractProviderErrorMessage(errorPayload).toLowerCase();
    if (!message) {
      return false;
    }

    return (
      message.includes('response_format') ||
      message.includes('json_schema') ||
      message.includes('structured output') ||
      message.includes('response schema') ||
      message.includes('responseschema') ||
      message.includes('response mime') ||
      message.includes('responsemimetype') ||
      message.includes('application/json')
    );
  }

  private isGeminiStructuredOutputUnsupportedError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const message = error.message.toLowerCase();
    return (
      message.includes('responseschema') ||
      message.includes('response schema') ||
      message.includes('responsemimetype') ||
      message.includes('response mime') ||
      message.includes('application/json') ||
      message.includes('structured output')
    );
  }

  private getOpenAiSearchAttempt(
    plan: ProviderPlan,
    params: ChatParams,
    routeDecision: RouteDecision,
  ) {
    const searchEnabled =
      routeDecision.needsLiveSearch && supportsLiveWebSearch(plan);
    const requestOptions = !searchEnabled
      ? {}
      : plan.provider === 'openrouter'
        ? { tools: [{ type: 'openrouter:web_search' }] }
        : {
            compound_custom: {
              tools: { enabled_tools: ['web_search'] },
            },
          };

    return {
      searchEnabled,
      model: plan.model,
      prompt: searchEnabled
        ? `[SEARCH ONLINE] ${params.prompt}`
        : params.prompt,
      capabilities: this.buildCapabilities(searchEnabled),
      requestOptions,
    };
  }

  private getOpenAiDocumentOptions(plan: ProviderPlan, params: ChatParams) {
    return plan.provider === 'openrouter' && params.document
      ? {
          plugins: [{ id: 'file-parser', pdf: { engine: 'native' } }],
        }
      : {};
  }

  private async readWithTimeout<T>(
    reader: ReadableStreamDefaultReader<T>,
    label: string,
    timeoutMs = this.getStreamIdleTimeoutMs(),
  ): Promise<ReadableStreamReadResult<T>> {
    let timer: NodeJS.Timeout | null = null;
    try {
      return await Promise.race<ReadableStreamReadResult<T>>([
        reader.read(),
        new Promise<ReadableStreamReadResult<T>>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(`${label} stalled after ${timeoutMs}ms`)),
            timeoutMs,
          );
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async completeGeminiText(params: {
    model: string;
    prompt: string;
    temperature?: number;
    maxOutputTokens?: number;
    timeoutMs?: number;
  }): Promise<string> {
    if (!this.genAI) throw new Error('Gemini provider is not configured');

    const tryCompletion = async (mId: string) => {
      const timeout = params.timeoutMs ?? this.getProviderTimeoutMs();
      const response = await this.executeRetriableOperation(
        `Gemini completion (${mId})`,
        () =>
          this.withTimeout(
            this.genAI!.models.generateContent({
              model: mId,
              contents: params.prompt,
              config: {
                temperature:
                  params.temperature ?? AI_CONSTANTS.TEMPERATURE_PRECISE,
                maxOutputTokens:
                  params.maxOutputTokens ??
                  AI_CONSTANTS.COMPLETION_MAX_OUTPUT_TOKENS,
              },
            }),
            `Gemini completion (${mId})`,
            timeout,
          ),
      );
      return (response.text || '').trim();
    };

    try {
      return await tryCompletion(params.model);
    } catch (error: unknown) {
      if (this.isModelNotFoundError(error)) {
        this.logger.warn(
          `Model ${params.model} not found. Falling back to gemini-3.5-flash-lite...`,
        );
        return await tryCompletion('gemini-3.5-flash-lite');
      }
      throw error;
    }
  }

  async completeOpenAiCompatibleText(
    plan: ProviderPlan,
    params: {
      systemPrompt: string;
      prompt: string;
      context?: string;
      temperature?: number;
      maxOutputTokens?: number;
      history?: ChatHistoryMessage[];
      timeoutMs?: number;
    },
  ): Promise<string> {
    if (!plan.apiKey || !plan.baseUrl)
      throw new Error(`${plan.provider} provider is not configured`);
    const requestUrl = await this.getSafeOpenAiCompatibleUrl(plan.baseUrl);

    let requestTimeout = this.createAbortController(
      `${plan.provider} completion`,
      params.timeoutMs ?? this.getProviderTimeoutMs(),
    );

    try {
      const sendRequest = (attempt: number) => {
        requestTimeout.clear();
        requestTimeout = this.createAbortController(
          `${plan.provider} completion attempt ${attempt + 1}`,
          params.timeoutMs ?? this.getProviderTimeoutMs(),
        );
        return fetch(requestUrl, {
          method: 'POST',
          headers: this.getOpenAiCompatibleHeaders(plan),
          body: JSON.stringify({
            model: plan.model,
            messages: this.promptBuilder.buildOpenAiMessages(
              params.prompt,
              params.systemPrompt,
              params.context,
              params.history,
            ),
            temperature: params.temperature ?? AI_CONSTANTS.TEMPERATURE_PRECISE,
            max_tokens:
              params.maxOutputTokens ??
              AI_CONSTANTS.COMPLETION_MAX_OUTPUT_TOKENS,
          }),
          signal: requestTimeout.signal,
          redirect: 'manual',
        });
      };

      const response = await this.executeOpenAiRequestWithRetry(
        `${plan.provider} completion`,
        sendRequest,
      );

      if (!response.ok) {
        throw new Error(
          `${plan.provider} completion error (${response.status})`,
        );
      }

      const result = await response.json();
      const content = result.choices?.[0]?.message?.content;
      if (typeof content !== 'string') {
        return '';
      }

      return content.trim();
    } finally {
      requestTimeout.clear();
    }
  }

  async runGemini(
    plan: ProviderPlan,
    params: ChatParams,
    routingMode: AiRoutingMode,
    routeDecision: RouteDecision,
  ): Promise<ChatResult> {
    if (!this.genAI) throw new Error('Gemini provider is not configured');

    const searchEnabled = routeDecision.needsLiveSearch;
    const systemPrompt = this.buildSystemPromptForRequest(
      params,
      routeDecision,
      this.buildCapabilities(searchEnabled, !!params.image),
    );
    const parts = this.promptBuilder.prepareGeminiParts(
      params.prompt,
      params.context,
      params.image,
      params.document,
    );

    const baseConfig = {
      systemInstruction: systemPrompt,
      temperature: AI_CONSTANTS.TEMPERATURE_CREATIVE,
      maxOutputTokens: AI_CONSTANTS.MAX_OUTPUT_TOKENS,
      ...(searchEnabled ? { tools: [{ googleSearch: {} }] } : {}),
    };
    const structuredGenerationConfig = buildGeminiStructuredGenerationConfig(
      routeDecision.responseFormat,
    );
    let config = structuredGenerationConfig
      ? { ...baseConfig, ...structuredGenerationConfig }
      : baseConfig;
    const generate = () =>
      this.executeRetriableOperation(`Gemini request (${plan.model})`, () =>
        this.withTimeout(
          this.genAI!.models.generateContent({
            model: plan.model,
            contents: [{ role: 'user', parts }],
            config,
          }),
          `Gemini request (${plan.model})`,
        ),
      );
    let result;
    try {
      result = await generate();
    } catch (error) {
      if (
        structuredGenerationConfig &&
        this.isGeminiStructuredOutputUnsupportedError(error)
      ) {
        this.logger.warn(
          `Gemini model ${plan.model} rejected structured output config. Retrying without provider-level schema enforcement...`,
        );
        config = baseConfig;
        result = await generate();
      } else {
        throw error;
      }
    }

    const responseText = result.text || '';
    const parsed = this.promptBuilder.parseAiResponse(responseText);
    this.promptBuilder.assertUsableStructuredResponse(
      parsed,
      responseText,
      `Gemini (${plan.model})`,
    );

    const sources = this.promptBuilder.mergeSources(
      parsed.sources,
      searchEnabled ? this.promptBuilder.extractSources(result) : undefined,
    );
    return {
      ...parsed,
      message: this.promptBuilder.appendSourcesToMessage(
        parsed.message,
        sources,
      ),
      sources,
      provider: 'gemini',
      providerLabel: plan.displayName || 'gemini',
      model: plan.model,
      routingMode,
    };
  }

  async runOpenAiCompatible(
    plan: ProviderPlan,
    params: ChatParams,
    routingMode: AiRoutingMode,
    routeDecision: RouteDecision,
  ): Promise<ChatResult> {
    if (!plan.apiKey || !plan.baseUrl)
      throw new Error(`${plan.provider} provider is not configured`);
    const requestUrl = await this.getSafeOpenAiCompatibleUrl(plan.baseUrl);

    const searchAttempt = this.getOpenAiSearchAttempt(
      plan,
      params,
      routeDecision,
    );
    const modelToUse = searchAttempt.model;
    const finalPrompt = searchAttempt.prompt;
    let structuredResponseFormat = buildOpenAiStructuredResponseFormat(
      routeDecision.responseFormat,
    );
    const systemPrompt = this.buildSystemPromptForRequest(
      params,
      routeDecision,
      {
        ...searchAttempt.capabilities,
        visionInput: !!params.image,
      },
    );
    let requestTimeout = this.createAbortController(
      `${plan.provider} request (${modelToUse})`,
    );

    try {
      const sendRequest = (attempt: number) => {
        requestTimeout.clear();
        requestTimeout = this.createAbortController(
          `${plan.provider} request (${modelToUse}) attempt ${attempt + 1}`,
        );
        return fetch(requestUrl, {
          method: 'POST',
          headers: this.getOpenAiCompatibleHeaders(plan),
          body: JSON.stringify({
            model: modelToUse,
            messages: this.promptBuilder.buildOpenAiMessages(
              finalPrompt,
              systemPrompt,
              params.context,
              params.history,
              params.image,
              plan.provider === 'openrouter' ? params.document : undefined,
            ),
            temperature: AI_CONSTANTS.TEMPERATURE_CREATIVE,
            max_tokens: AI_CONSTANTS.MAX_OUTPUT_TOKENS,
            ...this.getOpenAiDocumentOptions(plan, params),
            ...searchAttempt.requestOptions,
            ...(structuredResponseFormat
              ? { response_format: structuredResponseFormat }
              : {}),
          }),
          signal: requestTimeout.signal,
          redirect: 'manual',
        });
      };

      let response = await this.executeOpenAiRequestWithRetry(
        `${plan.provider} request (${modelToUse})`,
        sendRequest,
      );

      while (!response.ok) {
        const errorPayload = await this.readProviderErrorPayload(response);

        if (
          structuredResponseFormat &&
          this.shouldRetryWithoutStructuredOutput(response, errorPayload)
        ) {
          this.logger.warn(
            `${plan.provider} model ${modelToUse} rejected response_format json_schema. Retrying without provider-level schema enforcement...`,
          );
          structuredResponseFormat = undefined;
          response = await this.executeOpenAiRequestWithRetry(
            `${plan.provider} request (${modelToUse}) structured-output fallback`,
            sendRequest,
          );
          continue;
        }

        throw new Error(`${plan.provider} error (${response.status})`);
      }

      const result = await response.json();
      const responseText = result.choices?.[0]?.message?.content || '';
      const parsed = this.promptBuilder.parseAiResponse(responseText);
      this.promptBuilder.assertUsableStructuredResponse(
        parsed,
        responseText,
        `${plan.provider} (${modelToUse})`,
      );
      const sources = this.promptBuilder.mergeSources(parsed.sources);
      return {
        ...parsed,
        message: this.promptBuilder.appendSourcesToMessage(
          parsed.message,
          sources,
        ),
        sources,
        provider: plan.provider,
        providerLabel: plan.displayName || plan.provider,
        model: modelToUse,
        routingMode,
      };
    } finally {
      requestTimeout.clear();
    }
  }

  async *streamGemini(
    plan: ProviderPlan,
    params: ChatParams,
    routingMode: AiRoutingMode,
    routeDecision: RouteDecision,
  ): AsyncGenerator<StreamEvent> {
    if (!this.genAI) throw new Error('Gemini provider is not configured');

    const searchEnabled = routeDecision.needsLiveSearch;
    const systemPrompt = this.buildSystemPromptForRequest(
      params,
      routeDecision,
      this.buildCapabilities(searchEnabled, !!params.image),
    );

    const baseConfig = {
      systemInstruction: systemPrompt,
      temperature: AI_CONSTANTS.TEMPERATURE_CREATIVE,
      maxOutputTokens: AI_CONSTANTS.MAX_OUTPUT_TOKENS,
      ...(searchEnabled ? { tools: [{ googleSearch: {} }] } : {}),
    };
    const structuredGenerationConfig = buildGeminiStructuredGenerationConfig(
      routeDecision.responseFormat,
    );
    let config = structuredGenerationConfig
      ? { ...baseConfig, ...structuredGenerationConfig }
      : baseConfig;
    const contents = this.promptBuilder.buildGeminiContents(
      params.prompt,
      params.context,
      params.history,
      params.image,
      params.document,
    );
    const generateStream = (): Promise<
      AsyncGenerator<GenerateContentResponse>
    > =>
      this.executeRetriableOperation(
        `Gemini stream bootstrap (${plan.model})`,
        () =>
          this.withTimeout(
            this.genAI!.models.generateContentStream({
              model: plan.model,
              contents,
              config,
            }),
            `Gemini stream bootstrap (${plan.model})`,
          ),
      );
    let result: AsyncGenerator<GenerateContentResponse>;
    try {
      result = await generateStream();
    } catch (error) {
      if (
        structuredGenerationConfig &&
        this.isGeminiStructuredOutputUnsupportedError(error)
      ) {
        this.logger.warn(
          `Gemini model ${plan.model} rejected structured output config for streaming. Retrying without provider-level schema enforcement...`,
        );
        config = baseConfig;
        result = await generateStream();
      } else {
        throw error;
      }
    }

    let fullText = '';
    const providerSources: string[] = [];
    const iterator = result;
    while (true) {
      const nextChunk = await this.withTimeout<
        IteratorResult<GenerateContentResponse, unknown>
      >(
        iterator.next(),
        `Gemini stream (${plan.model})`,
        this.getStreamIdleTimeoutMs(),
      );
      if (nextChunk.done) break;
      const chunkText = nextChunk.value.text || '';
      if (searchEnabled) {
        providerSources.push(
          ...this.promptBuilder.extractSources(nextChunk.value),
        );
      }
      if (chunkText) {
        fullText += chunkText;
        yield { type: 'chunk', text: chunkText };
      }
    }
    const parsed = this.promptBuilder.parseAiResponse(fullText);
    this.promptBuilder.assertUsableStructuredResponse(
      parsed,
      fullText,
      `Gemini stream (${plan.model})`,
    );

    const sources = this.promptBuilder.mergeSources(
      parsed.sources,
      searchEnabled ? providerSources : undefined,
    );
    yield {
      type: 'done',
      data: {
        ...parsed,
        message: this.promptBuilder.appendSourcesToMessage(
          parsed.message,
          sources,
        ),
        sources,
        provider: 'gemini',
        providerLabel: plan.displayName || 'gemini',
        model: plan.model,
        routingMode,
      },
    };
  }

  async *streamOpenAiCompatible(
    plan: ProviderPlan,
    params: ChatParams,
    routingMode: AiRoutingMode,
    routeDecision: RouteDecision,
  ): AsyncGenerator<StreamEvent> {
    if (!plan.apiKey || !plan.baseUrl)
      throw new Error(`${plan.provider} provider is not configured`);
    const requestUrl = await this.getSafeOpenAiCompatibleUrl(plan.baseUrl);
    const searchAttempt = this.getOpenAiSearchAttempt(
      plan,
      params,
      routeDecision,
    );
    const modelToUse = searchAttempt.model;
    const finalPrompt = searchAttempt.prompt;
    let structuredResponseFormat = buildOpenAiStructuredResponseFormat(
      routeDecision.responseFormat,
    );
    const systemPrompt = this.buildSystemPromptForRequest(
      params,
      routeDecision,
      {
        ...searchAttempt.capabilities,
        visionInput: !!params.image,
      },
    );
    let requestTimeout = this.createAbortController(
      `${plan.provider} stream request (${modelToUse})`,
    );

    try {
      const sendRequest = (attempt: number) => {
        requestTimeout.clear();
        requestTimeout = this.createAbortController(
          `${plan.provider} stream request (${modelToUse}) attempt ${attempt + 1}`,
        );
        return fetch(requestUrl, {
          method: 'POST',
          headers: this.getOpenAiCompatibleHeaders(plan),
          body: JSON.stringify({
            model: modelToUse,
            messages: this.promptBuilder.buildOpenAiMessages(
              finalPrompt,
              systemPrompt,
              params.context,
              params.history,
              params.image,
              plan.provider === 'openrouter' ? params.document : undefined,
            ),
            temperature: AI_CONSTANTS.TEMPERATURE_CREATIVE,
            max_tokens: AI_CONSTANTS.MAX_OUTPUT_TOKENS,
            stream: true,
            ...this.getOpenAiDocumentOptions(plan, params),
            ...searchAttempt.requestOptions,
            ...(structuredResponseFormat
              ? { response_format: structuredResponseFormat }
              : {}),
          }),
          signal: requestTimeout.signal,
          redirect: 'manual',
        });
      };

      let response = await this.executeOpenAiRequestWithRetry(
        `${plan.provider} stream request (${modelToUse})`,
        sendRequest,
      );

      while (!response.ok) {
        const errorPayload = await this.readProviderErrorPayload(response);

        if (
          structuredResponseFormat &&
          this.shouldRetryWithoutStructuredOutput(response, errorPayload)
        ) {
          this.logger.warn(
            `${plan.provider} model ${modelToUse} rejected stream response_format json_schema. Retrying without provider-level schema enforcement...`,
          );
          structuredResponseFormat = undefined;
          response = await this.executeOpenAiRequestWithRetry(
            `${plan.provider} stream request (${modelToUse}) structured-output fallback`,
            sendRequest,
          );
          continue;
        }

        throw new Error(
          `${plan.provider} Stream API error [${response.status}]`,
        );
      }

      yield* this.streamFetch(
        response,
        requestTimeout,
        modelToUse,
        plan.provider,
        plan.displayName || plan.provider,
        routingMode,
      );
    } finally {
      requestTimeout.clear();
    }
  }

  private async *streamFetch(
    response: Response,
    abortController: { clear: () => void; signal: AbortSignal },
    model: string,
    provider: AiProvider,
    providerLabel: string,
    routingMode: AiRoutingMode,
  ): AsyncGenerator<StreamEvent> {
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Response body is not readable');
    const decoder = new TextDecoder();
    let fullText = '';
    try {
      let doneStream = false;
      let lineBuffer = '';
      while (!doneStream) {
        const { done, value } = await this.readWithTimeout(
          reader,
          `${provider} stream chunk`,
        );
        if (done) break;
        lineBuffer += decoder.decode(value, { stream: true });
        const lines = lineBuffer.split(/\r?\n/);
        lineBuffer = lines.pop() || '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') {
              doneStream = true;
              break;
            }
            try {
              const parsed = JSON.parse(data);
              const text = parsed.choices?.[0]?.delta?.content || '';
              if (text) {
                fullText += text;
                yield { type: 'chunk', text };
              }
            } catch {
              /* skip invalid JSON */
            }
          }
        }
      }
      lineBuffer += decoder.decode();
      if (lineBuffer && !doneStream) {
        const line = lineBuffer.trimEnd();
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data !== '[DONE]') {
            try {
              const parsed = JSON.parse(data);
              const text = parsed.choices?.[0]?.delta?.content || '';
              if (text) {
                fullText += text;
                yield { type: 'chunk', text };
              }
            } catch {
              /* skip invalid JSON */
            }
          }
        }
      }
      const parsed = this.promptBuilder.parseAiResponse(fullText);
      this.promptBuilder.assertUsableStructuredResponse(
        parsed,
        fullText,
        `${provider} stream (${model})`,
      );
      const sources = this.promptBuilder.mergeSources(parsed.sources);
      yield {
        type: 'done',
        data: {
          ...parsed,
          message: this.promptBuilder.appendSourcesToMessage(
            parsed.message,
            sources,
          ),
          sources,
          provider,
          providerLabel,
          model,
          routingMode,
        },
      };
    } finally {
      reader.releaseLock();
      abortController.clear();
    }
  }

  private getOpenAiCompatibleHeaders(
    plan: ProviderPlan,
  ): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (plan.apiKey && plan.apiKey !== 'no-key') {
      headers['Authorization'] = `Bearer ${plan.apiKey}`;
    }
    if (plan.provider === 'openrouter') {
      headers['HTTP-Referer'] =
        this.configService.get<string>('FRONTEND_URL') ||
        'http://localhost:5173';
      headers['X-Title'] = 'Data Explorer';
    }
    return headers;
  }
}
