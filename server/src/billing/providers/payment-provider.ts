import type { BillingPlan, PaidPlanCode } from '../billing-plans';

export const PAYMENT_PROVIDERS = ['momo', 'zalopay'] as const;
export type PaymentProviderName = (typeof PAYMENT_PROVIDERS)[number];

export interface CheckoutRequest {
  paymentId: string;
  providerOrderId: string;
  userId: string;
  planCode: PaidPlanCode;
  planName: string;
  amountVnd: number;
  displayAmountUsd: string;
  durationDays: number;
}

export interface CheckoutResult {
  providerOrderId: string;
  providerRequestId?: string;
  checkoutUrl: string;
  rawResponse?: unknown;
}

export type VerifiedPaymentStatus = 'paid' | 'failed' | 'pending';

export interface VerifiedPayment {
  isValid: boolean;
  status: VerifiedPaymentStatus;
  providerOrderId: string;
  providerTransactionId?: string;
  paidAt?: Date;
  rawPayload: unknown;
}

export interface PaymentProvider {
  name: PaymentProviderName;
  displayName: string;
  createCheckout(input: CheckoutRequest): Promise<CheckoutResult>;
  verifyWebhook(payload: unknown): Promise<VerifiedPayment>;
}

export function createCheckoutRequest(
  paymentId: string,
  providerOrderId: string,
  userId: string,
  plan: BillingPlan,
): CheckoutRequest {
  return {
    paymentId,
    providerOrderId,
    userId,
    planCode: plan.code,
    planName: plan.name,
    amountVnd: plan.amountVnd,
    displayAmountUsd: plan.displayAmountUsd,
    durationDays: plan.durationDays,
  };
}
