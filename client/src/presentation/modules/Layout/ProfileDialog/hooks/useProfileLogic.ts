import { useState } from 'react';
import { useAppStore } from '@/core/services/store';
import { apiService } from '@/core/services/api.service';
import { useUserProfile } from './useUserProfile';
import { useUserSettings } from './useUserSettings';
import { useAccountSecurity } from './useAccountSecurity';
import { useBilling } from './useBilling';

export const useProfileLogic = (isOpen: boolean, initialTab?: string, onClose?: () => void) => {
    const { user } = useAppStore();
    const [activeTab, setActiveTab] = useState(initialTab || 'profile');

    const { isLoading: isProfileLoading, state: profileState, handleSaveProfile, handleUploadAvatar } = useUserProfile(isOpen);
    const { isLoading: isSettingsLoading, appearanceState, notificationsState, handleSaveSettings } = useUserSettings(isOpen);
    const { isLoading: isSecurityLoading, state: securityState, handleChangePassword, handleDeleteAccount } = useAccountSecurity(onClose);
    const { isLoading: isBillingLoading, handleUpdateBilling } = useBilling();

    const isLoading = isProfileLoading || isSettingsLoading || isSecurityLoading || isBillingLoading;

    return {
        user,
        isLoading,
        profileState,
        appearanceState,
        notificationsState,
        securityState,
        activeTab,
        setActiveTab,
        actions: {
            handleSaveProfile,
            handleUploadAvatar,
            handleSaveSettings,
            handleChangePassword,
            handleDeleteAccount,
            handleUpdateBilling,
            handleApiCall: apiService.request.bind(apiService) // For backward compatibility
        }
    };
};
