// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './AuthService';
import { createAuthSlice, type AuthUser } from './store/slices/authSlice';

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  beginLogout: vi.fn(),
  endLogout: vi.fn(),
  getState: vi.fn(),
}));

vi.mock('./api.service', () => ({
  apiService: {
    post: mocks.post,
    beginLogout: mocks.beginLogout,
    endLogout: mocks.endLogout,
  },
}));

vi.mock('./store', () => ({
  useAppStore: { getState: mocks.getState },
}));

const userA: AuthUser = { id: 'user-a', email: 'ada@example.com' };
const userB: AuthUser = { id: 'user-b', email: 'grace@example.com' };
const draftTab = {
  id: 'query-1',
  title: 'Unsaved query',
  type: 'query',
  metadata: { sql: 'select * from pending_edits;' },
};

function createTestStore() {
  let state: Record<string, unknown> = {};
  const store = {
    ...createAuthSlice(
      ((partial: unknown) => {
        const next = typeof partial === 'function' ? partial(state) : partial;
        state = { ...state, ...(next as Record<string, unknown>) };
        Object.assign(store, state);
      }) as never,
      undefined as never,
      undefined as never,
    ),
  };
  state = { ...store };
  store.login('old-access-token', userA, 123);
  const setState = (partial: Record<string, unknown>) => {
    state = { ...state, ...partial };
    Object.assign(store, state);
  };
  setState({ tabs: [draftTab], activeTabId: draftTab.id, queryHistory: [{ id: 'history-1' }] });
  return { store, getState: () => state };
}

describe('AuthService logout and password-change reauthentication', () => {
  const replace = vi.fn();
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
    clear: () => values.clear(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    storage.clear();
    vi.stubGlobal('window', { location: { replace }, localStorage: storage });
    mocks.post.mockResolvedValue({ message: 'Logged out.' });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('clears local auth and invalidates in-flight requests without a stale-cookie remote logout after password change', async () => {
    const { store, getState } = createTestStore();
    const logout = vi.spyOn(store, 'logout');
    mocks.getState.mockReturnValue(store);

    await AuthService.logoutAndRedirect('/login', { preserveWorkspace: true, remoteLogout: false });

    expect(mocks.beginLogout).toHaveBeenCalledTimes(1);
    expect(mocks.post).not.toHaveBeenCalled();
    expect(logout).toHaveBeenCalledWith({ preserveWorkspace: true });
    expect(getState()).toMatchObject({
      isAuthenticated: false,
      accessToken: null,
      user: null,
      tabs: [],
      queryHistory: [],
    });
    expect(replace).toHaveBeenCalledWith('/login');
    expect(mocks.beginLogout.mock.invocationCallOrder[0]).toBeLessThan(logout.mock.invocationCallOrder[0]);
    expect(mocks.endLogout).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(mocks.endLogout).toHaveBeenCalledTimes(1);
  });

  it('recovers drafts only when the same account signs back in after password rotation', async () => {
    const { store, getState } = createTestStore();
    mocks.getState.mockReturnValue(store);

    await AuthService.logoutAndRedirect('/login', { preserveWorkspace: true, remoteLogout: false });
    store.login('new-access-token', userA, 456);

    expect(getState().tabs).toEqual([draftTab]);
    expect(getState().activeTabId).toBe(draftTab.id);
    expect(getState().queryHistory).toEqual([]);
  });

  it('does not expose the previous account drafts when another account signs in', async () => {
    const { store, getState } = createTestStore();
    mocks.getState.mockReturnValue(store);

    await AuthService.logoutAndRedirect('/login', { preserveWorkspace: true, remoteLogout: false });
    store.login('other-access-token', userB, 456);

    expect(getState().tabs).toEqual([]);
    expect(getState().activeTabId).toBeNull();
    expect(getState().user).toMatchObject(userB);
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it('keeps normal signout remote revocation and non-recoverable workspace clearing unchanged', async () => {
    const { store, getState } = createTestStore();
    const logout = vi.spyOn(store, 'logout');
    mocks.getState.mockReturnValue(store);

    await AuthService.logoutAndRedirect('/login');

    expect(mocks.post).toHaveBeenCalledWith('/auth/logout', {}, {}, false);
    expect(logout).toHaveBeenCalledWith({ preserveWorkspace: false });
    store.login('new-access-token', userA, 456);
    expect(getState().tabs).toEqual([]);
    expect(replace).toHaveBeenCalledWith('/login');
  });

  it('still completes a normal signout when remote logout fails', async () => {
    const { store, getState } = createTestStore();
    mocks.getState.mockReturnValue(store);
    mocks.post.mockRejectedValue(new Error('Network unavailable'));

    await AuthService.logoutAndRedirect('/login');

    expect(getState().accessToken).toBeNull();
    expect(replace).toHaveBeenCalledWith('/login');
    store.login('new-access-token', userA, 456);
    expect(getState().tabs).toEqual([]);
  });
});
