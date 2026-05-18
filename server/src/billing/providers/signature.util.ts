import { createHmac, timingSafeEqual } from 'crypto';

export function hmacSha256Hex(secret: string, value: string) {
  return createHmac('sha256', secret).update(value).digest('hex');
}

export function signaturesMatch(expected: string, received: unknown) {
  if (typeof received !== 'string' || !received) return false;

  const expectedBuffer = Buffer.from(expected, 'hex');
  const receivedBuffer = Buffer.from(received, 'hex');

  if (expectedBuffer.length !== receivedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, receivedBuffer);
}
