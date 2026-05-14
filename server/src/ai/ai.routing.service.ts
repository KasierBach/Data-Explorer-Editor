import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AI_CONSTANTS } from './ai.constants';
import type { AiRoutingMode, ChatParams, ProviderPlan, RouteDecision } from './ai.types';

@Injectable()
export class AiRoutingService {
    constructor(private readonly configService: ConfigService) { }

    getGeminiModelList(requestedModel?: string): string[] {
        const legacyMap: Record<string, string> = {
            'gemini-3-pro': 'gemini-3-pro-preview',
            'gemini-3.1-pro': 'gemini-3.1-pro-preview',
        };

        // Only accept models that look like Gemini models
        const isGeminiModel = requestedModel && (
            requestedModel.startsWith('gemini-') ||
            legacyMap[requestedModel]
        );

        const actualModel = isGeminiModel ? (legacyMap[requestedModel!] || requestedModel!) : null;
        return actualModel
            ? [actualModel]
            : ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-3-flash'];
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
            complexityScore += AI_CONSTANTS.COMPLEXITY_IMAGE_WEIGHT;
            reasons.push('image-attached');
        }

        if (currentInfoPattern.test(combined)) {
            complexityScore += AI_CONSTANTS.COMPLEXITY_CURRENT_INFO_WEIGHT;
            reasons.push('current-info');
        }

        if (deepReasoningPattern.test(combined)) {
            complexityScore += AI_CONSTANTS.COMPLEXITY_DEEP_REASONING_WEIGHT;
            reasons.push('deep-reasoning');
        }

        if (complexDataPattern.test(combined)) {
            complexityScore += AI_CONSTANTS.COMPLEXITY_COMPLEX_DATA_WEIGHT;
            reasons.push('complex-db-task');
        }

        if ((prompt?.length || 0) > AI_CONSTANTS.PROMPT_LENGTH_FAST) {
            complexityScore += AI_CONSTANTS.COMPLEXITY_LONG_PROMPT_WEIGHT;
            reasons.push('long-prompt');
        }

        if ((context?.length || 0) > AI_CONSTANTS.CONTEXT_LENGTH_MEDIUM) {
            complexityScore += AI_CONSTANTS.COMPLEXITY_LARGE_CONTEXT_WEIGHT;
            reasons.push('large-context');
        }

        if ((schemaContext?.length || 0) > AI_CONSTANTS.SCHEMA_CONTEXT_LENGTH_LARGE) {
            complexityScore += AI_CONSTANTS.COMPLEXITY_LARGE_SCHEMA_WEIGHT;
            reasons.push('large-schema');
        }

        if (mode === 'planning') {
            complexityScore += AI_CONSTANTS.COMPLEXITY_PLANNING_MODE_WEIGHT;
            reasons.push('planning-mode');
        }

        return {
            preferGemini: complexityScore >= AI_CONSTANTS.COMPLEXITY_GEMINI_THRESHOLD,
            complexityScore,
            reasons,
        };
    }

    getLowCostPlans(): ProviderPlan[] {
        const openRouterApiKey = this.configService.get<string>('OPENROUTER_API_KEY');
        const cerebrasApiKey = this.configService.get<string>('CEREBRAS_API_KEY');
        const groqApiKey = this.configService.get<string>('GROQ_API_KEY');

        const plans: ProviderPlan[] = [];

        if (openRouterApiKey) {
            plans.push({
                provider: 'openrouter',
                apiKey: openRouterApiKey,
                baseUrl: this.configService.get<string>('OPENROUTER_BASE_URL') || 'https://openrouter.ai/api/v1',
                model: this.configService.get<string>('OPENROUTER_CHAT_MODEL') || 'openai/gpt-3.5-turbo',
            });
        }

        if (cerebrasApiKey) {
            plans.push({
                provider: 'cerebras',
                apiKey: cerebrasApiKey,
                baseUrl: this.configService.get<string>('CEREBRAS_BASE_URL') || 'https://api.cerebras.ai/v1',
                model: this.configService.get<string>('CEREBRAS_CHAT_MODEL') || 'llama3.1-8b',
            });
        }

        if (groqApiKey) {
            plans.push({
                provider: 'groq',
                apiKey: groqApiKey,
                baseUrl: this.configService.get<string>('GROQ_BASE_URL') || 'https://api.groq.com/openai/v1',
                model: this.configService.get<string>('GROQ_CHAT_MODEL') || 'meta-llama/llama-4-scout-17b-16e-instruct',
            });
        }

        return plans;
    }

    buildPlanChain(params: ChatParams, geminiAvailable: boolean): { routingMode: AiRoutingMode; plans: ProviderPlan[] } {
        const routingMode = this.normalizeRoutingMode(params.routingMode);
        const lowCostPlans = this.getLowCostPlans();

        // Detect if user explicitly picked a non-Gemini model from the UI
        let requestedPlan: ProviderPlan | null = null;
        if (params.model) {
            if (params.model.startsWith('groq:')) {
                // Groq model — strip prefix
                const modelName = params.model.slice('groq:'.length);
                const groqConfig = lowCostPlans.find(p => p.provider === 'groq');
                if (groqConfig) {
                    requestedPlan = { ...groqConfig, model: modelName };
                }
            } else if (params.model.includes('/') || params.model.includes(':')) {
                // OpenRouter model format: "provider/model-name" or "model:variant"
                const orConfig = lowCostPlans.find(p => p.provider === 'openrouter');
                if (orConfig) {
                    requestedPlan = { ...orConfig, model: params.model };
                }
            } else if (params.model.startsWith('llama')) {
                const cerConfig = lowCostPlans.find(p => p.provider === 'cerebras');
                if (cerConfig) {
                    requestedPlan = { ...cerConfig, model: params.model };
                }
            }
        }

        // Build Gemini plans — always available as fallback unless gemini-only is off and model is locked
        const geminiPlans = geminiAvailable
            ? this.getGeminiModelList(requestedPlan ? undefined : params.model).map((model) => ({ provider: 'gemini' as const, model }))
            : [];

        // Cerebras-only plan for fallback
        const cerebrasPlans = lowCostPlans.filter(p => p.provider === 'cerebras');

        // Groq plan for fallback
        const groqPlans = lowCostPlans.filter(p => p.provider === 'groq');

        // OpenRouter default plan (only if no explicit requestedPlan overrides it)
        const openRouterDefaultPlans = requestedPlan?.provider === 'openrouter'
            ? [] // skip default OR since requestedPlan IS the OR model
            : lowCostPlans.filter(p => p.provider === 'openrouter');

        const routeDecision = this.detectPromptNeeds(params.prompt, params.context, params.schemaContext, params.mode, params.image);

        if (params.image && geminiPlans.length === 0) {
            throw new Error('Image analysis currently requires Gemini. Set GEMINI_API_KEY or remove the image attachment.');
        }

        const orderedPlans: ProviderPlan[] = [];
        const push = (plan: ProviderPlan) => {
            if (!orderedPlans.some(e => e.provider === plan.provider && e.model === plan.model)) {
                orderedPlans.push(plan);
            }
        };
        const pushAll = (plans: ProviderPlan[]) => plans.forEach(push);

        const needsSearch = /\b(latest|current|today|news|recent|now|search web|tìm trên mạng|hôm nay|mới nhất|giá|thời tiết|thị trường|tin tức)\b/i.test(params.prompt);

        if (routingMode === 'gemini-only') {
            // Gemini only — no cheap fallbacks
            pushAll(geminiPlans);
            if (orderedPlans.length === 0) pushAll(lowCostPlans);
        } else if (needsSearch) {
            // Web search needed — only Gemini supports it. Skip free providers.
            pushAll(geminiPlans);
            if (orderedPlans.length === 0) pushAll(lowCostPlans);
        } else if (requestedPlan) {
            // CRITICAL: User picked a model. Use it FIRST.
            push(requestedPlan);

            // Further fallback to Gemini if task is complex
            if (routeDecision.preferGemini || routingMode === 'best') {
                pushAll(geminiPlans);
            }

            pushAll(lowCostPlans);
            pushAll(geminiPlans);
        } else if (routingMode === 'best' || params.image || routeDecision.preferGemini) {
            // High complexity: OpenRouter & Groq first, then Gemini, Cerebras last
            pushAll(openRouterDefaultPlans);
            pushAll(groqPlans);
            pushAll(geminiPlans);
            pushAll(cerebrasPlans);
        } else {
            // Default auto / fast: OpenRouter & Groq first, then Gemini, Cerebras last
            pushAll(openRouterDefaultPlans);
            pushAll(groqPlans);
            pushAll(geminiPlans);
            pushAll(cerebrasPlans);
        }

        if (orderedPlans.length === 0) {
            throw new Error(
                'No AI provider is configured. Set GEMINI_API_KEY or configure CEREBRAS_API_KEY / OPENROUTER_API_KEY.',
            );
        }

        return { routingMode, plans: orderedPlans };
    }
}
