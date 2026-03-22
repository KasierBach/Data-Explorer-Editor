import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AiService } from './ai.service';

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
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('fake-api-key'),
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

  describe('parseAiResponse', () => {
    it('should correctly parse valid JSON response', () => {
      const response = '{"message": "Ready", "sql": "SELECT 1"}';
      const result = (service as any).parseAiResponse(response);
      expect(result).toEqual({
        message: 'Ready',
        sql: 'SELECT 1',
        explanation: undefined
      });
    });

    it('should handle non-JSON response gracefully', () => {
      const response = 'Plain text response';
      const result = (service as any).parseAiResponse(response);
      expect(result).toEqual({
        message: 'Plain text response'
      });
    });

    it('should extract JSON from markdown or extra text', () => {
      const response = 'Sure, here is your data: {"message": "Extracted", "sql": "SELECT 2"} and some suffix.';
      const result = (service as any).parseAiResponse(response);
      expect(result).toEqual({
        message: 'Extracted',
        sql: 'SELECT 2',
        explanation: undefined
      });
    });
  });

  describe('chat', () => {
    it('should return parsed AI content', async () => {
      const result = await service.chat({ prompt: 'Test prompt' });
      expect(result).toHaveProperty('message', 'Hello from AI');
      expect(result).toHaveProperty('sql', 'SELECT * FROM users');
    });
  });
});
