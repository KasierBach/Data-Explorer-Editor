import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Client as SshClient } from 'ssh2';
import { createServer, Server, Socket } from 'net';
import type { Duplex } from 'stream';
import { validateHost } from '../common/utils/ssrf-validator.util';

export interface SshTunnelConfig {
  sshHost: string;
  sshPort: number;
  sshUsername: string;
  sshPrivateKey?: string;
  sshPassphrase?: string;
  dbHost: string;
  dbPort: number;
}

export interface ActiveTunnel {
  localPort: number;
  server: Server;
  sshClient: SshClient;
}

interface TunnelOwner {
  key: string;
  validation: Promise<boolean>;
  opening: Promise<number>;
  resolve: (port: number) => void;
  reject: (error: Error) => void;
  sshClient?: SshClient;
  server?: Server;
  active?: ActiveTunnel;
  sockets: Set<Duplex>;
  aborted: boolean;
  sshReady: boolean;
  sshClosed: boolean;
  serverClosed: boolean;
  listenSettled: Promise<void>;
  finishListen?: () => void;
  closing?: Promise<void>;
}

@Injectable()
export class SshTunnelService implements OnModuleDestroy {
  private readonly logger = new Logger(SshTunnelService.name);
  private readonly tunnels = new Map<string, ActiveTunnel>();
  private readonly owners = new Map<string, TunnelOwner>();
  private readonly ownedStates = new Set<TunnelOwner>();
  private readonly closures = new Map<string, Promise<void>>();
  private readonly openRequests = new Set<Promise<number>>();
  private shuttingDown = false;
  private shutdownPromise?: Promise<void>;

  private isInternalIp(host: string): boolean {
    const h = host.toLowerCase().trim();
    if (
      h === 'localhost' ||
      h === '127.0.0.1' ||
      h === '::1' ||
      h === '0.0.0.0'
    ) {
      return true;
    }

    // Basic check for RFC1918 and other internal ranges
    // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16 (Link-local)
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const match = h.match(ipv4Regex);
    if (match) {
      const octets = match.slice(1).map(Number);
      if (octets[0] === 10) return true;
      if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return true;
      if (octets[0] === 192 && octets[1] === 168) return true;
      if (octets[0] === 169 && octets[1] === 254) return true;
    }

    return false;
  }

  async openTunnel(key: string, config: SshTunnelConfig): Promise<number> {
    if (this.shuttingDown)
      throw new Error('SSH tunnel service is shutting down.');
    const request = this.openAdmittedTunnel(key, config);
    this.openRequests.add(request);
    try {
      return await request;
    } finally {
      this.openRequests.delete(request);
    }
  }

  assertTunnelOpen(key: string): void {
    const owner = this.owners.get(key);
    if (
      this.shuttingDown ||
      !owner?.active ||
      owner.aborted ||
      this.tunnels.get(key) !== owner.active
    ) {
      throw new Error('SSH tunnel is no longer open.');
    }
  }

  private async openAdmittedTunnel(
    key: string,
    config: SshTunnelConfig,
  ): Promise<number> {
    const existing = this.owners.get(key);
    if (existing) {
      // Preserve validation on every caller, even when an open is coalesced.
      const isSafeTarget = await validateHost(config.dbHost);
      this.assertSafeTarget(config, isSafeTarget);
      if (existing.aborted || this.shuttingDown) {
        throw new Error('SSH tunnel opening was aborted.');
      }
      return existing.opening;
    }

    let resolve!: (port: number) => void;
    let reject!: (error: Error) => void;
    const opening = new Promise<number>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    const owner: TunnelOwner = {
      key,
      validation: Promise.resolve(false),
      opening,
      resolve,
      reject,
      sockets: new Set(),
      aborted: false,
      sshReady: false,
      sshClosed: false,
      serverClosed: false,
      listenSettled: Promise.resolve(),
    };
    // Reserve ownership before the first asynchronous validation/SSH step.
    this.owners.set(key, owner);
    this.ownedStates.add(owner);
    void opening.catch(() => undefined);
    try {
      owner.validation = validateHost(config.dbHost);
      void this.startOwnedTunnel(owner, config).catch((error) => {
        this.failOwnedTunnel(owner, error);
      });
    } catch (error) {
      this.failOwnedTunnel(owner, error);
    }
    return opening;
  }

  private assertSafeTarget(config: SshTunnelConfig, isSafeTarget: boolean) {
    if (!isSafeTarget) {
      throw new Error(
        `Connection to internal host ${config.dbHost} is forbidden for security reasons.`,
      );
    }
  }

  private failOwnedTunnel(owner: TunnelOwner, error: unknown): void {
    const reason = error instanceof Error ? error : new Error(String(error));
    void this.closeOwnedTunnel(owner, reason).catch(() => {
      this.logger.warn(`Could not completely close SSH tunnel ${owner.key}.`);
    });
  }

  private async startOwnedTunnel(owner: TunnelOwner, config: SshTunnelConfig) {
    const isSafeTarget = await owner.validation;
    if (owner.aborted || this.shuttingDown) return;
    this.assertSafeTarget(config, isSafeTarget);
    const sshClient = new SshClient();
    owner.sshClient = sshClient;
    const connConfig: any = {
      host: config.sshHost,
      port: config.sshPort,
      username: config.sshUsername,
    };
    if (config.sshPrivateKey) {
      connConfig.privateKey = Buffer.from(config.sshPrivateKey, 'base64');
      if (config.sshPassphrase) connConfig.passphrase = config.sshPassphrase;
    }

    sshClient.once('ready', () => {
      if (
        owner.aborted ||
        owner.sshClosed ||
        this.owners.get(owner.key) !== owner
      )
        return;
      owner.sshReady = true;
      try {
        const server = createServer((sock) =>
          this.forwardOwnedSocket(owner, config, sock),
        );
        owner.server = server;
        owner.listenSettled = new Promise<void>((resolve) => {
          owner.finishListen = resolve;
        });
        server.on('listening', () => owner.finishListen?.());
        server.on('error', (error) => {
          owner.finishListen?.();
          this.failOwnedTunnel(owner, error);
        });
        server.on('close', () => {
          owner.serverClosed = true;
          owner.finishListen?.();
          if (!owner.aborted) {
            this.failOwnedTunnel(
              owner,
              new Error('SSH tunnel listener closed.'),
            );
          }
        });
        // Bind the owned server directly; probing and releasing a free port
        // first leaves a race with another listener claiming the same port.
        server.listen(0, '127.0.0.1', () => {
          if (owner.aborted || this.owners.get(owner.key) !== owner) return;
          const address = server.address();
          if (!address || typeof address === 'string') {
            this.failOwnedTunnel(
              owner,
              new Error('SSH tunnel has no local port.'),
            );
            return;
          }
          const localPort = address.port;
          owner.active = { localPort, server, sshClient };
          this.tunnels.set(owner.key, owner.active);
          this.logger.log(`SSH tunnel ${owner.key} -> 127.0.0.1:${localPort}`);
          owner.resolve(localPort);
        });
      } catch (error) {
        owner.finishListen?.();
        this.failOwnedTunnel(owner, error);
      }
    });
    sshClient.on('error', (error) => {
      this.logger.error(`SSH tunnel error for ${owner.key}: ${error.message}`);
      this.failOwnedTunnel(owner, error);
    });
    sshClient.on('close', () => {
      owner.sshClosed = true;
      if (!owner.aborted) {
        this.failOwnedTunnel(
          owner,
          new Error('SSH client closed before tunnel completion.'),
        );
      }
    });
    sshClient.on('end', () => {
      if (!owner.aborted) {
        this.failOwnedTunnel(
          owner,
          new Error('SSH client ended before tunnel completion.'),
        );
      }
    });
    try {
      sshClient.connect(connConfig);
    } catch (error) {
      // ssh2 rejects invalid credentials before allocating _sock. destroy()
      // emits no close event then, so there is no client socket to drain.
      if (!(sshClient as SshClient & { _sock?: Socket })._sock) {
        owner.sshClosed = true;
        sshClient.destroy();
      }
      throw error;
    }
  }

  private ownSocket(owner: TunnelOwner, socket: Duplex): void {
    owner.sockets.add(socket);
    socket.once('close', () => owner.sockets.delete(socket));
    socket.on('error', () => socket.destroy());
  }

  private forwardOwnedSocket(
    owner: TunnelOwner,
    config: SshTunnelConfig,
    sock: Socket,
  ): void {
    this.ownSocket(owner, sock);
    if (owner.aborted || !owner.sshClient) {
      sock.destroy();
      return;
    }
    try {
      owner.sshClient.forwardOut(
        sock.remoteAddress || 'localhost',
        sock.remotePort || 0,
        config.dbHost,
        config.dbPort,
        (error, stream) => {
          if (stream) this.ownSocket(owner, stream);
          if (error || owner.aborted || sock.destroyed) {
            sock.destroy();
            stream?.destroy();
            return;
          }
          try {
            sock.pipe(stream).pipe(sock);
          } catch {
            sock.destroy();
            stream?.destroy();
          }
        },
      );
    } catch {
      sock.destroy();
    }
  }

  private closeSocket(socket: Duplex): Promise<void> {
    if (socket.closed) return Promise.resolve();
    return new Promise<void>((resolve) => {
      socket.once('close', () => resolve());
      socket.destroy();
    });
  }

  private closeSshClient(owner: TunnelOwner): Promise<void> {
    const sshClient = owner.sshClient;
    if (!sshClient || owner.sshClosed) return Promise.resolve();
    return new Promise<void>((resolve) => {
      sshClient.once('close', () => {
        owner.sshClosed = true;
        resolve();
      });
      if (owner.sshReady) sshClient.end();
      else sshClient.destroy();
    });
  }

  private closeServer(owner: TunnelOwner): Promise<void> {
    const server = owner.server;
    if (!server || owner.serverClosed) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      server.close((error?: NodeJS.ErrnoException) => {
        if (error && error.code !== 'ERR_SERVER_NOT_RUNNING') reject(error);
        else resolve();
      });
    });
  }

  private closeOwnedTunnel(owner: TunnelOwner, reason: Error): Promise<void> {
    if (owner.closing) return owner.closing;
    owner.aborted = true;
    // Event callbacks capture an owner, not a key lookup that might now point
    // at a replacement. Detach only this owner's cache entries.
    if (this.owners.get(owner.key) === owner) this.owners.delete(owner.key);
    if (owner.active && this.tunnels.get(owner.key) === owner.active) {
      this.tunnels.delete(owner.key);
    }
    const closure = (async () => {
      let closed = false;
      try {
        await owner.validation.catch(() => undefined);
        // A close during listen must wait for its listen/error outcome before
        // closing, otherwise a late listen callback could leave an open server.
        await owner.listenSettled;
        const results = await Promise.allSettled([
          ...[...owner.sockets].map((socket) => this.closeSocket(socket)),
          this.closeSshClient(owner),
          this.closeServer(owner),
        ]);
        for (const result of results) {
          if (result.status === 'rejected') throw result.reason;
        }
        closed = true;
      } finally {
        owner.reject(reason);
        this.ownedStates.delete(owner);
        if (closed) this.logger.log(`SSH tunnel ${owner.key} closed`);
        else
          this.logger.warn(
            `Could not completely close SSH tunnel ${owner.key}.`,
          );
      }
    })();
    owner.closing = closure;
    this.closures.set(owner.key, closure);
    const forget = () => {
      if (this.closures.get(owner.key) === closure)
        this.closures.delete(owner.key);
    };
    void closure.then(forget, forget);
    return closure;
  }

  async closeTunnel(key: string): Promise<void> {
    const owner = this.owners.get(key);
    if (owner) {
      await this.closeOwnedTunnel(
        owner,
        new Error('SSH tunnel opening was aborted.'),
      );
    } else {
      await this.closures.get(key);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.shutdownPromise) return this.shutdownPromise;
    this.shuttingDown = true;
    this.shutdownPromise = (async () => {
      const results = await Promise.allSettled(
        [...this.ownedStates].map((owner) =>
          this.closeOwnedTunnel(
            owner,
            new Error('SSH tunnel service is shutting down.'),
          ),
        ),
      );
      while (this.openRequests.size > 0 || this.closures.size > 0) {
        await Promise.allSettled([
          ...this.openRequests,
          ...this.closures.values(),
        ]);
      }
      for (const result of results) {
        if (result.status === 'rejected') throw result.reason;
      }
    })();
    return this.shutdownPromise;
  }
}
