import * as dns from 'node:dns';
import * as http from 'node:http';
import * as https from 'node:https';
import { isIP } from 'node:net';
import type { TLSSocket } from 'node:tls';
import { isPrivateIp } from '../common/utils/ssrf-validator.util';

export interface AiProviderTransportOptions {
  /** Exact origins, without a trailing slash; only HTTP loopback is eligible. */
  approvedLocalOrigins?: string[];
  maxResponseBytes?: number;
  maxRequestBytes?: number;
  maxHeaderBytes?: number;
  /** Total deadline, including DNS, policy, connection and response consumption. */
  timeoutMs?: number;
  /** Trusted policy hook, rechecked after DNS and before constructing the request. */
  beforeDispatch?: () => void | Promise<void>;
}

type TransportErrorCode =
  | 'UNSAFE_URL'
  | 'UNSAFE_ADDRESS'
  | 'INVALID_REQUEST'
  | 'LIMIT_EXCEEDED'
  | 'NETWORK'
  | 'INVALID_RESPONSE'
  | 'INVALID_JSON'
  | 'ABORTED'
  | 'TIMEOUT';

export class AiProviderTransportError extends Error {
  constructor(
    readonly code: TransportErrorCode,
    message: string,
  ) {
    super(message);
    this.name =
      code === 'ABORTED'
        ? 'AbortError'
        : code === 'TIMEOUT'
          ? 'TimeoutError'
          : 'AiProviderTransportError';
  }
}

const DEFAULT_RESPONSE_BYTES = 2 * 1024 * 1024;
const DEFAULT_REQUEST_BYTES = 1024 * 1024;
const DEFAULT_HEADER_BYTES = 16 * 1024;
const DEFAULT_TIMEOUT_MS = 15_000;
const CONTROL = {
  test(value: string): boolean {
    for (let index = 0; index < value.length; index++) {
      const code = value.charCodeAt(index);
      if (code < 32 || (code >= 127 && code <= 159)) return true;
    }
    return false;
  },
};

function failure(code: TransportErrorCode, message: string) {
  return new AiProviderTransportError(code, message);
}

function limit(value: number | undefined, fallback: number, maximum: number) {
  const result = value ?? fallback;
  if (!Number.isSafeInteger(result) || result < 1 || result > maximum) {
    throw failure('INVALID_REQUEST', 'Invalid provider transport limit');
  }
  return result;
}

function hostOf(url: URL) {
  return url.hostname.replace(/^\[|\]$/g, '');
}

type Address = { key: string; ipv4?: number[]; words?: number[] };

function addressOf(value: string): Address | undefined {
  // Zone IDs are never admitted, including on platforms where isIP accepts them.
  if (value.includes('%')) return undefined;
  const family = isIP(value);
  if (family === 4) {
    const ipv4 = value.split('.').map(Number);
    return { key: ipv4.join('.'), ipv4 };
  }
  if (family !== 6) return undefined;
  let expanded = value.toLowerCase();
  if (expanded.includes('.')) {
    const lastColon = expanded.lastIndexOf(':');
    const bytes = expanded
      .slice(lastColon + 1)
      .split('.')
      .map(Number);
    expanded = `${expanded.slice(0, lastColon)}:${((bytes[0] << 8) | bytes[1]).toString(16)}:${((bytes[2] << 8) | bytes[3]).toString(16)}`;
  }
  const sides = expanded.split('::');
  const left = sides[0] ? sides[0].split(':') : [];
  const right = sides.length === 2 && sides[1] ? sides[1].split(':') : [];
  const parts =
    sides.length === 2
      ? [...left, ...Array(8 - left.length - right.length).fill('0'), ...right]
      : left;
  const words = parts.map((part) => parseInt(part, 16));
  if (words.length !== 8) return undefined;
  // Normalize both dotted and hexadecimal IPv4-mapped forms before policy and
  // peer comparisons (e.g. ::ffff:7f00:1 must not hide loopback).
  if (words.slice(0, 5).every((word) => word === 0) && words[5] === 0xffff) {
    const ipv4 = [words[6] >> 8, words[6] & 255, words[7] >> 8, words[7] & 255];
    return { key: ipv4.join('.'), ipv4 };
  }
  return { key: words.map((word) => word.toString(16)).join(':'), words };
}

function loopback(address: Address) {
  return address.ipv4?.[0] === 127 || address.key === '0:0:0:0:0:0:0:1';
}

function prohibited(value: string) {
  const address = addressOf(value);
  if (!address || isPrivateIp(value)) return true;
  if (address.ipv4) {
    const [a, b, c] = address.ipv4;
    return (
      isPrivateIp(address.key) ||
      (a === 100 && b >= 64 && b <= 127) || // CGNAT /10
      (a === 192 && b === 0 && (c === 0 || c === 2)) ||
      (a === 192 && b === 88 && c === 99) ||
      (a === 192 &&
        ((b === 31 && c === 196) ||
          (b === 52 && c === 193) ||
          (b === 175 && c === 48))) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113) ||
      a >= 224
    ); // Multicast /4 and reserved /4, including broadcast
  }
  const words = address.words!;
  // Fail closed outside global unicast 2000::/3: unspecified/compatible,
  // NAT64, discard-only, ULA, link/site-local, and multicast are not providers.
  return (
    (words[0] & 0xe000) !== 0x2000 ||
    (words[0] === 0x2001 && words[1] < 0x200) || // IETF special-purpose /23
    (words[0] === 0x2001 && words[1] === 0xdb8) ||
    words[0] === 0x2002 || // 6to4 can embed a prohibited IPv4 address
    (words[0] === 0x3fff && (words[1] & 0xf000) === 0) || // Documentation /20
    (words[0] === 0x2620 && words[1] === 0x4f && words[2] === 0x8000)
  );
}

/** Syntactic/no-DNS validation, also suitable for configuration-only CRUD. */
export function validateAiProviderUrl(
  value: string | URL,
  options: Pick<AiProviderTransportOptions, 'approvedLocalOrigins'> = {},
): URL {
  const raw = value instanceof URL ? value.href : value;
  if (
    typeof raw !== 'string' ||
    raw.length > 8192 ||
    CONTROL.test(raw) ||
    /\s/.test(raw) ||
    /%(?:0[0-9a-f]|1[0-9a-f]|7f)/i.test(raw)
  ) {
    throw failure('UNSAFE_URL', 'Unsafe provider URL');
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw failure('UNSAFE_URL', 'Unsafe provider URL');
  }
  if (
    !url.hostname ||
    url.username ||
    url.password ||
    url.hash ||
    url.port === '0' ||
    /^[a-z]+:\/\/[^/?#]*@/i.test(raw)
  ) {
    throw failure('UNSAFE_URL', 'Unsafe provider URL');
  }
  const host = hostOf(url);
  const address = addressOf(host);
  const localHttp =
    url.protocol === 'http:' &&
    options.approvedLocalOrigins?.includes(url.origin) === true &&
    (host === 'localhost' || (address && loopback(address)));
  if (url.protocol !== 'https:' && !localHttp) {
    throw failure('UNSAFE_URL', 'Unsafe provider URL');
  }
  if (
    isIP(host) &&
    (!address || (localHttp ? !loopback(address) : prohibited(host)))
  ) {
    throw failure('UNSAFE_ADDRESS', 'Unsafe provider address');
  }
  return url;
}

function requestBody(
  body: RequestInit['body'],
  maxBytes: number,
): Buffer | undefined {
  if (body === undefined || body === null) return undefined;
  let result: Buffer;
  if (typeof body === 'string' || body instanceof URLSearchParams) {
    const text = typeof body === 'string' ? body : body.toString();
    if (Buffer.byteLength(text) > maxBytes)
      throw failure('LIMIT_EXCEEDED', 'Provider request is too large');
    result = Buffer.from(text);
  } else if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
    if (body.byteLength > maxBytes)
      throw failure('LIMIT_EXCEEDED', 'Provider request is too large');
    result =
      body instanceof ArrayBuffer
        ? Buffer.from(body)
        : Buffer.from(body.buffer, body.byteOffset, body.byteLength);
  } else {
    // Never collect an unbounded upload stream or encode arbitrary form data.
    throw failure('INVALID_REQUEST', 'Unsupported provider request body');
  }
  return result;
}

function requestHeaders(
  init: RequestInit,
  url: URL,
  body: Buffer | undefined,
  maxBytes: number,
) {
  const headers = new Headers(init.headers);
  const forbidden = [
    'host',
    'content-length',
    'transfer-encoding',
    'connection',
    'upgrade',
    'proxy-authorization',
    'te',
    'trailer',
    'expect',
    'keep-alive',
  ];
  for (const name of forbidden) {
    if (headers.has(name))
      throw failure('INVALID_REQUEST', 'Unsupported provider request header');
  }
  headers.set('host', url.host);
  headers.set('accept-encoding', 'identity');
  headers.set('connection', 'close');
  if (body !== undefined)
    headers.set('content-length', String(body.byteLength));
  let bytes = 0;
  let count = 0;
  const result: Record<string, string> = {};
  headers.forEach((value, name) => {
    bytes += Buffer.byteLength(name) + Buffer.byteLength(value) + 4;
    if (
      CONTROL.test(name) ||
      CONTROL.test(value) ||
      ++count > 100 ||
      bytes > maxBytes
    ) {
      throw failure(
        'LIMIT_EXCEEDED',
        'Provider headers are too large or invalid',
      );
    }
    result[name] = value;
  });
  return result;
}

function checkContentLength(headers: Headers, maxBytes: number) {
  const length = headers.get('content-length');
  if (length === null) return;
  if (!/^\d+$/.test(length) || !Number.isSafeInteger(Number(length))) {
    throw failure('INVALID_RESPONSE', 'Invalid provider response headers');
  }
  if (Number(length) > maxBytes)
    throw failure('LIMIT_EXCEEDED', 'Provider response is too large');
}

/**
 * Native HTTPS, never global fetch: one all-address DNS admission, pinned lookup,
 * original Host/SNI/certificate identity, and a backpressured bounded Web body.
 * Redirects are returned as non-ok responses and are never followed. The timeout
 * remains active after headers until the body is consumed or cancelled.
 */
export function fetchAiProvider(
  value: string | URL,
  init: RequestInit = {},
  options: AiProviderTransportOptions = {},
): Promise<Response> {
  return new Promise<Response>((resolve, reject) => {
    let request: http.ClientRequest | undefined;
    let incoming: http.IncomingMessage | undefined;
    let bodyController: ReadableStreamDefaultController<Uint8Array> | undefined;
    let finished = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cleanup = () => {
      if (timer) clearTimeout(timer);
      init.signal?.removeEventListener('abort', onAbort);
    };
    const fail = (error: Error) => {
      if (finished) return;
      finished = true;
      cleanup();
      bodyController?.error(error);
      incoming?.destroy();
      request?.destroy();
      reject(error);
    };
    const onAbort = () =>
      fail(failure('ABORTED', 'Provider request was cancelled'));
    const complete = () => {
      if (finished) return;
      finished = true;
      cleanup();
    };
    void (async () => {
      try {
        const maxResponseBytes = limit(
          options.maxResponseBytes,
          DEFAULT_RESPONSE_BYTES,
          64 * 1024 * 1024,
        );
        const maxRequestBytes = limit(
          options.maxRequestBytes,
          DEFAULT_REQUEST_BYTES,
          64 * 1024 * 1024,
        );
        const maxHeaderBytes = limit(
          options.maxHeaderBytes,
          DEFAULT_HEADER_BYTES,
          64 * 1024,
        );
        const timeoutMs = limit(options.timeoutMs, DEFAULT_TIMEOUT_MS, 300_000);
        init.signal?.addEventListener('abort', onAbort, { once: true });
        if (init.signal?.aborted) return onAbort();
        timer = setTimeout(
          () => fail(failure('TIMEOUT', 'Provider request timed out')),
          timeoutMs,
        );
        timer.unref?.();
        const url = validateAiProviderUrl(value, options);
        const host = hostOf(url);
        const method = (init.method || 'GET').toUpperCase();
        if (
          !/^[A-Z]{1,20}$/.test(method) ||
          ['CONNECT', 'TRACE', 'TRACK'].includes(method)
        ) {
          throw failure(
            'INVALID_REQUEST',
            'Unsupported provider request method',
          );
        }
        const body = requestBody(init.body, maxRequestBytes);
        if (body !== undefined && (method === 'GET' || method === 'HEAD')) {
          throw failure('INVALID_REQUEST', 'Unsupported provider request body');
        }
        const headers = requestHeaders(init, url, body, maxHeaderBytes);
        const addresses: dns.LookupAddress[] = isIP(host)
          ? [{ address: host, family: isIP(host) }]
          : await new Promise<dns.LookupAddress[]>((resolveDns, rejectDns) => {
              dns.lookup(
                host,
                { all: true, verbatim: true },
                (error, records) => {
                  if (error)
                    rejectDns(failure('NETWORK', 'Unable to resolve provider'));
                  else resolveDns(records);
                },
              );
            });
        if (finished) return;
        const localHttp = url.protocol === 'http:';
        if (
          !Array.isArray(addresses) ||
          !addresses.length ||
          addresses.some((entry) => {
            const address = addressOf(entry.address);
            return (
              !address ||
              entry.family !== isIP(entry.address) ||
              (localHttp ? !loopback(address) : prohibited(entry.address))
            );
          })
        )
          throw failure('UNSAFE_ADDRESS', 'Unsafe provider address');
        const admitted = new Set(
          addresses.map((entry) => addressOf(entry.address)!.key),
        );
        const selected = addresses[0];
        if (options.beforeDispatch) {
          try {
            await options.beforeDispatch();
          } catch (error) {
            // This is a trusted authorization hook, not a provider/native error.
            fail(
              error instanceof Error
                ? error
                : failure('INVALID_REQUEST', 'Provider dispatch was denied'),
            );
            return;
          }
        }
        if (finished) return;
        const pinnedLookup: NonNullable<http.RequestOptions['lookup']> = (
          _host,
          lookupOptions,
          callback,
        ) => {
          if (typeof lookupOptions === 'object' && lookupOptions.all)
            callback(null, [selected]);
          else callback(null, selected.address, selected.family);
        };
        const requestOptions: https.RequestOptions = {
          protocol: url.protocol,
          hostname: host,
          port: Number(url.port || (localHttp ? 80 : 443)),
          path: `${url.pathname}${url.search}`,
          method,
          headers,
          family: selected.family,
          lookup: pinnedLookup,
          agent: false, // No pooled socket or second resolver can bypass admission.
          maxHeaderSize: maxHeaderBytes,
          insecureHTTPParser: false,
          ...(localHttp
            ? {}
            : {
                servername: isIP(host) ? undefined : host,
                rejectUnauthorized: true,
              }),
        };
        request = (localHttp ? http.request : https.request)(
          requestOptions,
          (response) => {
            incoming = response;
            if (finished) return response.destroy();
            try {
              if (
                !admitted.has(
                  addressOf(response.socket.remoteAddress || '')?.key || '',
                )
              ) {
                throw failure(
                  'UNSAFE_ADDRESS',
                  'Provider peer address was not admitted',
                );
              }
              const raw = response.rawHeaders;
              let bytes = 0;
              if (raw.length > 200)
                throw failure(
                  'LIMIT_EXCEEDED',
                  'Provider response headers are too large',
                );
              const responseHeaders = new Headers();
              for (let index = 0; index < raw.length; index += 2) {
                bytes +=
                  Buffer.byteLength(raw[index]) +
                  Buffer.byteLength(raw[index + 1]) +
                  4;
                if (
                  bytes > maxHeaderBytes ||
                  CONTROL.test(raw[index]) ||
                  CONTROL.test(raw[index + 1])
                ) {
                  throw failure(
                    'LIMIT_EXCEEDED',
                    'Provider response headers are too large or invalid',
                  );
                }
                responseHeaders.append(raw[index], raw[index + 1]);
              }
              checkContentLength(responseHeaders, maxResponseBytes);
              if (
                responseHeaders.has('content-encoding') &&
                responseHeaders.get('content-encoding')?.toLowerCase() !==
                  'identity'
              ) {
                throw failure(
                  'INVALID_RESPONSE',
                  'Unsupported provider response encoding',
                );
              }
              const status = response.statusCode || 0;
              if (status < 200 || status > 599)
                throw failure(
                  'INVALID_RESPONSE',
                  'Invalid provider response status',
                );
              if (method === 'HEAD' || [204, 205, 304].includes(status)) {
                complete();
                response.destroy();
                request?.destroy();
                resolve(
                  new Response(null, { status, headers: responseHeaders }),
                );
                return;
              }
              let total = 0;
              let ended = false;
              const stream = new ReadableStream<Uint8Array>(
                {
                  start(controller) {
                    bodyController = controller;
                    response.pause();
                    response.on('data', (chunk: Buffer) => {
                      if (finished) return;
                      total += chunk.byteLength;
                      if (total > maxResponseBytes) {
                        fail(
                          failure(
                            'LIMIT_EXCEEDED',
                            'Provider response is too large',
                          ),
                        );
                        return;
                      }
                      controller.enqueue(
                        new Uint8Array(
                          chunk.buffer,
                          chunk.byteOffset,
                          chunk.byteLength,
                        ),
                      );
                      if ((controller.desiredSize ?? 0) <= 0) response.pause();
                    });
                    response.once('end', () => {
                      if (finished) return;
                      ended = true;
                      controller.close();
                      complete();
                    });
                    response.once('error', () =>
                      fail(
                        failure('NETWORK', 'Provider response was interrupted'),
                      ),
                    );
                    response.once('aborted', () =>
                      fail(
                        failure('NETWORK', 'Provider response was interrupted'),
                      ),
                    );
                    response.once('close', () => {
                      if (!ended && !finished)
                        fail(
                          failure(
                            'NETWORK',
                            'Provider response was interrupted',
                          ),
                        );
                    });
                  },
                  pull() {
                    if (!finished) response.resume();
                  },
                  cancel() {
                    complete();
                    response.destroy();
                    request?.destroy();
                  },
                },
                { highWaterMark: 0 },
              );
              resolve(
                new Response(stream, { status, headers: responseHeaders }),
              );
            } catch (error) {
              fail(
                error instanceof AiProviderTransportError
                  ? error
                  : failure('INVALID_RESPONSE', 'Invalid provider response'),
              );
            }
          },
        );
        request.once('error', () =>
          fail(failure('NETWORK', 'Unable to reach provider')),
        );
        request.once('upgrade', (_response, socket) => {
          socket.destroy();
          fail(
            failure(
              'INVALID_RESPONSE',
              'Unsupported provider protocol upgrade',
            ),
          );
        });
        request.once('socket', (socket) => {
          const send = () => {
            if (finished) return;
            if (
              !admitted.has(addressOf(socket.remoteAddress || '')?.key || '')
            ) {
              fail(
                failure(
                  'UNSAFE_ADDRESS',
                  'Provider peer address was not admitted',
                ),
              );
              return;
            }
            if (!localHttp && (socket as TLSSocket).authorized !== true) {
              fail(failure('NETWORK', 'Provider TLS verification failed'));
              return;
            }
            // Do not release authentication headers or the body before peer/TLS verification.
            request!.end(body);
          };
          if (
            !socket.connecting &&
            (localHttp || (socket as TLSSocket).authorized === true)
          )
            send();
          else socket.once(localHttp ? 'connect' : 'secureConnect', send);
        });
      } catch (error) {
        fail(
          error instanceof AiProviderTransportError
            ? error
            : failure('INVALID_REQUEST', 'Invalid provider request'),
        );
      }
    })();
  });
}

/** Bounded JSON-only decoding; never echoes response text or parse/native errors. */
export async function readAiProviderJson(
  response: Response,
  maxBytes = DEFAULT_RESPONSE_BYTES,
): Promise<unknown> {
  const bound = limit(maxBytes, DEFAULT_RESPONSE_BYTES, 64 * 1024 * 1024);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    if (
      !/^application\/(?:[a-z0-9!#$&^_.+-]+\+)?json(?:\s*;|$)/i.test(
        response.headers.get('content-type') || '',
      )
    ) {
      throw failure('INVALID_JSON', 'Provider returned invalid JSON');
    }
    checkContentLength(response.headers, bound);
    if (!response.body)
      throw failure('INVALID_JSON', 'Provider returned invalid JSON');
    reader = response.body.getReader();
    let total = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > bound)
        throw failure('LIMIT_EXCEEDED', 'Provider response is too large');
      chunks.push(value);
    }
    const bytes = Buffer.concat(chunks, total);
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch (error) {
    if (reader) await reader.cancel().catch(() => undefined);
    else await response.body?.cancel().catch(() => undefined);
    throw error instanceof AiProviderTransportError
      ? error
      : failure('INVALID_JSON', 'Provider returned invalid JSON');
  } finally {
    reader?.releaseLock();
  }
}
