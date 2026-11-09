import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { AiPromptBuilderService } from './ai.prompt-builder.service';
import { AiProviderRunnerService } from './ai.provider-runner.service';
import { AiRoutingService } from './ai.routing.service';
import { AiCircuitBreakerService } from './ai.circuit-breaker.service';
import { isAiDisabledError } from './ai-account-policy.service';
import { AI_CONSTANTS } from './ai.constants';
import { createHash } from 'node:crypto';
import type { ProviderPlan } from './ai.types';
import {
  assertAiRequestActive,
  createAiRequestScope,
  isAiRequestStoppedError,
  waitForAiResult,
} from './ai-request-lifecycle';
import type { ChatParams, ChatResult, StreamEvent } from './ai.types';

@Injectable()
export class AiChatCompletionService {
  private readonly logger = new Logger(AiChatCompletionService.name);

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly promptBuilder: AiPromptBuilderService,
    private readonly providerRunner: AiProviderRunnerService,
    private readonly routingService: AiRoutingService,
    private readonly circuitBreaker: AiCircuitBreakerService,
  ) {}

  private circuitScope(plan: ProviderPlan, params: ChatParams): string {
    return createHash('sha256')
      .update(
        JSON.stringify([
          params.requestScopeKey ?? 'internal',
          plan.baseUrl ?? 'gemini',
          plan.apiKey
            ? createHash('sha256').update(plan.apiKey).digest('hex')
            : null,
        ]),
      )
      .digest('hex');
  }

  async chat(params: ChatParams): Promise<ChatResult> {
    const scope = createAiRequestScope({
      ...params,
      timeoutMs: AI_CONSTANTS.DEFAULT_PROVIDER_TIMEOUT_MS,
    });
    const request = {
      ...params,
      signal: scope.signal,
      deadlineAt: scope.deadlineAt,
    };
    try {
      assertAiRequestActive(request);
      await waitForAiResult(
        Promise.resolve().then(() => params.beforeProviderRequest?.()),
        scope.signal,
      );
      assertAiRequestActive(request);
      const { routingMode, plans, routeDecision } =
        this.routingService.buildPlanChain(
          request,
          this.providerRunner.isGeminiAvailable(),
        );
      let lastError: Error | null = null;

      for (const plan of plans) {
        assertAiRequestActive(request);
        await waitForAiResult(
          Promise.resolve().then(() => params.beforeProviderRequest?.()),
          scope.signal,
        );
        assertAiRequestActive(request);
        const circuitScope = this.circuitScope(plan, request);
        if (
          this.circuitBreaker.isOpen(plan.provider, plan.model, circuitScope)
        ) {
          this.logger.warn(
            `[AiChatService] Skipping ${plan.provider}/${plan.model}: circuit open`,
          );
          continue;
        }
        try {
          const result = await waitForAiResult(
            plan.provider === 'gemini'
              ? this.providerRunner.runGemini(
                  plan,
                  request,
                  routingMode,
                  routeDecision,
                )
              : this.providerRunner.runOpenAiCompatible(
                  plan,
                  request,
                  routingMode,
                  routeDecision,
                ),
            scope.signal,
          );
          assertAiRequestActive(request);
          this.circuitBreaker.recordSuccess(
            plan.provider,
            plan.model,
            circuitScope,
          );
          return result;
        } catch (error) {
          if (
            scope.signal.aborted ||
            isAiDisabledError(error) ||
            isAiRequestStoppedError(error) ||
            (typeof error === 'object' &&
              error !== null &&
              'aiRequestFatal' in error &&
              error.aiRequestFatal === true)
          ) {
            this.circuitBreaker.releaseProbe?.(
              plan.provider,
              plan.model,
              circuitScope,
            );
            throw error;
          }
          lastError = error instanceof Error ? error : new Error(String(error));
          this.circuitBreaker.recordFailure(
            plan.provider,
            plan.model,
            circuitScope,
          );
          this.logger.warn(
            `[AiChatService] Provider ${plan.provider}/${plan.model} failed: ${lastError.message}`,
          );
        }
      }

      throw new Error(
        `AI generation failed: ${lastError?.message || 'No provider could complete the request'}`,
      );
    } finally {
      scope.dispose();
    }
  }

  async *chatStream(params: ChatParams): AsyncGenerator<StreamEvent> {
    const scope = createAiRequestScope({
      ...params,
      timeoutMs: AI_CONSTANTS.DEFAULT_PROVIDER_TIMEOUT_MS,
    });
    const request = {
      ...params,
      signal: scope.signal,
      deadlineAt: scope.deadlineAt,
    };
    let activeStream: AsyncGenerator<StreamEvent> | undefined;
    try {
      assertAiRequestActive(request);
      await waitForAiResult(
        Promise.resolve().then(() => params.beforeProviderRequest?.()),
        scope.signal,
      );
      assertAiRequestActive(request);
      const { routingMode, plans, routeDecision } =
        this.routingService.buildPlanChain(
          request,
          this.providerRunner.isGeminiAvailable(),
        );
      let lastError: Error | null = null;
      let emittedChunk = false;

      for (const plan of plans) {
        assertAiRequestActive(request);
        await waitForAiResult(
          Promise.resolve().then(() => params.beforeProviderRequest?.()),
          scope.signal,
        );
        assertAiRequestActive(request);
        const circuitScope = this.circuitScope(plan, request);
        if (
          this.circuitBreaker.isOpen(plan.provider, plan.model, circuitScope)
        ) {
          this.logger.warn(
            `[AiChatService:Stream] Skipping ${plan.provider}/${plan.model}: circuit open`,
          );
          continue;
        }
        try {
          activeStream =
            plan.provider === 'gemini'
              ? this.providerRunner.streamGemini(
                  plan,
                  request,
                  routingMode,
                  routeDecision,
                )
              : this.providerRunner.streamOpenAiCompatible(
                  plan,
                  request,
                  routingMode,
                  routeDecision,
                );
          while (true) {
            const next = await waitForAiResult(
              activeStream.next(),
              scope.signal,
            );
            assertAiRequestActive(request);
            if (next.done) break;
            if (next.value.type === 'chunk') emittedChunk = true;
            yield next.value;
            if (next.value.type === 'done') {
              this.circuitBreaker.recordSuccess(
                plan.provider,
                plan.model,
                circuitScope,
              );
              return;
            }
            if (next.value.type === 'error') return;
          }
          throw new Error('Provider stream ended without a terminal response');
        } catch (error) {
          if (
            scope.signal.aborted ||
            isAiDisabledError(error) ||
            isAiRequestStoppedError(error) ||
            (typeof error === 'object' &&
              error !== null &&
              'aiRequestFatal' in error &&
              error.aiRequestFatal === true)
          ) {
            this.circuitBreaker.releaseProbe?.(
              plan.provider,
              plan.model,
              circuitScope,
            );
            throw error;
          }
          lastError = error instanceof Error ? error : new Error(String(error));
          this.circuitBreaker.recordFailure(
            plan.provider,
            plan.model,
            circuitScope,
          );
          this.logger.warn(
            `[AiChatService:Stream] Provider ${plan.provider}/${plan.model} failed: ${lastError.message}`,
          );
          if (emittedChunk) {
            yield {
              type: 'error',
              text: `AI generation interrupted: ${lastError.message}`,
            };
            return;
          }
        } finally {
          this.circuitBreaker.releaseProbe?.(
            plan.provider,
            plan.model,
            circuitScope,
          );
          if (activeStream) {
            void activeStream.return(undefined).catch(() => undefined);
            activeStream = undefined;
          }
        }
      }

      yield {
        type: 'error',
        text: `AI generation failed: ${lastError?.message || 'No provider could complete the request'}`,
      };
    } finally {
      scope.abort();
      if (activeStream)
        void activeStream.return(undefined).catch(() => undefined);
      scope.dispose();
    }
  }
}
