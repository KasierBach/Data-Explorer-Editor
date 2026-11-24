import { Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { RedisService } from './redis.service';

jest.mock('@nestjs/config', () => ({ ConfigService: class {} }));
jest.mock('ioredis', () => ({ __esModule: true, default: jest.fn() }));

const dummyUrl = 'redis://unit.invalid:0';

function createClientMock() {
  const state = {
    manuallyClosing: false,
    socketClosed: false,
    reconnectAttempts: 0,
  };
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  const stopReconnect = () => {
    state.manuallyClosing = true;
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = undefined;
  };
  const startReconnect = () => {
    retryTimer = setTimeout(() => {
      if (state.manuallyClosing) return;
      state.reconnectAttempts++;
      startReconnect();
    }, 200);
  };
  const client = {
    state,
    stopReconnect,
    startReconnect,
    on: jest.fn().mockReturnThis(),
    quit: jest.fn(async () => {
      stopReconnect();
      state.socketClosed = true;
      return 'OK';
    }),
    disconnect: jest.fn((reconnect = false) => {
      if (!reconnect) stopReconnect();
      state.socketClosed = true;
    }),
  };
  return client;
}

describe('RedisService owned shutdown', () => {
  let service: RedisService;
  let client: ReturnType<typeof createClientMock>;
  let logError: jest.SpyInstance;
  const clients: ReturnType<typeof createClientMock>[] = [];
  const deferredQuitReleases = new Set<() => void>();
  const constructorMock = Redis as unknown as jest.Mock;
  const configMock = { get: jest.fn().mockReturnValue(dummyUrl) };

  function createService(ownedClient = createClientMock()) {
    clients.push(ownedClient);
    constructorMock.mockReturnValueOnce(ownedClient);
    const instance = new RedisService(configMock as any);
    instance.onModuleInit();
    ownedClient.startReconnect();
    return instance;
  }

  function observe<T>(promise: Promise<T>) {
    return promise.then(
      (value) => ({ status: 'fulfilled' as const, value }),
      (reason: unknown) => ({ status: 'rejected' as const, reason }),
    );
  }

  async function flush() {
    for (let index = 0; index < 20; index++) await Promise.resolve();
  }

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    logError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});
    client = createClientMock();
    service = createService(client);
  });

  afterEach(async () => {
    // Release only mock work started by the old implementation during RED.
    for (const release of deferredQuitReleases) release();
    deferredQuitReleases.clear();
    for (const ownedClient of clients) ownedClient.stopReconnect();
    clients.length = 0;
    await flush();
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('does not let a rejected QUIT abandon remaining teardown or reconnect indefinitely', async () => {
    client.quit.mockRejectedValue(new Error('QUIT unavailable'));
    const laterCleanup = jest.fn().mockResolvedValue(undefined);
    const teardown = async () => {
      await service.onModuleDestroy();
      await laterCleanup();
    };

    expect((await observe(teardown())).status).toBe('fulfilled');
    expect(laterCleanup).toHaveBeenCalledTimes(1);
    expect(client.quit).not.toHaveBeenCalled();
    expect(client.disconnect).toHaveBeenCalledWith(false);
    expect(client.state.manuallyClosing).toBe(true);
    expect(client.state.socketClosed).toBe(true);
    jest.advanceTimersByTime(20_000);
    expect(client.state.reconnectAttempts).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('finishes destruction before a deferred QUIT acknowledgement without creating pending command work', async () => {
    client.quit.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          deferredQuitReleases.add(() => resolve('OK'));
        }),
    );
    let settled = false;
    const shutdown = observe(service.onModuleDestroy()).then((result) => {
      settled = true;
      return result;
    });
    await flush();

    expect(settled).toBe(true);
    expect((await shutdown).status).toBe('fulfilled');
    expect(client.quit).not.toHaveBeenCalled();
    expect(deferredQuitReleases.size).toBe(0);
    expect(client.disconnect).toHaveBeenCalledTimes(1);
    expect(client.state.manuallyClosing).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('disconnects an owned client only once across simultaneous and repeated destroy hooks', async () => {
    await Promise.all([service.onModuleDestroy(), service.onModuleDestroy()]);
    await service.onModuleDestroy();

    expect(client.disconnect).toHaveBeenCalledTimes(1);
    expect(client.disconnect).toHaveBeenCalledWith(false);
    expect(client.quit).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('reports a local disconnect failure without leaking driver details or skipping later cleanup', async () => {
    client.disconnect.mockImplementationOnce(() => {
      // ioredis stops reconnect before invoking its connector's disconnect.
      client.stopReconnect();
      throw new Error('untrusted driver details');
    });
    const laterCleanup = jest.fn().mockResolvedValue(undefined);
    const teardown = async () => {
      await service.onModuleDestroy();
      await laterCleanup();
    };

    expect((await observe(teardown())).status).toBe('fulfilled');
    expect(laterCleanup).toHaveBeenCalledTimes(1);
    expect(logError).toHaveBeenCalledWith(
      'Failed to disconnect owned Redis client during shutdown.',
    );
    // Report a failed disconnect, rather than claim that socket closure succeeded.
    expect(client.state.socketClosed).toBe(false);
    expect(client.state.manuallyClosing).toBe(true);
    jest.advanceTimersByTime(20_000);
    expect(client.state.reconnectAttempts).toBe(0);
    await service.onModuleDestroy();
    expect(client.disconnect).toHaveBeenCalledTimes(1);
    expect(logError).toHaveBeenCalledTimes(1);
  });

  it('does not disconnect another service instance or its reconnect work', async () => {
    const otherClient = createClientMock();
    const otherService = createService(otherClient);
    await service.onModuleDestroy();

    expect(otherClient.disconnect).not.toHaveBeenCalled();
    expect(otherClient.quit).not.toHaveBeenCalled();
    expect(otherClient.state.manuallyClosing).toBe(false);
    expect(otherService.getClient()).toBe(otherClient);
    jest.advanceTimersByTime(200);
    expect(client.state.reconnectAttempts).toBe(0);
    expect(otherClient.state.reconnectAttempts).toBe(1);
    await otherService.onModuleDestroy();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('handles destruction before initialization and closes a later owned client independently', async () => {
    const uninitialized = new RedisService(configMock as any);
    await expect(uninitialized.onModuleDestroy()).resolves.toBeUndefined();
    expect(client.disconnect).not.toHaveBeenCalled();

    await service.onModuleDestroy();
    const replacement = createClientMock();
    clients.push(replacement);
    constructorMock.mockReturnValueOnce(replacement);
    service.onModuleInit();
    replacement.startReconnect();
    await service.onModuleDestroy();

    expect(client.disconnect).toHaveBeenCalledTimes(1);
    expect(replacement.disconnect).toHaveBeenCalledTimes(1);
    expect(replacement.disconnect).toHaveBeenCalledWith(false);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('retains startup timeouts and retries while using only the dummy mocked URL', () => {
    expect(constructorMock).toHaveBeenCalledWith(
      dummyUrl,
      expect.objectContaining({
        commandTimeout: 5_000,
        connectTimeout: 5_000,
        maxRetriesPerRequest: 1,
        enableReadyCheck: true,
        retryStrategy: expect.any(Function),
      }),
    );
    expect(configMock.get).toHaveBeenCalledWith('REDIS_URL');
    expect(client.disconnect).not.toHaveBeenCalled();
  });
});
