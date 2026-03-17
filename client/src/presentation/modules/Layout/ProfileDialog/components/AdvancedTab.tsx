import React from 'react';
import { Button } from '@/presentation/components/ui/button';
import { Loader2 } from 'lucide-react';

interface AdvancedTabProps {
    t: (key: string) => string;
    isLoading: boolean;
    actions: {
        handleDeleteAccount: (confirmText: string, successText: string) => void;
    };
}

export const AdvancedTab: React.FC<AdvancedTabProps> = ({ 
    t, isLoading, actions 
}) => {
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div>
                <h3 className="text-lg font-medium text-red-500">{t('danger_zone_title')}</h3>
                <p className="text-sm text-muted-foreground">{t('danger_zone_subtitle')}</p>
            </div>
            <div className="w-full h-px bg-border/50" />
            <div className="border border-red-500/30 rounded-xl p-1 bg-red-500/5">
                <div className="p-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium text-sm text-foreground">{t('clear_local_workspace')}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{t('clear_local_hint')}</p>
                        </div>
                        <Button variant="outline" size="sm" className="hover:bg-red-500/10 hover:text-red-600 hover:border-red-200" onClick={() => { localStorage.clear(); window.location.reload(); }}>{t('clear_data_button')}</Button>
                    </div>
                    <div className="h-px bg-red-500/20 w-full"></div>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium text-sm text-foreground">{t('delete_account_title')}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{t('delete_account_description')}</p>
                        </div>
                        <Button variant="destructive" size="sm" onClick={() => actions.handleDeleteAccount(t('delete_account_confirm'), t('account_deleted'))} disabled={isLoading}>
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('delete_account_button')}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
