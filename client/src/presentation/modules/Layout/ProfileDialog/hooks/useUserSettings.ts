import { useState, useEffect } from 'react';
import { useAppStore } from '@/core/services/store';
import { apiService } from '@/core/services/api.service';
import { toast } from 'sonner';
import { useTheme } from '@/presentation/components/theme-provider';

export const useUserSettings = (isOpen: boolean) => {
    const { user, updateUser, lang, setLang } = useAppStore();
    const { setTheme: setAppTheme } = useTheme();
    const [isLoading, setIsLoading] = useState(false);

    // Appearance State
    const [theme, setTheme] = useState('dark');
    const [language, setLanguage] = useState('vi');

    // Notifications State
    const [emailNotifications, setEmailNotifications] = useState(true);
    const [failedQueryAlerts, setFailedQueryAlerts] = useState(true);
    const [productUpdates, setProductUpdates] = useState(false);
    const [securityAlerts, setSecurityAlerts] = useState(true);

    useEffect(() => {
        if (isOpen && user) {
            setTheme(user.theme || 'dark');
            setLanguage(user.language || 'vi');
            setEmailNotifications(user.emailNotifications ?? true);
            setFailedQueryAlerts(user.failedQueryAlerts ?? true);
            setProductUpdates(user.productUpdates ?? false);
            setSecurityAlerts(user.securityAlerts ?? true);
        }
    }, [isOpen, user]);

    const handleSaveSettings = async (updates: any) => {
        setIsLoading(true);
        try {
            if (updates.language) {
                setLang(updates.language);
            }
            const data = await apiService.patch<any>('/users/settings', updates);
            updateUser(data);
            toast.success(lang === 'vi' ? "Cập nhật cài đặt thành công!" : "Settings updated successfully!");
            return true;
        } catch (err: any) {
            toast.error(err.message);
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    return {
        isLoading,
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
        handleSaveSettings
    };
};
