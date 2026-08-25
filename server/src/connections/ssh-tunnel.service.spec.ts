import { SshTunnelService } from './ssh-tunnel.service';
import { validateHost } from '../common/utils/ssrf-validator.util';

const mockConnect = jest.fn();
let latestClient: {
  emit: (event: string, ...args: unknown[]) => void;
} | null = null;
let emitConnectError = false;

jest.mock('../common/utils/ssrf-validator.util', () => ({
  validateHost: jest.fn(),
}));

jest.mock('ssh2', () => ({
  Client: class MockSshClient {
    private readonly handlers = new Map<string, (...args: any[]) => void>();

    on(event: string, handler: (...args: any[]) => void) {
      this.handlers.set(event, handler);
      latestClient = {
        emit: (eventName, ...args) => this.handlers.get(eventName)?.(...args),
      };
      return this;
    }

    connect(config: unknown) {
      mockConnect(config);
      if (emitConnectError) {
        this.handlers.get('error')?.(
          new Error('SSH connect should not run for blocked hosts'),
        );
      }
    }

    emit(event: string, ...args: unknown[]) {
      this.handlers.get(event)?.(...args);
    }

    forwardOut = jest.fn();
    end = jest.fn();
  },
}));

describe('SshTunnelService SSRF guard', () => {
  let service: SshTunnelService;

  beforeEach(() => {
    jest.clearAllMocks();
    latestClient = null;
    emitConnectError = false;
    service = new SshTunnelService();
  });

  it('rejects tunnel destinations whose hostnames resolve to internal networks', async () => {
    (validateHost as jest.Mock).mockResolvedValueOnce(false);

    await expect(
      service.openTunnel('pool-key', {
        sshHost: 'ssh.example.com',
        sshPort: 22,
        sshUsername: 'deploy',
        dbHost: 'db.internal.example',
        dbPort: 5432,
      }),
    ).rejects.toThrow(/forbidden/i);

    expect(validateHost).toHaveBeenCalledWith('db.internal.example');
    expect(mockConnect).not.toHaveBeenCalled();
  });

  it('does not keep a dead tunnel cached after the SSH client errors', async () => {
    (validateHost as jest.Mock).mockResolvedValue(true);
    const opening = service.openTunnel('pool-key', {
      sshHost: 'ssh.example.com',
      sshPort: 22,
      sshUsername: 'deploy',
      dbHost: 'db.example.com',
      dbPort: 5432,
    });

    await new Promise((resolve) => setImmediate(resolve));
    latestClient?.emit('ready');
    await opening;
    latestClient?.emit('error', new Error('connection lost'));

    emitConnectError = true;
    await expect(
      service.openTunnel('pool-key', {
        sshHost: 'ssh.example.com',
        sshPort: 22,
        sshUsername: 'deploy',
        dbHost: 'db.example.com',
        dbPort: 5432,
      }),
    ).rejects.toThrow(/blocked hosts/i);
    expect(mockConnect).toHaveBeenCalledTimes(2);
  });
});
