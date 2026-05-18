import { useState } from 'react';
import { toast } from 'sonner';
import type { PaidPlanCode, PaymentProviderName } from '@/core/billing/billingPlans';
import { BillingService } from '@/core/services/BillingService';
import { useAppStore } from '@/core/services/store';

const getErrorMessage = (error: unknown) => (
    error instanceof Error ? error.message : 'Something went wrong'
);

export const useBilling = () => {
    const updateUser = useAppStore((state) => state.updateUser);
    const [isLoading, setIsLoading] = useState(false);

    const handleStartCheckout = async (planCode: PaidPlanCode, provider: PaymentProviderName) => {
        setIsLoading(true);
        try {
            const checkout = await BillingService.createCheckout(planCode, provider);
            window.location.assign(checkout.checkoutUrl);
            return true;
        } catch (err) {
            toast.error(getErrorMessage(err));
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const handleRefreshBilling = async () => {
        setIsLoading(true);
        try {
            const latestUser = await BillingService.refreshCurrentUser();
            updateUser(latestUser);
            toast.success('Billing history refreshed');
            return latestUser;
        } catch (err) {
            toast.error(getErrorMessage(err));
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    return {
        isLoading,
        handleStartCheckout,
        handleRefreshBilling,
    };
};
