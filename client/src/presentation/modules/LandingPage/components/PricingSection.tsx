import React from 'react';
import { Check, CreditCard } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { Badge } from '@/presentation/components/ui/badge';
import { billingPlans } from '@/core/billing/billingPlans';
import { cn } from '@/lib/utils';
import { getWorkspaceText } from '@/core/utils/workspaceText';

interface PricingSectionProps {
    lang: string;
    addToRevealRefs: (el: HTMLDivElement | null) => void;
}

export const PricingSection: React.FC<PricingSectionProps> = ({ lang, addToRevealRefs }) => {
    const text = getWorkspaceText(lang).pricingSection;

    const handleOpenBilling = () => {
        window.location.href = '/sql-explorer';
    };

    return (
        <section id="pricing" className="relative py-20">
            <div className="container mx-auto px-4 sm:px-6">
                <div ref={addToRevealRefs} className="reveal mx-auto mb-12 max-w-2xl text-center">
                    <h2 className="mb-4 text-3xl font-semibold tracking-normal md:text-5xl">
                        {text.title}
                    </h2>
                    <p className="text-base font-medium text-muted-foreground md:text-lg">
                        {text.description}
                    </p>
                </div>

                <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-3">
                    {billingPlans.map((plan, index) => {
                        const isPopular = plan.code === 'pro_yearly';
                        return (
                            <div
                                key={plan.code}
                                ref={addToRevealRefs}
                                className={cn(
                                    'reveal flex min-h-[420px] flex-col rounded-lg border bg-card p-6 transition-colors',
                                    isPopular
                                        ? 'border-blue-500/50 bg-blue-500/5'
                                        : 'border-border/70',
                                    `stagger-${index + 1}`,
                                )}
                            >
                                <div className="mb-5 flex items-start justify-between gap-3">
                                    <div>
                                        <h3 className="text-lg font-semibold">{plan.name}</h3>
                                        <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
                                    </div>
                                    {isPopular && (
                                        <Badge className="bg-blue-600 text-white">{text.bestValue}</Badge>
                                    )}
                                </div>

                                <div className="mb-5">
                                    <div className="text-3xl font-semibold">{plan.amountVnd}</div>
                                    <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                                        <span>{plan.displayAmountUsd}</span>
                                        <span>/ {plan.cadence}</span>
                                    </div>
                                </div>

                                <div className="mb-5 h-px bg-border/70" />

                                <ul className="mb-6 flex-1 space-y-3">
                                    {plan.features.map((feature) => (
                                        <li key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
                                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
                                            <span>{feature}</span>
                                        </li>
                                    ))}
                                </ul>

                                <Button
                                    type="button"
                                    className="w-full gap-2"
                                    variant={plan.code === 'free' ? 'outline' : 'default'}
                                    onClick={handleOpenBilling}
                                >
                                    <CreditCard className="h-4 w-4" />
                                    {plan.code === 'free'
                                        ? text.openWorkspace
                                        : text.upgradeInProfile}
                                </Button>
                            </div>
                        );
                    })}
                </div>

                <p className="mx-auto mt-6 max-w-3xl text-center text-xs text-muted-foreground">
                    {text.footerNote}
                </p>
            </div>
        </section>
    );
};
