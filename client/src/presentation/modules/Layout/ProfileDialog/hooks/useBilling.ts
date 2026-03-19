import { useState } from 'react';
import { useAppStore } from '@/core/services/store';
import { apiService } from '@/core/services/api.service';
import { toast } from 'sonner';

export const useBilling = () => {
    const { updateUser, lang } = useAppStore();
    const [isLoading, setIsLoading] = useState(false);

    const handleUpdateBilling = async (plan: string) => {
        setIsLoading(true);
        const successMsg = lang === 'vi' ? "Cập nhật gói thành công!" : "Plan updated successfully!";
        try {
            const data = await apiService.patch<any>('/users/billing', { 
                plan, paymentMethod: 'Visa ending in 4242' 
            });
            updateUser(data);
            toast.success(successMsg);
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
        handleUpdateBilling
    };
};
