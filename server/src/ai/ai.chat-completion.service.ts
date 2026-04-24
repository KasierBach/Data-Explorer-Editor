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
        const { routingMode, plans } = this.routingService.buildPlanChain(params, this.providerRunner.isGeminiAvailable());
        let lastError: Error | null = null;

        for (const plan of plans) {
            try {
                if (plan.provider === 'gemini') {
                    return await this.providerRunner.runGemini(plan, params, routingMode);
                }

                return await this.providerRunner.runOpenAiCompatible(plan, params, routingMode);
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                this.logger.warn(`[AiChatService] Provider ${plan.provider}/${plan.model} failed: ${lastError.message}`);
            }
        }

        throw new Error(`AI generation failed: ${lastError?.message || 'No provider could complete the request'}`);
    }

    async * chatStream(params: ChatParams): AsyncGenerator<StreamEvent> {
        const { routingMode, plans } = this.routingService.buildPlanChain(params, this.providerRunner.isGeminiAvailable());
        let lastError: Error | null = null;

        for (const plan of plans) {
            try {
                if (plan.provider === 'gemini') {
                    yield* this.providerRunner.streamGemini(plan, params, routingMode);
                    return;
                }

                yield* this.providerRunner.streamOpenAiCompatible(plan, params, routingMode);
                return;
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                this.logger.warn(`[AiChatService:Stream] Provider ${plan.provider}/${plan.model} failed: ${lastError.message}`);
            }
        }

        yield {
            type: 'error',
            text: `AI generation failed: ${lastError?.message || 'No provider could complete the request'}`,
        };
    }
}
