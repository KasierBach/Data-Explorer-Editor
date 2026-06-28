import { Test, TestingModule } from '@nestjs/testing';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiConnectionService } from './ai.connection-service';

describe('AiController', () => {
  let controller: AiController;
  const originalFetch = global.fetch;

  const aiServiceMock = {
    chat: jest.fn(),
    chatStream: jest.fn(),
    gatherSchemaContext: jest.fn(),
    autocomplete: jest.fn(),
    generateSql: jest.fn(),
  };

  const connectionServiceMock = {
    getConnectionContext: jest.fn(),
    getConnectionContextForStream: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiController],
      providers: [
        { provide: AiService, useValue: aiServiceMock },
        {
          provide: AiConnectionService,
          useValue: connectionServiceMock,
        },
      ],
    }).compile();

    controller = module.get<AiController>(AiController);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('passes history into chatStream for streaming requests', async () => {
    const history = [{ role: 'user', content: 'Show tables' }];
    const streamEvent = {
      type: 'done',
      data: { message: 'SELECT * FROM users;' },
    };

    connectionServiceMock.getConnectionContextForStream.mockResolvedValue({
      connection: { type: 'postgresql' },
      schemaContext: 'schema context',
    });

    aiServiceMock.chatStream.mockReturnValue(
      (async function* () {
        yield streamEvent;
      })(),
    );

    const res = {
      setHeader: jest.fn(),
      flushHeaders: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
    };

    await controller.generateSqlStream(
      {
        connectionId: 'conn-1',
        database: 'app',
        prompt: 'show me a table',
        history,
      } as any,
      res as any,
      { user: { id: 'user-1' } } as any,
    );

    expect(aiServiceMock.chatStream).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'show me a table',
        schemaContext: 'schema context',
        databaseType: 'postgresql',
        history,
      }),
    );
    expect(res.write).toHaveBeenCalledWith(
      `data: ${JSON.stringify(streamEvent)}\n\n`,
    );
    expect(res.write).toHaveBeenCalledWith('data: [DONE]\n\n');
    expect(res.end).toHaveBeenCalled();
  });

  it('passes model and routing options into nlpToSql requests', async () => {
    connectionServiceMock.getConnectionContext.mockResolvedValue({
      connection: { type: 'mongodb' },
      schemaContext: 'schema context',
    });
    aiServiceMock.generateSql.mockResolvedValue({
      sql: '{"action":"find","collection":"orders","filter":{}}',
      explanation: 'Reads orders.',
    });

    await controller.nlpToSql(
      {
        connectionId: 'conn-1',
        database: 'app',
        prompt: 'For collection "orders": show all orders',
        model: 'gemini:gemini-2.5-flash',
        mode: 'fast',
        routingMode: 'auto',
      } as any,
      { user: { id: 'user-1' } } as any,
    );

    expect(aiServiceMock.generateSql).toHaveBeenCalledWith({
      query: 'For collection "orders": show all orders',
      databaseType: 'mongodb',
      schemaContext: 'schema context',
      model: 'gemini:gemini-2.5-flash',
      mode: 'fast',
      routingMode: 'auto',
    });
  });

  it('lists provider models from an openai-compatible endpoint', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        data: [{ id: 'z-model' }, { id: 'a-model' }, { id: 'a-model' }],
      }),
    }) as any;

    await expect(
      controller.listProviderModels({
        baseUrl: 'https://provider.example.com/v1',
        apiKey: 'sk-test',
      }),
    ).resolves.toEqual({
      models: ['a-model', 'z-model'],
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://provider.example.com/v1/models',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer sk-test',
        }),
      }),
    );
  });

  it('passes autocomplete model overrides through to the ai service', async () => {
    connectionServiceMock.getConnectionContext.mockResolvedValue({
      connection: { type: 'postgresql' },
      schemaContext: 'schema context',
    });
    aiServiceMock.autocomplete.mockResolvedValue('FROM users');

    await controller.autocomplete(
      {
        connectionId: 'conn-1',
        beforeCursor: 'SELECT * ',
        model: 'anthropic/claude-sonnet-4.5',
        providerOverride: {
          type: 'openai-compatible',
          name: 'gido',
          baseUrl: 'https://provider.example.com/v1',
          apiKey: 'sk-test',
          model: 'anthropic/claude-sonnet-4.5',
        },
      } as any,
      { user: { id: 'user-1' } } as any,
    );

    expect(aiServiceMock.autocomplete).toHaveBeenCalledWith(
      expect.objectContaining({
        beforeCursor: 'SELECT * ',
        model: 'anthropic/claude-sonnet-4.5',
        providerOverride: expect.objectContaining({
          name: 'gido',
          model: 'anthropic/claude-sonnet-4.5',
        }),
      }),
    );
  });
});
