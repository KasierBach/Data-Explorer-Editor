import React from 'react';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { Loader2, Shield } from 'lucide-react';

interface SecurityTabProps {
    user: any;
    t: (key: string) => string;
    isLoading: boolean;
    securityState: {
        currentPassword: string; setCurrentPassword: (v: string) => void;
        newPassword: string; setNewPassword: (v: string) => void;
        confirmPassword: string; setConfirmPassword: (v: string) => void;
    };
    actions: {
        handleChangePassword: () => void;
        handleFeatureNotImplemented: (feature: string) => void;
    };
}

export const SecurityTab: React.FC<SecurityTabProps> = ({ 
    user, t, isLoading, securityState, actions 
}) => {
    const { currentPassword, setCurrentPassword, newPassword, setNewPassword, confirmPassword, setConfirmPassword } = securityState;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div>
                <h3 className="text-lg font-medium">{t('tabs.security')}</h3>
                <p className="text-sm text-muted-foreground">{t('security_subtitle')}</p>
            </div>
            <div className="w-full h-px bg-border/50" />
            <div className="space-y-6 max-w-md">
                <h4 className="font-medium text-sm">{t('change_password_title')}</h4>
                <div className="space-y-3">
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">{t('current_password_label')}</label>
                        <Input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">{t('new_password_label')}</label>
                        <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">{t('confirm_password_label')}</label>
                        <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                    </div>
                    {user?.provider !== 'local' && (
                        <p className="text-[10px] text-amber-500 font-medium">
                            Note: Social login accounts might not have a password set.
                        </p>
                    )}
                    <Button className="mt-2" onClick={actions.handleChangePassword} disabled={isLoading || !currentPassword || !newPassword}>
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('change_password_button')}
                    </Button>
                </div>
            </div>

            <div className="mt-8 border-t pt-8">
                <h4 className="font-medium text-sm mb-1">{t('two_factor_auth_title')}</h4>
                <p className="text-sm text-muted-foreground mb-4">{t('two_factor_auth_hint')}</p>
                <div className="border rounded-lg p-4 bg-muted/20 flex items-center justify-between">
                    <div className="flex gap-3 items-center">
                        <div className="p-2 bg-background rounded-full border shadow-sm">
                            <Shield className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div>
                            <p className="font-medium text-sm">{t('status_disabled')}</p>
                        </div>
                    </div>
                    <Button variant="outline" onClick={() => actions.handleFeatureNotImplemented('2FA Configuration')}>{t('enable_two_factor')}</Button>
                </div>
            </div>
        </div>
    );
};
