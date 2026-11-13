import {
  Injectable,
  Inject,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { AiPromptBuilderService } from './ai.prompt-builder.service';
import { AiProviderRunnerService } from './ai.provider-runner.service';
import { AiRoutingService } from './ai.routing.service';
import {
  AiCircuitBreakerService,
  type AiCircuitAdmission,
} from './ai.circuit-breaker.service';
import { isAiDisabledError } from './ai-account-policy.service';
import { AI_CONSTANTS } from './ai.constants';
import { isAiProviderTerminalError } from './ai-retry-policy';
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

  private acquireCircuit(
    plan: ProviderPlan,
    params: ChatParams,
  ): AiCircuitAdmission | undefined {
    if (typeof this.circuitBreaker.tryAcquire !== 'function') {
      throw new ServiceUnavailableException(
        'AI circuit admission is unavailable.',
      );
    }
    const admission = this.circuitBreaker.tryAcquire(
      plan.provider,
      plan.model,
      this.circuitScope(plan, params),
    );
    if (
      admission &&
      ['success', 'failure', 'cancel'].some(
        (method) =>
          typeof admission[method as keyof AiCircuitAdmission] !== 'function',
      )
    ) {
      throw new ServiceUnavailableException('AI circuit admission is invalid.');
    }
    if (!admission) return undefined;
    let settled = false;
    const settle = (outcome: keyof AiCircuitAdmission) => {
      if (settled) return;
      settled = true;
      admission[outcome]();
    };
    return {
      success: () => settle('success'),
      failure: () => settle('failure'),
      cancel: () => settle('cancel'),
    };
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
        const admission = this.acquireCircuit(plan, request);
        if (!admission) {
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
          admission.success();
          return result;
        } catch (error) {
          if (
            scope.signal.aborted ||
            isAiDisabledError(error) ||
            isAiRequestStoppedError(error) ||
            isAiProviderTerminalError(error) ||
            (typeof error === 'object' &&
              error !== null &&
              'aiRequestFatal' in error &&
              error.aiRequestFatal === true)
          ) {
            admission.cancel();
            throw error;
          }
          lastError = error instanceof Error ? error : new Error(String(error));
          admission.failure();
          this.logger.warn(
            `[AiChatService] Provider ${plan.provider}/${plan.model} failed: ${lastError.message}`,
          );
        } finally {
          admission.cancel();
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
        const admission = this.acquireCircuit(plan, request);
        if (!admission) {
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
            if (next.value.type === 'done') {
              admission.success();
              yield next.value;
              return;
            }
            if (next.value.type === 'error') {
              if (
                next.value.reason === 'AI_DISABLED' ||
                next.value.reason === 'AI_REQUEST_CANCELLED' ||
                next.value.reason === 'AI_REQUEST_TIMEOUT'
              )
                admission.cancel();
              else admission.failure();
              yield next.value;
              return;
            }
            if (next.value.type === 'chunk') emittedChunk = true;
            yield next.value;
          }
          throw new Error('Provider stream ended without a terminal response');
        } catch (error) {
          if (
            scope.signal.aborted ||
            isAiDisabledError(error) ||
            isAiRequestStoppedError(error) ||
            isAiProviderTerminalError(error) ||
            (typeof error === 'object' &&
              error !== null &&
              'aiRequestFatal' in error &&
              error.aiRequestFatal === true)
          ) {
            admission.cancel();
            throw error;
          }
          lastError = error instanceof Error ? error : new Error(String(error));
          admission.failure();
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
          admission.cancel();
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
