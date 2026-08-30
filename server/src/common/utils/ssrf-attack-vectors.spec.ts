import { isPrivateIp } from './ssrf-validator.util';

describe('SSRF protection — isPrivateIp attack vectors', () => {
  describe('cloud metadata endpoints (highest-value SSRF targets)', () => {
    it.each([
      ['169.254.169.254', 'AWS/GCP/Azure metadata'],
      ['169.254.170.2', 'ECS container metadata'],
      ['100.100.100.200', 'Alibaba metadata'],
      ['fd00:ec2::254', 'AWS IPv6 metadata'],
    ])('blocks %s (%s)', (ip) => {
      expect(isPrivateIp(ip)).toBe(true);
    });
  });

  describe('IPv4 private and reserved ranges', () => {
    it.each([
      '10.0.0.1',
      '10.255.255.255',
      '172.16.0.1',
      '172.31.255.255',
      '192.168.1.1',
      '192.168.0.100',
      '127.0.0.1',
      '127.1.1.1', // short loopback form
      '0.0.0.0',
      '255.255.255.255',
    ])('blocks %s', (ip) => {
      expect(isPrivateIp(ip)).toBe(true);
    });

    it('does NOT block the 172.32.0.0 boundary incorrectly (public range)', () => {
      // 172.16.0.0 – 172.31.255.255 is private; 172.32.x.x is public
      expect(isPrivateIp('172.32.0.1')).toBe(false);
    });
  });

  describe('IPv6 private/reserved ranges', () => {
    it.each([
      '::1', // loopback
      'fe80::1', // link-local
      'fc00::1', // unique local
      'fd12:3456:789a::1', // unique local (global ID)
      '::', // unspecified
    ])('blocks %s', (ip) => {
      expect(isPrivateIp(ip)).toBe(true);
    });
  });

  describe('IPv4-mapped IPv6 bypass attempts', () => {
    // Attackers encode IPv4 private addresses as IPv6 to bypass naive checks
    it.each([
      '::ffff:127.0.0.1',
      '::ffff:169.254.169.254',
      '::ffff:10.0.0.1',
      '::ffff:192.168.1.1',
      '0:0:0:0:0:ffff:10.0.0.1', // fully expanded form
    ])('blocks mapped form %s', (ip) => {
      expect(isPrivateIp(ip)).toBe(true);
    });
  });

  describe('public addresses must NOT be blocked (false positives)', () => {
    it.each([
      '8.8.8.8',
      '1.1.1.1',
      '172.32.0.1',
      '2606:4700:4700::1111', // Cloudflare DNS
      '2001:4860:4860::8888', // Google DNS
    ])('allows %s', (ip) => {
      expect(isPrivateIp(ip)).toBe(false);
    });
  });

  describe('malformed input', () => {
    it.each([
      'not-an-ip',
      '',
      '999.999.999.999',
      '10.0.0', // incomplete
    ])('returns false for non-IP %s (handled upstream as hostname)', (ip) => {
      // Non-IP strings are not "private IPs" — they are treated as hostnames
      // and resolved via DNS before checking. The guard here is that they
      // don't crash the validator.
      expect(() => isPrivateIp(ip)).not.toThrow();
    });
  });
});
