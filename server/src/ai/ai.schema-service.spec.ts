import { AiSchemaService } from './ai.schema-service';
import { ForbiddenException } from '@nestjs/common';
import type { ChatParams } from './ai.types';

function fixture() {
  const cacheManager = {
    get: jest.fn(),
    set: jest.fn().mockResolvedValue(undefined),
  };
  const providerRunner = {
    isGeminiAvailable: jest.fn().mockReturnValue(true),
    completeGeminiText: jest.fn().mockResolvedValue(''),
  };
  const beforeProviderRequest = jest.fn().mockResolvedValue(undefined);
  const beforeProviderAttempt = jest.fn().mockResolvedValue(undefined);
  const signal = new AbortController().signal;
  const execution = { generationId: 'owned', beforeAttempt: jest.fn() };
  const request: Pick<
    ChatParams,
    | 'signal'
    | 'deadlineAt'
    | 'execution'
    | 'beforeProviderAttempt'
    | 'requestScopeKey'
  > = {
    signal,
    deadlineAt: Date.now() + 1_500,
    execution,
    beforeProviderAttempt,
    requestScopeKey: JSON.stringify(['actor', 'connection', 'app']),
  };
  const service = new AiSchemaService(
    cacheManager as never,
    {} as never,
    providerRunner as never,
  );
  return {
    cacheManager,
    providerRunner,
    beforeProviderRequest,
    beforeProviderAttempt,
    request,
    service,
  };
}

describe('AiSchemaService', () => {
  it('caches an empty semantic result instead of calling the provider again', async () => {
    const f = fixture();
    let cached: string[] | undefined;
    f.cacheManager.get.mockImplementation(async () => cached);
    f.cacheManager.set.mockImplementation(
      async (_key: string, value: string[]) => {
        cached = value;
      },
    );
    await expect(
      f.service.suggestTablesBySemantic(
        'missing',
        ['users'],
        f.beforeProviderRequest,
        f.request,
      ),
    ).resolves.toEqual([]);
    await expect(
      f.service.suggestTablesBySemantic(
        'missing',
        ['users'],
        f.beforeProviderRequest,
        f.request,
      ),
    ).resolves.toEqual([]);
    expect(f.providerRunner.completeGeminiText).toHaveBeenCalledTimes(1);
    expect(f.beforeProviderRequest).toHaveBeenCalledTimes(3);
  });

  it('default-denies semantic calls without server-owned authorization and execution capabilities', async () => {
    const f = fixture();
    await expect(
      f.service.suggestTablesBySemantic('people', ['private_users']),
    ).resolves.toEqual([]);
    await expect(
      f.service.suggestTablesBySemantic(
        'people',
        ['private_users'],
        f.beforeProviderRequest,
        { ...f.request, beforeProviderAttempt: undefined },
      ),
    ).resolves.toEqual([]);
    expect(f.cacheManager.get).not.toHaveBeenCalled();
    expect(f.providerRunner.completeGeminiText).not.toHaveBeenCalled();
  });

  it('checks account/connection consent before cache and rechecks provider approval before dispatch', async () => {
    const f = fixture();
    const denied = new ForbiddenException({ reason: 'AI_EGRESS_DENIED' });
    f.beforeProviderRequest.mockRejectedValueOnce(denied);
    await expect(
      f.service.suggestTablesBySemantic(
        'people',
        ['users'],
        f.beforeProviderRequest,
        f.request,
      ),
    ).rejects.toBe(denied);
    expect(f.cacheManager.get).not.toHaveBeenCalled();
    f.beforeProviderAttempt.mockRejectedValueOnce(denied);
    await expect(
      f.service.suggestTablesBySemantic(
        'people',
        ['users'],
        f.beforeProviderRequest,
        f.request,
      ),
    ).rejects.toBe(denied);
    expect(f.beforeProviderAttempt).toHaveBeenCalledWith({
      provider: 'gemini',
      model: 'gemini-2.5-flash',
    });
    expect(f.providerRunner.completeGeminiText).not.toHaveBeenCalled();
  });

  it('forwards trusted scope, lifetime, execution and fresh hooks while sending table names only', async () => {
    const f = fixture();
    f.providerRunner.completeGeminiText.mockResolvedValue('users, unknown');
    await expect(
      f.service.suggestTablesBySemantic(
        'people',
        ['users'],
        f.beforeProviderRequest,
        f.request,
      ),
    ).resolves.toEqual(['users']);
    const params = f.providerRunner.completeGeminiText.mock.calls[0][0];
    expect(params).toMatchObject({
      ...f.request,
      beforeProviderRequest: f.beforeProviderRequest,
    });
    expect(params.execution).toBe(f.request.execution);
    expect(params.prompt).toContain('TABLES:\nusers');
    expect(params.schemaContext).toBeUndefined();
    expect(params.prompt).not.toContain('CREATE TABLE');
    expect(f.beforeProviderAttempt.mock.invocationCallOrder[0]).toBeLessThan(
      f.providerRunner.completeGeminiText.mock.invocationCallOrder[0],
    );
  });

  it('isolates semantic cache keys by authenticated connection/database scope', async () => {
    const f = fixture();
    await f.service.suggestTablesBySemantic(
      'people',
      ['users'],
      f.beforeProviderRequest,
      f.request,
    );
    await f.service.suggestTablesBySemantic(
      'people',
      ['users'],
      f.beforeProviderRequest,
      {
        ...f.request,
        requestScopeKey: JSON.stringify(['actor', 'connection', 'other-db']),
      },
    );
    expect(f.cacheManager.get.mock.calls[0][0]).not.toBe(
      f.cacheManager.get.mock.calls[1][0],
    );
  });

  it('propagates provider failure for owned semantic generations so callers record failure', async () => {
    const f = fixture();
    const error = Object.assign(new Error('ledger secret'), {
      aiRequestFatal: true,
    });
    f.providerRunner.completeGeminiText.mockRejectedValueOnce(error);
    await expect(
      f.service.suggestTablesBySemantic(
        'people',
        ['users'],
        f.beforeProviderRequest,
        f.request,
      ),
    ).rejects.toBe(error);
    expect(f.cacheManager.set).not.toHaveBeenCalled();
  });

  it('does not read cache or dispatch after cancellation', async () => {
    const f = fixture();
    const controller = new AbortController();
    controller.abort();
    await expect(
      f.service.suggestTablesBySemantic(
        'people',
        ['users'],
        f.beforeProviderRequest,
        { ...f.request, signal: controller.signal },
      ),
    ).rejects.toThrow();
    expect(f.cacheManager.get).not.toHaveBeenCalled();
    expect(f.providerRunner.completeGeminiText).not.toHaveBeenCalled();
  });
});
