import { Injectable, Logger } from '@nestjs/common';
import { Client as SshClient } from 'ssh2';
import { createServer, Server } from 'net';

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

@Injectable()
export class SshTunnelService {
  private readonly logger = new Logger(SshTunnelService.name);
  private readonly tunnels = new Map<string, ActiveTunnel>();

  async openTunnel(key: string, config: SshTunnelConfig): Promise<number> {
    const existing = this.tunnels.get(key);
    if (existing) return existing.localPort;

    const localPort = await this.findFreePort();
    const sshClient = new SshClient();

    return new Promise((resolve, reject) => {
      const connConfig: any = {
        host: config.sshHost,
        port: config.sshPort,
        username: config.sshUsername,
      };

      if (config.sshPrivateKey) {
        connConfig.privateKey = Buffer.from(config.sshPrivateKey, 'base64');
        if (config.sshPassphrase) connConfig.passphrase = config.sshPassphrase;
      }

      sshClient.on('ready', () => {
        const server = createServer((sock) => {
          sshClient.forwardOut(
            sock.remoteAddress || 'localhost',
            sock.remotePort || 0,
            config.dbHost,
            config.dbPort,
            (err, stream) => {
              if (err) {
                sock.end();
                return;
              }
              sock.pipe(stream).pipe(sock);
            },
          );
        });

        server.listen(localPort, '127.0.0.1', () => {
          this.tunnels.set(key, { localPort, server, sshClient });
          this.logger.log(`SSH tunnel ${key} -> 127.0.0.1:${localPort}`);
          resolve(localPort);
        });
      });

      sshClient.on('error', (err) => {
        this.logger.error(`SSH tunnel error for ${key}: ${err.message}`);
        reject(err);
      });

      sshClient.connect(connConfig);
    });
  }

  async closeTunnel(key: string): Promise<void> {
    const tunnel = this.tunnels.get(key);
    if (!tunnel) return;

    tunnel.server.close();
    tunnel.sshClient.end();
    this.tunnels.delete(key);
    this.logger.log(`SSH tunnel ${key} closed`);
  }

  private findFreePort(): Promise<number> {
    return new Promise((resolve, reject) => {
      const srv = createServer();
      srv.listen(0, '127.0.0.1', () => {
        const port = (srv.address() as any).port;
        srv.close(() => resolve(port));
      });
      srv.on('error', reject);
    });
  }
}
