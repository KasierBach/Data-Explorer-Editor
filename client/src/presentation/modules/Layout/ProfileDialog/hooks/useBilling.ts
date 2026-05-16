import { useState } from 'react';
import { useAppStore } from '@/core/services/store';
import { apiService } from '@/core/services/api.service';
import { toast } from 'sonner';
import type { AuthUser } from '@/core/services/store/slices/authSlice';

const getErrorMessage = (error: unknown) => (
    error instanceof Error ? error.message : 'Something went wrong'
);

export const useBilling = () => {
    const { updateUser, lang } = useAppStore();
    const [isLoading, setIsLoading] = useState(false);

    const handleUpdateBilling = async (plan: string) => {
        setIsLoading(true);
        const successMsg = lang === 'vi' ? "Cập nhật gói thành công!" : "Plan updated successfully!";
        try {
            const data = await apiService.patch<AuthUser>('/users/billing', { 
                plan, paymentMethod: 'Visa ending in 4242' 
            });
            updateUser(data);
            toast.success(successMsg);
            return true;
        } catch (err) {
            toast.error(getErrorMessage(err));
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    return {
        isLoading,
        handleUpdateBilling
    };
};
