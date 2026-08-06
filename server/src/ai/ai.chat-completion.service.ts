import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { AiPromptBuilderService } from './ai.prompt-builder.service';
import { AiProviderRunnerService } from './ai.provider-runner.service';
import { AiRoutingService } from './ai.routing.service';
import type { ChatParams, ChatResult, StreamEvent } from './ai.types';

@Injectable()
export class AiChatCompletionService {
  private readonly logger = new Logger(AiChatCompletionService.name);

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly promptBuilder: AiPromptBuilderService,
    private readonly providerRunner: AiProviderRunnerService,
    private readonly routingService: AiRoutingService,
  ) {}

  async chat(params: ChatParams): Promise<ChatResult> {
    const { routingMode, plans, routeDecision } =
      this.routingService.buildPlanChain(
        params,
        this.providerRunner.isGeminiAvailable(),
      );
    let lastError: Error | null = null;

    for (const plan of plans) {
      try {
        if (plan.provider === 'gemini') {
          return await this.providerRunner.runGemini(
            plan,
            params,
            routingMode,
            routeDecision,
          );
        }

        return await this.providerRunner.runOpenAiCompatible(
          plan,
          params,
          routingMode,
          routeDecision,
        );
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.logger.warn(
          `[AiChatService] Provider ${plan.provider}/${plan.model} failed: ${lastError.message}`,
        );
      }
    }

    throw new Error(
      `AI generation failed: ${lastError?.message || 'No provider could complete the request'}`,
    );
  }

  async *chatStream(params: ChatParams): AsyncGenerator<StreamEvent> {
    const { routingMode, plans, routeDecision } =
      this.routingService.buildPlanChain(
        params,
        this.providerRunner.isGeminiAvailable(),
      );
    let lastError: Error | null = null;
    let emittedChunk = false;

    for (const plan of plans) {
      try {
        const stream =
          plan.provider === 'gemini'
            ? this.providerRunner.streamGemini(
                plan,
                params,
                routingMode,
                routeDecision,
              )
            : this.providerRunner.streamOpenAiCompatible(
                plan,
                params,
                routingMode,
                routeDecision,
              );

        for await (const event of stream) {
          if (event.type === 'chunk') emittedChunk = true;
          yield event;
        }
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
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
      }
    }

    yield {
      type: 'error',
      text: `AI generation failed: ${lastError?.message || 'No provider could complete the request'}`,
    };
  }
}
