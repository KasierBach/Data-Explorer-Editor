import {
  ForbiddenException,
  HttpException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiProviderConnectionService } from './ai-provider-connection.service';
import { AiAccountPolicyService } from './ai-account-policy.service';
import { AiEgressPolicyService } from './ai-egress-policy.service';
import { fetchAiProvider, readAiProviderJson } from './ai-provider-transport';

jest.mock('./ai-provider-transport', () => ({
  ...jest.requireActual('./ai-provider-transport'),
  fetchAiProvider: jest.fn(),
  readAiProviderJson: jest.fn(),
}));
jest.mock('../utils/crypto.util', () => ({
  encryptAttribute: (value: string) => `encrypted:${value}`,
  decryptAttribute: (value: string) => value.replace(/^encrypted:/, ''),
}));

import {
  AiExecutionLedgerService,
  type AiExecutionContext,
} from './ai-execution-ledger.service';
import { AiProviderTransportError } from './ai-provider-transport';
import { ConfigService } from '@nestjs/config';

function fixture(prisma: unknown = {}, useLedger = true) {
  const account = { assertEnabled: jest.fn().mockResolvedValue(undefined) };
  const egress = { assertProvider: jest.fn() };
  const attempts: Array<{
    attemptId: string;
    complete: jest.Mock;
    fail: jest.Mock;
  }> = [];
  const execution = {
    generationId: 'discovery-generation',
    deadlineAt: Date.now() + 15_000,
    beforeAttempt: jest.fn(
      async (_plan: { provider: string; model: string }) => {
        const attempt = {
          attemptId: `attempt-${attempts.length + 1}`,
          complete: jest.fn().mockResolvedValue(undefined),
          fail: jest.fn().mockResolvedValue(undefined),
        };
        attempts.push(attempt);
        return attempt;
      },
    ),
    complete: jest.fn().mockResolvedValue({ outcome: 'succeeded' }),
    fail: jest.fn().mockResolvedValue({ outcome: 'failed' }),
    release: jest.fn().mockResolvedValue(undefined),
  };
  const ledger = {
    begin: jest.fn(
      async (
        _actor: string,
        _task: string,
        metadata: { deadlineAt: number },
      ) => {
        execution.deadlineAt = metadata.deadlineAt;
        return execution as unknown as AiExecutionContext;
      },
    ),
  };
  return {
    account,
    egress,
    ledger,
    execution,
    attempts,
    service: new AiProviderConnectionService(
      prisma as PrismaService,
      account as unknown as AiAccountPolicyService,
      egress as unknown as AiEgressPolicyService,
      useLedger ? (ledger as unknown as AiExecutionLedgerService) : undefined,
    ),
  };
}

describe('AiProviderConnectionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(fetchAiProvider).mockReset();
    jest.mocked(readAiProviderJson).mockReset();
  });
  afterEach(() => jest.useRealTimers());

  it('does not contact a provider for model discovery or testing when AI is disabled', async () => {
    const { service, account } = fixture();
    const denied = new ForbiddenException({
      reason: 'AI_DISABLED',
      message: 'AI is disabled',
    });
    account.assertEnabled.mockRejectedValue(denied);
    await expect(
      service.listModels('https://provider.example.com', undefined, 'user-1'),
    ).rejects.toBe(denied);
    await expect(
      service.test('user-1', undefined, {
        name: 'Provider',
        model: 'model-a',
        baseUrl: 'https://provider.example.com',
      }),
    ).rejects.toBe(denied);
    expect(fetchAiProvider).not.toHaveBeenCalled();
  });

  it('denies unapproved recipients before constructing provider requests', async () => {
    const { service, egress } = fixture();
    const denied = new ForbiddenException({ reason: 'AI_EGRESS_DENIED' });
    egress.assertProvider.mockImplementation(() => {
      throw denied;
    });
    await expect(
      service.listModels('https://provider.example.com', 'secret', 'user-1'),
    ).rejects.toBe(denied);
    expect(fetchAiProvider).not.toHaveBeenCalled();
  });

  it('encrypts API keys and never returns them to the client', async () => {
    const create = jest.fn().mockImplementation(({ data }) => ({
      ...data,
      id: 'provider-1',
      capabilities: data.capabilities || {},
      lastTestedAt: null,
      lastStatus: null,
      lastError: null,
      lastLatencyMs: null,
      createdAt: new Date('2026-08-01T00:00:00.000Z'),
      updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    }));
    const { service } = fixture({ aiProviderConnection: { create } });
    const result = await service.create('user-1', {
      name: 'Provider',
      type: 'openai-compatible',
      baseUrl: 'https://provider.example.com/v1/',
      apiKey: 'sk-secret',
      model: 'model-a',
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          apiKey: 'encrypted:sk-secret',
          baseUrl: 'https://provider.example.com/v1',
          userId: 'user-1',
        }),
      }),
    );
    expect(result).not.toHaveProperty('apiKey');
    expect(result.apiKeyConfigured).toBe(true);
    expect(fetchAiProvider).not.toHaveBeenCalled();
  });

  it('resolves saved provider secrets and capabilities for its owner', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: 'provider-1',
      userId: 'user-1',
      name: 'Saved provider',
      baseUrl: 'https://provider.example.com/v1',
      apiKey: 'encrypted:sk-secret',
      model: 'model-a',
      capabilities: { vision: true, document: false },
    });
    const { service } = fixture({ aiProviderConnection: { findFirst } });
    const result = await service.resolveOverride('user-1', {
      type: 'openai-compatible',
      providerId: 'provider-1',
      model: 'vision-model',
    });
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'provider-1', userId: 'user-1' },
    });
    expect(result).toEqual({
      type: 'openai-compatible',
      name: 'Saved provider',
      baseUrl: 'https://provider.example.com/v1',
      apiKey: 'sk-secret',
      model: 'vision-model',
      capabilities: { vision: true, document: false },
    });
  });

  it('bounds model discovery and rechecks authorization at the transport boundary', async () => {
    const { service, account, egress, execution } = fixture();
    jest
      .mocked(fetchAiProvider)
      .mockImplementation(async (_url, _init, options) => {
        const reservations = execution.beforeAttempt.mock.calls.length;
        await options?.beforeDispatch?.();
        expect(execution.beforeAttempt).toHaveBeenCalledTimes(reservations);
        return new Response('{}', {
          headers: { 'content-type': 'application/json' },
        });
      });
    jest.mocked(readAiProviderJson).mockResolvedValue({
      data: [{ id: 'second' }, { id: 'first' }, { id: 'first' }],
    });
    await expect(
      service.listModels('https://provider.example.com/v1', 'secret', 'user-1'),
    ).resolves.toEqual(['first', 'second']);
    const options = jest.mocked(fetchAiProvider).mock.calls[0][2];
    expect(options?.maxResponseBytes).toBe(512 * 1024);
    expect(options?.maxRequestBytes).toBe(16 * 1024);
    expect(options?.timeoutMs).toBeLessThanOrEqual(15_000);
    expect(account.assertEnabled).toHaveBeenCalled();
    expect(egress.assertProvider).toHaveBeenCalled();
  });

  it.each([
    {},
    { data: [] as unknown[] },
    { data: [{ id: 42 }] },
    { data: Array.from({ length: 201 }, () => ({ id: 'model' })) },
  ])('rejects malformed or excessive model IDs: %j', async (payload) => {
    const { service } = fixture();
    jest
      .mocked(fetchAiProvider)
      .mockResolvedValue(
        new Response('{}', { headers: { 'content-type': 'application/json' } }),
      );
    jest.mocked(readAiProviderJson).mockResolvedValue(payload);
    if (Array.isArray(payload.data) && payload.data.length === 0) {
      await expect(
        service.listModels(
          'https://provider.example.com/v1',
          undefined,
          'user-1',
        ),
      ).resolves.toEqual([]);
    } else {
      await expect(
        service.listModels(
          'https://provider.example.com/v1',
          undefined,
          'user-1',
        ),
      ).rejects.toThrow();
    }
  });

  it.each(['discovery', 'test'])(
    'fails closed without operational ledger for %s',
    async (operation) => {
      const { service } = fixture({}, false);
      const request =
        operation === 'discovery'
          ? service.listModels(
              'https://provider.example.com',
              'secret',
              'actor',
            )
          : service.test('actor', undefined, {
              name: 'Provider',
              model: 'model-a',
              baseUrl: 'https://provider.example.com',
            });
      await expect(request).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(fetchAiProvider).not.toHaveBeenCalled();
    },
  );

  it('denies default egress even if broad internal-IP environment bypasses are enabled', async () => {
    const { account, ledger } = fixture();
    const egress = new AiEgressPolicyService({
      get: jest.fn((key) =>
        key === 'ALLOW_INTERNAL_IPS' ? 'true' : undefined,
      ),
    } as unknown as ConfigService);
    const service = new AiProviderConnectionService(
      {} as PrismaService,
      account as unknown as AiAccountPolicyService,
      egress,
      ledger as unknown as AiExecutionLedgerService,
    );
    await expect(
      service.listModels('https://provider.example.com/v1', 'secret', 'actor'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(ledger.begin).not.toHaveBeenCalled();
    expect(fetchAiProvider).not.toHaveBeenCalled();
  });

  it('reserves one discovery execution and completes only after bounded JSON/model validation', async () => {
    const { service, ledger, execution, attempts } = fixture();
    let resolveJson!: (payload: unknown) => void;
    jest
      .mocked(fetchAiProvider)
      .mockResolvedValue(
        new Response('{}', { headers: { 'content-type': 'application/json' } }),
      );
    jest.mocked(readAiProviderJson).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveJson = resolve;
        }),
    );
    const request = service.listModels(
      'https://provider.example.com/v1',
      'secret-key',
      'actor',
    );
    for (let index = 0; index < 50; index += 1) await Promise.resolve();
    expect(attempts).toHaveLength(1);
    expect(attempts[0].complete).not.toHaveBeenCalled();
    expect(execution.complete).not.toHaveBeenCalled();
    resolveJson({ data: [{ id: 'model-a' }], usage: { total_tokens: 99 } });
    expect(await request).toEqual(['model-a']);
    expect(ledger.begin).toHaveBeenCalledWith('actor', 'provider_discovery', {
      requestedModel: 'discovery',
      deadlineAt: expect.any(Number),
    });
    expect(execution.beforeAttempt).toHaveBeenCalledWith({
      provider: 'custom',
      model: 'discovery',
    });
    expect(attempts[0].complete).toHaveBeenCalledWith({
      provider: 'custom',
      model: 'discovery',
      usage: null,
    });
    expect(attempts[0].fail).not.toHaveBeenCalled();
    expect(execution.complete).toHaveBeenCalledTimes(1);
    expect(execution.release).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(ledger.begin.mock.calls)).not.toContain('secret-key');
    expect(JSON.stringify(execution.beforeAttempt.mock.calls)).not.toContain(
      'provider.example.com',
    );
  });

  it('tracks GET and small POST as two attempts under one provider_test lease and one deadline', async () => {
    const { service, ledger, execution, attempts } = fixture();
    jest
      .mocked(fetchAiProvider)
      .mockResolvedValue(
        new Response('{}', { headers: { 'content-type': 'application/json' } }),
      );
    jest
      .mocked(readAiProviderJson)
      .mockResolvedValueOnce({ data: [{ id: 'model-a' }] })
      .mockResolvedValueOnce({
        choices: [{ message: { content: 'OK' } }],
        usage: { prompt_tokens: 4, completion_tokens: 1, total_tokens: 5 },
      });
    expect(
      await service.test('actor', undefined, {
        name: 'Provider',
        model: 'model-a',
        baseUrl: 'https://provider.example.com/v1',
        apiKey: 'secret',
      }),
    ).toMatchObject({ ok: true, models: ['model-a'] });
    expect(ledger.begin).toHaveBeenCalledTimes(1);
    expect(ledger.begin).toHaveBeenCalledWith('actor', 'provider_test', {
      requestedModel: 'model-a',
      deadlineAt: expect.any(Number),
    });
    expect(execution.beforeAttempt.mock.calls).toEqual([
      [{ provider: 'custom', model: 'discovery' }],
      [{ provider: 'custom', model: 'model-a' }],
    ]);
    expect(attempts[0].complete).toHaveBeenCalledWith({
      provider: 'custom',
      model: 'discovery',
      usage: null,
    });
    expect(attempts[1].complete).toHaveBeenCalledWith({
      provider: 'custom',
      model: 'model-a',
      usage: { promptTokens: 4, completionTokens: 1, totalTokens: 5 },
    });
    const calls = jest.mocked(fetchAiProvider).mock.calls;
    expect(calls[0][1]?.signal).toBe(calls[1][1]?.signal);
    expect(calls[0][1]?.method).toBe('GET');
    expect(calls[1][1]?.method).toBe('POST');
    expect(JSON.parse(calls[1][1]?.body as string)).toMatchObject({
      model: 'model-a',
      max_tokens: 8,
    });
    expect(execution.release).toHaveBeenCalledTimes(1);
  });

  it('does not reset the 15-second deadline after GET and aborts stalled POST/JSON waits', async () => {
    jest.useFakeTimers();
    const { service, execution, attempts } = fixture();
    jest
      .mocked(fetchAiProvider)
      .mockResolvedValue(
        new Response('{}', { headers: { 'content-type': 'application/json' } }),
      );
    jest
      .mocked(readAiProviderJson)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ data: [] }), 14_000),
          ),
      )
      .mockImplementationOnce(() => new Promise(() => undefined));
    const request = service.test('actor', undefined, {
      name: 'Provider',
      model: 'model-a',
      baseUrl: 'https://provider.example.com/v1',
    });
    for (let index = 0; index < 60; index += 1) await Promise.resolve();
    await jest.advanceTimersByTimeAsync(14_000);
    expect(fetchAiProvider).toHaveBeenCalledTimes(2);
    expect(
      jest.mocked(fetchAiProvider).mock.calls[1][2]?.timeoutMs,
    ).toBeLessThanOrEqual(1000);
    await jest.advanceTimersByTimeAsync(1000);
    expect(await request).toMatchObject({
      ok: false,
      latencyMs: 15_000,
      error: 'Provider test failed',
    });
    expect(attempts[1].fail).toHaveBeenCalledWith('timed_out', {
      provider: 'custom',
      model: 'model-a',
      usage: null,
    });
    expect(execution.fail).toHaveBeenCalledWith('timed_out');
    expect(execution.release).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('does not send POST when the one deadline expires during discovery', async () => {
    jest.useFakeTimers();
    const { service, execution, attempts } = fixture();
    jest
      .mocked(fetchAiProvider)
      .mockImplementation(() => new Promise(() => undefined));
    const request = service.test('actor', undefined, {
      name: 'Provider',
      model: 'model-a',
      baseUrl: 'https://provider.example.com/v1',
    });
    for (let index = 0; index < 60; index += 1) await Promise.resolve();
    await jest.advanceTimersByTimeAsync(15_000);
    expect(await request).toMatchObject({ ok: false });
    expect(fetchAiProvider).toHaveBeenCalledTimes(1);
    expect(attempts[0].fail).toHaveBeenCalledWith(
      'timed_out',
      expect.objectContaining({ usage: null }),
    );
    expect(execution.release).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('propagates distributed concurrency/attempt cap denials without transport or discovery fallback', async () => {
    const first = fixture();
    const busy = new HttpException('AI operational concurrency is busy.', 429);
    first.ledger.begin.mockRejectedValueOnce(busy);
    await expect(
      first.service.listModels(
        'https://provider.example.com/v1',
        undefined,
        'actor',
      ),
    ).rejects.toBe(busy);
    expect(fetchAiProvider).not.toHaveBeenCalled();
    const second = fixture();
    const capped = new HttpException(
      'AI finite attempt bound was reached.',
      409,
    );
    second.execution.beforeAttempt.mockRejectedValueOnce(capped);
    await expect(
      second.service.test('actor', undefined, {
        name: 'Provider',
        model: 'model-a',
        baseUrl: 'https://provider.example.com/v1',
      }),
    ).rejects.toBe(capped);
    expect(second.execution.beforeAttempt).toHaveBeenCalledTimes(1);
    expect(second.execution.release).toHaveBeenCalledTimes(1);
    expect(fetchAiProvider).not.toHaveBeenCalled();
  });

  it.each(['account', 'egress'])(
    'rechecks %s after DNS before dispatch without reserving another attempt',
    async (gate) => {
      const { service, account, egress, execution, attempts } = fixture();
      const denied = new ForbiddenException({
        reason: gate === 'account' ? 'AI_DISABLED' : 'AI_EGRESS_DENIED',
      });
      jest
        .mocked(fetchAiProvider)
        .mockImplementation(async (_url, _init, options) => {
          if (gate === 'account')
            account.assertEnabled.mockRejectedValueOnce(denied);
          else
            egress.assertProvider.mockImplementationOnce(() => {
              throw denied;
            });
          await options?.beforeDispatch?.();
          throw new Error('dispatch must be denied');
        });
      await expect(
        service.listModels(
          'https://provider.example.com/v1',
          'secret',
          'actor',
        ),
      ).rejects.toBe(denied);
      expect(execution.beforeAttempt).toHaveBeenCalledTimes(1);
      expect(attempts[0].fail).toHaveBeenCalledTimes(1);
      expect(attempts[0].complete).not.toHaveBeenCalled();
      expect(readAiProviderJson).not.toHaveBeenCalled();
      expect(execution.release).toHaveBeenCalledTimes(1);
    },
  );

  it('sanitizes failed HTTP/body responses and does not accept usage from HTTP error payloads', async () => {
    const { service, attempts } = fixture();
    jest
      .mocked(fetchAiProvider)
      .mockResolvedValueOnce(
        new Response('{}', {
          status: 401,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response('{}', {
          status: 403,
          headers: { 'content-type': 'application/json' },
        }),
      );
    jest.mocked(readAiProviderJson).mockResolvedValue({
      error: { message: 'Bearer secret /private/path' },
      usage: { total_tokens: 99 },
    });
    const result = await service.test('actor', undefined, {
      name: 'Provider',
      model: 'model-a',
      baseUrl: 'https://provider.example.com/v1',
      apiKey: 'secret',
    });
    expect(result).toMatchObject({
      ok: false,
      error: 'Provider test failed',
      modelDiscoveryError: 'Model discovery failed',
    });
    expect(JSON.stringify(result)).not.toContain('secret');
    expect(JSON.stringify(result)).not.toContain('/private/path');
    expect(attempts).toHaveLength(2);
    for (const attempt of attempts) {
      expect(attempt.fail).toHaveBeenCalledWith(
        'failed',
        expect.objectContaining({ usage: null }),
      );
      expect(attempt.complete).not.toHaveBeenCalled();
    }
  });

  it('fails invalid/oversized JSON without returning raw errors or reporting attempt success', async () => {
    const { service, execution, attempts } = fixture();
    jest
      .mocked(fetchAiProvider)
      .mockResolvedValue(
        new Response('{}', { headers: { 'content-type': 'application/json' } }),
      );
    jest
      .mocked(readAiProviderJson)
      .mockRejectedValue(
        new AiProviderTransportError(
          'LIMIT_EXCEEDED',
          'Provider response is too large',
        ),
      );
    await expect(
      service.listModels('https://provider.example.com/v1', undefined, 'actor'),
    ).rejects.toThrow('Provider response is too large');
    expect(attempts[0].fail).toHaveBeenCalledTimes(1);
    expect(attempts[0].complete).not.toHaveBeenCalled();
    expect(execution.complete).not.toHaveBeenCalled();
    expect(execution.release).toHaveBeenCalledTimes(1);
  });

  it.each(['begin', 'attempt', 'complete', 'release'])(
    'fails closed for %s ledger persistence errors',
    async (phase) => {
      const { service, ledger, execution } = fixture();
      const raw = new Error('postgres://user:password@private-db/secret');
      if (phase === 'begin') ledger.begin.mockRejectedValueOnce(raw);
      else if (phase === 'attempt')
        execution.beforeAttempt.mockRejectedValueOnce(raw);
      else if (phase === 'complete')
        execution.complete.mockRejectedValueOnce(raw);
      else execution.release.mockRejectedValueOnce(raw);
      jest.mocked(fetchAiProvider).mockResolvedValue(
        new Response('{}', {
          headers: { 'content-type': 'application/json' },
        }),
      );
      jest.mocked(readAiProviderJson).mockResolvedValue({ data: [] });
      await expect(
        service.listModels(
          'https://provider.example.com/v1',
          'secret',
          'actor',
        ),
      ).rejects.toThrow('AI execution storage is unavailable.');
      if (phase === 'begin' || phase === 'attempt')
        expect(fetchAiProvider).not.toHaveBeenCalled();
      else expect(execution.complete).toHaveBeenCalledTimes(1);
      if (phase === 'attempt' || phase === 'complete')
        expect(execution.fail).toHaveBeenCalledWith('failed');
      else expect(execution.fail).not.toHaveBeenCalled();
      expect(execution.release).toHaveBeenCalledTimes(
        phase === 'begin' ? 0 : 1,
      );
    },
  );

  it('does not contact providers or require an operational lease for encrypted configuration CRUD', async () => {
    const row = {
      id: 'provider-1',
      userId: 'actor',
      name: 'Provider',
      model: 'model-a',
      baseUrl: 'https://provider.example.com/v1',
      apiKey: 'encrypted:secret',
      capabilities: {},
      models: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      lastTestedAt: null,
      lastStatus: null,
      lastError: null,
      lastLatencyMs: null,
    };
    const prisma = {
      aiProviderConnection: {
        findMany: jest.fn().mockResolvedValue([row]),
        findFirst: jest.fn().mockResolvedValue(row),
        update: jest.fn().mockResolvedValue(row),
        delete: jest.fn().mockResolvedValue(row),
      },
    };
    const { service, account, ledger } = fixture(prisma, false);
    account.assertEnabled.mockRejectedValue(new ForbiddenException());
    expect((await service.list('actor'))[0]).not.toHaveProperty('apiKey');
    await service.update('actor', 'provider-1', {
      name: 'Provider',
      model: 'model-a',
      baseUrl: row.baseUrl,
      apiKey: 'new-secret',
    });
    expect(prisma.aiProviderConnection.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ apiKey: 'encrypted:new-secret' }),
      }),
    );
    await service.remove('actor', 'provider-1');
    expect(account.assertEnabled).not.toHaveBeenCalled();
    expect(ledger.begin).not.toHaveBeenCalled();
    expect(fetchAiProvider).not.toHaveBeenCalled();
  });
});
