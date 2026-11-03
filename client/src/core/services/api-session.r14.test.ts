import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from './store/slices/authSlice';

const fixture = vi.hoisted(() => {
  const state = {
    accessToken: 'expired-token' as string | null,
    user: { id: 'user-a', email: 'a@example.test' } as AuthUser | null,
    lang: 'en',
    restoreSession: vi.fn(),
    logout: vi.fn(),
  };
  return { state, fetch: vi.fn() };
});

vi.mock('./store', () => ({ useAppStore: { getState: () => fixture.state } }));

import { apiService } from './api.service';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function response(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function refreshBody(token = 'fresh-token') {
  return {
    access_token: token,
    accessTokenExpiresAt: 2_000_000_000,
    user: { id: 'user-a', email: 'a@example.test' },
  };
}

function refreshCalls() {
  return fixture.fetch.mock.calls.filter(([url]) => String(url).endsWith('/auth/refresh'));
}

describe('R14 session refresh ownership', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    apiService.endLogout();
    fixture.state.accessToken = 'expired-token';
    fixture.state.user = { id: 'user-a', email: 'a@example.test' };
    fixture.state.restoreSession.mockImplementation((token: string, user: AuthUser) => {
      fixture.state.accessToken = token;
      fixture.state.user = user;
    });
    fixture.state.logout.mockImplementation(() => {
      fixture.state.accessToken = null;
      fixture.state.user = null;
    });
    vi.stubGlobal('fetch', fixture.fetch);
  });

  afterEach(() => {
    apiService.endLogout();
    vi.unstubAllGlobals();
  });

  it('invalidates stale success after automatic logout and same-user login', async () => {
    const staleRead = deferred<Response>();
    fixture.fetch.mockImplementation((url: string) => {
      if (url.endsWith('/expire')) return Promise.resolve(response(401, { message: 'expired' }));
      if (url.endsWith('/auth/refresh')) return Promise.resolve(response(401, { message: 'refresh failed' }));
      return staleRead.promise;
    });

    const pending = apiService.get('/private-data').catch(error => error);
    await expect(apiService.get('/expire').catch(error => error)).resolves.toBeInstanceOf(Error);
    fixture.state.accessToken = 'same-user-new-token';
    fixture.state.user = { id: 'user-a', email: 'a@example.test' };
    staleRead.resolve(response(200, { privateValue: 'old-session' }));

    const error = await pending;
    expect(error).toBeInstanceOf(Error);
    expect((error as { reason?: string }).reason).toBe('SESSION_CHANGED');
    expect(fixture.state.accessToken).toBe('same-user-new-token');
  });

  it('does not replay an old write into a same-user replacement session', async () => {
    const staleWrite = deferred<Response>();
    let writeCalls = 0;
    fixture.fetch.mockImplementation((url: string) => {
      if (url.endsWith('/query/row')) {
        writeCalls += 1;
        return staleWrite.promise;
      }
      if (url.endsWith('/expire')) return Promise.resolve(response(401, { message: 'expired' }));
      if (url.endsWith('/auth/refresh')) return Promise.resolve(response(401, { message: 'refresh failed' }));
      return Promise.resolve(response(500, {}));
    });

    const pending = apiService.patch('/query/row', { note: 'old' }).catch(error => error);
    await expect(apiService.get('/expire').catch(error => error)).resolves.toBeInstanceOf(Error);
    fixture.state.accessToken = 'same-user-new-token';
    fixture.state.user = { id: 'user-a', email: 'a@example.test' };
    staleWrite.resolve(response(401, { message: 'old token expired' }));

    await expect(pending).resolves.toBeInstanceOf(Error);
    expect(writeCalls).toBe(1);
    expect(fixture.state.accessToken).toBe('same-user-new-token');
  });

  it.each(['expired-token', 'same-user-new-token'])('discards stale success after terminal 401 logout and same-user login with %s', async (newToken) => {
    const staleRead = deferred<Response>();
    fixture.fetch.mockImplementation((url: string) => url.endsWith('/expire')
      ? Promise.resolve(response(401, { message: 'expired' }))
      : staleRead.promise);
    const pending = apiService.get('/private-data').catch(error => error);
    await expect(apiService.get('/expire', {}, false).catch(error => error)).resolves.toBeInstanceOf(Error);
    expect(fixture.state.logout).toHaveBeenCalledTimes(1);
    fixture.state.accessToken = newToken;
    fixture.state.user = { id: 'user-a', email: 'a@example.test' };
    staleRead.resolve(response(200, { privateValue: 'old-session' }));

    const error = await pending;
    expect(error).toBeInstanceOf(Error);
    expect((error as { reason?: string }).reason).toBe('SESSION_CHANGED');
    expect(fixture.state.accessToken).toBe(newToken);
    expect(fixture.state.logout).toHaveBeenCalledTimes(1);
  });

  it('does not replay an old write after terminal 401 logout and same-user login', async () => {
    const staleWrite = deferred<Response>();
    fixture.fetch.mockImplementation((url: string) => {
      if (url.endsWith('/query/row')) return staleWrite.promise;
      return Promise.resolve(response(401, { message: 'expired' }));
    });
    const pending = apiService.patch('/query/row', { note: 'old' }).catch(error => error);
    await apiService.get('/expire', {}, false).catch(error => error);
    fixture.state.accessToken = 'same-user-new-token';
    fixture.state.user = { id: 'user-a', email: 'a@example.test' };
    staleWrite.resolve(response(401, { message: 'old token expired' }));

    await expect(pending).resolves.toBeInstanceOf(Error);
    expect(fixture.fetch.mock.calls.filter(([url]) => String(url).endsWith('/query/row'))).toHaveLength(1);
    expect(refreshCalls()).toHaveLength(0);
    expect(fixture.state.accessToken).toBe('same-user-new-token');
    expect(fixture.state.logout).toHaveBeenCalledTimes(1);
  });

  it('obsolete refresh cannot restore a same-token relogin after terminal logout', async () => {
    const refresh = deferred<Response>();
    fixture.fetch.mockImplementation((url: string) => url.endsWith('/auth/refresh')
      ? refresh.promise
      : Promise.resolve(response(401, { message: 'expired' })));
    const pending = apiService.get('/read-a').catch(error => error);
    await vi.waitFor(() => expect(refreshCalls()).toHaveLength(1));
    await apiService.get('/expire', {}, false).catch(error => error);
    fixture.state.accessToken = 'expired-token';
    fixture.state.user = { id: 'user-a', email: 'a@example.test' };
    refresh.resolve(response(200, refreshBody()));

    await expect(pending).resolves.toBeInstanceOf(Error);
    expect(fixture.state.restoreSession).not.toHaveBeenCalled();
    expect(fixture.state.accessToken).toBe('expired-token');
    expect(fixture.state.logout).toHaveBeenCalledTimes(1);
  });

  it('shares one refresh across concurrent expired-token reads', async () => {
    const refresh = deferred<Response>();
    fixture.fetch.mockImplementation((url: string, options: RequestInit) => {
      if (url.endsWith('/auth/refresh')) return refresh.promise;
      const headers = new Headers(options.headers);
      return Promise.resolve(headers.get('Authorization') === 'Bearer fresh-token'
        ? response(200, { value: url.split('/').at(-1) })
        : response(401, { message: 'Token expired' }));
    });

    const pending = [apiService.get('/read-a'), apiService.get('/read-b')];
    await vi.waitFor(() => expect(refreshCalls()).toHaveLength(1));
    refresh.resolve(response(200, refreshBody()));

    await expect(Promise.all(pending)).resolves.toEqual([{ value: 'read-a' }, { value: 'read-b' }]);
    expect(fixture.state.restoreSession).toHaveBeenCalledTimes(1);
    expect(fixture.state.logout).not.toHaveBeenCalled();
    expect(fixture.fetch).toHaveBeenCalledTimes(5);
  });

  it('retries a late 401 with the already-refreshed token instead of rotating twice', async () => {
    const late = deferred<Response>();
    fixture.fetch.mockImplementation((url: string, options: RequestInit) => {
      if (url.endsWith('/auth/refresh')) return Promise.resolve(response(200, refreshBody()));
      const headers = new Headers(options.headers);
      if (headers.get('Authorization') === 'Bearer fresh-token') return Promise.resolve(response(200, { value: 'ok' }));
      if (url.endsWith('/read-b')) return late.promise;
      return Promise.resolve(response(401, { message: 'Token expired' }));
    });

    const first = apiService.get('/read-a');
    const second = apiService.get('/read-b');
    await expect(first).resolves.toEqual({ value: 'ok' });
    late.resolve(response(401, { message: 'Token expired' }));
    await expect(second).resolves.toEqual({ value: 'ok' });
    expect(refreshCalls()).toHaveLength(1);
    expect(fixture.state.restoreSession).toHaveBeenCalledTimes(1);
  });

  it('does not restore or replay a write when logout begins during refresh', async () => {
    const refresh = deferred<Response>();
    fixture.fetch.mockResolvedValueOnce(response(401, { message: 'Token expired' })).mockReturnValueOnce(refresh.promise);
    const pending = apiService.patch('/query/row', { note: 'changed' }).catch(error => error);
    await vi.waitFor(() => expect(refreshCalls()).toHaveLength(1));
    apiService.beginLogout();
    fixture.state.logout();
    fixture.state.logout.mockClear();
    refresh.resolve(response(200, refreshBody()));

    await expect(pending).resolves.toBeInstanceOf(Error);
    expect(fixture.state.restoreSession).not.toHaveBeenCalled();
    expect(fixture.state.accessToken).toBeNull();
    expect(fixture.fetch.mock.calls.filter(([url]) => String(url).endsWith('/query/row'))).toHaveLength(1);
  });

  it('cannot replace a later login after logout has completed', async () => {
    const refresh = deferred<Response>();
    fixture.fetch.mockResolvedValueOnce(response(401, { message: 'Token expired' })).mockReturnValueOnce(refresh.promise);
    const pending = apiService.get('/read-a').catch(error => error);
    await vi.waitFor(() => expect(refreshCalls()).toHaveLength(1));
    apiService.beginLogout();
    fixture.state.logout();
    apiService.endLogout();
    fixture.state.accessToken = 'other-session-token';
    fixture.state.user = { id: 'user-b', email: 'b@example.test' };
    fixture.state.logout.mockClear();
    refresh.resolve(response(200, refreshBody()));

    await expect(pending).resolves.toBeInstanceOf(Error);
    expect(fixture.state.accessToken).toBe('other-session-token');
    expect(fixture.state.user?.id).toBe('user-b');
    expect(fixture.state.restoreSession).not.toHaveBeenCalled();
    expect(fixture.state.logout).not.toHaveBeenCalled();
  });

  it('does not log out a newer session when an obsolete refresh fails', async () => {
    const refresh = deferred<Response>();
    fixture.fetch.mockResolvedValueOnce(response(401, { message: 'Token expired' })).mockReturnValueOnce(refresh.promise);
    const pending = apiService.get('/read-a').catch(error => error);
    await vi.waitFor(() => expect(refreshCalls()).toHaveLength(1));
    apiService.beginLogout();
    fixture.state.logout();
    apiService.endLogout();
    fixture.state.accessToken = 'other-session-token';
    fixture.state.user = { id: 'user-b', email: 'b@example.test' };
    fixture.state.logout.mockClear();
    refresh.reject(new TypeError('Refresh connection lost'));

    await expect(pending).resolves.toBeInstanceOf(Error);
    expect(fixture.state.accessToken).toBe('other-session-token');
    expect(fixture.state.logout).not.toHaveBeenCalled();
  });

  it('discards a successful response from before logout instead of returning old user data', async () => {
    const read = deferred<Response>();
    fixture.fetch.mockReturnValueOnce(read.promise);
    const pending = apiService.get('/private-data').catch(error => error);
    apiService.beginLogout();
    fixture.state.logout();
    apiService.endLogout();
    fixture.state.accessToken = 'other-session-token';
    fixture.state.user = { id: 'user-b', email: 'b@example.test' };
    fixture.state.logout.mockClear();
    read.resolve(response(200, { privateValue: 'user-a-only' }));

    await expect(pending).resolves.toBeInstanceOf(Error);
    expect(fixture.state.accessToken).toBe('other-session-token');
    expect(fixture.state.logout).not.toHaveBeenCalled();
  });

  it('does not restore a session when logout happens while the refresh body is being parsed', async () => {
    const body = deferred<ReturnType<typeof refreshBody>>();
    const refreshResponse = response(200, {});
    const parse = vi.spyOn(refreshResponse, 'json').mockReturnValue(body.promise);
    fixture.fetch.mockResolvedValueOnce(response(401, { message: 'Token expired' })).mockResolvedValueOnce(refreshResponse);
    const pending = apiService.get('/read-a').catch(error => error);
    await vi.waitFor(() => expect(parse).toHaveBeenCalledTimes(1));
    apiService.beginLogout();
    fixture.state.logout();
    body.resolve(refreshBody());

    await expect(pending).resolves.toBeInstanceOf(Error);
    expect(fixture.state.restoreSession).not.toHaveBeenCalled();
    expect(fixture.state.accessToken).toBeNull();
  });

  it.each([401, 503])('keeps concurrent refresh failure HTTP %s bounded and allows a later new session to refresh', async (status) => {
    const refresh = deferred<Response>();
    fixture.fetch.mockImplementation((url: string) => url.endsWith('/auth/refresh')
      ? refresh.promise
      : Promise.resolve(response(401, { message: 'Token expired' })));
    const pending = [apiService.get('/read-a').catch(error => error), apiService.get('/read-b').catch(error => error)];
    await vi.waitFor(() => expect(refreshCalls()).toHaveLength(1));
    refresh.resolve(response(status, { message: 'Refresh failed' }));
    const errors = await Promise.all(pending);
    expect(errors.every(error => error instanceof Error)).toBe(true);
    expect(fixture.state.accessToken).toBeNull();
    expect(fixture.state.restoreSession).not.toHaveBeenCalled();
    expect(refreshCalls()).toHaveLength(1);

    fixture.state.accessToken = 'next-expired-token';
    fixture.state.user = { id: 'user-a', email: 'a@example.test' };
    fixture.fetch.mockReset();
    fixture.fetch.mockResolvedValueOnce(response(401, { message: 'Token expired' }))
      .mockResolvedValueOnce(response(200, refreshBody('next-fresh-token')))
      .mockResolvedValueOnce(response(200, { value: 'ok' }));
    await expect(apiService.get('/read-next')).resolves.toEqual({ value: 'ok' });
    expect(fixture.state.accessToken).toBe('next-fresh-token');
    expect(refreshCalls()).toHaveLength(1);
  });
});
