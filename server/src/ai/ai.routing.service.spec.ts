import { ConfigService } from '@nestjs/config';
import { AiRoutingService } from './ai.routing.service';

function createConfig(
  overrides: Record<string, string | undefined> = {},
): ConfigService {
  const defaults: Record<string, string | undefined> = {
    BEEKNOEE_API_KEY: 'sk-bee-test',
    BEEKNOEE_BASE_URL: 'https://platform.beeknoee.com/api/v1',
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
  });
});
