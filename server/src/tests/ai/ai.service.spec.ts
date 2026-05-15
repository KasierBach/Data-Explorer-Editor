import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from '../../ai/ai.service';
import { AiChatCompletionService } from '../../ai/ai.chat-completion.service';
import { AiSchemaService } from '../../ai/ai.schema-service';
import { AiAutocompleteService } from '../../ai/ai.autocomplete-service';

describe('AiService', () => {
  let service: AiService;
  const chatService = {
    chat: jest.fn(),
    chatStream: jest.fn(),
  };
  const schemaService = {
    gatherSchemaContext: jest.fn(),
    clearCache: jest.fn(),
    buildSchemaContext: jest.fn(),
    suggestTablesBySemantic: jest.fn(),
  };
  const autocompleteService = {
    autocomplete: jest.fn(),
    generateSql: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: AiChatCompletionService, useValue: chatService },
        { provide: AiSchemaService, useValue: schemaService },
        { provide: AiAutocompleteService, useValue: autocompleteService },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('chat', () => {
    it('should return parsed AI content', async () => {
      chatService.chat.mockResolvedValue({
        message: 'Hello from AI',
        sql: 'SELECT * FROM users',
        provider: 'gemini',
        routingMode: 'auto',
      });

      const result = await service.chat({ prompt: 'Test prompt' });
      expect(result).toHaveProperty('message', 'Hello from AI');
      expect(result).toHaveProperty('sql', 'SELECT * FROM users');
      expect(result).toHaveProperty('provider', 'gemini');
      expect(result).toHaveProperty('routingMode', 'auto');
      expect(chatService.chat).toHaveBeenCalledWith({ prompt: 'Test prompt' });
    });
  });
});
