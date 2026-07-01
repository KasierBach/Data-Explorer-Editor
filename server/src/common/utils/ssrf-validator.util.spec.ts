import * as dns from 'dns';
import { validateExternalUrl, validateHost } from './ssrf-validator.util';

jest.mock('dns', () => ({
  lookup: jest.fn(),
  resolveSrv: jest.fn(),
}));

const lookupMock = dns.lookup as unknown as jest.Mock;
const resolveSrvMock = dns.resolveSrv as unknown as jest.Mock;

function mockLookupAddresses(
  addresses: Array<{ address: string; family: 4 | 6 }>,
) {
  lookupMock.mockImplementation(
    (
      _host: string,
      optionsOrCallback:
        | { all?: boolean }
        | ((error: Error | null, result: unknown) => void),
      maybeCallback?: (error: Error | null, result: unknown) => void,
    ) => {
      const options =
        typeof optionsOrCallback === 'function' ? undefined : optionsOrCallback;
      const callback =
        typeof optionsOrCallback === 'function'
          ? optionsOrCallback
          : maybeCallback;

      if (!callback) return;
      callback(null, options?.all ? addresses : addresses[0]);
    },
  );
}

describe('validateHost', () => {
  const originalAllowInternalIps = process.env.ALLOW_INTERNAL_IPS;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.ALLOW_INTERNAL_IPS;
    process.env.NODE_ENV = 'production';
    resolveSrvMock.mockImplementation(
      (
        _host: string,
        callback: (error: Error | null, records: dns.SrvRecord[]) => void,
      ) => callback(null, []),
    );
  });

  afterAll(() => {
    process.env.ALLOW_INTERNAL_IPS = originalAllowInternalIps;
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('rejects hostnames when any resolved address is private', async () => {
    mockLookupAddresses([
      { address: '93.184.216.34', family: 4 },
      { address: '10.0.0.5', family: 4 },
    ]);

    await expect(validateHost('db.example.com')).resolves.toBe(false);
  });

  it('accepts hostnames only when every resolved address is public', async () => {
    mockLookupAddresses([
      { address: '93.184.216.34', family: 4 },
      { address: '2606:2800:220:1:248:1893:25c8:1946', family: 6 },
    ]);

    await expect(validateHost('db.example.com')).resolves.toBe(true);
  });

  it('rejects provider URLs that resolve to private addresses', async () => {
    mockLookupAddresses([{ address: '10.0.0.5', family: 4 }]);

    await expect(
      validateExternalUrl('https://provider.example.com/v1'),
    ).resolves.toBe(false);
  });

  it('rejects non-https provider URLs in production', async () => {
    mockLookupAddresses([{ address: '93.184.216.34', family: 4 }]);

    await expect(
      validateExternalUrl('http://provider.example.com/v1'),
    ).resolves.toBe(false);
    expect(lookupMock).not.toHaveBeenCalled();
  });
});
