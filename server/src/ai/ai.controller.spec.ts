import { Test, TestingModule } from '@nestjs/testing';
import { AiController, AiTestController } from './ai.controller';
import { EventEmitter } from 'events';
import { AI_CONSTANTS } from './ai.constants';
import { AiRequestStoppedError } from './ai-request-lifecycle';
import { AiService } from './ai.service';
import { AiConnectionService } from './ai.connection-service';
import { validateExternalUrl } from '../common/utils/ssrf-validator.util';
import { AuditAction, AuditService } from '../audit/audit.service';
import { ConfigService } from '@nestjs/config';
import { AiProviderConnectionService } from './ai-provider-connection.service';
import { AiAccountPolicyService } from './ai-account-policy.service';
import {
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  AiExecutionLedgerService,
  type AiExecutionContext,
} from './ai-execution-ledger.service';

function fakeLedger() {
  const summary = {
    generationId: 'owned-generation',
    outcome: 'succeeded' as const,
    provider: null,
    model: null,
    attemptCount: 0,
    measuredAttemptCount: 0,
    usageCoverage: 'unavailable' as const,
    usage: null,
    costCoverage: 'unavailable' as const,
  };
  const context = {
    generationId: summary.generationId,
    deadlineAt: Date.now() + AI_CONSTANTS.DEFAULT_PROVIDER_TIMEOUT_MS,
    beforeAttempt: jest.fn(),
    complete: jest.fn().mockResolvedValue(summary),
    fail: jest.fn().mockImplementation(async (outcome = 'failed') => ({
      ...summary,
      outcome,
    })),
    release: jest.fn().mockResolvedValue(undefined),
  };
  const ledger = {
    begin: jest.fn().mockImplementation(async (_actor, _task, metadata) => {
      context.deadlineAt = metadata.deadlineAt;
      return context;
    }),
    feedback: jest
      .fn()
      .mockImplementation(async (_actor, generationId, rating) => ({
        generationId,
        rating,
      })),
  };
  return { ledger, context, summary };
}

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

  const assertEnabled = jest.fn().mockResolvedValue(undefined);
  const assertConnectionEnabled = jest.fn().mockResolvedValue(undefined);
  const beforeProviderRequest = jest.fn(
    (actor, connection, database) => () =>
      assertConnectionEnabled(actor, connection, database),
  );
  const beforeProviderAttempt = jest.fn(() =>
    jest.fn().mockResolvedValue(undefined),
  );
  const accountPolicy = {
    assertEnabled,
    assertConnectionEnabled,
    beforeProviderRequest,
    beforeProviderAttempt,
  };
  const { ledger, context: executionContext, summary } = fakeLedger();

  const providerConnectionsMock = {
    listModels: jest.fn().mockResolvedValue([]),
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
    ledger.begin
      .mockReset()
      .mockImplementation(async (_actor, _task, metadata) => {
        executionContext.deadlineAt = metadata.deadlineAt;
        return executionContext;
      });
    ledger.feedback
      .mockReset()
      .mockImplementation(async (_actor, generationId, rating) => ({
        generationId,
        rating,
      }));
    executionContext.complete.mockReset().mockResolvedValue(summary);
    executionContext.fail
      .mockReset()
      .mockImplementation(async (outcome = 'failed') => ({
        ...summary,
        outcome,
      }));
    executionContext.release.mockReset().mockResolvedValue(undefined);
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
        { provide: AiAccountPolicyService, useValue: accountPolicy },
        { provide: AiExecutionLedgerService, useValue: ledger },
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

  it.each(['generateSql', 'nlpToSql', 'autocomplete'] as const)(
    'rejects disabled accounts before schema lookup for %s',
    async (method) => {
      const denied = new ForbiddenException({
        reason: 'AI_DISABLED',
        message: 'AI is disabled',
      });
      assertEnabled.mockRejectedValueOnce(denied);
      await expect(
        controller[method](
          {
            connectionId: 'conn-1',
            prompt: 'Show tables',
            beforeCursor: 'SEL',
          },
          { user: { id: 'user-1' } } as Parameters<
            AiController['generateSql']
          >[1],
        ),
      ).rejects.toBe(denied);
      expect(connectionServiceMock.getConnectionContext).not.toHaveBeenCalled();
      expect(aiServiceMock.chat).not.toHaveBeenCalled();
      expect(aiServiceMock.generateSql).not.toHaveBeenCalled();
      expect(aiServiceMock.autocomplete).not.toHaveBeenCalled();
    },
  );

  it('rejects disabled streams before writing headers or starting a provider', async () => {
    const denied = new ForbiddenException({
      reason: 'AI_DISABLED',
      message: 'AI is disabled',
    });
    assertEnabled.mockRejectedValueOnce(denied);
    const res = {
      setHeader: jest.fn(),
      flushHeaders: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
    };
    await expect(
      controller.generateSqlStream(
        { connectionId: 'conn-1', prompt: 'Show tables' },
        res as unknown as Parameters<AiController['generateSqlStream']>[1],
        { user: { id: 'user-1' } } as Parameters<
          AiController['generateSqlStream']
        >[2],
      ),
    ).rejects.toBe(denied);
    expect(res.setHeader).not.toHaveBeenCalled();
    expect(
      connectionServiceMock.getConnectionContextForStream,
    ).not.toHaveBeenCalled();
    expect(aiServiceMock.chatStream).not.toHaveBeenCalled();
  });

  it('does not start model discovery for a disabled account', async () => {
    const denied = new ForbiddenException({
      reason: 'AI_DISABLED',
      message: 'AI is disabled',
    });
    assertEnabled.mockRejectedValueOnce(denied);
    global.fetch = jest.fn();
    await expect(
      controller.listProviderModels(
        { baseUrl: 'https://provider.example.com' },
        { user: { id: 'user-1' } } as Parameters<
          AiController['listProviderModels']
        >[1],
      ),
    ).rejects.toBe(denied);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(validateExternalUrlMock).not.toHaveBeenCalled();
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

  it('rejects a denied connection before sending SSE headers or calling an AI provider', async () => {
    const error = new Error('fixture denied');
    connectionServiceMock.getConnectionContextForStream.mockRejectedValueOnce(
      error,
    );
    const res =
      jest.createMockFromModule<typeof import('express')>('express').response;
    await expect(
      controller.generateSqlStream(
        { connectionId: 'conn-1', prompt: 'show tables' },
        res,
        { user: { id: 'user-1' } } as Parameters<
          AiController['generateSqlStream']
        >[2],
      ),
    ).rejects.toBe(error);
    expect(res.flushHeaders).not.toHaveBeenCalled();
    expect(res.write).not.toHaveBeenCalled();
    expect(aiServiceMock.chatStream).not.toHaveBeenCalled();
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
      `data: ${JSON.stringify({ ...streamEvent, data: { ...streamEvent.data, generationId: summary.generationId, usageCoverage: 'unavailable', attemptCount: 0, measuredAttemptCount: 0, costCoverage: 'unavailable', usage: null, observedUsage: null } })}\n\n`,
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
      expect.objectContaining({
        signal: expect.any(AbortSignal),
        deadlineAt: expect.any(Number),
        beforeProviderRequest: expect.any(Function),
      }),
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

    expect(aiServiceMock.generateSql).toHaveBeenCalledWith(
      expect.objectContaining({
        beforeProviderRequest: expect.any(Function),
        query: 'For collection "orders": show all orders',
        databaseType: 'mongodb',
        schemaContext: 'schema context',
        model: 'gemini:gemini-2.5-flash',
        mode: 'fast',
        routingMode: 'auto',
      }),
    );
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

  it('binds feedback to actor ownership and does not audit a denied generation', async () => {
    const denied = new NotFoundException('AI generation not found.');
    ledger.feedback.mockRejectedValueOnce(denied);
    await expect(
      controller.recordSqlFeedback(
        { generationId: 'other-generation', rating: 'up' },
        { user: { id: 'user-1' } } as any,
      ),
    ).rejects.toBe(denied);
    expect(ledger.feedback).toHaveBeenCalledWith(
      'user-1',
      'other-generation',
      'up',
    );
    expect(auditServiceMock.log).not.toHaveBeenCalled();
  });

  it('acknowledges feedback only through the idempotent ledger API, with audit secondary', async () => {
    const body = {
      generationId: 'owned-generation',
      rating: 'down' as const,
      userId: 'spoofed',
      prompt: 'secret',
    };
    auditServiceMock.log.mockRejectedValueOnce(new Error('audit failed'));
    await expect(
      controller.recordSqlFeedback(body, { user: { id: 'user-1' } } as any),
    ).resolves.toEqual({ success: true });
    await expect(
      controller.recordSqlFeedback(body, { user: { id: 'user-1' } } as any),
    ).resolves.toEqual({ success: true });
    expect(ledger.feedback).toHaveBeenNthCalledWith(
      1,
      'user-1',
      'owned-generation',
      'down',
    );
    expect(ledger.feedback).toHaveBeenNthCalledWith(
      2,
      'user-1',
      'owned-generation',
      'down',
    );
    expect(JSON.stringify(auditServiceMock.log.mock.calls)).not.toContain(
      'secret',
    );
    ledger.feedback.mockRejectedValueOnce(new Error('durability failed'));
    await expect(
      controller.recordSqlFeedback(body, { user: { id: 'user-1' } } as any),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('delegates discovery egress denial to the bounded provider service without legacy fetch', async () => {
    global.fetch = jest.fn();
    const denied = new ForbiddenException({ reason: 'AI_EGRESS_DENIED' });
    providerConnectionsMock.listModels.mockRejectedValueOnce(denied);
    await expect(
      controller.listProviderModels(
        { baseUrl: 'https://provider.example/v1', apiKey: 'secret' },
        { user: { id: 'user-1' } } as any,
      ),
    ).rejects.toBe(denied);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(validateExternalUrlMock).not.toHaveBeenCalled();
    expect(providerConnectionsMock.listModels).toHaveBeenCalledWith(
      'https://provider.example/v1',
      'secret',
      'user-1',
    );
  });

  it('lists provider models using only allowlisted input and the authenticated actor', async () => {
    global.fetch = jest.fn();
    providerConnectionsMock.listModels.mockResolvedValueOnce([
      'a-model',
      'z-model',
    ]);
    await expect(
      controller.listProviderModels(
        {
          baseUrl: '  https://provider.example.com/v1///  ',
          apiKey: ' sk-test ',
          userId: 'spoofed',
          execution: { beforeAttempt: jest.fn() },
          approvedLocalOrigins: ['http://127.0.0.1'],
        } as any,
        { user: { id: 'user-1' } } as any,
      ),
    ).resolves.toEqual({ models: ['a-model', 'z-model'] });
    expect(providerConnectionsMock.listModels).toHaveBeenCalledWith(
      'https://provider.example.com/v1///',
      'sk-test',
      'user-1',
    );
    expect(global.fetch).not.toHaveBeenCalled();
    expect(validateExternalUrlMock).not.toHaveBeenCalled();
  });

  it('passes provider URL safety failures through the secure service without duplicate transport', async () => {
    global.fetch = jest.fn();
    providerConnectionsMock.listModels.mockRejectedValueOnce(
      new Error('Unsafe provider URL'),
    );
    await expect(
      controller.listProviderModels(
        { baseUrl: 'http://127.0.0.1:3000/v1', apiKey: 'sk-sensitive' },
        { user: { id: 'user-1' } } as any,
      ),
    ).rejects.toThrow('Unsafe provider URL');
    expect(global.fetch).not.toHaveBeenCalled();
    expect(validateExternalUrlMock).not.toHaveBeenCalled();
  });

  it.each([
    {},
    { baseUrl: 42 },
    { baseUrl: ' ' },
    { baseUrl: 'x'.repeat(2001) },
    { baseUrl: 'https://provider.example', apiKey: 42 },
    { baseUrl: 'https://provider.example', apiKey: 'x'.repeat(4001) },
  ])('validates discovery input before delegating %j', async (body) => {
    await expect(
      controller.listProviderModels(
        body as any,
        { user: { id: 'user-1' } } as any,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(providerConnectionsMock.listModels).not.toHaveBeenCalled();
    expect(validateExternalUrlMock).not.toHaveBeenCalled();
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

  describe('HTTP ownership', () => {
    const methods = [
      'generateSql',
      'generateSqlStream',
      'nlpToSql',
      'autocomplete',
      'testAutocomplete',
    ] as const;
    type Method = (typeof methods)[number];
    const testController = new AiTestController(
      aiServiceMock as unknown as AiService,
      connectionServiceMock as unknown as AiConnectionService,
      providerConnectionsMock as unknown as AiProviderConnectionService,
      accountPolicy as unknown as AiAccountPolicyService,
      ledger as unknown as AiExecutionLedgerService,
    );

    function transport() {
      const res = Object.assign(new EventEmitter(), {
        destroyed: false,
        writableEnded: false,
        writableFinished: false,
        setHeader: jest.fn(),
        flushHeaders: jest.fn(),
        write: jest.fn((_frame: string) => true),
        end: jest.fn(() => {
          res.writableEnded = true;
          res.emit('close');
        }),
      });
      const req = Object.assign(new EventEmitter(), {
        user: { id: 'user-1' },
        aborted: false,
        res,
      });
      return { req, res };
    }

    function deferred<T>() {
      let resolve!: (value: T) => void;
      const promise = new Promise<T>((done) => {
        resolve = done;
      });
      return { promise, resolve };
    }

    function invoke(method: Method, fixture: ReturnType<typeof transport>) {
      const untrusted = new AbortController();
      untrusted.abort(new Error('body secret'));
      const body = {
        connectionId: 'conn-1',
        database: 'app',
        prompt: 'Show tables',
        beforeCursor: 'SEL',
        signal: untrusted.signal,
        deadlineAt: 0,
        cacheScope: 'body-owned-cache',
        requestScopeKey: 'body-owned-key',
        userId: 'spoofed-actor',
        generationId: 'body-generation',
        execution: {
          generationId: 'body-generation',
          beforeAttempt: jest.fn(),
        },
        beforeProviderRequest: jest.fn(),
        beforeProviderAttempt: jest.fn(),
      };
      const req = fixture.req as unknown as Parameters<
        AiController['generateSql']
      >[1];
      if (method === 'generateSqlStream') {
        return controller.generateSqlStream(
          body,
          fixture.res as unknown as Parameters<
            AiController['generateSqlStream']
          >[1],
          req,
        );
      }
      if (method === 'testAutocomplete')
        return testController.autocomplete(body, req);
      return controller[method](body, req);
    }

    function contextMock(method: Method) {
      return method === 'generateSqlStream'
        ? connectionServiceMock.getConnectionContextForStream
        : connectionServiceMock.getConnectionContext;
    }

    function expectNoProvider() {
      expect(aiServiceMock.chat).not.toHaveBeenCalled();
      expect(aiServiceMock.chatStream).not.toHaveBeenCalled();
      expect(aiServiceMock.generateSql).not.toHaveBeenCalled();
      expect(aiServiceMock.autocomplete).not.toHaveBeenCalled();
    }

    beforeEach(() => {
      jest.useFakeTimers();
      Object.values(aiServiceMock).forEach((mock) => mock.mockReset());
      Object.values(connectionServiceMock).forEach((mock) => mock.mockReset());
      providerConnectionsMock.resolveOverride
        .mockReset()
        .mockImplementation((_userId: string, providerOverride: unknown) =>
          Promise.resolve(providerOverride),
        );
    });
    afterEach(() => jest.useRealTimers());

    it.each(methods)(
      'cancels delayed schema for %s with no later provider dispatch',
      async (method) => {
        const fixture = transport();
        const schema = deferred<string>();
        const started = deferred<void>();
        aiServiceMock.gatherSchemaContext.mockImplementationOnce(() => {
          started.resolve(undefined);
          return schema.promise;
        });
        contextMock(method).mockImplementationOnce(
          async (_id, _db, _user, gather) => ({
            connection: { type: 'postgresql' },
            schemaContext: await gather({}, {}, 'app', 'conn-1'),
          }),
        );
        const running = invoke(method, fixture);
        await started.promise;
        const rejected = expect(running).rejects.toMatchObject({
          status: 499,
          response: { reason: 'AI_REQUEST_CANCELLED' },
        });
        fixture.res.emit('close');
        await rejected;
        schema.resolve('late schema');
        await schema.promise;
        expectNoProvider();
        expect(providerConnectionsMock.resolveOverride).not.toHaveBeenCalled();
        expect(fixture.res.setHeader).not.toHaveBeenCalled();
        expect(fixture.req.listenerCount('aborted')).toBe(0);
        expect(fixture.res.listenerCount('close')).toBe(0);
        expect(executionContext.release).toHaveBeenCalledTimes(1);
        expect(jest.getTimerCount()).toBe(0);
      },
    );

    it.each(methods)(
      'cancels delayed provider override for %s without dispatch',
      async (method) => {
        const fixture = transport();
        const override = deferred<undefined>();
        const started = deferred<void>();
        contextMock(method).mockResolvedValueOnce({
          connection: { type: 'postgresql' },
          schemaContext: 'schema',
        });
        providerConnectionsMock.resolveOverride.mockImplementationOnce(() => {
          started.resolve(undefined);
          return override.promise;
        });
        const running = invoke(method, fixture);
        await started.promise;
        const settled =
          method === 'generateSqlStream'
            ? expect(running).resolves.toBeUndefined()
            : expect(running).rejects.toMatchObject({
                status: 499,
                response: { reason: 'AI_REQUEST_CANCELLED' },
              });
        fixture.req.emit('aborted');
        await settled;
        override.resolve(undefined);
        await override.promise;
        expectNoProvider();
        expect(fixture.res.write).not.toHaveBeenCalled();
        expect(fixture.res.end).toHaveBeenCalledTimes(
          method === 'generateSqlStream' ? 1 : 0,
        );
        expect(fixture.req.listenerCount('aborted')).toBe(0);
        expect(fixture.res.listenerCount('close')).toBe(0);
        expect(executionContext.release).toHaveBeenCalledTimes(1);
        expect(jest.getTimerCount()).toBe(0);
      },
    );

    it.each(methods)(
      'forwards only the trusted HTTP lifetime through schema and %s dispatch',
      async (method) => {
        const fixture = transport();
        const deadlineAt =
          Date.now() + AI_CONSTANTS.DEFAULT_PROVIDER_TIMEOUT_MS;
        aiServiceMock.gatherSchemaContext.mockResolvedValueOnce('schema');
        contextMock(method).mockImplementationOnce(
          async (_id, _db, _user, gather) => ({
            connection: { type: 'postgresql' },
            schemaContext: await gather({}, {}, 'app', 'conn-1'),
          }),
        );
        aiServiceMock.chat.mockResolvedValueOnce({ message: 'ok' });
        aiServiceMock.generateSql.mockResolvedValueOnce({
          sql: 'SELECT 1',
          provider: 'groq',
          model: 'model',
        });
        aiServiceMock.autocomplete.mockResolvedValueOnce('ECT');
        aiServiceMock.chatStream.mockReturnValueOnce(
          (async function* () {
            yield { type: 'done', data: { message: 'ok' } };
            yield { type: 'chunk', text: 'must not arrive' };
          })(),
        );
        fixture.req.emit('close');
        await invoke(method, fixture);
        const service =
          method === 'generateSql'
            ? aiServiceMock.chat
            : method === 'nlpToSql'
              ? aiServiceMock.generateSql
              : method === 'generateSqlStream'
                ? aiServiceMock.chatStream
                : aiServiceMock.autocomplete;
        const params = service.mock.calls[0][0];
        expect(params.signal).toBeInstanceOf(AbortSignal);
        expect(params.signal.aborted).toBe(false);
        expect(params.deadlineAt).toBe(deadlineAt);
        expect(params.beforeProviderRequest).toEqual(expect.any(Function));
        expect(params.execution).toBe(executionContext);
        expect(params.requestScopeKey).toBe(
          JSON.stringify(['user-1', 'conn-1', 'app']),
        );
        expect(params.beforeProviderAttempt).toEqual(expect.any(Function));
        expect(beforeProviderRequest).toHaveBeenCalledWith(
          'user-1',
          'conn-1',
          'app',
        );
        expect(beforeProviderAttempt).toHaveBeenCalledWith(
          'user-1',
          'conn-1',
          'app',
        );
        expect(ledger.begin).toHaveBeenCalledWith(
          'user-1',
          method.includes('utocomplete')
            ? 'autocomplete'
            : method === 'nlpToSql'
              ? 'generate_sql'
              : 'chat',
          {
            connectionId: 'conn-1',
            database: 'app',
            requestedModel: undefined,
            deadlineAt,
          },
        );
        expect(executionContext.complete).toHaveBeenCalledTimes(1);
        expect(executionContext.release).toHaveBeenCalledTimes(1);
        expect(aiServiceMock.gatherSchemaContext).toHaveBeenCalledWith(
          {},
          {},
          'app',
          'conn-1',
          method.includes('utocomplete') ? 'SEL' : 'Show tables',
          expect.objectContaining({
            signal: params.signal,
            deadlineAt,
            beforeProviderRequest: expect.any(Function),
          }),
        );
        if (method.includes('utocomplete')) {
          expect(params.cacheScope).toBe(
            JSON.stringify(['user-1', 'conn-1', 'app']),
          );
        }
        if (method === 'generateSqlStream') {
          expect(fixture.res.end).toHaveBeenCalledTimes(1);
          expect(fixture.res.write).toHaveBeenCalledTimes(2);
          expect(JSON.stringify(fixture.res.write.mock.calls)).not.toContain(
            'must not arrive',
          );
        }
        expect(fixture.req.listenerCount('aborted')).toBe(0);
        expect(fixture.res.listenerCount('close')).toBe(0);
        expect(executionContext.release).toHaveBeenCalledTimes(1);
        expect(jest.getTimerCount()).toBe(0);
      },
    );

    it.each(methods)(
      'connection egress denial starts neither schema nor budget for %s',
      async (method) => {
        const denied = new ForbiddenException({ reason: 'AI_EGRESS_DENIED' });
        assertConnectionEnabled.mockRejectedValueOnce(denied);
        await expect(invoke(method, transport())).rejects.toBe(denied);
        expect(ledger.begin).not.toHaveBeenCalled();
        expect(contextMock(method)).not.toHaveBeenCalled();
        expectNoProvider();
      },
    );

    it.each(methods)(
      'ledger admission failure dispatches no schema/provider for %s',
      async (method) => {
        ledger.begin.mockRejectedValueOnce(new Error('database secret'));
        await expect(invoke(method, transport())).rejects.toMatchObject({
          status: 503,
        });
        expect(contextMock(method)).not.toHaveBeenCalled();
        expectNoProvider();
        expect(executionContext.complete).not.toHaveBeenCalled();
      },
    );

    it.each(methods)(
      'releases a context arriving after begin cancellation for %s',
      async (method) => {
        const fixture = transport();
        const begin = deferred<AiExecutionContext>();
        const started = deferred<void>();
        ledger.begin.mockImplementationOnce(() => {
          started.resolve(undefined);
          return begin.promise;
        });
        const running = invoke(method, fixture);
        await started.promise;
        const rejected = expect(running).rejects.toMatchObject({ status: 499 });
        fixture.req.emit('aborted');
        await rejected;
        begin.resolve(executionContext);
        for (let index = 0; index < 30; index++) await Promise.resolve();
        expect(executionContext.fail).toHaveBeenCalledWith('cancelled');
        expect(executionContext.release).toHaveBeenCalledTimes(1);
        expectNoProvider();
        expect(contextMock(method)).not.toHaveBeenCalled();
        expect(jest.getTimerCount()).toBe(0);
      },
    );

    it.each(methods)(
      'durability failure never returns success for %s',
      async (method) => {
        const fixture = transport();
        contextMock(method).mockResolvedValueOnce({
          connection: { type: 'postgresql' },
          schemaContext: 'schema',
        });
        aiServiceMock.chat.mockResolvedValueOnce({ message: 'ok' });
        aiServiceMock.generateSql.mockResolvedValueOnce({ sql: 'SELECT 1' });
        aiServiceMock.autocomplete.mockResolvedValueOnce('ECT');
        aiServiceMock.chatStream.mockReturnValueOnce(
          (async function* () {
            yield { type: 'done', data: { message: 'ok' } };
          })(),
        );
        executionContext.complete.mockRejectedValueOnce(
          new Error('ledger credentials secret'),
        );
        await expect(invoke(method, fixture)).rejects.toMatchObject({
          status: 503,
        });
        expect(executionContext.release).toHaveBeenCalledTimes(1);
        expect(JSON.stringify(fixture.res.write.mock.calls)).not.toContain(
          '"type":"done"',
        );
        expect(JSON.stringify(fixture.res.write.mock.calls)).not.toContain(
          'secret',
        );
        expect(jest.getTimerCount()).toBe(0);
      },
    );

    it.each(methods)('releases failed providers for %s', async (method) => {
      const fixture = transport();
      contextMock(method).mockResolvedValueOnce({
        connection: { type: 'postgresql' },
        schemaContext: 'schema',
      });
      aiServiceMock.chat.mockRejectedValueOnce(new Error('provider secret'));
      aiServiceMock.generateSql.mockRejectedValueOnce(
        new Error('provider secret'),
      );
      aiServiceMock.autocomplete.mockRejectedValueOnce(
        new Error('provider secret'),
      );
      aiServiceMock.chatStream.mockReturnValueOnce(
        (async function* () {
          yield {
            type: 'error',
            text: 'provider secret',
            aiRequestFatal: true,
          };
        })(),
      );
      const running = invoke(method, fixture);
      if (method === 'generateSqlStream') await running;
      else if (method === 'testAutocomplete')
        await expect(running).resolves.toMatchObject({
          completion: '',
          error: 'AI generation failed.',
        });
      else await expect(running).rejects.toBeDefined();
      expect(executionContext.fail).toHaveBeenCalledWith('failed');
      expect(executionContext.complete).not.toHaveBeenCalled();
      expect(executionContext.release).toHaveBeenCalledTimes(1);
      expect(jest.getTimerCount()).toBe(0);
    });

    it('bounds pre-stream schema gathering by the total deadline with a safe HTTP reason', async () => {
      const fixture = transport();
      contextMock('generateSqlStream').mockImplementationOnce(
        () => new Promise(() => {}),
      );
      const running = invoke('generateSqlStream', fixture);
      const rejected = expect(running).rejects.toMatchObject({
        status: 504,
        response: {
          reason: 'AI_REQUEST_TIMEOUT',
          message: 'AI request deadline exceeded.',
        },
      });
      await jest.advanceTimersByTimeAsync(
        AI_CONSTANTS.DEFAULT_PROVIDER_TIMEOUT_MS,
      );
      await rejected;
      expectNoProvider();
      expect(fixture.res.setHeader).not.toHaveBeenCalled();
      expect(jest.getTimerCount()).toBe(0);
    });

    it('does not dispatch or write after disconnect while sending SSE headers', async () => {
      const fixture = transport();
      contextMock('generateSqlStream').mockResolvedValueOnce({
        connection: { type: 'postgresql' },
        schemaContext: 'schema',
      });
      fixture.res.flushHeaders.mockImplementationOnce(() =>
        fixture.res.emit('close'),
      );
      await invoke('generateSqlStream', fixture);
      expectNoProvider();
      expect(providerConnectionsMock.resolveOverride).not.toHaveBeenCalled();
      expect(fixture.res.write).not.toHaveBeenCalled();
      expect(fixture.res.end).not.toHaveBeenCalled();
      expect(jest.getTimerCount()).toBe(0);
    });

    it('keeps stopped provider failures typed without echoing a provider secret', async () => {
      const fixture = transport();
      contextMock('generateSql').mockResolvedValueOnce({
        connection: { type: 'postgresql' },
        schemaContext: 'schema',
      });
      const stopped = new AiRequestStoppedError('AI_REQUEST_TIMEOUT');
      stopped.message = 'provider sk-secret';
      aiServiceMock.chat.mockRejectedValueOnce(stopped);
      await expect(invoke('generateSql', fixture)).rejects.toMatchObject({
        status: 504,
        response: {
          reason: 'AI_REQUEST_TIMEOUT',
          message: 'AI request deadline exceeded.',
        },
      });
      expect(jest.getTimerCount()).toBe(0);
    });
  });
});
