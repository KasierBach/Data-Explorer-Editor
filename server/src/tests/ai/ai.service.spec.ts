import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AiService } from '../../ai/ai.service';
import { AiPromptBuilderService } from '../../ai/ai.prompt-builder.service';
import { AiRoutingService } from '../../ai/ai.routing.service';
import { AiSchemaContextService } from '../../ai/ai.schema-context.service';
import { AiProviderRunnerService } from '../../ai/ai.provider-runner.service';

// Mock GoogleGenerativeAI
jest.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
      getGenerativeModel: jest.fn().mockReturnValue({
        generateContent: jest.fn().mockResolvedValue({
          response: {
            text: () => JSON.stringify({
              message: 'Hello from AI',
              sql: 'SELECT * FROM users',
              explanation: 'This query selects all users'
            }),
          },
        }),
      }),
    })),
  };
});

describe('AiService', () => {
  let service: AiService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        AiPromptBuilderService,
        AiRoutingService,
        AiSchemaContextService,
        AiProviderRunnerService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key === 'GEMINI_API_KEY') return 'fake-api-key';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('chat', () => {
    it('should return parsed AI content', async () => {
      const result = await service.chat({ prompt: 'Test prompt' });
      expect(result).toHaveProperty('message', 'Hello from AI');
      expect(result).toHaveProperty('sql', 'SELECT * FROM users');
      expect(result).toHaveProperty('provider', 'gemini');
      expect(result).toHaveProperty('routingMode', 'auto');
    });
  });
});
