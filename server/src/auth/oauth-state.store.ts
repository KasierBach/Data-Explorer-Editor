import { randomBytes, timingSafeEqual } from 'crypto';
import type { CookieOptions, Request, Response } from 'express';
import { extractCookie } from './auth-cookie.util';

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

function useSecureCookies() {
  const frontendUrl = (process.env.FRONTEND_URL || '').trim();
  return (
    process.env.NODE_ENV === 'production' || frontendUrl.startsWith('https://')
  );
}

function getStateCookieOptions(): CookieOptions {
  const secure = useSecureCookies();

  return {
    httpOnly: true,
    secure,
    sameSite: secure ? 'none' : 'lax',
    path: '/',
    maxAge: OAUTH_STATE_TTL_MS,
  };
}

function getClearedStateCookieOptions(): CookieOptions {
  const secure = useSecureCookies();

  return {
    httpOnly: true,
    secure,
    sameSite: secure ? 'none' : 'lax',
    path: '/',
    expires: new Date(0),
  };
}

function hasMatchingState(storedState: string, providedState: string) {
  const stored = Buffer.from(storedState);
  const provided = Buffer.from(providedState);

  return stored.length === provided.length && timingSafeEqual(stored, provided);
}

export class OAuthStateCookieStore {
  constructor(private readonly cookieName: string) {}

  store(
    req: Request & { res?: Response },
    callback: (error: Error | null, state?: string) => void,
  ) {
    const res = req.res;
    if (!res || typeof res.cookie !== 'function') {
      callback(
        new Error('OAuth state cookie store requires an HTTP response object.'),
      );
      return;
    }

    const state = randomBytes(24).toString('hex');
    res.cookie(this.cookieName, state, getStateCookieOptions());
    callback(null, state);
  }

  verify(
    req: Request & { res?: Response },
    providedState: string,
    callback: (error: Error | null, ok?: boolean, info?: { message: string }) => void,
  ) {
    const storedState = extractCookie(req, this.cookieName);
    const res = req.res;

    if (res && typeof res.cookie === 'function') {
      res.cookie(this.cookieName, '', getClearedStateCookieOptions());
    }

    if (!storedState || !providedState) {
      callback(null, false, {
        message: 'Unable to verify authorization request state.',
      });
      return;
    }

    if (!hasMatchingState(storedState, providedState)) {
      callback(null, false, {
        message: 'Invalid authorization request state.',
      });
      return;
    }

    callback(null, true);
  }
}