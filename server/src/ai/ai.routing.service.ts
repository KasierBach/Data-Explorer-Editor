import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AI_CONSTANTS } from './ai.constants';
import {
  supportsLiveWebSearch,
  supportsVision,
} from './ai.provider-capabilities';
import type {
  AiChatMode,
  AiResponseFormat,
  AiRoutingMode,
  ChatParams,
  ProviderPlan,
  RouteDecision,
} from './ai.types';

@Injectable()
export class AiRoutingService {
  constructor(private readonly configService: ConfigService) {}

  private getBeeknoeePlan(requestedModel?: string): ProviderPlan | null {
    const apiKey = this.configService.get<string>('BEEKNOEE_API_KEY');
    if (!apiKey) return null;

    const fallbackModel =
      this.configService.get<string>('BEEKNOEE_CHAT_MODEL') || 'glm-4.7-flash';
    const normalizedModel =
      requestedModel && requestedModel !== 'default'
        ? requestedModel
        : fallbackModel;

    return {
      provider: 'beeknoee',
      apiKey,
      baseUrl:
        this.configService.get<string>('BEEKNOEE_BASE_URL') ||
        'https://platform.beeknoee.com/api/v1',
      model: normalizedModel,
    };
  }

  private getTokenRouterPlan(requestedModel?: string): ProviderPlan | null {
    const apiKey = this.configService.get<string>('TOKENROUTER_API_KEY');
    if (!apiKey) return null;

    const fallbackModel =
      this.configService.get<string>('TOKENROUTER_CHAT_MODEL') || 'MiniMax-M3';
    const normalizedModel =
      requestedModel && requestedModel !== 'default'
        ? requestedModel
        : fallbackModel;

    return {
      provider: 'tokenrouter',
      apiKey,
      baseUrl:
        this.configService.get<string>('TOKENROUTER_BASE_URL') ||
        'https://api.tokenrouter.com/v1',
      model: normalizedModel,
    };
  }

  getGeminiModelList(requestedModel?: string): string[] {
    const legacyMap: Record<string, string> = {
      'gemini-3-pro': 'gemini-3-pro-preview',
      'gemini-3.1-pro': 'gemini-3.1-pro-preview',
    };

    const isGeminiModel =
      requestedModel &&
      (requestedModel.startsWith('gemini-') || legacyMap[requestedModel]);

    const actualModel = isGeminiModel
      ? legacyMap[requestedModel] || requestedModel
      : null;
    return actualModel
      ? [actualModel]
      : ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-3-flash'];
  }

  normalizeRoutingMode(routingMode?: string): AiRoutingMode {
    if (
      routingMode === 'fast' ||
      routingMode === 'best' ||
      routingMode === 'gemini-only'
    ) {
      return routingMode;
    }

    return 'auto';
  }

  private foldSignalText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D');
  }

  detectPromptNeeds(
    prompt: string,
    context?: string,
    schemaContext?: string,
    mode?: AiChatMode,
    image?: string,
  ): RouteDecision {
    const combined = `${prompt}\n${context || ''}`.toLowerCase();
    const foldedCombined = this.foldSignalText(combined).toLowerCase();
    const reasons: string[] = [];
    let complexityScore = 0;

    const currentInfoPattern =
      /\b(latest|current|today|news|recent|now|this week|this month|202[6-9]|search web|browse|up to date|weather|price|market|stock|tim tren mang|hom nay|moi nhat|tin tuc|thoi tiet|thi truong|gia)\b/i;
    const deepReasoningPattern =
      /\b(architecture|refactor|migration|optimi[sz]e|performance|debug|root cause|trade[- ]?off|step[- ]?by[- ]?step|thorough|deep dive|analyze)\b/i;
    const complexDataPattern =
      /\b(index|join|execution plan|explain|schema design|normalization|aggregation|pipeline|relationship|foreign key)\b/i;
    const structuredDbPattern =
      /\b(sql|query|select|insert|update|delete|drop|alter|create table|join|where|group by|order by|limit|optimi[sz]e|explain|schema|migration|ddl|aggregation|pipeline|foreign key|write (me )?(a )?(query|sql))\b/i;

    const needsLiveSearch =
      currentInfoPattern.test(combined) ||
      currentInfoPattern.test(foldedCombined);
    const responseFormat: AiResponseFormat =
      structuredDbPattern.test(combined) ||
      structuredDbPattern.test(foldedCombined)
        ? 'structured'
        : 'chat';

    if (image) {
      complexityScore += AI_CONSTANTS.COMPLEXITY_IMAGE_WEIGHT;
      reasons.push('image-attached');
    }

    if (needsLiveSearch) {
      complexityScore += AI_CONSTANTS.COMPLEXITY_CURRENT_INFO_WEIGHT;
      reasons.push('current-info');
    }

    if (
      deepReasoningPattern.test(combined) ||
      deepReasoningPattern.test(foldedCombined)
    ) {
      complexityScore += AI_CONSTANTS.COMPLEXITY_DEEP_REASONING_WEIGHT;
      reasons.push('deep-reasoning');
    }

    if (
      complexDataPattern.test(combined) ||
      complexDataPattern.test(foldedCombined)
    ) {
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

    if (
      (schemaContext?.length || 0) > AI_CONSTANTS.SCHEMA_CONTEXT_LENGTH_LARGE
    ) {
      complexityScore += AI_CONSTANTS.COMPLEXITY_LARGE_SCHEMA_WEIGHT;
      reasons.push('large-schema');
    }

    if (mode === 'planning') {
      complexityScore += AI_CONSTANTS.COMPLEXITY_PLANNING_MODE_WEIGHT;
      reasons.push('planning-mode');
    }

    if (responseFormat === 'structured') {
      reasons.push('structured-db-response');
    }

    return {
      preferGemini: complexityScore >= AI_CONSTANTS.COMPLEXITY_GEMINI_THRESHOLD,
      complexityScore,
      reasons,
      needsLiveSearch,
      responseFormat,
    };
  }

  getLowCostPlans(): ProviderPlan[] {
    const openRouterApiKey =
      this.configService.get<string>('OPENROUTER_API_KEY');
    const cerebrasApiKey = this.configService.get<string>('CEREBRAS_API_KEY');
    const groqApiKey = this.configService.get<string>('GROQ_API_KEY');

    const plans: ProviderPlan[] = [];

    if (openRouterApiKey) {
      plans.push({
        provider: 'openrouter',
        apiKey: openRouterApiKey,
        baseUrl:
          this.configService.get<string>('OPENROUTER_BASE_URL') ||
          'https://openrouter.ai/api/v1',
        model:
          this.configService.get<string>('OPENROUTER_CHAT_MODEL') ||
          'openai/gpt-3.5-turbo',
      });
    }

    if (cerebrasApiKey) {
      plans.push({
        provider: 'cerebras',
        apiKey: cerebrasApiKey,
        baseUrl:
          this.configService.get<string>('CEREBRAS_BASE_URL') ||
          'https://api.cerebras.ai/v1',
        model:
          this.configService.get<string>('CEREBRAS_CHAT_MODEL') ||
          'gpt-oss-120b',
      });
    }

    if (groqApiKey) {
      plans.push({
        provider: 'groq',
        apiKey: groqApiKey,
        baseUrl:
          this.configService.get<string>('GROQ_BASE_URL') ||
          'https://api.groq.com/openai/v1',
        model:
          this.configService.get<string>('GROQ_CHAT_MODEL') ||
          'meta-llama/llama-4-scout-17b-16e-instruct',
      });
    }

    return plans;
  }

  buildPlanChain(
    params: ChatParams,
    geminiAvailable: boolean,
  ): {
    routingMode: AiRoutingMode;
    plans: ProviderPlan[];
    routeDecision: RouteDecision;
  } {
    const routingMode = this.normalizeRoutingMode(params.routingMode);
    const lowCostPlans = this.getLowCostPlans();

    let requestedPlan: ProviderPlan | null = null;
    if (params.providerOverride?.type === 'openai-compatible') {
      requestedPlan = {
        provider: 'custom',
        model: params.providerOverride.model,
        apiKey: params.providerOverride.apiKey || 'no-key',
        baseUrl: params.providerOverride.baseUrl,
        displayName: params.providerOverride.name,
      };
    } else if (params.model) {
      if (params.model.startsWith('beeknoee:')) {
        const modelName = params.model.slice('beeknoee:'.length);
        const beeknoeePlan = this.getBeeknoeePlan(modelName);
        if (!beeknoeePlan) {
          throw new Error(
            'Beeknoee provider is not configured. Set BEEKNOEE_API_KEY to use Beeknoee models.',
          );
        }
        requestedPlan = beeknoeePlan;
      } else if (params.model.startsWith('tokenrouter:')) {
        const modelName = params.model.slice('tokenrouter:'.length);
        const tokenRouterPlan = this.getTokenRouterPlan(modelName);
        if (!tokenRouterPlan) {
          throw new Error(
            'TokenRouter provider is not configured. Set TOKENROUTER_API_KEY to use TokenRouter models.',
          );
        }
        requestedPlan = tokenRouterPlan;
      } else if (params.model.startsWith('groq:')) {
        const modelName = params.model.slice('groq:'.length);
        const groqConfig = lowCostPlans.find((p) => p.provider === 'groq');
        if (groqConfig) {
          requestedPlan = { ...groqConfig, model: modelName };
        }
      } else if (params.model.startsWith('gemini-')) {
        requestedPlan = { provider: 'gemini', model: params.model };
      } else if (params.model.includes('/') || params.model.includes(':')) {
        const orConfig = lowCostPlans.find((p) => p.provider === 'openrouter');
        if (orConfig) {
          requestedPlan = { ...orConfig, model: params.model };
        }
      } else if (params.model.startsWith('llama')) {
        const cerConfig = lowCostPlans.find((p) => p.provider === 'cerebras');
        if (cerConfig) {
          requestedPlan = { ...cerConfig, model: params.model };
        }
      }
    }

    const geminiPlans = geminiAvailable
      ? (requestedPlan?.provider === 'gemini'
          ? [requestedPlan.model, ...this.getGeminiModelList()]
          : this.getGeminiModelList(requestedPlan ? undefined : params.model)
        ).map((model) => ({ provider: 'gemini' as const, model }))
      : [];

    const cerebrasPlans = lowCostPlans.filter((p) => p.provider === 'cerebras');
    const groqPlans = lowCostPlans.filter((p) => p.provider === 'groq');
    const openRouterDefaultPlans =
      requestedPlan?.provider === 'openrouter'
        ? []
        : lowCostPlans.filter((p) => p.provider === 'openrouter');

    const routeDecision = this.detectPromptNeeds(
      params.prompt,
      params.context,
      params.schemaContext,
      params.mode,
      params.image,
    );

    const orderedPlans: ProviderPlan[] = [];
    const push = (plan: ProviderPlan) => {
      if (
        !orderedPlans.some(
          (existing) =>
            existing.provider === plan.provider &&
            existing.model === plan.model,
        )
      ) {
        orderedPlans.push(plan);
      }
    };
    const pushAll = (plans: ProviderPlan[]) => plans.forEach(push);

    if (routingMode === 'gemini-only') {
      pushAll(geminiPlans);
      if (orderedPlans.length === 0) pushAll(lowCostPlans);
    } else if (routeDecision.needsLiveSearch) {
      pushAll(geminiPlans);
      if (orderedPlans.length === 0) pushAll(lowCostPlans);
    } else if (requestedPlan) {
      push(requestedPlan);

      if (routeDecision.preferGemini || routingMode === 'best') {
        pushAll(geminiPlans);
      }

      pushAll(lowCostPlans);
      pushAll(geminiPlans);
    } else if (
      routingMode === 'best' ||
      params.image ||
      routeDecision.preferGemini
    ) {
      pushAll(openRouterDefaultPlans);
      pushAll(groqPlans);
      pushAll(geminiPlans);
      pushAll(cerebrasPlans);
    } else {
      pushAll(openRouterDefaultPlans);
      pushAll(groqPlans);
      pushAll(geminiPlans);
      pushAll(cerebrasPlans);
    }

    const capabilityFilteredPlans = orderedPlans.filter((plan) => {
      if (params.image && !supportsVision(plan)) {
        return false;
      }

      if (routeDecision.needsLiveSearch && !supportsLiveWebSearch(plan)) {
        return false;
      }

      return true;
    });

    if (params.image && capabilityFilteredPlans.length === 0) {
      throw new Error(
        'Image analysis requires a configured vision-capable lane. Use Gemini or choose a vision-capable OpenRouter model.',
      );
    }

    if (routeDecision.needsLiveSearch && capabilityFilteredPlans.length === 0) {
      throw new Error(
        'Live search requires a configured search-capable lane. Use Gemini or configure an OpenRouter lane for web-backed requests.',
      );
    }

    if (capabilityFilteredPlans.length === 0) {
      throw new Error(
        'No AI provider is configured. Set GEMINI_API_KEY or configure CEREBRAS_API_KEY / OPENROUTER_API_KEY.',
      );
    }

    return { routingMode, plans: capabilityFilteredPlans, routeDecision };
  }
}

