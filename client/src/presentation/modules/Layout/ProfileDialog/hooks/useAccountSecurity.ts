import { useState } from 'react';
import { useAppStore } from '@/core/services/store';
import { apiService } from '@/core/services/api.service';
import { toast } from 'sonner';
import { AuthService } from '@/core/services/AuthService';
import { getProfileDialogText } from '../profileI18n';

const getErrorMessage = (error: unknown) => (
    error instanceof Error ? error.message : 'Something went wrong'
);

export const useAccountSecurity = (onClose?: () => void) => {
    const { lang } = useAppStore();
    const text = getProfileDialogText(lang);
    const [isLoading, setIsLoading] = useState(false);

    // Security State
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const handleChangePassword = async () => {
        if (newPassword !== confirmPassword) {
            toast.error(text.passwordsDoNotMatch);
            return false;
        }
        
        setIsLoading(true);
        try {
            await apiService.post('/users/change-password', { currentPassword, newPassword });
            toast.success(text.passwordChanged);
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            return true;
        } catch (err) {
            toast.error(getErrorMessage(err));
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteAccount = async (confirmText: string, successText: string) => {
        const confirmed = window.confirm(confirmText);
        
        if (confirmed) {
            setIsLoading(true);
            try {
                await apiService.delete('/users/me');
                toast.success(successText);
                onClose?.();
                await AuthService.logoutAndRedirect('/login');
                return true;
            } catch (err) {
                toast.error(getErrorMessage(err));
                return false;
            } finally {
                setIsLoading(false);
            }
        }
        return false;
    };

    return {
        isLoading,
        state: {
            currentPassword, setCurrentPassword,
            newPassword, setNewPassword,
            confirmPassword, setConfirmPassword
        },
        handleChangePassword,
        handleDeleteAccount
    };
};
