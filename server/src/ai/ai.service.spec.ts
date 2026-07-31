import { AiAutocompleteService } from './ai.autocomplete-service';
import { AiChatCompletionService } from './ai.chat-completion.service';
import { AiSchemaService } from './ai.schema-service';
import { AiService } from './ai.service';

describe('AiService MongoDB command normalization', () => {
  const chat = jest.fn();
  const service = new AiService(
    { chat } as unknown as AiChatCompletionService,
    {} as AiSchemaService,
    {} as AiAutocompleteService,
  );

  beforeEach(() => {
    chat.mockReset();
    chat.mockResolvedValue({
      sql: '{"action":"find","filter":{}}',
      message: 'Ready',
      provider: 'groq',
      model: 'openai/gpt-oss-120b',
      routingMode: 'auto',
    });
  });

  it('uses a quoted collection name from the user request', async () => {
    const result = await service.generateSql({
      query: 'For collection "orders": show all orders',
      databaseType: 'mongodb',
    });

    expect(JSON.parse(result.sql)).toEqual(
      expect.objectContaining({
        action: 'find',
        collection: 'orders',
        filter: {},
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        provider: 'groq',
        model: 'openai/gpt-oss-120b',
        routingMode: 'auto',
      }),
    );
  });

  it('does not accept a quoted collection name across line boundaries', async () => {
    const result = await service.generateSql({
      query: 'For collection "orders\nadmin": show all orders',
      databaseType: 'mongodb',
    });

    expect(JSON.parse(result.sql)).toEqual(
      expect.objectContaining({ collection: 'yourCollection' }),
    );
  });
});
