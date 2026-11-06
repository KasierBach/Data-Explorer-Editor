import React from 'react';
import { Check, CreditCard } from 'lucide-react';
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
    const plans = lang === 'vi'
        ? billingPlans.map((plan) => {
            if (plan.code === 'free') {
                return {
                    ...plan,
                    name: 'Mi\u1ec5n ph\u00ed',
                    cadence: 'm\u00e3i m\u00e3i',
                    description: 'Kh\u00e1m ph\u00e1 c\u1ee5c b\u1ed9 v\u00e0 d\u1ef1 \u00e1n c\u00e1 nh\u00e2n.',
                    features: ['SQL v\u00e0 NoSQL c\u1ee5c b\u1ed9', 'Tr\u1ee3 l\u00fd AI c\u01a1 b\u1ea3n', 'Duy\u1ec7t schema'],
                };
            }

            return plan.code === 'pro_monthly'
                ? { ...plan, name: 'Pro th\u00e1ng', cadence: '30 ng\u00e0y', description: 'Quy\u1ec1n truy c\u1eadp Pro trong 30 ng\u00e0y; ma tr\u1eadn t\u00ednh n\u0103ng \u0111ang ch\u1edd ph\u00ea duy\u1ec7t.', features: ['Tr\u1ea1ng th\u00e1i Pro trong 30 ng\u00e0y', 'K\u00edch ho\u1ea1t sau webhook \u0111\u00e3 x\u00e1c minh', 'Ma tr\u1eadn t\u00ednh n\u0103ng ch\u1edd ph\u00ea duy\u1ec7t'] }
                : { ...plan, name: 'Pro n\u0103m', cadence: '365 ng\u00e0y', description: 'Quy\u1ec1n truy c\u1eadp Pro trong 365 ng\u00e0y; ma tr\u1eadn t\u00ednh n\u0103ng \u0111ang ch\u1edd ph\u00ea duy\u1ec7t.', features: ['Tr\u1ea1ng th\u00e1i Pro trong 365 ng\u00e0y', 'K\u00edch ho\u1ea1t sau webhook \u0111\u00e3 x\u00e1c minh', 'Ma tr\u1eadn t\u00ednh n\u0103ng ch\u1edd ph\u00ea duy\u1ec7t'] };
        })
        : billingPlans;

    return (
        <section id="pricing" className="lp-section">
            <div className="lp-container">
                <div ref={addToRevealRefs} className="mx-auto mb-12 max-w-2xl text-center">
                    <h2 className="lp-h2" style={{ color: 'var(--lp-text)' }}>
                        {text.title}
                    </h2>
                    <p className="lp-body mt-4">
                        {text.description}
                    </p>
                </div>

                <div className="lp-pricing-grid">
                    {plans.map((plan) => {
                        const isPopular = plan.code === 'pro_yearly';
                        return (
                            <div
                                key={plan.code}
                                data-featured={isPopular ? 'true' : undefined}
                                className="lp-pricing-card"
                                style={{
                                    backgroundColor: 'var(--lp-surface)',
                                    borderColor: isPopular ? 'var(--lp-accent)' : 'var(--lp-border)',
                                }}
                            >
                                <div className="lp-plan-header">
                                    <div className="lp-plan-heading">
                                        <h3 className="text-lg font-semibold" style={{ color: 'var(--lp-text)' }}>{plan.name}</h3>
                                        {isPopular && (
                                            <Badge className="lp-plan-badge shrink-0 whitespace-nowrap text-white" style={{ backgroundColor: 'var(--lp-accent)' }}>{text.bestValue}</Badge>
                                        )}
                                    </div>
                                    <p className="lp-plan-description" style={{ color: 'var(--lp-muted)' }}>{plan.description}</p>
                                </div>

                                <div className="lp-plan-price">
                                    <div className="lp-plan-amount" style={{ color: 'var(--lp-text)' }}>{plan.amountVnd}</div>
                                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm" style={{ color: 'var(--lp-muted)' }}>
                                        <span>{plan.displayAmountUsd}</span>
                                        <span>/ {plan.cadence}</span>
                                    </div>
                                </div>

                                <div className="lp-plan-divider" style={{ backgroundColor: 'var(--lp-border)' }} />

                                <ul className="mb-6 flex-1 space-y-3">
                                    {plan.features.map((feature) => (
                                        <li key={feature} className="flex items-start gap-2 text-sm" style={{ color: 'var(--lp-muted)' }}>
                                            <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--lp-accent)' }} aria-hidden="true" />
                                            <span>{feature}</span>
                                        </li>
                                    ))}
                                </ul>

                                <a
                                    href="/sql-explorer"
                                    className={cn('lp-button w-full', plan.code === 'free' ? 'lp-button-secondary' : 'lp-button-primary')}
                                >
                                    <CreditCard className="h-4 w-4" aria-hidden="true" />
                                    {plan.code === 'free'
                                        ? text.openWorkspace
                                        : text.upgradeInProfile}
                                </a>
                            </div>
                        );
                    })}
                </div>

                <p className="mx-auto mt-6 max-w-3xl text-center text-xs" style={{ color: 'var(--lp-muted)' }}>
                    {text.footerNote}
                </p>
            </div>
        </section>
    );
};
