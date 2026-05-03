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

  private isInternalIp(host: string): boolean {
    const h = host.toLowerCase().trim();
    if (h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '0.0.0.0') {
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
    if (this.isInternalIp(config.dbHost)) {
      throw new Error(`Connection to internal host ${config.dbHost} is forbidden for security reasons.`);
    }

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
