import { SshTunnelService } from './ssh-tunnel.service';
import { validateHost } from '../common/utils/ssrf-validator.util';

const mockConnect = jest.fn();

jest.mock('../common/utils/ssrf-validator.util', () => ({
  validateHost: jest.fn(),
}));

jest.mock('ssh2', () => ({
  Client: class MockSshClient {
    private readonly handlers = new Map<string, (...args: any[]) => void>();

    on(event: string, handler: (...args: any[]) => void) {
      this.handlers.set(event, handler);
      return this;
    }

    connect(config: unknown) {
      mockConnect(config);
      this.handlers.get('error')?.(
        new Error('SSH connect should not run for blocked hosts'),
      );
    }

    forwardOut = jest.fn();
    end = jest.fn();
  },
}));

describe('SshTunnelService SSRF guard', () => {
  let service: SshTunnelService;

  beforeEach(() => {
    jest.clearAllMocks();
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
});
