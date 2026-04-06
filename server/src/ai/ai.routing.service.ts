import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AiRoutingMode, ChatParams, ProviderPlan, RouteDecision } from './ai.types';

@Injectable()
export class AiRoutingService {
    constructor(private readonly configService: ConfigService) {}

    getGeminiModelList(requestedModel?: string): string[] {
        const legacyMap: Record<string, string> = {
            'gemini-3-flash': 'gemini-3-flash-preview',
            'gemini-3-pro': 'gemini-3-pro-preview',
            'gemini-3.1-pro': 'gemini-3.1-pro-preview',
        };

        const actualModel = requestedModel ? (legacyMap[requestedModel] || requestedModel) : null;
        return actualModel
            ? [actualModel]
            : ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-3-flash-preview'];
    }

    normalizeRoutingMode(routingMode?: string): AiRoutingMode {
        if (routingMode === 'fast' || routingMode === 'best' || routingMode === 'gemini-only') {
            return routingMode;
        }

        return 'auto';
    }

    detectPromptNeeds(prompt: string, context?: string, schemaContext?: string, mode?: string, image?: string): RouteDecision {
        const combined = `${prompt}\n${context || ''}`.toLowerCase();
        const reasons: string[] = [];
        let complexityScore = 0;

        const currentInfoPattern = /\b(latest|current|today|news|recent|now|this week|this month|202[6-9]|search web|browse|up to date)\b/i;
        const deepReasoningPattern = /\b(architecture|refactor|migration|optimi[sz]e|performance|debug|root cause|trade[- ]?off|step[- ]?by[- ]?step|thorough|deep dive|analyze)\b/i;
        const complexDataPattern = /\b(index|join|execution plan|explain|schema design|normalization|aggregation|pipeline|relationship|foreign key)\b/i;

        if (image) {
            complexityScore += 6;
            reasons.push('image-attached');
        }

        if (currentInfoPattern.test(combined)) {
            complexityScore += 4;
            reasons.push('current-info');
        }

        if (deepReasoningPattern.test(combined)) {
            complexityScore += 3;
            reasons.push('deep-reasoning');
        }

        if (complexDataPattern.test(combined)) {
            complexityScore += 2;
            reasons.push('complex-db-task');
        }

        if ((prompt?.length || 0) > 1200) {
            complexityScore += 2;
            reasons.push('long-prompt');
        }

        if ((context?.length || 0) > 2500) {
            complexityScore += 2;
            reasons.push('large-context');
        }

        if ((schemaContext?.length || 0) > 6000) {
            complexityScore += 1;
            reasons.push('large-schema');
        }

        if (mode === 'planning') {
            complexityScore += 1;
            reasons.push('planning-mode');
        }

        return {
            preferGemini: complexityScore >= 5,
            complexityScore,
            reasons,
        };
    }

    getLowCostPlans(): ProviderPlan[] {
        const plans: ProviderPlan[] = [];

        const cerebrasApiKey = this.configService.get<string>('CEREBRAS_API_KEY');
        if (cerebrasApiKey) {
            plans.push({
                provider: 'cerebras',
                apiKey: cerebrasApiKey,
                baseUrl: this.configService.get<string>('CEREBRAS_BASE_URL') || 'https://api.cerebras.ai/v1',
                model: this.configService.get<string>('CEREBRAS_CHAT_MODEL') || 'llama3.1-8b',
            });
        }

        const openRouterApiKey = this.configService.get<string>('OPENROUTER_API_KEY');
        const openRouterModel = this.configService.get<string>('OPENROUTER_CHAT_MODEL');
        if (openRouterApiKey && openRouterModel) {
            plans.push({
                provider: 'openrouter',
                apiKey: openRouterApiKey,
                baseUrl: this.configService.get<string>('OPENROUTER_BASE_URL') || 'https://openrouter.ai/api/v1',
                model: openRouterModel,
            });
        }

        return plans;
    }

    buildPlanChain(params: ChatParams, geminiAvailable: boolean): { routingMode: AiRoutingMode; plans: ProviderPlan[] } {
        const routingMode = this.normalizeRoutingMode(params.routingMode);
        const lowCostPlans = this.getLowCostPlans();
        const geminiPlans = geminiAvailable
            ? this.getGeminiModelList(params.model).map((model) => ({ provider: 'gemini' as const, model }))
            : [];
        const routeDecision = this.detectPromptNeeds(params.prompt, params.context, params.schemaContext, params.mode, params.image);

        if (params.image && geminiPlans.length === 0) {
            throw new Error('Image analysis currently requires Gemini. Set GEMINI_API_KEY or remove the image attachment.');
        }

        const orderedPlans: ProviderPlan[] = [];
        const pushAll = (plans: ProviderPlan[]) => {
            for (const plan of plans) {
                if (!orderedPlans.some((existing) => existing.provider === plan.provider && existing.model === plan.model)) {
                    orderedPlans.push(plan);
                }
            }
        };

        if (routingMode === 'gemini-only' || routingMode === 'best') {
            pushAll(geminiPlans);
            pushAll(lowCostPlans);
        } else if (params.image || routeDecision.preferGemini) {
            pushAll(geminiPlans);
            pushAll(lowCostPlans);
        } else {
            pushAll(lowCostPlans);
            pushAll(geminiPlans);
        }

        if (orderedPlans.length === 0) {
            throw new Error(
                'No AI provider is configured. Set GEMINI_API_KEY or configure CEREBRAS_API_KEY / OPENROUTER_API_KEY.',
            );
        }

        return { routingMode, plans: orderedPlans };
    }
}
