import { useState } from 'react';
import { useAppStore } from '@/core/services/store';
import { apiService } from '@/core/services/api.service';
import { toast } from 'sonner';

export const useAccountSecurity = (onClose?: () => void) => {
    const { logout: storeLogout, lang } = useAppStore();
    const [isLoading, setIsLoading] = useState(false);

    // Security State
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const handleChangePassword = async () => {
        if (newPassword !== confirmPassword) {
            toast.error(lang === 'vi' ? "Mật khẩu xác nhận không khớp" : "Passwords do not match");
            return false;
        }
        
        setIsLoading(true);
        try {
            await apiService.post('/users/change-password', { currentPassword, newPassword });
            toast.success(lang === 'vi' ? "Đổi mật khẩu thành công!" : "Password changed successfully!");
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            return true;
        } catch (err: any) {
            toast.error(err.message);
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
                storeLogout();
                return true;
            } catch (err: any) {
                toast.error(err.message);
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
