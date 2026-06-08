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

  describe('generateSql', () => {
    it('routes SQL generation through the shared chat pipeline', async () => {
      chatService.chat.mockResolvedValue({
        message: 'Generated SQL ready.',
        sql: 'SELECT * FROM users LIMIT 10',
        explanation: 'Reads the latest users.',
        provider: 'openrouter',
        model: 'openai/gpt-4o-mini',
        routingMode: 'auto',
      });

      const result = await service.generateSql({
        query: 'Show the latest users',
        databaseType: 'postgres',
        schemaContext: 'TABLE users(id uuid)',
        model: 'openrouter:openai/gpt-4o-mini',
        routingMode: 'auto',
      });

      expect(chatService.chat).toHaveBeenCalledWith(
        expect.objectContaining({
          databaseType: 'postgres',
          schemaContext: 'TABLE users(id uuid)',
          mode: 'fast',
          routingMode: 'auto',
        }),
      );
      expect(
        (chatService.chat.mock.calls[0]?.[0]?.prompt as string) || '',
      ).toContain('Generate an executable SQL query');
      expect(result).toEqual({
        sql: 'SELECT * FROM users LIMIT 10',
        explanation: 'Reads the latest users.',
      });
    });

    it('normalizes MongoDB payloads from the shared chat pipeline into executable JSON', async () => {
      chatService.chat.mockResolvedValue({
        message: 'Generated Mongo payload ready.',
        sql: '[{ "$match": { "status": "active" } }]',
        explanation: 'Filters active orders.',
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        routingMode: 'auto',
      });

      const result = await service.generateSql({
        query: 'For collection "orders": show active orders',
        databaseType: 'mongodb',
      });

      expect(JSON.parse(result.sql)).toEqual({
        action: 'aggregate',
        collection: 'orders',
        pipeline: [{ $match: { status: 'active' } }],
      });
      expect(result.explanation).toBe('Filters active orders.');
    });
  });
});
