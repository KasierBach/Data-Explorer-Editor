export const PAID_PLAN_CODES = ['pro_monthly', 'pro_yearly'] as const;
export type PaidPlanCode = (typeof PAID_PLAN_CODES)[number];

export const PAYMENT_PROVIDERS = ['momo', 'zalopay'] as const;
export type PaymentProviderName = (typeof PAYMENT_PROVIDERS)[number];

export interface BillingPlan {
    code: 'free' | PaidPlanCode;
    name: string;
    cadence: string;
    amountVnd: string;
    displayAmountUsd: string;
    description: string;
    features: string[];
}

export const billingPlans: BillingPlan[] = [
    {
        code: 'free',
        name: 'Free',
        cadence: 'forever',
        amountVnd: '0 VND',
        displayAmountUsd: '$0',
        description: 'For local exploration and personal projects.',
        features: ['Local SQL and NoSQL workspace', 'Basic AI assistant', 'Schema browsing'],
    },
    {
        code: 'pro_monthly',
        name: 'Pro Monthly',
        cadence: '30 days',
        amountVnd: '149,000 VND',
        displayAmountUsd: '~$5.99',
        description: 'A flexible Pro pass for heavier database work.',
        features: ['Advanced AI workflows', 'Cloud database workflows', 'Priority workspace features'],
    },
    {
        code: 'pro_yearly',
        name: 'Pro Yearly',
        cadence: '365 days',
        amountVnd: '1,490,000 VND',
        displayAmountUsd: '~$59.99',
        description: 'Best value for daily use across the year.',
        features: ['Everything in monthly Pro', 'Two months included', 'Longer access window'],
    },
];

export const paidBillingPlans = billingPlans.filter(
    (plan): plan is BillingPlan & { code: PaidPlanCode } => plan.code !== 'free',
);

export const paymentProviderLabels: Record<PaymentProviderName, string> = {
    momo: 'MoMo',
    zalopay: 'ZaloPay',
};
