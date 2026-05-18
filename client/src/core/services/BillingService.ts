import { apiService } from './api.service';
import type { PaidPlanCode, PaymentProviderName } from '@/core/billing/billingPlans';
import type { AuthUser } from './store/slices/authSlice';

export interface CheckoutResponse {
    paymentId: string;
    provider: PaymentProviderName;
    providerOrderId: string;
    checkoutUrl: string;
}

export interface BillingStatusResponse {
    payment: {
        id: string;
        provider: PaymentProviderName;
        planCode: PaidPlanCode;
        amountVnd: number;
        displayAmountUsd: string;
        status: string;
        paidAt?: string;
        createdAt?: string;
    };
    user: AuthUser;
}

export const BillingService = {
    createCheckout(planCode: PaidPlanCode, provider: PaymentProviderName) {
        return apiService.post<CheckoutResponse>('/billing/checkout', { planCode, provider });
    },

    getPaymentStatus(paymentId: string) {
        return apiService.get<BillingStatusResponse>(`/billing/status/${paymentId}`);
    },

    getHistory() {
        return apiService.get<BillingStatusResponse['payment'][]>('/billing/history');
    },

    refreshCurrentUser() {
        return apiService.get<AuthUser>('/users/me');
    },
};
