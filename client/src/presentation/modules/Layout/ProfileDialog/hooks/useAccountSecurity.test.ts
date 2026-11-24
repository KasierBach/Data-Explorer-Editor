import { act, renderHook } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { useAccountSecurity } from './useAccountSecurity';

const mocks = vi.hoisted(() => ({
  useAppStore: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
  logoutAndRedirect: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/core/services/store', () => ({ useAppStore: mocks.useAppStore }));
vi.mock('@/core/services/api.service', () => ({ apiService: { post: mocks.post, delete: mocks.delete } }));
vi.mock('@/core/services/AuthService', () => ({ AuthService: { logoutAndRedirect: mocks.logoutAndRedirect } }));
vi.mock('sonner', () => ({ toast: { success: mocks.success, error: mocks.error } }));

describe('useAccountSecurity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useAppStore.mockReturnValue({ lang: 'en' });
    mocks.post.mockResolvedValue({ message: 'Password updated successfully' });
    mocks.delete.mockResolvedValue({ message: 'Account deleted successfully' });
    mocks.logoutAndRedirect.mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ['en', 'Password changed successfully. Please sign in again.'],
    ['vi', 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại.'],
  ])('closes and reauthenticates with same-account recovery after a successful password change in %s', async (lang, message) => {
    mocks.useAppStore.mockReturnValue({ lang });
    const onClose = vi.fn();
    const { result } = renderHook(() => useAccountSecurity(onClose));
    act(() => {
      result.current.state.setCurrentPassword('old-password');
      result.current.state.setNewPassword('new-password');
      result.current.state.setConfirmPassword('new-password');
    });

    await act(async () => {
      expect(await result.current.handleChangePassword()).toBe(true);
    });

    expect(mocks.post).toHaveBeenCalledWith('/users/change-password', {
      currentPassword: 'old-password',
      newPassword: 'new-password',
    });
    expect(mocks.success).toHaveBeenCalledWith(message);
    expect(result.current.state.currentPassword).toBe('');
    expect(result.current.state.newPassword).toBe('');
    expect(result.current.state.confirmPassword).toBe('');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mocks.logoutAndRedirect).toHaveBeenCalledWith('/login', {
      preserveWorkspace: true,
      remoteLogout: false,
    });
    expect(onClose.mock.invocationCallOrder[0]).toBeLessThan(mocks.logoutAndRedirect.mock.invocationCallOrder[0]);
    expect(result.current.isLoading).toBe(false);
  });

  it('waits for server success before clearing passwords or redirecting', async () => {
    let resolveChange!: (value: { message: string }) => void;
    mocks.post.mockReturnValue(new Promise((resolve) => { resolveChange = resolve; }));
    const onClose = vi.fn();
    const { result } = renderHook(() => useAccountSecurity(onClose));
    act(() => {
      result.current.state.setCurrentPassword('old-password');
      result.current.state.setNewPassword('new-password');
      result.current.state.setConfirmPassword('new-password');
    });
    let pending!: Promise<boolean>;
    act(() => { pending = result.current.handleChangePassword(); });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.state.currentPassword).toBe('old-password');
    expect(onClose).not.toHaveBeenCalled();
    expect(mocks.logoutAndRedirect).not.toHaveBeenCalled();

    await act(async () => {
      resolveChange({ message: 'Password updated successfully' });
      await pending;
    });
    expect(mocks.logoutAndRedirect).toHaveBeenCalledTimes(1);
  });

  it('retains password fields and the active session when a password change fails', async () => {
    mocks.post.mockRejectedValue(new Error('Current password does not match'));
    const onClose = vi.fn();
    const { result } = renderHook(() => useAccountSecurity(onClose));
    act(() => {
      result.current.state.setCurrentPassword('old-password');
      result.current.state.setNewPassword('new-password');
      result.current.state.setConfirmPassword('new-password');
    });

    await act(async () => {
      expect(await result.current.handleChangePassword()).toBe(false);
    });

    expect(mocks.error).toHaveBeenCalledWith('Current password does not match');
    expect(result.current.state.currentPassword).toBe('old-password');
    expect(result.current.state.newPassword).toBe('new-password');
    expect(onClose).not.toHaveBeenCalled();
    expect(mocks.logoutAndRedirect).not.toHaveBeenCalled();
  });

  it('does not revoke or redirect when confirmation passwords do not match', async () => {
    const { result } = renderHook(() => useAccountSecurity());
    act(() => {
      result.current.state.setNewPassword('new-password');
      result.current.state.setConfirmPassword('different-password');
    });

    await act(async () => {
      expect(await result.current.handleChangePassword()).toBe(false);
    });

    expect(mocks.error).toHaveBeenCalledWith('Passwords do not match');
    expect(mocks.post).not.toHaveBeenCalled();
    expect(mocks.logoutAndRedirect).not.toHaveBeenCalled();
  });

  it('keeps normal account-delete logout behavior unchanged', async () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useAccountSecurity(onClose));

    await act(async () => {
      expect(await result.current.handleDeleteAccount('Delete account?', 'Account deleted')).toBe(true);
    });

    expect(mocks.delete).toHaveBeenCalledWith('/users/me');
    expect(mocks.success).toHaveBeenCalledWith('Account deleted');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mocks.logoutAndRedirect).toHaveBeenCalledWith('/login');
  });

  it('shows a deletion conflict without logging out or closing the profile dialog', async () => {
    const message = 'This account cannot be deleted while retained activity history is linked to it.';
    mocks.delete.mockRejectedValue(Object.assign(new Error(message), { statusCode: 409 }));
    const onClose = vi.fn();
    const { result } = renderHook(() => useAccountSecurity(onClose));

    await act(async () => {
      expect(await result.current.handleDeleteAccount('Delete account?', 'Account deleted')).toBe(false);
    });

    expect(mocks.error).toHaveBeenCalledWith(message);
    expect(mocks.success).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(mocks.logoutAndRedirect).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });

  it('does not delete or sign out when account deletion is cancelled', async () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    const { result } = renderHook(() => useAccountSecurity());

    await act(async () => {
      expect(await result.current.handleDeleteAccount('Delete account?', 'Account deleted')).toBe(false);
    });

    expect(mocks.delete).not.toHaveBeenCalled();
    expect(mocks.logoutAndRedirect).not.toHaveBeenCalled();
  });
});
