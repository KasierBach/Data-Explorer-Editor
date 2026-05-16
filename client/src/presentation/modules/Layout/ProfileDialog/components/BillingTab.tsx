import React from 'react';
import { Button } from '@/presentation/components/ui/button';
import { Loader2, Zap, CreditCard } from 'lucide-react';
import type { AuthUser } from '@/core/services/store/slices/authSlice';

interface BillingTabProps {
    user: AuthUser | null;
    t: (key: string) => string;
    isLoading: boolean;
    actions: {
        handleUpdateBilling: (plan: string) => void;
    };
}

export const BillingTab: React.FC<BillingTabProps> = ({ 
    user, t, isLoading, actions 
}) => {
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div>
                <h3 className="text-lg font-medium">{t('tabs.billing')}</h3>
                <p className="text-sm text-muted-foreground">{t('billing_subtitle')}</p>
            </div>
            <div className="w-full h-px bg-border/50" />

            <div className="border border-violet-500/30 rounded-xl p-6 bg-violet-500/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Zap className="w-32 h-32" />
                </div>
                <div className="flex items-center gap-4 mb-4 relative z-10">
                    <div className="p-3 bg-violet-500/20 rounded-xl text-violet-500 border border-violet-500/30">
                        <Zap className="w-6 h-6 fill-violet-500/20" />
                    </div>
                    <div>
                        <h4 className="font-bold text-xl flex items-center gap-2">
                            {user?.plan === 'pro' ? t('plan_pro_name') : t('plan_free_name')}
                            {user?.plan === 'pro' && (
                                <span className="bg-violet-500 text-white text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider">{t('plan_active_status')}</span>
                            )}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                            {user?.plan === 'pro' 
                                ? t('plan_pro_description')
                                : t('plan_free_description')}
                        </p>
                    </div>
                    <div className="ml-auto flex items-end flex-col">
                        <div className="flex items-end gap-1">
                            <span className="text-3xl font-black tracking-tighter">{user?.plan === 'pro' ? '$19' : '$0'}</span>
                            <span className="text-sm text-muted-foreground mb-1">/mo</span>
                        </div>
                    </div>
                </div>
                <div className="relative z-10">
                    <p className="text-xs font-medium text-muted-foreground mb-6">
                        {user?.plan === 'pro' 
                            ? <>{t('billing_next_date')} <strong className="text-foreground">{user.billingDate ? new Date(user.billingDate).toLocaleDateString() : ''}</strong>.</>
                            : t('upgrade_plan_hint')}
                    </p>
                    <div className="flex gap-3">
                        {user?.plan !== 'pro' ? (
                            <Button onClick={() => actions.handleUpdateBilling('pro')} disabled={isLoading} className="bg-foreground text-background hover:bg-foreground/90 font-medium px-6">
                                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('upgrade_to_pro')}
                            </Button>
                        ) : (
                            <Button onClick={() => actions.handleUpdateBilling('free')} variant="outline" className="border-border/50">{t('downgrade_to_free')}</Button>
                        )}
                        <Button variant="outline" className="border-border/50">{t('manage_subscription')}</Button>
                    </div>
                </div>
            </div>

            <div className="space-y-4 pt-4">
                <h4 className="font-medium text-sm">{t('payment_method')}</h4>
                <div className="border rounded-lg p-4 flex items-center justify-between bg-card">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-8 bg-white rounded flex items-center justify-center p-1 border">
                            <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Visa_Inc._logo.svg/2560px-Visa_Inc._logo.svg.png" alt="Visa" className="h-full object-contain" />
                        </div>
                        <div>
                            <p className="font-medium text-sm">{user?.paymentMethod || 'Visa ending in 4242'}</p>
                            <p className="text-xs text-muted-foreground text-left">{t('expires_label')} 12/2028</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs bg-muted px-2 py-1 rounded font-medium">{t('default_label')}</span>
                        <Button variant="ghost" size="sm" className="h-8">{t('edit_label')}</Button>
                    </div>
                </div>
                <Button variant="outline" className="w-full border-dashed text-muted-foreground bg-transparent hover:bg-muted/50 h-10">
                    <CreditCard className="w-4 h-4 mr-2" />
                    {t('add_payment_method')}
                </Button>
            </div>
        </div>
    );
};
