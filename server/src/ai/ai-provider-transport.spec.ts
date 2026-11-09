import * as http from 'node:http';
import dns from 'node:dns';
import https from 'node:https';
import { EventEmitter } from 'node:events';
import type { AddressInfo } from 'node:net';
import {
  fetchAiProvider,
  readAiProviderJson,
  validateAiProviderUrl,
} from './ai-provider-transport';

async function localFixture(handler: http.RequestListener) {
  const server = http.createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    origin,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}

describe('AI pinned provider transport', () => {
  afterEach(() => jest.restoreAllMocks());
  it.each([
    'http://127.0.0.1:80/v1',
    'https://127.0.0.1/v1',
    'https://[::ffff:7f00:1]/v1',
    'https://100.64.0.1/v1',
    'https://user:secret@provider.example/v1',
    'https://provider.example/path\nunsafe',
    'https://[2001:db8::1]/v1',
    'file:///etc/passwd',
  ])('rejects unsafe destination without dialing %s', (url) => {
    expect(() => validateAiProviderUrl(url)).toThrow();
  });

  it('rejects a mixed public/private DNS answer without constructing a request', async () => {
    jest.spyOn(dns, 'lookup').mockImplementation(((
      _host: string,
      _options: unknown,
      callback: (...args: unknown[]) => void,
    ) => {
      callback(null, [
        { address: '8.8.8.8', family: 4 },
        { address: '127.0.0.1', family: 4 },
      ]);
    }) as typeof dns.lookup);
    const request = jest.spyOn(https, 'request').mockImplementation(() => {
      throw new Error('Network must not be reached');
    });
    await expect(
      fetchAiProvider('https://fixture.example/v1', {
        headers: { authorization: 'Bearer secret' },
      }),
    ).rejects.toThrow('Unsafe provider address');
    expect(request).not.toHaveBeenCalled();
  });

  it('pins one admitted DNS result while preserving host, SNI and certificate verification', async () => {
    const lookup = jest.spyOn(dns, 'lookup').mockImplementation(((
      _host: string,
      _options: unknown,
      callback: (...args: unknown[]) => void,
    ) => {
      callback(null, [{ address: '8.8.8.8', family: 4 }]);
    }) as typeof dns.lookup);
    const controller = new AbortController();
    let captured: https.RequestOptions | undefined;
    const nativeRequest = Object.assign(new EventEmitter(), {
      destroy: jest.fn(),
      end: jest.fn(),
    });
    jest.spyOn(https, 'request').mockImplementation(((
      options: https.RequestOptions,
    ) => {
      captured = options;
      return nativeRequest;
    }) as unknown as typeof https.request);
    const pending = fetchAiProvider('https://fixture.example/v1', {
      signal: controller.signal,
    });
    for (let index = 0; index < 10; index++) await Promise.resolve();
    expect(captured).toMatchObject({
      hostname: 'fixture.example',
      servername: 'fixture.example',
      rejectUnauthorized: true,
      agent: false,
    });
    expect(captured?.headers).toMatchObject({ host: 'fixture.example' });
    const callback = jest.fn();
    captured?.lookup?.('fixture.example', { all: true }, callback);
    expect(callback).toHaveBeenCalledWith(null, [
      { address: '8.8.8.8', family: 4 },
    ]);
    expect(lookup).toHaveBeenCalledTimes(1);
    controller.abort();
    await expect(pending).rejects.toThrow('cancelled');
    expect(nativeRequest.destroy).toHaveBeenCalledTimes(1);
  });

  it('bounds response headers and never echoes their contents', async () => {
    const fixture = await localFixture((_req, res) => {
      res.setHeader('x-private-header', 'secret-value-'.repeat(200));
      res.end('unexpected');
    });
    try {
      const pending = fetchAiProvider(
        `${fixture.origin}/headers`,
        {},
        { approvedLocalOrigins: [fixture.origin], maxHeaderBytes: 1024 },
      );
      await expect(pending).rejects.toThrow();
    } finally {
      await fixture.close();
    }
  });

  it('rejects oversized uploads before constructing a request', async () => {
    const request = jest.spyOn(https, 'request').mockImplementation(() => {
      throw new Error('Network must not be reached');
    });
    await expect(
      fetchAiProvider(
        'https://fixture.example/v1',
        { method: 'POST', body: 'x'.repeat(129) },
        { maxRequestBytes: 128 },
      ),
    ).rejects.toThrow('request is too large');
    expect(request).not.toHaveBeenCalled();
  });

  it('keeps the deadline active through a stalled response body', async () => {
    const fixture = await localFixture((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.write('{');
    });
    try {
      const response = await fetchAiProvider(
        `${fixture.origin}/body`,
        {},
        { approvedLocalOrigins: [fixture.origin], timeoutMs: 100 },
      );
      await expect(readAiProviderJson(response)).rejects.toThrow('timed out');
    } finally {
      await fixture.close();
    }
  });

  it('permits exact approved loopback only and consumes bounded JSON', async () => {
    const fixture = await localFixture((_req, res) => {
      res.setHeader('content-type', 'application/json');
      res.end('{"data":[{"id":"fixture"}]}');
    });
    try {
      const response = await fetchAiProvider(
        `${fixture.origin}/models`,
        {},
        { approvedLocalOrigins: [fixture.origin] },
      );
      await expect(readAiProviderJson(response)).resolves.toEqual({
        data: [{ id: 'fixture' }],
      });
      expect(() =>
        validateAiProviderUrl(`${fixture.origin}/models`, {
          approvedLocalOrigins: ['http://127.0.0.1:1'],
        }),
      ).toThrow();
    } finally {
      await fixture.close();
    }
  });

  it('returns redirects without following the next destination', async () => {
    let calls = 0;
    const fixture = await localFixture((_req, res) => {
      calls++;
      res.writeHead(302, { location: 'http://127.0.0.1:1/secret' });
      res.end();
    });
    try {
      const response = await fetchAiProvider(
        `${fixture.origin}/redirect`,
        {},
        { approvedLocalOrigins: [fixture.origin] },
      );
      expect(response.status).toBe(302);
      await response.body?.cancel();
      expect(calls).toBe(1);
    } finally {
      await fixture.close();
    }
  });

  it('enforces a streamed response cap even without content-length', async () => {
    const fixture = await localFixture((_req, res) => {
      res.setHeader('content-type', 'application/json');
      res.write('[');
      res.end('"' + 'x'.repeat(512) + '"]');
    });
    try {
      const response = await fetchAiProvider(
        `${fixture.origin}/large`,
        {},
        { approvedLocalOrigins: [fixture.origin], maxResponseBytes: 128 },
      );
      await expect(readAiProviderJson(response, 128)).rejects.toThrow(/large/i);
    } finally {
      await fixture.close();
    }
  });

  it('rechecks trusted policy before constructing the request', async () => {
    let calls = 0;
    const fixture = await localFixture((_req, res) => {
      calls++;
      res.end('unexpected');
    });
    try {
      await expect(
        fetchAiProvider(
          `${fixture.origin}/blocked`,
          {},
          {
            approvedLocalOrigins: [fixture.origin],
            beforeDispatch: () => {
              throw new Error('Policy denied');
            },
          },
        ),
      ).rejects.toThrow('Policy denied');
      expect(calls).toBe(0);
    } finally {
      await fixture.close();
    }
  });

  it('cancels stalled headers and releases the request', async () => {
    const fixture = await localFixture(() => undefined);
    const controller = new AbortController();
    try {
      const pending = fetchAiProvider(
        `${fixture.origin}/stalled`,
        { signal: controller.signal },
        { approvedLocalOrigins: [fixture.origin], timeoutMs: 100 },
      );
      controller.abort();
      await expect(pending).rejects.toThrow(/cancelled/i);
    } finally {
      await fixture.close();
    }
  });
});
