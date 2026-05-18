import React from 'react';
import { Button } from '@/presentation/components/ui/button';
import { BadgeCheck, Clock3, CreditCard, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import type { AuthUser } from '@/core/services/store/slices/authSlice';
import {
    paidBillingPlans,
    paymentProviderLabels,
    type PaidPlanCode,
    type PaymentProviderName,
} from '@/core/billing/billingPlans';

interface BillingTabProps {
    user: AuthUser | null;
    t: (key: string) => string;
    isLoading: boolean;
    actions: {
        handleStartCheckout: (planCode: PaidPlanCode, provider: PaymentProviderName) => void;
        handleRefreshBilling: () => void;
    };
}

const paymentProviders = Object.entries(paymentProviderLabels) as [PaymentProviderName, string][];

function formatDate(value?: string) {
    if (!value) return 'Not active';
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
}

export const BillingTab: React.FC<BillingTabProps> = ({
    user,
    t,
    isLoading,
    actions,
}) => {
    const isPro = user?.plan === 'pro' && user?.subscriptionStatus === 'active';
    const expiresAt = user?.planExpiresAt || user?.billingDate;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h3 className="text-lg font-semibold">{t('tabs.billing')}</h3>
                    <p className="text-sm text-muted-foreground">
                        Real checkout through MoMo and ZaloPay. Prices are charged in VND.
                    </p>
                </div>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-fit gap-2 border-border/60"
                    disabled={isLoading}
                    onClick={() => actions.handleRefreshBilling()}
                >
                    <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            <section className="rounded-lg border border-border bg-card p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2 text-emerald-400">
                            {isPro ? <BadgeCheck className="h-5 w-5" /> : <Clock3 className="h-5 w-5" />}
                        </div>
                        <div>
                            <p className="text-xs font-medium uppercase text-muted-foreground">Current plan</p>
                            <h4 className="mt-1 text-xl font-semibold">
                                {isPro ? 'Data Explorer Pro' : 'Data Explorer Free'}
                            </h4>
                            <p className="text-sm text-muted-foreground">
                                {isPro ? `Active until ${formatDate(expiresAt)}` : 'Upgrade with a time-based Pro pass.'}
                            </p>
                        </div>
                    </div>
                    <div className="rounded-md border border-border/70 px-3 py-2 text-sm">
                        <span className="text-muted-foreground">Status </span>
                        <span className={isPro ? 'text-emerald-400' : 'text-muted-foreground'}>
                            {isPro ? 'active' : 'inactive'}
                        </span>
                    </div>
                </div>
            </section>

            <section className="space-y-3">
                <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold">Choose Pro access</h4>
                    <span className="text-xs text-muted-foreground">USD is reference copy only</span>
                </div>

                <div className="grid gap-3">
                    {paidBillingPlans.map((plan) => (
                        <div
                            key={plan.code}
                            className="rounded-lg border border-border bg-card/70 p-4"
                        >
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                                        <h5 className="text-base font-semibold">{plan.name}</h5>
                                        <span className="text-xs text-muted-foreground">{plan.cadence}</span>
                                    </div>
                                    <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                                        <span className="text-2xl font-semibold">{plan.amountVnd}</span>
                                        <span className="text-xs text-muted-foreground">{plan.displayAmountUsd}</span>
                                    </div>
                                    <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {paymentProviders.map(([provider, label]) => (
                                        <Button
                                            key={`${plan.code}-${provider}`}
                                            type="button"
                                            disabled={isLoading}
                                            className="gap-2"
                                            variant={provider === 'momo' ? 'default' : 'outline'}
                                            onClick={() => actions.handleStartCheckout(plan.code, provider)}
                                        >
                                            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                                            {plan.code === 'pro_monthly' ? 'Monthly' : 'Yearly'} with {label}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <section className="rounded-lg border border-border bg-muted/20 p-4">
                <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 h-5 w-5 text-blue-400" />
                    <div>
                        <h4 className="text-sm font-semibold">Supported payment methods</h4>
                        <p className="mt-1 text-sm text-muted-foreground">
                            MoMo and ZaloPay checkout are confirmed by provider webhook before Pro is activated.
                        </p>
                    </div>
                </div>
            </section>
        </div>
    );
};
