import { useState, useEffect } from 'react';
import { useAppStore } from '@/core/services/store';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/core/config/env';
import { useTheme } from '@/presentation/components/theme-provider';

export const useProfileLogic = (isOpen: boolean, initialTab?: string, onClose?: () => void) => {
    const { user, updateUser, accessToken, logout: storeLogout, lang } = useAppStore();
    const { setTheme: setAppTheme } = useTheme();
    const [isLoading, setIsLoading] = useState(false);

    // Profile State
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [jobRole, setJobRole] = useState('');
    const [bio, setBio] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [address, setAddress] = useState('');

    // Appearance State
    const [theme, setTheme] = useState('dark');
    const [language, setLanguage] = useState('vi');

    // Notifications State
    const [emailNotifications, setEmailNotifications] = useState(true);
    const [failedQueryAlerts, setFailedQueryAlerts] = useState(true);
    const [productUpdates, setProductUpdates] = useState(false);
    const [securityAlerts, setSecurityAlerts] = useState(true);

    // Security State
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // Tab state
    const [activeTab, setActiveTab] = useState('profile');

    // Sync state when dialog opens or user changes
    useEffect(() => {
        if (isOpen && user) {
            setFirstName(user.firstName || '');
            setLastName(user.lastName || '');
            setEmail(user.email || '');
            setUsername(user.username || '');
            setJobRole(user.jobRole || '');
            setBio(user.bio || '');
            setPhoneNumber(user.phoneNumber || '');
            setAddress(user.address || '');
            setTheme(user.theme || 'dark');
            setLanguage(user.language || 'vi');
            setEmailNotifications(user.emailNotifications ?? true);
            setFailedQueryAlerts(user.failedQueryAlerts ?? true);
            setProductUpdates(user.productUpdates ?? false);
            setSecurityAlerts(user.securityAlerts ?? true);
            if (initialTab) setActiveTab(initialTab);
        }
    }, [isOpen, user, initialTab]);

    const handleApiCall = async (endpoint: string, method: string, body: any, successMsg: string) => {
        setIsLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}${endpoint}`, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                },
                body: JSON.stringify(body)
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Something went wrong');

            if (data.id || data.email) {
                updateUser(data);
            }
            toast.success(successMsg);
            return true;
        } catch (err: any) {
            toast.error(err.message);
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveProfile = () => {
        return handleApiCall('/users/profile', 'PATCH', { 
            firstName, lastName, email, username, jobRole, bio, phoneNumber, address 
        }, lang === 'vi' ? "Cập nhật hồ sơ thành công!" : "Profile updated successfully!");
    };

    const handleSaveSettings = (updates: any) => {
        return handleApiCall('/users/settings', 'PATCH', updates, 
            lang === 'vi' ? "Cập nhật cài đặt thành công!" : "Settings updated successfully!");
    };

    const handleChangePassword = async () => {
        if (newPassword !== confirmPassword) {
            toast.error(lang === 'vi' ? "Mật khẩu xác nhận không khớp" : "Passwords do not match");
            return false;
        }
        const success = await handleApiCall('/users/change-password', 'POST', { currentPassword, newPassword }, 
            lang === 'vi' ? "Đổi mật khẩu thành công!" : "Password changed successfully!");
        
        if (success) {
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        }
        return success;
    };

    const handleDeleteAccount = async (confirmText: string, successText: string) => {
        const confirmed = window.confirm(confirmText);
        
        if (confirmed) {
            const success = await handleApiCall('/users/me', 'DELETE', {}, successText);
            if (success) {
                onClose?.();
                storeLogout();
            }
            return success;
        }
        return false;
    };

    const handleUpdateBilling = (plan: string, successMsg: string) => {
        return handleApiCall('/users/billing', 'PATCH', { 
            plan, paymentMethod: 'Visa ending in 4242' 
        }, successMsg);
    };

    return {
        user,
        isLoading,
        setIsLoading,
        profileState: {
            firstName, setFirstName,
            lastName, setLastName,
            email, setEmail,
            username, setUsername,
            jobRole, setJobRole,
            bio, setBio,
            phoneNumber, setPhoneNumber,
            address, setAddress
        },
        appearanceState: {
            theme, setTheme,
            language, setLanguage,
            setAppTheme
        },
        notificationsState: {
            emailNotifications, setEmailNotifications,
            failedQueryAlerts, setFailedQueryAlerts,
            productUpdates, setProductUpdates,
            securityAlerts, setSecurityAlerts
        },
        securityState: {
            currentPassword, setCurrentPassword,
            newPassword, setNewPassword,
            confirmPassword, setConfirmPassword
        },
        activeTab,
        setActiveTab,
        actions: {
            handleSaveProfile,
            handleSaveSettings,
            handleChangePassword,
            handleDeleteAccount,
            handleUpdateBilling,
            handleApiCall
        }
    };
};
