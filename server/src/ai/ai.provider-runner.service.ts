import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { GenerateContentResponse } from '@google/genai';
import {
  AiGeminiProviderError,
  AiGeminiTransport,
} from './ai-gemini-transport';
import { AiPromptBuilderService } from './ai.prompt-builder.service';
import {
  buildGeminiStructuredGenerationConfig,
  buildOpenAiStructuredResponseFormat,
} from './ai.structured-output';
import {
  AiRetryPolicyError,
  aiRetryDelayMs,
  isAiProviderTerminalError,
  parseAiRetryAfter,
} from './ai-retry-policy';
import { AI_CONSTANTS } from './ai.constants';
import type {
  AiPromptCapabilities,
  AiProviderAttempt,
  AiProvider,
  AiResponseFormat,
  AiRoutingMode,
  ChatParams,
  ChatHistoryMessage,
  ChatResult,
  ProviderPlan,
  RouteDecision,
  StreamEvent,
  TokenUsage,
} from './ai.types';
import {
  AiProviderTransportError,
  fetchAiProvider,
  readAiProviderJson,
  validateAiProviderUrl,
} from './ai-provider-transport';
import { AI_INPUT_BOUNDS } from './ai-input-bounds';
import { normalizeProviderBaseUrl } from './ai-url.util';
import { supportsLiveWebSearch } from './ai.provider-capabilities';
import {
  assertAiRequestActive,
  createAiRequestScope,
  isAiRequestStoppedError,
  waitForAiResult,
} from './ai-request-lifecycle';

type AiRequestContext = Pick<ChatParams, 'signal' | 'deadlineAt'> & {
  retryBudget?: { attempts: number; lastError?: unknown };
};
type AiAttemptParams = AiRequestContext &
  Pick<ChatParams, 'beforeProviderAttempt' | 'execution'>;
type TrackedProviderAttempt = AiProviderAttempt & { finished: boolean };

class AiAttemptControlError extends Error {
  readonly aiRequestFatal = true;

  constructor(cause: unknown) {
    super(
      cause instanceof Error
        ? cause.message
        : 'AI attempt gate or ledger failed',
      { cause },
    );
    this.name = 'AiAttemptControlError';
  }
}

type ProviderRequestScope = ReturnType<typeof createAiRequestScope> & {
  label: string;
  timeoutMs: number;
  clear: () => void;
};
const MAX_STREAM_TEXT_CHARACTERS = AI_CONSTANTS.MAX_OUTPUT_TOKENS * 16;
const MAX_STREAM_EVENT_CHARACTERS = 256 * 1024;
const STREAM_CLEANUP_TIMEOUT_MS = 100;
const MAX_PROVIDER_RESPONSE_BYTES = 2 * 1024 * 1024;

type OpenAiResponsePayload = {
  model?: unknown;
  choices?: Array<{ message?: { content?: unknown } }>;
};

@Injectable()
export class AiProviderRunnerService {
  private readonly genAI: AiGeminiTransport | null;
  private readonly logger = new Logger(AiProviderRunnerService.name);
  private readonly openAiAttempts = new WeakMap<
    Response,
    TrackedProviderAttempt
  >();

  constructor(
    private readonly configService: ConfigService,
    private readonly promptBuilder: AiPromptBuilderService,
  ) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      this.logger.warn('GEMINI_API_KEY not set - Gemini lane disabled');
      this.genAI = null;
    } else {
      this.genAI = new AiGeminiTransport(apiKey);
    }
  }

  private async getSafeOpenAiCompatibleUrl(baseUrl: string): Promise<string> {
    const requestUrl = `${normalizeProviderBaseUrl(baseUrl)}/chat/completions`;
    return validateAiProviderUrl(requestUrl).toString();
  }

  private providerTransportOptions(
    plan: ProviderPlan,
    params: AiAttemptParams & Pick<ChatParams, 'beforeProviderRequest'>,
    scope: ProviderRequestScope,
  ) {
    return {
      maxRequestBytes: AI_INPUT_BOUNDS.maxSerializedBytes,
      maxResponseBytes: MAX_PROVIDER_RESPONSE_BYTES,
      timeoutMs: Math.max(
        1,
        Math.min(300_000, scope.timeoutMs, scope.deadlineAt - Date.now()),
      ),
      beforeDispatch: async () => {
        assertAiRequestActive(scope);
        if (params.beforeProviderRequest) {
          await waitForAiResult(params.beforeProviderRequest(), scope.signal);
        }
        await this.checkProviderRecipient(plan, { ...params, ...scope });
      },
    };
  }

  isGeminiAvailable(): boolean {
    return !!this.genAI;
  }

  private async checkProviderRecipient(
    plan: ProviderPlan,
    params: AiAttemptParams,
  ) {
    assertAiRequestActive(params);
    try {
      if (params.beforeProviderAttempt) {
        await waitForAiResult(
          params.beforeProviderAttempt(plan),
          params.signal,
        );
      }
    } catch (error) {
      assertAiRequestActive(params);
      if (isAiRequestStoppedError(error)) throw error;
      throw new AiAttemptControlError(error);
    }
    assertAiRequestActive(params);
  }

  private getAttemptOutcome(
    error: unknown,
    context: AiRequestContext,
  ): 'failed' | 'cancelled' | 'timed_out' {
    const reason = context.signal?.aborted ? context.signal.reason : error;
    if (
      (reason as { reason?: string } | null)?.reason === 'AI_REQUEST_TIMEOUT' ||
      (context.deadlineAt !== undefined && Date.now() >= context.deadlineAt) ||
      (reason instanceof Error &&
        (reason.name === 'TimeoutError' ||
          /timed out|deadline exceeded/i.test(reason.message)))
    )
      return 'timed_out';
    if (context.signal?.aborted || isAiRequestStoppedError(reason))
      return 'cancelled';
    return 'failed';
  }

  private async beginProviderAttempt(
    plan: ProviderPlan,
    params: AiAttemptParams,
  ): Promise<TrackedProviderAttempt | undefined> {
    await this.checkProviderRecipient(plan, params);
    if (!params.execution) return undefined;
    const recipient = { provider: plan.provider, model: plan.model };
    let handle: AiProviderAttempt;
    try {
      // Do not race persistence against cancellation and lose a reserved handle.
      // Only recipient identity is handed to the ledger, never credentials/URL.
      handle = await params.execution.beforeAttempt(recipient);
    } catch (error) {
      throw new AiAttemptControlError(error);
    }
    const tracked: TrackedProviderAttempt = {
      attemptId: handle.attemptId,
      finished: false,
      complete: async (result) => {
        if (tracked.finished) return;
        tracked.finished = true;
        try {
          await handle.complete({ ...recipient, ...result });
        } catch (error) {
          throw new AiAttemptControlError(error);
        }
      },
      fail: async (outcome = 'failed', result) => {
        if (tracked.finished) return;
        tracked.finished = true;
        try {
          await handle.fail(outcome, { ...recipient, ...result });
        } catch (error) {
          throw new AiAttemptControlError(error);
        }
      },
    };
    try {
      assertAiRequestActive(params);
    } catch (error) {
      await tracked.fail(this.getAttemptOutcome(error, params));
      throw error;
    }
    return tracked;
  }

  private async executeTrackedAttempt<T>(
    plan: ProviderPlan,
    params: AiAttemptParams,
    operation: () => Promise<T>,
    extractUsage?: (result: T) => Partial<TokenUsage> | undefined,
  ): Promise<T> {
    const attempt = await this.beginProviderAttempt(plan, params);
    let usage: Partial<TokenUsage> | undefined;
    try {
      assertAiRequestActive(params);
      const result = await operation();
      usage = extractUsage?.(result);
      assertAiRequestActive(params);
      await attempt?.complete({ usage });
      assertAiRequestActive(params);
      return result;
    } catch (error) {
      if (error instanceof AiGeminiProviderError)
        usage = this.extractGeminiAttemptUsage(error) ?? usage;
      await attempt?.fail(this.getAttemptOutcome(error, params), { usage });
      throw error;
    }
  }

  private async sendTrackedOpenAiRequest(
    plan: ProviderPlan,
    params: AiAttemptParams,
    operation: () => Promise<Response>,
  ): Promise<Response> {
    const attempt = await this.beginProviderAttempt(plan, params);
    try {
      assertAiRequestActive(params);
      const response = await operation();
      if (attempt) this.openAiAttempts.set(response, attempt);
      return response;
    } catch (error) {
      await attempt?.fail(this.getAttemptOutcome(error, params));
      throw error;
    }
  }

  private async finishOpenAiAttempt(
    response: Response | undefined,
    error?: unknown,
    context: AiRequestContext = {},
    usage?: TokenUsage,
  ) {
    if (!response) return;
    const attempt = this.openAiAttempts.get(response);
    if (!attempt) return;
    this.openAiAttempts.delete(response);
    if (error !== undefined || !response.ok) {
      await attempt.fail(this.getAttemptOutcome(error, context), { usage });
    } else {
      await attempt.complete({ usage });
    }
  }

  private getProviderTimeoutMs(): number {
    const raw = Number(
      this.configService.get<string>('AI_PROVIDER_TIMEOUT_MS') ||
        AI_CONSTANTS.DEFAULT_PROVIDER_TIMEOUT_MS,
    );
    return Number.isFinite(raw) && raw > 0
      ? Math.max(
          1,
          Math.min(AI_CONSTANTS.DEFAULT_PROVIDER_TIMEOUT_MS, Math.floor(raw)),
        )
      : AI_CONSTANTS.DEFAULT_PROVIDER_TIMEOUT_MS;
  }

  private getStreamIdleTimeoutMs(): number {
    const raw = Number(
      this.configService.get<string>('AI_STREAM_IDLE_TIMEOUT_MS') ||
        this.getProviderTimeoutMs(),
    );
    return Number.isFinite(raw) && raw > 0
      ? Math.max(
          1,
          Math.min(AI_CONSTANTS.DEFAULT_PROVIDER_TIMEOUT_MS, Math.floor(raw)),
        )
      : this.getProviderTimeoutMs();
  }

  private createRequestScope(context: AiRequestContext) {
    const scope = createAiRequestScope({
      ...context,
      timeoutMs:
        context.deadlineAt === undefined
          ? this.getProviderTimeoutMs()
          : Math.max(
              1,
              Math.min(
                AI_CONSTANTS.DEFAULT_PROVIDER_TIMEOUT_MS,
                context.deadlineAt - Date.now(),
              ),
            ),
    });
    return { ...scope, retryBudget: context.retryBudget ?? { attempts: 0 } };
  }

  private async waitForProviderResult<T>(
    promise: Promise<T>,
    scope: ProviderRequestScope,
    context: AiRequestContext,
  ): Promise<T> {
    // The operation may synchronously abort the caller while creating its
    // promise (for example error-body decoding). Always observe that promise
    // even when the active-request assertion wins the race.
    void promise.catch(() => undefined);
    try {
      assertAiRequestActive(context);
      const result = await waitForAiResult(promise, scope.signal);
      assertAiRequestActive(context);
      assertAiRequestActive(scope);
      return result;
    } catch (error) {
      // A caller stop or the total deadline is terminal; an attempt timeout is
      // still a transport failure while there is time left in the total budget.
      assertAiRequestActive(context);
      if (scope.signal.aborted) {
        throw new Error(`${scope.label} timed out after ${scope.timeoutMs}ms`, {
          cause: error,
        });
      }
      throw error;
    }
  }

  private async withTimeout<T>(
    execute: (scope: ProviderRequestScope) => Promise<T>,
    label: string,
    timeoutMs = this.getProviderTimeoutMs(),
    context: AiRequestContext = {},
  ): Promise<T> {
    const scope = this.createAbortController(label, timeoutMs, context);
    try {
      assertAiRequestActive(scope);
      return await this.waitForProviderResult(execute(scope), scope, context);
    } catch (error) {
      scope.abort(error);
      throw error;
    } finally {
      scope.dispose();
    }
  }

  private createAbortController(
    label: string,
    timeoutMs = this.getProviderTimeoutMs(),
    context: AiRequestContext = {},
  ): ProviderRequestScope {
    const scope = createAiRequestScope({ ...context, timeoutMs });
    return { ...scope, label, timeoutMs, clear: scope.dispose };
  }

  private async cancelStreamResource(
    cleanup: () => Promise<unknown> | undefined,
  ) {
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        Promise.resolve()
          .then(cleanup)
          .catch(() => undefined),
        new Promise<void>((resolve) => {
          timer = setTimeout(resolve, STREAM_CLEANUP_TIMEOUT_MS);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private appendStreamText(fullText: string, text: string): string {
    if (fullText.length + text.length > MAX_STREAM_TEXT_CHARACTERS) {
      throw new Error('AI response exceeded the parsing size limit');
    }
    return fullText + text;
  }

  private isModelNotFoundError(error: unknown): boolean {
    if (
      !this.isRetryableTransportError(error) &&
      isAiProviderTerminalError(error)
    )
      return false;
    if (typeof error === 'object' && error !== null) {
      const status =
        (error as { status?: number; response?: { status?: number } }).status ??
        (error as { response?: { status?: number } }).response?.status;
      if (typeof status === 'number') return status === 404;
    }
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
    if (
      error instanceof AiAttemptControlError ||
      isAiRequestStoppedError(error) ||
      isAiProviderTerminalError(error)
    )
      return false;
    if (error instanceof AiProviderTransportError)
      return error.code === 'NETWORK' || error.code === 'TIMEOUT';
    if (typeof error === 'object' && error !== null) {
      const candidate = error as {
        status?: number;
        code?: number | string;
        response?: { status?: number };
        getStatus?: () => number;
      };
      const status =
        candidate.status ??
        candidate.response?.status ??
        candidate.getStatus?.();
      if (typeof status === 'number')
        return this.isTransientOpenAiStatus(status);
      const code =
        typeof candidate.code === 'string'
          ? candidate.code.toLowerCase()
          : undefined;
      if (code && ['resource_exhausted', 'unavailable'].includes(code))
        return true;
    }
    if (!(error instanceof Error)) return false;
    const message = error.message.toLowerCase();
    return (
      message.includes('timed out') ||
      message.includes('fetch failed') ||
      message.includes('network') ||
      message.includes('econnreset') ||
      message.includes('econnrefused') ||
      message.includes('etimedout') ||
      message.includes('socket hang up')
    );
  }

  private getRetryDelayMs(
    attempt: number,
    error?: unknown,
    context: AiRequestContext = {},
  ): number {
    return aiRetryDelayMs(attempt, error, context.deadlineAt);
  }

  private async sleep(ms: number, context: AiRequestContext = {}) {
    let timer: NodeJS.Timeout | undefined;
    try {
      assertAiRequestActive(context);
      await waitForAiResult(
        new Promise<void>((resolve) => {
          timer = setTimeout(resolve, ms);
        }),
        context.signal,
      );
      assertAiRequestActive(context);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private async executeRetriableOperation<T>(
    label: string,
    execute: (attempt: number) => Promise<T>,
    beforeProviderRequest?: ChatParams['beforeProviderRequest'],
    context: AiRequestContext = {},
  ): Promise<T> {
    const maxAttempts = AI_CONSTANTS.OPENAI_COMPATIBLE_RETRY_ATTEMPTS;
    const budget = context.retryBudget ?? { attempts: 0 };
    while (budget.attempts < maxAttempts) {
      assertAiRequestActive(context);
      await waitForAiResult(
        Promise.resolve().then(() => {
          assertAiRequestActive(context);
          return beforeProviderRequest?.();
        }),
        context.signal,
      );
      assertAiRequestActive(context);
      const attempt = budget.attempts++;
      try {
        const result = await execute(attempt);
        assertAiRequestActive(context);
        return result;
      } catch (error) {
        budget.lastError = error;
        if (error instanceof AiAttemptControlError) throw error;
        assertAiRequestActive(context);
        if (!this.isRetryableTransportError(error)) throw error;
        const delay = this.getRetryDelayMs(attempt, error, context);
        if (budget.attempts >= maxAttempts) {
          if (
            error &&
            typeof error === 'object' &&
            'retryAfterMs' in error &&
            typeof error.retryAfterMs === 'number' &&
            error.retryAfterMs > 0
          )
            throw new AiRetryPolicyError('AI_RETRY_DEFERRED');
          throw error;
        }
        this.logger.warn(
          `${label} failed with a transient error. Retrying (${budget.attempts + 1}/${maxAttempts})...`,
        );
        await this.sleep(delay, context);
      }
    }
    if (budget.lastError instanceof Error) throw budget.lastError;
    throw new AiRetryPolicyError('AI_ATTEMPT_BUDGET_EXHAUSTED');
  }

  private async executeOpenAiRequestWithRetry(
    label: string,
    send: (attempt: number) => Promise<Response>,
    beforeProviderRequest?: ChatParams['beforeProviderRequest'],
    context: AiRequestContext = {},
  ): Promise<Response> {
    return this.executeRetriableOperation(
      label,
      async (attempt) => {
        const response = await send(attempt);
        try {
          assertAiRequestActive(context);
          if (!response.ok && this.isTransientOpenAiStatus(response.status)) {
            await this.readProviderErrorPayload(response, context);
            await this.finishOpenAiAttempt(response, undefined, context);
            await this.cancelStreamResource(() => response.body?.cancel());
            throw this.getProviderHttpError(
              label,
              '',
              response.status,
              undefined,
              '',
              parseAiRetryAfter(response.headers?.get('retry-after')),
            );
          }
          return response;
        } catch (error) {
          await this.finishOpenAiAttempt(response, error, context);
          throw error;
        }
      },
      beforeProviderRequest,
      context,
    );
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

  private async readProviderErrorPayload(
    response: Response,
    context: AiRequestContext = {},
  ): Promise<unknown> {
    assertAiRequestActive(context);
    try {
      const payload = await waitForAiResult(
        readAiProviderJson(response, MAX_PROVIDER_RESPONSE_BYTES),
        context.signal,
      );
      assertAiRequestActive(context);
      return payload;
    } catch (error) {
      assertAiRequestActive(context);
      if (
        isAiRequestStoppedError(error) ||
        error instanceof AiAttemptControlError
      )
        throw error;
      if (
        error instanceof AiProviderTransportError &&
        error.code !== 'INVALID_JSON'
      )
        throw error;
      return {};
    }
  }

  private assertOpenAiResponseAllowed(payload: unknown): void {
    if (
      !payload ||
      typeof payload !== 'object' ||
      !('choices' in payload) ||
      !Array.isArray(payload.choices)
    )
      return;
    for (const choice of payload.choices) {
      if (!choice || typeof choice !== 'object') continue;
      if (choice.finish_reason === 'content_filter')
        throw new AiRetryPolicyError('AI_PROVIDER_REFUSED');
      for (const content of [choice.message, choice.delta]) {
        if (
          content &&
          typeof content === 'object' &&
          content.refusal != null &&
          content.refusal !== ''
        )
          throw new AiRetryPolicyError('AI_PROVIDER_REFUSED');
      }
    }
  }

  private getProviderHttpError(
    provider: string,
    model: string,
    status: number,
    errorPayload: unknown,
    apiKey: string,
    retryAfterMs?: number,
  ): Error {
    const target = `${provider} model ${model}`;
    const message =
      status === 429
        ? `${target} is temporarily rate limited (429). Wait and retry or choose another model.`
        : status === 402
          ? `${target} requires provider credits (402). Add credits or choose another model.`
          : status === 404
            ? `${target} is unavailable (404). Choose another model.`
            : `${provider} error (${status}). The provider request failed.`;
    return Object.assign(new Error(message), { status, retryAfterMs });
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
    if (isAiProviderTerminalError(error)) return false;
    if (error instanceof AiGeminiProviderError) return error.schemaUnsupported;
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
    const requestOptions =
      searchEnabled && plan.provider === 'openrouter'
        ? { tools: [{ type: 'openrouter:web_search' }] }
        : {};

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
          plugins: [{ id: 'file-parser', pdf: { engine: 'cloudflare-ai' } }],
        }
      : {};
  }

  private getOpenAiMaxOutputTokens(plan: ProviderPlan): number {
    return plan.provider === 'groq'
      ? AI_CONSTANTS.GROQ_MAX_OUTPUT_TOKENS
      : AI_CONSTANTS.MAX_OUTPUT_TOKENS;
  }

  private providerReportedModel(value: unknown): string | undefined {
    return typeof value === 'string' &&
      /^[A-Za-z0-9][A-Za-z0-9._/:@-]{0,199}$/.test(value)
      ? value
      : undefined;
  }

  private extractOpenAiUsage(payload: unknown): TokenUsage | undefined {
    if (!payload || typeof payload !== 'object') return undefined;
    const usage = (payload as { usage?: unknown }).usage;
    if (!usage || typeof usage !== 'object') return undefined;

    const raw = usage as {
      prompt_tokens?: unknown;
      completion_tokens?: unknown;
      total_tokens?: unknown;
    };
    const promptTokens = raw.prompt_tokens;
    const completionTokens = raw.completion_tokens;
    const totalTokens = raw.total_tokens;
    if (
      typeof promptTokens !== 'number' ||
      typeof completionTokens !== 'number' ||
      typeof totalTokens !== 'number' ||
      ![promptTokens, completionTokens, totalTokens].every(
        (count) => Number.isSafeInteger(count) && count >= 0,
      )
    )
      return undefined;

    return { promptTokens, completionTokens, totalTokens };
  }

  private extractGeminiAttemptUsage(
    response: Pick<GenerateContentResponse, 'usageMetadata'>,
  ): Partial<TokenUsage> | undefined {
    const raw = response.usageMetadata;
    if (!raw) return undefined;
    const result: Partial<TokenUsage> = {};
    for (const [source, target] of [
      ['promptTokenCount', 'promptTokens'],
      ['candidatesTokenCount', 'completionTokens'],
      ['totalTokenCount', 'totalTokens'],
    ] as const) {
      const value = raw[source];
      if (
        typeof value === 'number' &&
        Number.isSafeInteger(value) &&
        value >= 0 &&
        value <= 2_147_483_647
      )
        result[target] = value;
    }
    return Object.keys(result).length ? result : undefined;
  }

  private extractGeminiUsage(
    response: Pick<GenerateContentResponse, 'usageMetadata'>,
  ): TokenUsage | undefined {
    const usage = response.usageMetadata as
      | {
          promptTokenCount?: number;
          candidatesTokenCount?: number;
          totalTokenCount?: number;
        }
      | undefined;
    if (!usage) return undefined;

    const promptTokens = usage.promptTokenCount;
    const completionTokens = usage.candidatesTokenCount;
    const totalTokens = usage.totalTokenCount;
    if (
      typeof promptTokens !== 'number' ||
      typeof completionTokens !== 'number' ||
      typeof totalTokens !== 'number' ||
      ![promptTokens, completionTokens, totalTokens].every(
        (count) => Number.isSafeInteger(count) && count >= 0,
      )
    )
      return undefined;

    return { promptTokens, completionTokens, totalTokens };
  }

  private extractOpenAiSources(payload: unknown): string[] {
    if (!payload || typeof payload !== 'object') return [];

    const choices = (payload as { choices?: unknown }).choices;
    if (
      !Array.isArray(choices) ||
      !choices[0] ||
      typeof choices[0] !== 'object'
    )
      return [];

    const choice = choices[0] as {
      message?: unknown;
      delta?: unknown;
    };
    const sources: string[] = [];

    for (const candidate of [choice.message, choice.delta]) {
      if (!candidate || typeof candidate !== 'object') continue;
      const message = candidate as {
        annotations?: unknown;
        executed_tools?: unknown;
      };

      if (Array.isArray(message.annotations)) {
        for (const annotation of message.annotations) {
          const url = (annotation as { url_citation?: { url?: unknown } })
            ?.url_citation?.url;
          if (typeof url === 'string') sources.push(url);
        }
      }

      if (Array.isArray(message.executed_tools)) {
        for (const tool of message.executed_tools) {
          if (!tool || typeof tool !== 'object') continue;
          const executedTool = tool as {
            arguments?: unknown;
            search_results?: { results?: unknown };
          };
          const results = executedTool.search_results?.results;
          if (Array.isArray(results)) {
            for (const result of results) {
              const url = (result as { url?: unknown })?.url;
              if (typeof url === 'string') sources.push(url);
            }
          }
          if (typeof executedTool.arguments === 'string') {
            try {
              const parsed = JSON.parse(executedTool.arguments) as {
                url?: unknown;
              };
              if (typeof parsed.url === 'string') sources.push(parsed.url);
            } catch {
              // Ignore provider-specific non-JSON tool arguments.
            }
          }
        }
      }
    }

    return this.promptBuilder.mergeSources(sources) || [];
  }

  private async readWithTimeout<T>(
    reader: ReadableStreamDefaultReader<T>,
    label: string,
    timeoutMs = this.getStreamIdleTimeoutMs(),
    context: AiRequestContext = {},
    abortUpstream?: (reason?: unknown) => void,
  ): Promise<ReadableStreamReadResult<T>> {
    try {
      return await this.withTimeout(
        () => reader.read(),
        label,
        timeoutMs,
        context,
      );
    } catch (error) {
      abortUpstream?.(error);
      throw error;
    }
  }

  async completeGeminiText(params: {
    signal?: AbortSignal;
    deadlineAt?: number;
    beforeProviderRequest?: ChatParams['beforeProviderRequest'];
    beforeProviderAttempt?: ChatParams['beforeProviderAttempt'];
    execution?: ChatParams['execution'];
    model: string;
    prompt: string;
    temperature?: number;
    maxOutputTokens?: number;
    timeoutMs?: number;
  }): Promise<string> {
    const requestScope = this.createRequestScope(params);
    try {
      assertAiRequestActive(requestScope);
      if (!this.genAI) throw new Error('Gemini provider is not configured');
      await this.checkProviderRecipient(
        { provider: 'gemini', model: params.model },
        { ...params, ...requestScope },
      );

      const tryCompletion = async (mId: string) => {
        const timeout = params.timeoutMs ?? this.getProviderTimeoutMs();
        const response = await this.executeRetriableOperation(
          `Gemini completion (${mId})`,
          () =>
            this.executeTrackedAttempt(
              { provider: 'gemini', model: mId },
              { ...params, ...requestScope },
              () =>
                this.withTimeout(
                  (scope) =>
                    this.genAI!.models.generateContent(
                      {
                        model: mId,
                        contents: params.prompt,
                        config: {
                          temperature:
                            params.temperature ??
                            AI_CONSTANTS.TEMPERATURE_PRECISE,
                          maxOutputTokens:
                            params.maxOutputTokens ??
                            AI_CONSTANTS.COMPLETION_MAX_OUTPUT_TOKENS,
                          abortSignal: scope.signal,
                          httpOptions: {
                            timeout: Math.max(1, scope.deadlineAt - Date.now()),
                          },
                        },
                      },
                      this.providerTransportOptions(
                        { provider: 'gemini', model: mId },
                        params,
                        scope,
                      ),
                    ),
                  `Gemini completion (${mId})`,
                  timeout,
                  requestScope,
                ),
              (result) => this.extractGeminiAttemptUsage(result),
            ),
          params.beforeProviderRequest,
          requestScope,
        );
        assertAiRequestActive(requestScope);
        return (response.text || '').trim();
      };

      try {
        return await tryCompletion(params.model);
      } catch (error: unknown) {
        if (error instanceof AiAttemptControlError) throw error;
        assertAiRequestActive(requestScope);
        if (
          !(error instanceof AiAttemptControlError) &&
          !isAiRequestStoppedError(error) &&
          this.isModelNotFoundError(error)
        ) {
          this.logger.warn(
            `Model ${params.model} not found. Falling back to gemini-3.5-flash-lite...`,
          );
          return await tryCompletion('gemini-3.5-flash-lite');
        }
        throw error;
      }
    } finally {
      requestScope.dispose();
    }
  }

  async completeOpenAiCompatibleText(
    plan: ProviderPlan,
    params: {
      signal?: AbortSignal;
      deadlineAt?: number;
      beforeProviderRequest?: ChatParams['beforeProviderRequest'];
      beforeProviderAttempt?: ChatParams['beforeProviderAttempt'];
      execution?: ChatParams['execution'];
      systemPrompt: string;
      prompt: string;
      context?: string;
      temperature?: number;
      maxOutputTokens?: number;
      history?: ChatHistoryMessage[];
      timeoutMs?: number;
    },
  ): Promise<string> {
    const requestScope = this.createRequestScope(params);
    let requestTimeout: ProviderRequestScope | undefined;
    let response: Response | undefined;
    let receivedUsage: TokenUsage | undefined;
    try {
      assertAiRequestActive(requestScope);
      if (!plan.apiKey || !plan.baseUrl)
        throw new Error(`${plan.provider} provider is not configured`);
      await this.checkProviderRecipient(plan, { ...params, ...requestScope });
      const requestUrl = await waitForAiResult(
        this.getSafeOpenAiCompatibleUrl(plan.baseUrl),
        requestScope.signal,
      );
      assertAiRequestActive(requestScope);
      const sendRequest = async (attempt: number) => {
        assertAiRequestActive(requestScope);
        requestTimeout?.abort();
        requestTimeout?.dispose();
        const scope = this.createAbortController(
          `${plan.provider} completion attempt ${attempt + 1}`,
          params.timeoutMs ?? this.getProviderTimeoutMs(),
          requestScope,
        );
        requestTimeout = scope;
        assertAiRequestActive(scope);
        return this.sendTrackedOpenAiRequest(
          plan,
          { ...params, ...requestScope },
          () =>
            this.waitForProviderResult(
              fetchAiProvider(
                requestUrl,
                {
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
                    temperature:
                      params.temperature ?? AI_CONSTANTS.TEMPERATURE_PRECISE,
                    max_tokens:
                      params.maxOutputTokens ??
                      AI_CONSTANTS.COMPLETION_MAX_OUTPUT_TOKENS,
                  }),
                  signal: scope.signal,
                  redirect: 'manual',
                },
                this.providerTransportOptions(plan, params, scope),
              ),
              scope,
              requestScope,
            ),
        );
      };

      response = await this.executeOpenAiRequestWithRetry(
        `${plan.provider} completion`,
        sendRequest,
        params.beforeProviderRequest,
        requestScope,
      );
      assertAiRequestActive(requestScope);
      if (!response.ok) {
        throw this.getProviderHttpError(
          plan.provider,
          plan.model,
          response.status,
          undefined,
          plan.apiKey,
          parseAiRetryAfter(response.headers?.get('retry-after')),
        );
      }

      const result = (await this.waitForProviderResult(
        readAiProviderJson(response, MAX_PROVIDER_RESPONSE_BYTES),
        requestTimeout!,
        requestScope,
      )) as OpenAiResponsePayload;
      receivedUsage = this.extractOpenAiUsage(result);
      this.assertOpenAiResponseAllowed(result);
      const content = result.choices?.[0]?.message?.content;
      if (typeof content !== 'string')
        throw new Error('Provider returned invalid completion content');
      assertAiRequestActive(requestScope);
      await this.finishOpenAiAttempt(
        response,
        undefined,
        requestScope,
        receivedUsage,
      );
      assertAiRequestActive(requestScope);
      return typeof content === 'string' ? content.trim() : '';
    } catch (error) {
      await this.finishOpenAiAttempt(
        response,
        error,
        requestScope,
        receivedUsage,
      );
      throw error;
    } finally {
      requestTimeout?.abort();
      requestTimeout?.dispose();
      requestScope.dispose();
    }
  }

  async runGemini(
    plan: ProviderPlan,
    params: ChatParams,
    routingMode: AiRoutingMode,
    routeDecision: RouteDecision,
  ): Promise<ChatResult> {
    const requestScope = this.createRequestScope(params);
    try {
      assertAiRequestActive(requestScope);
      if (!this.genAI) throw new Error('Gemini provider is not configured');
      await this.checkProviderRecipient(plan, { ...params, ...requestScope });
      const searchEnabled = routeDecision.needsLiveSearch;
      const systemPrompt = this.buildSystemPromptForRequest(
        params,
        routeDecision,
        this.buildCapabilities(searchEnabled, !!params.image),
      );
      const contents = this.promptBuilder.buildGeminiContents(
        params.prompt,
        params.context,
        params.history,
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
        this.executeRetriableOperation(
          `Gemini request (${plan.model})`,
          () =>
            this.executeTrackedAttempt(
              plan,
              { ...params, ...requestScope },
              () =>
                this.withTimeout(
                  (scope) =>
                    this.genAI!.models.generateContent(
                      {
                        model: plan.model,
                        contents,
                        config: {
                          ...config,
                          abortSignal: scope.signal,
                          httpOptions: {
                            timeout: Math.max(1, scope.deadlineAt - Date.now()),
                          },
                        },
                      },
                      this.providerTransportOptions(plan, params, scope),
                    ),
                  `Gemini request (${plan.model})`,
                  this.getProviderTimeoutMs(),
                  requestScope,
                ),
              (result) => this.extractGeminiAttemptUsage(result),
            ),
          params.beforeProviderRequest,
          requestScope,
        );
      let result;
      try {
        result = await generate();
      } catch (error) {
        if (error instanceof AiAttemptControlError) throw error;
        assertAiRequestActive(requestScope);
        if (
          !(error instanceof AiAttemptControlError) &&
          !isAiRequestStoppedError(error) &&
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

      assertAiRequestActive(requestScope);
      const responseText = result.text || '';
      const parsed = this.promptBuilder.parseAiResponse(
        responseText,
        routeDecision.responseFormat,
      );
      this.promptBuilder.assertUsableStructuredResponse(
        parsed,
        responseText,
        `Gemini (${plan.model})`,
        routeDecision.responseFormat,
      );
      const sourceDetails = searchEnabled
        ? this.promptBuilder.extractSourceDetails(result)
        : [];
      const sources = this.promptBuilder.mergeSources(
        parsed.sources,
        sourceDetails.map((source) => source.url),
      );
      assertAiRequestActive(requestScope);
      return {
        ...parsed,
        message: this.promptBuilder.appendSourcesToMessage(
          parsed.message,
          sources,
          sourceDetails,
        ),
        sources,
        provider: 'gemini',
        providerLabel: plan.displayName || 'gemini',
        model: plan.model,
        routingMode,
        contractVersion: 1,
        usage: this.extractGeminiUsage(result),
      };
    } finally {
      requestScope.dispose();
    }
  }

  async runOpenAiCompatible(
    plan: ProviderPlan,
    params: ChatParams,
    routingMode: AiRoutingMode,
    routeDecision: RouteDecision,
  ): Promise<ChatResult> {
    const requestScope = this.createRequestScope(params);
    let requestTimeout: ProviderRequestScope | undefined;
    let response: Response | undefined;
    let receivedUsage: TokenUsage | undefined;
    try {
      assertAiRequestActive(requestScope);
      if (!plan.apiKey || !plan.baseUrl)
        throw new Error(`${plan.provider} provider is not configured`);
      await this.checkProviderRecipient(plan, { ...params, ...requestScope });
      const requestUrl = await waitForAiResult(
        this.getSafeOpenAiCompatibleUrl(plan.baseUrl),
        requestScope.signal,
      );
      assertAiRequestActive(requestScope);
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
        { ...searchAttempt.capabilities, visionInput: !!params.image },
      );
      const sendRequest = async (attempt: number) => {
        assertAiRequestActive(requestScope);
        requestTimeout?.abort();
        requestTimeout?.dispose();
        const scope = this.createAbortController(
          `${plan.provider} request (${modelToUse}) attempt ${attempt + 1}`,
          this.getProviderTimeoutMs(),
          requestScope,
        );
        requestTimeout = scope;
        assertAiRequestActive(scope);
        const response = await this.sendTrackedOpenAiRequest(
          { ...plan, model: modelToUse },
          { ...params, ...requestScope },
          () =>
            this.waitForProviderResult(
              fetchAiProvider(
                requestUrl,
                {
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
                      plan.provider === 'openrouter' ||
                        plan.capabilities?.document
                        ? params.document
                        : undefined,
                    ),
                    temperature: AI_CONSTANTS.TEMPERATURE_CREATIVE,
                    max_tokens: this.getOpenAiMaxOutputTokens(plan),
                    ...this.getOpenAiDocumentOptions(plan, params),
                    ...searchAttempt.requestOptions,
                    ...(structuredResponseFormat
                      ? { response_format: structuredResponseFormat }
                      : {}),
                  }),
                  signal: scope.signal,
                  redirect: 'manual',
                },
                this.providerTransportOptions(plan, params, scope),
              ),
              scope,
              requestScope,
            ),
        );
        return response;
      };

      response = await this.executeOpenAiRequestWithRetry(
        `${plan.provider} request (${modelToUse})`,
        sendRequest,
        params.beforeProviderRequest,
        requestScope,
      );
      while (!response.ok) {
        const errorPayload = await this.waitForProviderResult(
          this.readProviderErrorPayload(response, requestTimeout),
          requestTimeout!,
          requestScope,
        );
        assertAiRequestActive(requestScope);
        await this.finishOpenAiAttempt(response, undefined, requestScope);
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
            params.beforeProviderRequest,
            requestScope,
          );
          continue;
        }
        throw this.getProviderHttpError(
          plan.provider,
          modelToUse,
          response.status,
          errorPayload,
          plan.apiKey,
          parseAiRetryAfter(response.headers?.get('retry-after')),
        );
      }

      const result = (await this.waitForProviderResult(
        readAiProviderJson(response, MAX_PROVIDER_RESPONSE_BYTES),
        requestTimeout!,
        requestScope,
      )) as OpenAiResponsePayload;
      receivedUsage = this.extractOpenAiUsage(result);
      this.assertOpenAiResponseAllowed(result);
      const responseText = result.choices?.[0]?.message?.content ?? '';
      if (typeof responseText !== 'string')
        throw new Error('Provider returned invalid completion content');
      const parsed = this.promptBuilder.parseAiResponse(
        responseText,
        routeDecision.responseFormat,
      );
      this.promptBuilder.assertUsableStructuredResponse(
        parsed,
        responseText,
        `${plan.provider} (${modelToUse})`,
        routeDecision.responseFormat,
      );
      const sources = this.promptBuilder.mergeSources(
        parsed.sources,
        this.extractOpenAiSources(result),
      );
      assertAiRequestActive(requestScope);
      await this.finishOpenAiAttempt(
        response,
        undefined,
        requestScope,
        receivedUsage,
      );
      assertAiRequestActive(requestScope);
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
        providerReportedModel: this.providerReportedModel(result.model),
        routingMode,
        contractVersion: 1,
        usage: this.extractOpenAiUsage(result),
      };
    } catch (error) {
      await this.finishOpenAiAttempt(
        response,
        error,
        requestScope,
        receivedUsage,
      );
      throw error;
    } finally {
      requestTimeout?.abort();
      requestTimeout?.dispose();
      requestScope.dispose();
    }
  }

  async *streamGemini(
    plan: ProviderPlan,
    params: ChatParams,
    routingMode: AiRoutingMode,
    routeDecision: RouteDecision,
  ): AsyncGenerator<StreamEvent> {
    const requestScope = this.createRequestScope(params);
    let requestTimeout: ProviderRequestScope | undefined;
    let iterator: AsyncGenerator<GenerateContentResponse> | undefined;
    let trackedAttempt: TrackedProviderAttempt | undefined;
    let usage: TokenUsage | undefined;
    let observedUsage: Partial<TokenUsage> | undefined;
    try {
      assertAiRequestActive(requestScope);
      if (!this.genAI) throw new Error('Gemini provider is not configured');
      await this.checkProviderRecipient(plan, { ...params, ...requestScope });
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
      const generateStream = () =>
        this.executeRetriableOperation(
          `Gemini stream bootstrap (${plan.model})`,
          async () => {
            requestTimeout?.abort();
            requestTimeout?.dispose();
            const scope = this.createAbortController(
              `Gemini stream bootstrap (${plan.model})`,
              this.getProviderTimeoutMs(),
              requestScope,
            );
            requestTimeout = scope;
            assertAiRequestActive(scope);
            trackedAttempt = undefined;
            usage = undefined;
            observedUsage = undefined;
            trackedAttempt = await this.beginProviderAttempt(plan, {
              ...params,
              ...requestScope,
            });
            try {
              return await this.waitForProviderResult(
                this.genAI!.models.generateContentStream(
                  {
                    model: plan.model,
                    contents,
                    config: {
                      ...config,
                      abortSignal: scope.signal,
                      httpOptions: {
                        timeout: Math.max(1, scope.deadlineAt - Date.now()),
                      },
                    },
                  },
                  this.providerTransportOptions(plan, params, scope),
                ),
                scope,
                requestScope,
              );
            } catch (error) {
              if (error instanceof AiGeminiProviderError)
                observedUsage =
                  this.extractGeminiAttemptUsage(error) ?? observedUsage;
              await trackedAttempt?.fail(
                this.getAttemptOutcome(error, requestScope),
                { usage: observedUsage },
              );
              scope.abort(error);
              scope.dispose();
              throw error;
            }
          },
          params.beforeProviderRequest,
          requestScope,
        );
      try {
        iterator = await generateStream();
      } catch (error) {
        if (error instanceof AiAttemptControlError) throw error;
        assertAiRequestActive(requestScope);
        if (
          !(error instanceof AiAttemptControlError) &&
          !isAiRequestStoppedError(error) &&
          structuredGenerationConfig &&
          this.isGeminiStructuredOutputUnsupportedError(error)
        ) {
          this.logger.warn(
            `Gemini model ${plan.model} rejected structured output config for streaming. Retrying without provider-level schema enforcement...`,
          );
          config = baseConfig;
          iterator = await generateStream();
        } else {
          throw error;
        }
      }

      let fullText = '';
      const providerSourceDetails: Array<{ title: string; url: string }> = [];
      while (true) {
        assertAiRequestActive(requestScope);
        const nextChunk = await this.withTimeout(
          () => iterator!.next(),
          `Gemini stream (${plan.model})`,
          this.getStreamIdleTimeoutMs(),
          requestTimeout,
        );
        assertAiRequestActive(requestScope);
        if (nextChunk.done) break;
        const chunkText = nextChunk.value.text || '';
        if (chunkText.length > MAX_STREAM_EVENT_CHARACTERS) {
          throw new Error('AI provider stream event exceeded the size limit');
        }
        usage = this.extractGeminiUsage(nextChunk.value) ?? usage;
        const receivedUsage = this.extractGeminiAttemptUsage(nextChunk.value);
        if (receivedUsage)
          observedUsage = { ...observedUsage, ...receivedUsage };
        if (searchEnabled) {
          providerSourceDetails.push(
            ...this.promptBuilder.extractSourceDetails(nextChunk.value),
          );
        }
        if (chunkText) {
          fullText = this.appendStreamText(fullText, chunkText);
          assertAiRequestActive(requestScope);
          yield { type: 'chunk', text: chunkText };
        }
      }
      assertAiRequestActive(requestScope);
      const parsed = this.promptBuilder.parseAiResponse(
        fullText,
        routeDecision.responseFormat,
      );
      this.promptBuilder.assertUsableStructuredResponse(
        parsed,
        fullText,
        `Gemini stream (${plan.model})`,
        routeDecision.responseFormat,
      );
      const sources = this.promptBuilder.mergeSources(
        parsed.sources,
        providerSourceDetails.map((source) => source.url),
      );
      assertAiRequestActive(requestScope);
      await trackedAttempt?.complete({ usage: observedUsage });
      assertAiRequestActive(requestScope);
      yield {
        type: 'done',
        data: {
          ...parsed,
          message: this.promptBuilder.appendSourcesToMessage(
            parsed.message,
            sources,
            providerSourceDetails,
          ),
          sources,
          provider: 'gemini',
          providerLabel: plan.displayName || 'gemini',
          model: plan.model,
          routingMode,
          contractVersion: 1,
          usage,
        },
      };
    } catch (error) {
      if (error instanceof AiGeminiProviderError) {
        const receivedUsage = this.extractGeminiAttemptUsage(error);
        if (receivedUsage)
          observedUsage = { ...observedUsage, ...receivedUsage };
      }
      await trackedAttempt?.fail(this.getAttemptOutcome(error, requestScope), {
        usage: observedUsage,
      });
      throw error;
    } finally {
      requestTimeout?.abort();
      requestScope.abort();
      try {
        await trackedAttempt?.fail(
          this.getAttemptOutcome(undefined, requestScope),
          { usage: observedUsage },
        );
      } finally {
        // Native iterators may ignore AbortSignal or queue return() behind a
        // stalled next(). Request termination must not await them indefinitely.
        await this.cancelStreamResource(() => iterator?.return(undefined));
        requestTimeout?.dispose();
        requestScope.dispose();
      }
    }
  }

  async *streamOpenAiCompatible(
    plan: ProviderPlan,
    params: ChatParams,
    routingMode: AiRoutingMode,
    routeDecision: RouteDecision,
  ): AsyncGenerator<StreamEvent> {
    const requestScope = this.createRequestScope(params);
    let requestTimeout: ProviderRequestScope | undefined;
    let response: Response | undefined;
    try {
      assertAiRequestActive(requestScope);
      if (!plan.apiKey || !plan.baseUrl)
        throw new Error(`${plan.provider} provider is not configured`);
      await this.checkProviderRecipient(plan, { ...params, ...requestScope });
      const requestUrl = await waitForAiResult(
        this.getSafeOpenAiCompatibleUrl(plan.baseUrl),
        requestScope.signal,
      );
      assertAiRequestActive(requestScope);
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
        { ...searchAttempt.capabilities, visionInput: !!params.image },
      );
      const sendRequest = async (attempt: number) => {
        assertAiRequestActive(requestScope);
        requestTimeout?.abort();
        requestTimeout?.dispose();
        const scope = this.createAbortController(
          `${plan.provider} stream request (${modelToUse}) attempt ${attempt + 1}`,
          this.getProviderTimeoutMs(),
          requestScope,
        );
        requestTimeout = scope;
        assertAiRequestActive(scope);
        const result = await this.sendTrackedOpenAiRequest(
          { ...plan, model: modelToUse },
          { ...params, ...requestScope },
          () =>
            this.waitForProviderResult(
              fetchAiProvider(
                requestUrl,
                {
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
                      plan.provider === 'openrouter' ||
                        plan.capabilities?.document
                        ? params.document
                        : undefined,
                    ),
                    temperature: AI_CONSTANTS.TEMPERATURE_CREATIVE,
                    max_tokens: this.getOpenAiMaxOutputTokens(plan),
                    stream: true,
                    ...this.getOpenAiDocumentOptions(plan, params),
                    ...searchAttempt.requestOptions,
                    ...(structuredResponseFormat
                      ? { response_format: structuredResponseFormat }
                      : {}),
                  }),
                  signal: scope.signal,
                  redirect: 'manual',
                },
                this.providerTransportOptions(plan, params, scope),
              ),
              scope,
              requestScope,
            ),
        );
        return result;
      };

      response = await this.executeOpenAiRequestWithRetry(
        `${plan.provider} stream request (${modelToUse})`,
        sendRequest,
        params.beforeProviderRequest,
        requestScope,
      );
      while (!response.ok) {
        const errorPayload = await this.waitForProviderResult(
          this.readProviderErrorPayload(response, requestTimeout),
          requestTimeout!,
          requestScope,
        );
        assertAiRequestActive(requestScope);
        await this.finishOpenAiAttempt(response, undefined, requestScope);
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
            params.beforeProviderRequest,
            requestScope,
          );
          continue;
        }
        throw this.getProviderHttpError(
          plan.provider,
          modelToUse,
          response.status,
          errorPayload,
          plan.apiKey,
          parseAiRetryAfter(response.headers?.get('retry-after')),
        );
      }

      assertAiRequestActive(requestScope);
      yield* this.streamFetch(
        response,
        requestTimeout!,
        modelToUse,
        plan.provider,
        plan.displayName || plan.provider,
        routingMode,
        routeDecision.responseFormat,
      );
    } catch (error) {
      await this.finishOpenAiAttempt(response, error, requestScope);
      throw error;
    } finally {
      requestTimeout?.abort();
      requestScope.abort();
      try {
        await this.finishOpenAiAttempt(
          response,
          requestScope.signal.reason,
          requestScope,
        );
      } finally {
        if (response?.body && !response.body.locked) {
          await this.cancelStreamResource(() => response!.body?.cancel());
        }
        requestTimeout?.dispose();
        requestScope.dispose();
      }
    }
  }

  private async *streamFetch(
    response: Response,
    abortController: {
      clear: () => void;
      signal: AbortSignal;
      deadlineAt?: number;
      abort?: (reason?: unknown) => void;
    },
    model: string,
    provider: AiProvider,
    providerLabel: string,
    routingMode: AiRoutingMode,
    responseFormat: AiResponseFormat = 'chat',
  ): AsyncGenerator<StreamEvent> {
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Response body is not readable');
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let fullText = '';
    let usage: TokenUsage | undefined;
    let providerReportedModel: string | undefined;
    const providerSources: string[] = [];
    let doneStream = false;
    const readEvent = (line: string): string => {
      assertAiRequestActive(abortController);
      if (line.length > MAX_STREAM_EVENT_CHARACTERS) {
        throw new Error('AI provider stream event exceeded the size limit');
      }
      if (!line.startsWith('data:')) return '';
      const data = line.slice(5).trim();
      if (data === '[DONE]') {
        doneStream = true;
        return '';
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(data);
      } catch (error) {
        // Only JSON syntax errors are ignorable. Stop/size/control errors
        // must never disappear into malformed-event handling.
        if (error instanceof SyntaxError) return '';
        throw error;
      }
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
        return '';
      usage = this.extractOpenAiUsage(parsed) ?? usage;
      const eventModel = this.providerReportedModel(
        (parsed as { model?: unknown }).model,
      );
      if (eventModel) {
        if (providerReportedModel && providerReportedModel !== eventModel)
          throw new Error(
            'Provider stream changed its provider-reported model identity',
          );
        providerReportedModel = eventModel;
      }
      this.assertOpenAiResponseAllowed(parsed);
      providerSources.push(...this.extractOpenAiSources(parsed));
      const text = this.promptBuilder.extractOpenAiStreamText(parsed);
      if (text) fullText = this.appendStreamText(fullText, text);
      return text;
    };
    try {
      let lineBuffer = '';
      while (!doneStream) {
        assertAiRequestActive(abortController);
        const { done, value } = await this.readWithTimeout(
          reader,
          `${provider} stream chunk`,
          this.getStreamIdleTimeoutMs(),
          abortController,
          abortController.abort,
        );
        assertAiRequestActive(abortController);
        if (done) break;
        lineBuffer += decoder.decode(value, { stream: true });
        const lines = lineBuffer.split(/\r?\n/);
        lineBuffer = lines.pop() || '';
        for (const line of lines) {
          const text = readEvent(line);
          if (doneStream) break;
          if (text) {
            assertAiRequestActive(abortController);
            yield { type: 'chunk', text };
          }
        }
        if (!doneStream && lineBuffer.length > MAX_STREAM_EVENT_CHARACTERS) {
          throw new Error('AI provider stream event exceeded the size limit');
        }
      }
      assertAiRequestActive(abortController);
      if (!doneStream) {
        lineBuffer += decoder.decode();
        if (lineBuffer) {
          const text = readEvent(lineBuffer.trimEnd());
          if (text) {
            assertAiRequestActive(abortController);
            yield { type: 'chunk', text };
          }
        }
      }
      assertAiRequestActive(abortController);
      if (!doneStream)
        throw new Error('AI provider stream ended without a terminal marker');
      const parsed = this.promptBuilder.parseAiResponse(
        fullText,
        responseFormat,
      );
      this.promptBuilder.assertUsableStructuredResponse(
        parsed,
        fullText,
        `${provider} stream (${model})`,
        responseFormat,
      );
      const sources = this.promptBuilder.mergeSources(
        parsed.sources,
        providerSources,
      );
      assertAiRequestActive(abortController);
      await this.finishOpenAiAttempt(
        response,
        undefined,
        abortController,
        usage,
      );
      assertAiRequestActive(abortController);
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
          providerReportedModel,
          routingMode,
          contractVersion: 1,
          usage,
        },
      };
    } catch (error) {
      await this.finishOpenAiAttempt(response, error, abortController, usage);
      throw error;
    } finally {
      try {
        await this.finishOpenAiAttempt(
          response,
          new Error('AI stream consumer cancelled'),
          { ...abortController, signal: AbortSignal.abort() },
          usage,
        );
      } finally {
        abortController.abort?.();
        try {
          await this.cancelStreamResource(() => reader.cancel());
        } finally {
          reader.releaseLock();
          abortController.clear();
        }
      }
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
