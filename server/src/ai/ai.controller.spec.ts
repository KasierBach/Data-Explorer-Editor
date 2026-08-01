import { Test, TestingModule } from '@nestjs/testing';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiConnectionService } from './ai.connection-service';
import { validateExternalUrl } from '../common/utils/ssrf-validator.util';
import { AuditAction, AuditService } from '../audit/audit.service';
import { ConfigService } from '@nestjs/config';
import { AiProviderConnectionService } from './ai-provider-connection.service';

jest.mock('../common/utils/ssrf-validator.util', () => ({
  validateExternalUrl: jest.fn(),
}));

const validateExternalUrlMock = validateExternalUrl as jest.MockedFunction<
  typeof validateExternalUrl
>;

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

  const auditServiceMock = {
    log: jest.fn(),
  };

  const providerConnectionsMock = {
    resolveOverride: jest.fn((_userId: string, providerOverride: unknown) =>
      Promise.resolve(providerOverride),
    ),
  };

  const configuredProviders: Record<string, string | undefined> = {
    GEMINI_API_KEY: 'gemini-key',
    OPENROUTER_API_KEY: 'openrouter-key',
    GROQ_API_KEY: undefined,
    CEREBRAS_API_KEY: 'cerebras-key',
    BEEKNOEE_API_KEY: 'beeknoee-key',
  };
  const configServiceMock = {
    get: jest.fn((key: string) => configuredProviders[key]),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    validateExternalUrlMock.mockResolvedValue(true);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiController],
      providers: [
        { provide: AiService, useValue: aiServiceMock },
        {
          provide: AiConnectionService,
          useValue: connectionServiceMock,
        },
        { provide: AuditService, useValue: auditServiceMock },
        { provide: ConfigService, useValue: configServiceMock },
        {
          provide: AiProviderConnectionService,
          useValue: providerConnectionsMock,
        },
      ],
    }).compile();

    controller = module.get<AiController>(AiController);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('reports provider configuration without exposing API keys', () => {
    const result = controller.getProviderStatus();

    expect(result).toEqual({
      providers: {
        gemini: true,
        openrouter: true,
        groq: false,
        cerebras: true,
        beeknoee: true,
      },
    });
    expect(JSON.stringify(result)).not.toContain('-key');
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

    const gatherSchema =
      connectionServiceMock.getConnectionContextForStream.mock.calls[0][3];
    await gatherSchema({}, {}, 'app', 'conn-1');
    expect(aiServiceMock.gatherSchemaContext).toHaveBeenCalledWith(
      {},
      {},
      'app',
      'conn-1',
      'show me a table',
    );
  });

  it('passes model and routing options into nlpToSql requests', async () => {
    connectionServiceMock.getConnectionContext.mockResolvedValue({
      connection: { type: 'mongodb' },
      schemaContext: 'schema context',
    });
    aiServiceMock.generateSql.mockResolvedValue({
      sql: '{"action":"find","collection":"orders","filter":{}}',
      explanation: 'Reads orders.',
      provider: 'groq',
      model: 'openai/gpt-oss-120b',
      routingMode: 'auto',
    });

    const result = await controller.nlpToSql(
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
    expect(result).toEqual(
      expect.objectContaining({
        sql: '{"action":"find","collection":"orders","filter":{}}',
        generationId: expect.any(String),
      }),
    );
    expect(auditServiceMock.log).toHaveBeenCalledWith({
      action: AuditAction.AI_SQL_GENERATED,
      userId: 'user-1',
      details: expect.objectContaining({
        generationId: result.generationId,
        databaseType: 'mongodb',
        requestedModel: 'gemini:gemini-2.5-flash',
        provider: 'groq',
        model: 'openai/gpt-oss-120b',
        routingMode: 'auto',
        latencyMs: expect.any(Number),
      }),
    });
  });

  it('records SQL feedback without storing prompt or generated SQL', async () => {
    await expect(
      controller.recordSqlFeedback(
        {
          generationId: '2c1cc849-e91f-4d54-9a40-9ac7c3f5d37f',
          rating: 'down',
        },
        { user: { id: 'user-1' } } as any,
      ),
    ).resolves.toEqual({ success: true });

    expect(auditServiceMock.log).toHaveBeenCalledWith({
      action: AuditAction.AI_SQL_FEEDBACK,
      userId: 'user-1',
      details: {
        generationId: '2c1cc849-e91f-4d54-9a40-9ac7c3f5d37f',
        rating: 'down',
      },
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
        baseUrl: 'https://provider.example.com/v1///',
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

  it('blocks unsafe provider model URLs before sending credentials', async () => {
    global.fetch = jest.fn() as any;
    validateExternalUrlMock.mockResolvedValueOnce(false);

    await expect(
      controller.listProviderModels({
        baseUrl: 'http://127.0.0.1:3000/v1',
        apiKey: 'sk-sensitive',
      }),
    ).rejects.toThrow('Unsafe provider URL');

    expect(global.fetch).not.toHaveBeenCalled();
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
