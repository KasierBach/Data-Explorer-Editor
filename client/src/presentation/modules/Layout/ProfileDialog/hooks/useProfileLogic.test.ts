import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useProfileLogic } from './useProfileLogic';
import { useAppStore } from '@/core/services/store';
import { useUserProfile } from './useUserProfile';
import { useUserSettings } from './useUserSettings';
import { useAccountSecurity } from './useAccountSecurity';
import { useBilling } from './useBilling';

vi.mock('@/core/services/store', () => ({
  useAppStore: vi.fn(),
}));

vi.mock('./useUserProfile', () => ({
  useUserProfile: vi.fn(),
}));

vi.mock('./useUserSettings', () => ({
  useUserSettings: vi.fn(),
}));

vi.mock('./useAccountSecurity', () => ({
  useAccountSecurity: vi.fn(),
}));

vi.mock('./useBilling', () => ({
  useBilling: vi.fn(),
}));

const mockUseAppStore = vi.mocked(useAppStore);
const mockUseUserProfile = vi.mocked(useUserProfile);
const mockUseUserSettings = vi.mocked(useUserSettings);
const mockUseAccountSecurity = vi.mocked(useAccountSecurity);
const mockUseBilling = vi.mocked(useBilling);

describe('useProfileLogic', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseAppStore.mockReturnValue({
      user: null,
    } as ReturnType<typeof useAppStore>);

    mockUseUserProfile.mockReturnValue({
      isLoading: false,
      state: {
        firstName: '',
        setFirstName: vi.fn(),
        lastName: '',
        setLastName: vi.fn(),
        email: '',
        setEmail: vi.fn(),
        username: '',
        setUsername: vi.fn(),
        jobRole: '',
        setJobRole: vi.fn(),
        bio: '',
        setBio: vi.fn(),
        phoneNumber: '',
        setPhoneNumber: vi.fn(),
        address: '',
        setAddress: vi.fn(),
      },
      handleSaveProfile: vi.fn(),
      handleUploadAvatar: vi.fn(),
    });

    mockUseUserSettings.mockReturnValue({
      isLoading: false,
      appearanceState: {
        language: 'en',
      },
      notificationsState: {},
      handleSaveSettings: vi.fn(),
    });

    mockUseAccountSecurity.mockReturnValue({
      isLoading: false,
      state: {
        currentPassword: '',
        setCurrentPassword: vi.fn(),
        newPassword: '',
        setNewPassword: vi.fn(),
        confirmPassword: '',
        setConfirmPassword: vi.fn(),
      },
      handleChangePassword: vi.fn(),
      handleDeleteAccount: vi.fn(),
    });

    mockUseBilling.mockReturnValue({
      isLoading: false,
      handleUpdateBilling: vi.fn(),
    });
  });

  it('syncs the active tab when the requested initial tab changes before opening', () => {
    const { result, rerender } = renderHook(
      ({ isOpen, initialTab }) => useProfileLogic(isOpen, initialTab),
      {
        initialProps: {
          isOpen: false,
          initialTab: 'profile',
        },
      },
    );

    expect(result.current.activeTab).toBe('profile');

    rerender({
      isOpen: true,
      initialTab: 'advanced',
    });

    expect(result.current.activeTab).toBe('advanced');
  });
});
