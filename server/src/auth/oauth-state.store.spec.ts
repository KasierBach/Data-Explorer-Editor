import type { Request, Response } from 'express';
import { OAuthStateCookieStore } from './oauth-state.store';

describe('OAuthStateCookieStore', () => {
  const store = new OAuthStateCookieStore('de_oauth_state');

  function createReq(cookieHeader?: string) {
    const res = {
      cookie: jest.fn(),
    } as unknown as Response;

    return {
      headers: cookieHeader ? { cookie: cookieHeader } : {},
      res,
    } as Request & { res: Response };
  }

  it('stores a random state in an httpOnly cookie', (done) => {
    const req = createReq();

    store.store(req, (error, state) => {
      expect(error).toBeNull();
      expect(state).toMatch(/^[a-f0-9]{48}$/);
      expect(req.res.cookie).toHaveBeenCalledWith(
        'de_oauth_state',
        state,
        expect.objectContaining({
          httpOnly: true,
          path: '/',
        }),
      );
      done();
    });
  });

  it('rejects a callback when the state cookie is missing', (done) => {
    const req = createReq();

    store.verify(req, 'abc', (error, ok, info) => {
      expect(error).toBeNull();
      expect(ok).toBe(false);
      expect(info).toEqual(
        expect.objectContaining({
          message: 'Unable to verify authorization request state.',
        }),
      );
      expect(req.res.cookie).toHaveBeenCalled();
      done();
    });
  });

  it('accepts a callback when the state matches the cookie', (done) => {
    const state = 'abcdef0123456789abcdef0123456789abcdef0123456789';
    const req = createReq(`de_oauth_state=${state}`);

    store.verify(req, state, (error, ok, info) => {
      expect(error).toBeNull();
      expect(ok).toBe(true);
      expect(info).toBeUndefined();
      expect(req.res.cookie).toHaveBeenCalled();
      done();
    });
  });
});
