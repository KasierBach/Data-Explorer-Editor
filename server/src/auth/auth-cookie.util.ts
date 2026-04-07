import type { CookieOptions, Request } from 'express';

export const REFRESH_TOKEN_COOKIE = 'de_refresh';

function useSecureCookies() {
  const frontendUrl = (process.env.FRONTEND_URL || '').trim();
  return process.env.NODE_ENV === 'production' || frontendUrl.startsWith('https://');
}

export function getRefreshTokenCookieOptions(maxAgeMs: number): CookieOptions {
  const secure = useSecureCookies();

  return {
    httpOnly: true,
    secure,
    sameSite: secure ? 'none' : 'lax',
    path: '/',
    maxAge: maxAgeMs,
  };
}

export function getClearedRefreshTokenCookieOptions(): CookieOptions {
  const secure = useSecureCookies();

  return {
    httpOnly: true,
    secure,
    sameSite: secure ? 'none' : 'lax',
    path: '/',
    expires: new Date(0),
  };
}

export function extractCookie(req: Request, name: string): string | undefined {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) {
    return undefined;
  }

  for (const part of cookieHeader.split(';')) {
    const [rawName, ...rawValue] = part.trim().split('=');
    if (rawName === name) {
      return decodeURIComponent(rawValue.join('='));
    }
  }

  return undefined;
}
