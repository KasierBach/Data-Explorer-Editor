import { EventEmitter } from 'events';
import { SshTunnelService } from './ssh-tunnel.service';
import { validateHost } from '../common/utils/ssrf-validator.util';

const mockClients: any[] = [];
const mockServers: any[] = [];
const mockDeferredReleases = new Set<() => void>();
let mockAutoListen = true;
let mockAutoClose = true;
let mockConnectError: Error | undefined;
let mockConnectHasSocket = false;
let mockSilentDestroy = false;

jest.mock('../common/utils/ssrf-validator.util', () => ({
  validateHost: jest.fn(),
}));
jest.mock('ssh2', () => {
  const { EventEmitter: Emitter } = jest.requireActual('events');
  return {
    Client: class extends Emitter {
      constructor() {
        super();
        mockClients.push(this);
      }
      _sock?: object;
      connect = jest.fn(() => {
        if (mockConnectError) {
          if (mockConnectHasSocket) this._sock = {};
          throw mockConnectError;
        }
        return this;
      });
      end = jest.fn(() => {
        queueMicrotask(() => this.emit('close'));
        return this;
      });
      destroy = jest.fn(() => {
        if (!mockSilentDestroy) queueMicrotask(() => this.emit('close'));
        return this;
      });
      forwardOut = jest.fn();
    },
  };
});
jest.mock('net', () => {
  const { EventEmitter: Emitter } = jest.requireActual('events');
  return {
    createServer: jest.fn((connectionHandler?: (...args: any[]) => void) => {
      const server = new Emitter();
      const index = mockServers.length;
      Object.assign(server, {
        connectionHandler,
        listening: false,
        address: () => ({ port: 15432 + index }),
        finishListen: () => {
          server.listening = true;
          server.emit('listening');
          server.listeningCallback?.();
        },
        finishClose: () => {
          server.listening = false;
          server.emit('close');
          server.closeCallback?.();
        },
        listen: jest.fn(
          (_port: number, _host: string, callback?: () => void) => {
            server.listeningCallback = callback;
            // The legacy free-port probe is mocked as well as the actual listener.
            if (mockAutoListen || !connectionHandler)
              queueMicrotask(server.finishListen);
            return server;
          },
        ),
        close: jest.fn((callback?: () => void) => {
          server.closeCallback = callback;
          if (mockAutoClose) queueMicrotask(server.finishClose);
          return server;
        }),
      });
      mockServers.push(server);
      return server;
    }),
  };
});

describe('SshTunnelService lifecycle races (mock sockets only)', () => {
  let service: SshTunnelService;
  const config = {
    sshHost: 'ssh.example.com',
    sshPort: 22,
    sshUsername: 'deploy',
    dbHost: 'db.example.com',
    dbPort: 5432,
  };

  function observe<T>(promise: Promise<T>) {
    return promise.then(
      (value) => ({ status: 'fulfilled' as const, value }),
      (reason) => ({ status: 'rejected' as const, reason }),
    );
  }

  async function flush() {
    for (let i = 0; i < 30; i++) await Promise.resolve();
  }

  async function ready(key = 'key') {
    const opening = service.openTunnel(key, config);
    await flush();
    const client = mockClients[mockClients.length - 1];
    expect(client).toBeDefined();
    client.emit('ready');
    await opening;
    return {
      client,
      server: mockServers.findLast((item) => item.connectionHandler),
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockClients.length = 0;
    mockServers.length = 0;
    mockAutoListen = true;
    mockAutoClose = true;
    mockConnectError = undefined;
    mockConnectHasSocket = false;
    mockSilentDestroy = false;
    (validateHost as jest.Mock).mockResolvedValue(true);
    service = new SshTunnelService();
  });

  afterEach(async () => {
    for (const release of mockDeferredReleases) release();
    mockDeferredReleases.clear();
    mockAutoClose = true;
    for (const server of mockServers) server.finishClose();
    for (const client of mockClients) client.emit('close');
    await Promise.all(
      ['key', 'replacement'].map((key) => service.closeTunnel(key)),
    );
    await service.onModuleDestroy();
  });

  it('coalesces concurrent opens before host validation resolves', async () => {
    let allow!: (value: boolean) => void;
    (validateHost as jest.Mock).mockReturnValueOnce(
      new Promise<boolean>((resolve) => {
        allow = resolve;
      }),
    );
    const first = observe(service.openTunnel('key', config));
    const second = observe(service.openTunnel('key', config));
    allow(true);
    await flush();

    expect(mockClients).toHaveLength(1);
    mockClients[0].emit('ready');
    expect((await first).status).toBe('fulfilled');
    expect((await second).status).toBe('fulfilled');
  });

  it('aborts a pending host validation without opening an SSH client', async () => {
    let allow!: (value: boolean) => void;
    (validateHost as jest.Mock).mockReturnValueOnce(
      new Promise<boolean>((resolve) => {
        allow = resolve;
      }),
    );
    const opening = observe(service.openTunnel('key', config));
    const closing = service.closeTunnel('key');
    allow(true);
    await closing;
    await flush();

    expect(mockClients).toHaveLength(0);
    expect((await opening).status).toBe('rejected');
  });

  it('rejects an aborted handshake and ignores a late ready event', async () => {
    const opening = observe(service.openTunnel('key', config));
    await flush();
    const client = mockClients[0];
    expect(client).toBeDefined();
    await service.closeTunnel('key');
    client.emit('ready');
    await flush();

    expect((await opening).status).toBe('rejected');
    expect(
      client.end.mock.calls.length + client.destroy.mock.calls.length,
    ).toBe(1);
    expect(mockServers.filter((item) => item.connectionHandler)).toHaveLength(
      0,
    );
  });

  it('rejects synchronous SSH configuration failure without waiting for a nonexistent socket close', async () => {
    mockConnectError = new Error('Cannot parse privateKey');
    mockSilentDestroy = true;
    const opening = observe(service.openTunnel('key', config));
    let result: any;
    void opening.then((value) => {
      result = value;
    });
    await flush();

    expect(result?.status).toBe('rejected');
    expect(result.reason).toBe(mockConnectError);
    expect(mockClients[0].destroy).toHaveBeenCalledTimes(1);
    expect(mockServers).toHaveLength(0);
    mockClients[0].emit('ready');
    await flush();
    expect((service as any).tunnels.size).toBe(0);
  });

  it('still drains a socket allocated before a synchronous connect failure', async () => {
    mockConnectError = new Error('socket connect failed');
    mockConnectHasSocket = true;
    mockSilentDestroy = true;
    const opening = observe(service.openTunnel('key', config));
    let settled = false;
    void opening.then(() => {
      settled = true;
    });
    await flush();

    expect(settled).toBe(false);
    expect(mockClients[0].destroy).toHaveBeenCalledTimes(1);
    mockClients[0].emit('close');
    expect((await opening).status).toBe('rejected');
  });

  it.each(['forward', 'pipe'])(
    'contains synchronous %s failure to the owned forwarding sockets',
    async (failure) => {
      const active = await ready();
      const socket: any = new EventEmitter();
      socket.pipe = jest.fn().mockImplementation(() => {
        throw new Error('pipe failed');
      });
      socket.destroy = jest.fn(() => socket.emit('close'));
      const stream: any = new EventEmitter();
      stream.destroy = jest.fn(() => stream.emit('close'));
      if (failure === 'forward') {
        active.client.forwardOut.mockImplementation(() => {
          throw new Error('not connected');
        });
      } else {
        active.client.forwardOut.mockImplementation(
          (_a: any, _b: any, _c: any, _d: any, callback: any) =>
            callback(undefined, stream),
        );
      }

      expect(() => active.server.connectionHandler(socket)).not.toThrow();
      expect(socket.destroy).toHaveBeenCalledTimes(1);
      if (failure === 'pipe') expect(stream.destroy).toHaveBeenCalledTimes(1);
      expect(active.client.end).not.toHaveBeenCalled();
      expect(active.server.close).not.toHaveBeenCalled();
    },
  );

  it.each(['error', 'close', 'end'])(
    'rejects %s before readiness and closes its own client',
    async (event) => {
      const opening = observe(service.openTunnel('key', config));
      await flush();
      const client = mockClients[0];
      client.emit(event, new Error('handshake failed'));
      await flush();

      let result: any;
      void opening.then((value) => {
        result = value;
      });
      await flush();
      expect(result?.status).toBe('rejected');
      expect((service as any).tunnels.size).toBe(0);
      if (event === 'error')
        expect(
          client.end.mock.calls.length + client.destroy.mock.calls.length,
        ).toBe(1);
    },
  );

  it('rejects listener errors and drains the listener and SSH client', async () => {
    mockAutoListen = false;
    const opening = observe(service.openTunnel('key', config));
    await flush();
    const client = mockClients[0];
    client.emit('ready');
    await flush();
    const server = mockServers.find((item) => item.connectionHandler);
    expect(server).toBeDefined();
    // Existing code has no listener error handler; assert before emitting.
    expect(server.listenerCount('error')).toBeGreaterThan(0);
    server.emit('error', new Error('EADDRINUSE'));
    expect((await opening).status).toBe('rejected');
    expect(server.close).toHaveBeenCalledTimes(1);
    expect(
      client.end.mock.calls.length + client.destroy.mock.calls.length,
    ).toBe(1);
    expect((service as any).tunnels.size).toBe(0);
  });

  it('waits for listen cancellation and never publishes a late listener', async () => {
    mockAutoListen = false;
    const opening = observe(service.openTunnel('key', config));
    await flush();
    const client = mockClients[0];
    client.emit('ready');
    await flush();
    const server = mockServers.find((item) => item.connectionHandler);
    const closing = service.closeTunnel('key');
    server.finishListen();
    await closing;
    await flush();

    expect((await opening).status).toBe('rejected');
    expect((service as any).tunnels.size).toBe(0);
    expect(server.close).toHaveBeenCalledTimes(1);
    expect(
      client.end.mock.calls.length + client.destroy.mock.calls.length,
    ).toBe(1);
  });

  it('awaits idempotent close and destroys only owned forwarding sockets', async () => {
    const { client, server } = await ready();
    const socket: any = new EventEmitter();
    socket.remoteAddress = '127.0.0.1';
    socket.remotePort = 42000;
    socket.pipe = jest.fn().mockReturnThis();
    socket.destroy = jest.fn(() => socket.emit('close'));
    socket.end = jest.fn();
    const stream: any = new EventEmitter();
    stream.pipe = jest.fn().mockReturnThis();
    stream.destroy = jest.fn(() => stream.emit('close'));
    client.forwardOut.mockImplementation(
      (_a: any, _b: any, _c: any, _d: any, callback: any) =>
        callback(undefined, stream),
    );
    server.connectionHandler(socket);
    const unrelatedSocket = { destroy: jest.fn() };
    mockAutoClose = false;
    let finished = false;
    const closing = service.closeTunnel('key').then(() => {
      finished = true;
    });
    const again = service.closeTunnel('key');
    await flush();

    expect(finished).toBe(false);
    expect(socket.destroy).toHaveBeenCalledTimes(1);
    expect(stream.destroy).toHaveBeenCalledTimes(1);
    expect(unrelatedSocket.destroy).not.toHaveBeenCalled();
    server.finishClose();
    await Promise.all([closing, again]);
    expect(server.close).toHaveBeenCalledTimes(1);
    expect(
      client.end.mock.calls.length + client.destroy.mock.calls.length,
    ).toBe(1);
  });

  it('preserves host validation for a warm tunnel without closing its authorized owner', async () => {
    const active = await ready();
    (validateHost as jest.Mock).mockResolvedValueOnce(false);
    await expect(
      service.openTunnel('key', { ...config, dbHost: 'blocked.example.com' }),
    ).rejects.toThrow(/forbidden/i);
    expect((service as any).tunnels.get('key').sshClient).toBe(active.client);
    expect(active.server.close).not.toHaveBeenCalled();
  });

  it('drains a coalesced validation request on shutdown and gates later opens', async () => {
    const active = await ready();
    let allow!: (value: boolean) => void;
    (validateHost as jest.Mock).mockReturnValueOnce(
      new Promise<boolean>((resolve) => {
        allow = resolve;
      }),
    );
    const joining = observe(service.openTunnel('key', config));
    mockDeferredReleases.add(() => allow(true));
    let drained = false;
    const shutdown = service.onModuleDestroy().then(() => {
      drained = true;
    });
    await flush();

    expect(drained).toBe(false);
    await expect(service.openTunnel('replacement', config)).rejects.toThrow(
      /shutting down/i,
    );
    allow(true);
    await shutdown;
    expect((await joining).status).toBe('rejected');
    expect(active.server.close).toHaveBeenCalledTimes(1);
    expect(mockClients).toHaveLength(1);
  });

  it('waits for every owned close even if one close reports an error', async () => {
    const active = await ready();
    active.client.end.mockImplementation(() => active.client);
    active.server.close.mockImplementation(
      (callback: (error: Error) => void) => {
        queueMicrotask(() => callback(new Error('listener close failed')));
        return active.server;
      },
    );
    let settled = false;
    const closing = observe(service.closeTunnel('key')).then((result) => {
      settled = true;
      return result;
    });
    await flush();

    expect(settled).toBe(false);
    active.client.emit('close');
    expect((await closing).status).toBe('rejected');
  });

  it('keeps a replacement alive while the previous listener is still closing', async () => {
    const old = await ready();
    mockAutoClose = false;
    const closing = service.closeTunnel('key');
    await flush();
    const replacement = await ready();
    old.client.emit('error', new Error('stale error during close'));
    old.server.finishClose();
    await closing;

    expect((service as any).tunnels.get('key').sshClient).toBe(
      replacement.client,
    );
    expect(replacement.server.close).not.toHaveBeenCalled();
    expect(replacement.client.end).not.toHaveBeenCalled();
  });

  it('does not let late errors or close events from the old client close a replacement', async () => {
    const old = await ready();
    await service.closeTunnel('key');
    const replacement = await ready();
    old.client.emit('error', new Error('late old error'));
    old.client.emit('close');
    old.server.emit('close');
    await flush();

    expect((service as any).tunnels.get('key').sshClient).toBe(
      replacement.client,
    );
    expect(replacement.server.close).not.toHaveBeenCalled();
    expect(replacement.client.end).not.toHaveBeenCalled();
    expect(replacement.client.destroy).not.toHaveBeenCalled();
  });

  it('rejects active listener closure and recreates the key without leaking the old client', async () => {
    const old = await ready();
    old.server.emit('close');
    await flush();

    expect((service as any).tunnels.size).toBe(0);
    expect(
      old.client.end.mock.calls.length + old.client.destroy.mock.calls.length,
    ).toBe(1);
    const replacement = await ready();
    expect(replacement.client).not.toBe(old.client);
  });
});
