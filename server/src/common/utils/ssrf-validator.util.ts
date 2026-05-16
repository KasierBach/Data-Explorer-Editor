import * as dns from 'dns';
import * as net from 'net';
import { promisify } from 'util';

const lookup = promisify(dns.lookup);
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

async function validateMongoSrvHost(host: string): Promise<boolean> {
  const records = await resolveSrv(`_mongodb._tcp.${host}`);
  if (!records.length) {
    return false;
  }

  for (const record of records) {
    const targetHost = normalizeHost(record.name);
    const result = await lookup(targetHost);

    if (!(await isSafeResolvedAddress(result.address))) {
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

    // Broadcast
    if (ip === '255.255.255.255') return true;
  }

  // IPv6 Private/Reserved
  if (net.isIPv6(ip)) {
    // Loopback (::1)
    if (ip === '::1' || ip === '0:0:0:0:0:0:0:1') return true;

    // Unique Local (fc00::/7)
    if (ip.toLowerCase().startsWith('fc') || ip.toLowerCase().startsWith('fd'))
      return true;

    // Link-local (fe80::/10)
    if (ip.toLowerCase().startsWith('fe8')) return true;
  }

  return false;
}

/**
 * Validates a host to prevent SSRF attacks.
 * Resolves the host to an IP to prevent DNS Rebinding.
 */
export async function validateHost(host: string): Promise<boolean> {
  if (!host) return true;
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

    // Resolve domain to IP (prevents DNS Rebinding if checked before connection)
    const result = await lookup(normalizedHost);
    return isSafeResolvedAddress(result.address);
  } catch {
    try {
      return await validateMongoSrvHost(normalizedHost);
    } catch {
      return false;
    }
  }
}
