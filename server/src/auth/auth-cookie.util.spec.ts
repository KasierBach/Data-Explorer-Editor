import type { Request, Response } from 'express';
import {
  extractRefreshTokenCookie,
  REFRESH_TOKEN_COOKIE,
  setRefreshTokenCookie,
} from './auth-cookie.util';

describe('refresh token cookies', () => {
  const originalEncryptionKey = process.env.ENCRYPTION_KEY;

  beforeAll(() => {
    process.env.ENCRYPTION_KEY = 'e'.repeat(32);
  });

  afterAll(() => {
    if (originalEncryptionKey === undefined) {
      delete process.env.ENCRYPTION_KEY;
    } else {
      process.env.ENCRYPTION_KEY = originalEncryptionKey;
    }
  });

  it('encrypts refresh tokens at rest and decrypts them when read', () => {
    const cookie = jest.fn();
    const response = { cookie } as unknown as Response;
    const refreshToken = 'refresh-token-secret';

    setRefreshTokenCookie(
      response,
      refreshToken,
      new Date(Date.now() + 60_000),
    );

    const encryptedToken = cookie.mock.calls[0][1] as string;
    expect(cookie).toHaveBeenCalledWith(
      REFRESH_TOKEN_COOKIE,
      expect.stringMatching(/^v1:/),
      expect.objectContaining({ httpOnly: true }),
    );
    expect(encryptedToken).not.toContain(refreshToken);

    const request = {
      headers: {
        cookie: `${REFRESH_TOKEN_COOKIE}=${encodeURIComponent(encryptedToken)}`,
      },
    } as Request;

    expect(extractRefreshTokenCookie(request)).toBe(refreshToken);
  });

  it('accepts legacy plaintext cookies during migration', () => {
    const request = {
      headers: { cookie: `${REFRESH_TOKEN_COOKIE}=legacy-refresh-token` },
    } as Request;

    expect(extractRefreshTokenCookie(request)).toBe('legacy-refresh-token');
  });

  it('treats tampered encrypted cookies as invalid credentials', () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const request = {
      headers: { cookie: `${REFRESH_TOKEN_COOKIE}=v1%3Ainvalid` },
    } as Request;

    expect(extractRefreshTokenCookie(request)).toBeUndefined();
    consoleError.mockRestore();
  });
});
