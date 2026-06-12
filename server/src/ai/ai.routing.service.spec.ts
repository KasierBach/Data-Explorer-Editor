import { ConfigService } from '@nestjs/config';
import { AiRoutingService } from './ai.routing.service';

function createConfig(
  overrides: Record<string, string | undefined> = {},
): ConfigService {
  const defaults: Record<string, string | undefined> = {
    BEEKNOEE_API_KEY: 'sk-bee-test',
    BEEKNOEE_BASE_URL: 'https://platform.beeknoee.com/api/v1',
    TOKENROUTER_API_KEY: 'sk-tr-test',
    TOKENROUTER_BASE_URL: 'https://api.tokenrouter.com/v1',
    TOKENROUTER_CHAT_MODEL: 'MiniMax-M3',
    OPENROUTER_API_KEY: 'sk-or-test',
    OPENROUTER_BASE_URL: 'https://openrouter.ai/api/v1',
    OPENROUTER_CHAT_MODEL: 'openai/gpt-3.5-turbo',
    GROQ_API_KEY: 'gsk-test',
    GROQ_BASE_URL: 'https://api.groq.com/openai/v1',
    GROQ_CHAT_MODEL: 'meta-llama/llama-4-scout-17b-16e-instruct',
    CEREBRAS_API_KEY: 'csk-test',
    CEREBRAS_BASE_URL: 'https://api.cerebras.ai/v1',
    CEREBRAS_CHAT_MODEL: 'gpt-oss-120b',
  };

  return {
    get: jest.fn((key: string) => ({ ...defaults, ...overrides })[key]),
  } as unknown as ConfigService;
}

describe('AiRoutingService', () => {
  it('routes an explicitly selected beeknoee model to the Beeknoee provider plan first', () => {
    const service = new AiRoutingService(createConfig());

    const result = service.buildPlanChain(
      {
        prompt: 'Explain this query',
        model: 'beeknoee:glm-4.7-flash',
        routingMode: 'auto',
      },
      true,
    );

    expect(result.plans[0]).toMatchObject({
      provider: 'beeknoee',
      apiKey: 'sk-bee-test',
      baseUrl: 'https://platform.beeknoee.com/api/v1',
      model: 'glm-4.7-flash',
    });
    expect(result.routeDecision.responseFormat).toBe('structured');
  });

  it('does not add Beeknoee to the default auto provider chain', () => {
    const service = new AiRoutingService(createConfig());

    const result = service.buildPlanChain(
      {
        prompt: 'List slow queries in this schema',
        routingMode: 'auto',
      },
      true,
    );

    expect(result.plans.some((plan) => plan.provider === 'beeknoee')).toBe(
      false,
    );
    expect(result.routeDecision.responseFormat).toBe('structured');
  });

  it('routes an explicitly selected TokenRouter model to the TokenRouter provider plan first', () => {
    const service = new AiRoutingService(createConfig());

    const result = service.buildPlanChain(
      {
        prompt: 'Explain this query',
        model: 'tokenrouter:MiniMax-M3',
        routingMode: 'auto',
      },
      true,
    );

    expect(result.plans[0]).toMatchObject({
      provider: 'tokenrouter',
      apiKey: 'sk-tr-test',
      baseUrl: 'https://api.tokenrouter.com/v1',
      model: 'MiniMax-M3',
    });
    expect(result.routeDecision.responseFormat).toBe('structured');
  });

  it('does not add TokenRouter to the default auto provider chain', () => {
    const service = new AiRoutingService(createConfig());

    const result = service.buildPlanChain(
      {
        prompt: 'List slow queries in this schema',
        routingMode: 'auto',
      },
      true,
    );

    expect(result.plans.some((plan) => plan.provider === 'tokenrouter')).toBe(
      false,
    );
    expect(result.routeDecision.responseFormat).toBe('structured');
  });

  it('puts an explicitly selected Gemini model first in the provider chain', () => {
    const service = new AiRoutingService(createConfig());

    const result = service.buildPlanChain(
      {
        prompt: 'Explain this query',
        model: 'gemini-2.5-flash',
        routingMode: 'auto',
      },
      true,
    );

    expect(result.plans[0]).toMatchObject({
      provider: 'gemini',
      model: 'gemini-2.5-flash',
    });
  });

  it('routes image prompts through vision-capable lanes only when the default low-cost models are text-only', () => {
    const service = new AiRoutingService(createConfig());

    const result = service.buildPlanChain(
      {
        prompt: 'Describe the screenshot and explain the issue',
        image: 'data:image/png;base64,abc',
        routingMode: 'auto',
      },
      true,
    );

    expect(result.plans.length).toBeGreaterThan(0);
    expect(result.plans.every((plan) => plan.provider === 'gemini')).toBe(true);
  });

  it('keeps an explicitly selected vision-capable OpenRouter model first for image prompts', () => {
    const service = new AiRoutingService(createConfig());

    const result = service.buildPlanChain(
      {
        prompt: 'Describe this ERD screenshot',
        image: 'data:image/png;base64,abc',
        model: 'openai/gpt-4o-mini',
        routingMode: 'auto',
      },
      true,
    );

    expect(result.plans[0]).toMatchObject({
      provider: 'openrouter',
      model: 'openai/gpt-4o-mini',
    });
    expect(result.plans.some((plan) => plan.provider === 'gemini')).toBe(true);
  });

  it('keeps an explicitly selected TokenRouter model first for image prompts when that model is vision-capable', () => {
    const service = new AiRoutingService(createConfig());

    const result = service.buildPlanChain(
      {
        prompt: 'Describe this screenshot',
        image: 'data:image/png;base64,abc',
        model: 'tokenrouter:MiniMax-M3',
        routingMode: 'auto',
      },
      true,
    );

    expect(result.plans[0]).toMatchObject({
      provider: 'tokenrouter',
      model: 'MiniMax-M3',
    });
    expect(result.plans.some((plan) => plan.provider === 'gemini')).toBe(true);
  });

  it('flags live-search prompts and keeps them in chat mode by default', () => {
    const service = new AiRoutingService(createConfig());

    const result = service.detectPromptNeeds(
      'What is the latest PostgreSQL news today?',
    );

    expect(result.needsLiveSearch).toBe(true);
    expect(result.responseFormat).toBe('chat');
    expect(result.reasons).toContain('current-info');
  });

  it('flags accented Vietnamese current-events prompts for live search', () => {
    const service = new AiRoutingService(createConfig());

    const result = service.detectPromptNeeds(
      'Tin tức mới nhất hôm nay là gì?',
      'Cho mình cập nhật thị trường và giá vàng',
    );

    expect(result.needsLiveSearch).toBe(true);
    expect(result.responseFormat).toBe('chat');
    expect(result.reasons).toContain('current-info');
  });

  it('marks SQL authoring prompts as structured responses', () => {
    const service = new AiRoutingService(createConfig());

    const result = service.detectPromptNeeds(
      'Write me a SQL query to list slow orders by customer',
      'Need exact columns',
    );

    expect(result.responseFormat).toBe('structured');
    expect(result.reasons).toContain('structured-db-response');
  });
});
