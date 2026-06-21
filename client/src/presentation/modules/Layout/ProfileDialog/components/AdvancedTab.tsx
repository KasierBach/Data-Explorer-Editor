import React from 'react';
import { Button } from '@/presentation/components/ui/button';
import { Loader2 } from 'lucide-react';

const WORKSPACE_STORAGE_KEY = 'data-explorer-storage';
const WORKSPACE_RECOVERY_STORAGE_KEY = 'data-explorer-workspace-recovery-v1';
const WORKSPACE_STORAGE_PREFIXES = [
    'data-grid:column-order:',
    'data-grid:column-sizing:',
];

function clearLocalWorkspaceStorage() {
    if (typeof window === 'undefined') return;

    window.localStorage.removeItem(WORKSPACE_STORAGE_KEY);
    window.localStorage.removeItem(WORKSPACE_RECOVERY_STORAGE_KEY);

    const keysToRemove: string[] = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);
        if (key && WORKSPACE_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
            keysToRemove.push(key);
        }
    }

    keysToRemove.forEach((key) => {
        window.localStorage.removeItem(key);
    });
}

interface AdvancedTabProps {
    t: (key: string) => string;
    isLoading: boolean;
    actions: {
        handleDeleteAccount: (confirmText: string, successText: string) => void;
    };
}

export const AdvancedTab: React.FC<AdvancedTabProps> = ({
    t,
    isLoading,
    actions,
}) => {
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div>
                <h3 className="text-lg font-medium">{t('tabs.advanced')}</h3>
                <p className="text-sm text-muted-foreground">{t('advanced_subtitle')}</p>
            </div>
            <div className="h-px w-full bg-border/50" />

            <div>
                <h4 className="text-lg font-medium text-red-500">{t('danger_zone_title')}</h4>
                <p className="text-sm text-muted-foreground">{t('danger_zone_subtitle')}</p>
            </div>

            <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-1">
                <div className="space-y-4 p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-foreground">{t('clear_local_workspace')}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">{t('clear_local_hint')}</p>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="hover:border-red-200 hover:bg-red-500/10 hover:text-red-600"
                            onClick={() => {
                                clearLocalWorkspaceStorage();
                                window.location.reload();
                            }}
                        >
                            {t('clear_data_button')}
                        </Button>
                    </div>

                    <div className="h-px w-full bg-red-500/20" />

                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-foreground">{t('delete_account_title')}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">{t('delete_account_description')}</p>
                        </div>
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => actions.handleDeleteAccount(t('delete_account_confirm'), t('account_deleted'))}
                            disabled={isLoading}
                        >
                            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('delete_account_button')}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
