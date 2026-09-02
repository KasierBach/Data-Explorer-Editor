import * as dns from 'dns';
import * as net from 'net';
import { promisify } from 'util';

const lookupAll = promisify(dns.lookup) as unknown as (
  hostname: string,
  options: dns.LookupAllOptions,
) => Promise<dns.LookupAddress[]>;
const resolveSrv = promisify(dns.resolveSrv);

function isDevelopment() {
  return process.env.NODE_ENV !== 'production';
}

function isLocalDevHost(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  return (
    normalized === 'localhost' ||
    normalized === '127.0.0.1' ||
    normalized === '::1'
  );
}

function normalizeHost(host: string): string {
  return host.trim().replace(/\.$/, '').toLowerCase();
}

async function isSafeResolvedAddress(address: string): Promise<boolean> {
  if (isDevelopment() && isLocalDevHost(address)) {
    return true;
  }

  return !isPrivateIp(address);
}

async function areAllResolvedAddressesSafe(
  addresses: dns.LookupAddress[],
): Promise<boolean> {
  if (!addresses.length) return false;

  for (const result of addresses) {
    if (!(await isSafeResolvedAddress(result.address))) {
      return false;
    }
  }

  return true;
}

async function validateMongoSrvHost(host: string): Promise<boolean> {
  const records = await resolveSrv(`_mongodb._tcp.${host}`);
  if (!records.length) {
    return false;
  }

  for (const record of records) {
    const targetHost = normalizeHost(record.name);
    const results = await lookupAll(targetHost, { all: true });

    if (!(await areAllResolvedAddressesSafe(results))) {
      return false;
    }
  }

  return true;
}

/**
 * Returns true if the given IP address is private or reserved.
 * (RFC 1918, RFC 1122, RFC 3927, RFC 4193, RFC 4291)
 */
export function isPrivateIp(ip: string): boolean {
  if (!net.isIP(ip)) return false;

  // IPv4 Private/Reserved
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);

    // Loopback (127.0.0.0/8)
    if (parts[0] === 127) return true;

    // Private Network (10.0.0.0/8)
    if (parts[0] === 10) return true;

    // Private Network (172.16.0.0/12)
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;

    // Private Network (192.168.0.0/16)
    if (parts[0] === 192 && parts[1] === 168) return true;

    // Link-local (169.254.0.0/16)
    if (parts[0] === 169 && parts[1] === 254) return true;

    // Alibaba Cloud metadata (100.100.100.200)
    if (ip === '100.100.100.200') return true;

    // Broadcast
    if (ip === '255.255.255.255') return true;

    // Unspecified ("this" network, 0.0.0.0/8) — on many platforms
    // connecting to 0.0.0.0 reaches localhost
    if (parts[0] === 0) return true;
  }

  // IPv6 Private/Reserved
  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase();

    // Loopback (::1)
    if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') return true;

    // Unspecified (::) — equivalent of 0.0.0.0
    if (normalized === '::' || normalized === '0:0:0:0:0:0:0:0') return true;

    // Unique Local (fc00::/7)
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;

    // Link-local (fe80::/10) — fe8, fe9, fea, feb prefixes
    if (/^fe[89ab]/.test(normalized)) return true;

    // IPv4-mapped IPv6 can bypass IPv4 checks; re-check the embedded IPv4.
    const mappedMatch = normalized.match(
      /^(?:::ffff:|0:0:0:0:0:ffff:)(\d{1,3}(?:\.\d{1,3}){3})$/,
    );
    if (mappedMatch) {
      return isPrivateIp(mappedMatch[1]);
    }
  }

  return false;
}

/**
 * Validates a host to prevent SSRF attacks.
 * Resolves the host to an IP to prevent DNS Rebinding.
 */
export async function validateHost(host: string): Promise<boolean> {
  // Fail-closed: callers skip optional fields, so a host reaching this
  // check must be non-empty.
  if (!host || !host.trim()) return false;
  const normalizedHost = normalizeHost(host);

  // Environment override for local development if needed
  if (process.env.ALLOW_INTERNAL_IPS === 'true') {
    return true;
  }

  if (isDevelopment() && isLocalDevHost(normalizedHost)) {
    return true;
  }

  try {
    // If it's already an IP, check it
    if (net.isIP(normalizedHost)) {
      if (isDevelopment() && isLocalDevHost(normalizedHost)) {
        return true;
      }
      return !isPrivateIp(normalizedHost);
    }

    // Resolve every address so one safe A/AAAA record cannot hide a private one.
    const results = await lookupAll(normalizedHost, { all: true });
    return areAllResolvedAddressesSafe(results);
  } catch {
    try {
      return await validateMongoSrvHost(normalizedHost);
    } catch {
      return false;
    }
  }
}

export async function validateExternalUrl(value: string): Promise<boolean> {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (!['http:', 'https:'].includes(url.protocol)) return false;
  if (!isDevelopment() && url.protocol !== 'https:') return false;
  if (url.username || url.password) return false;

  return validateHost(url.hostname);
}
