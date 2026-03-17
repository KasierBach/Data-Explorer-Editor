import React from 'react';
import { Button } from '@/presentation/components/ui/button';
import { User, X, Settings, CreditCard, Bell, Palette, Shield, LogOut } from 'lucide-react';
import { toast } from 'sonner';

import { useProfileLogic } from './hooks/useProfileLogic';
import { translations } from './constants/translations';

// Tab Components
import { ProfileTab } from './components/ProfileTab';
import { AppearanceTab } from './components/AppearanceTab';
import { BillingTab } from './components/BillingTab';
import { NotificationsTab } from './components/NotificationsTab';
import { SecurityTab } from './components/SecurityTab';
import { AdvancedTab } from './components/AdvancedTab';

interface ProfileDialogProps {
    isOpen: boolean;
    onClose: () => void;
    initialTab?: string;
}

export const ProfileDialog: React.FC<ProfileDialogProps> = ({ isOpen, onClose, initialTab }) => {
    const {
        user,
        isLoading,
        profileState,
        appearanceState,
        notificationsState,
        securityState,
        activeTab,
        setActiveTab,
        actions
    } = useProfileLogic(isOpen, initialTab, onClose);

    const t = (key: string) => {
        const lang = appearanceState.language || 'en';
        const res = (translations as any)[lang];
        const keys = key.split('.');
        let current = res;
        for (const k of keys) {
            current = current ? current[k] : undefined;
        }
        return current || key;
    };

    const handleFeatureNotImplemented = (feature: string) => {
        toast.info(`${feature} ${t('not_implemented_suffix')}`);
    };

    if (!isOpen) return null;

    const tabsList = [
        { id: 'profile', label: 'Public Profile', icon: User },
        { id: 'appearance', label: 'Appearance', icon: Palette },
        { id: 'billing', label: 'Billing & Plan', icon: CreditCard },
        { id: 'notifications', label: 'Notifications', icon: Bell },
        { id: 'security', label: 'Security', icon: Shield },
        { id: 'advanced', label: 'Advanced Settings', icon: Settings },
    ];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-background border rounded-xl shadow-2xl w-full max-w-4xl h-[600px] flex relative animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute right-4 top-4 z-10 rounded-sm opacity-70 transition-opacity hover:opacity-100 hover:bg-muted p-1"
                >
                    <X className="h-5 w-5" />
                    <span className="sr-only">Close</span>
                </button>

                {/* Sidebar */}
                <div className="w-64 bg-muted/20 border-r flex flex-col">
                    <div className="p-6 pb-4">
                        <h2 className="text-xl font-bold tracking-tight">{t('title')}</h2>
                        <p className="text-xs text-muted-foreground mt-1">{t('subtitle')}</p>
                    </div>
                    <div className="flex-1 px-3 space-y-1 overflow-y-auto">
                        {tabsList.map(tab => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            const label = t(`tabs.${tab.id}`);
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${isActive
                                        ? 'bg-violet-500/15 text-violet-500 dark:text-violet-400'
                                        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                                        }`}
                                >
                                    <Icon className={`w-4 h-4 ${isActive ? 'text-violet-500 dark:text-violet-400' : ''}`} />
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                    <div className="p-4 border-t border-border/50">
                        <Button variant="ghost" className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-500/10" onClick={onClose}>
                            <LogOut className="w-4 h-4 mr-2" />
                            {t('sign_out')}
                        </Button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-8 relative">
                    {activeTab === 'profile' && (
                        <ProfileTab user={user} t={t} profileState={profileState} isLoading={isLoading} actions={actions} />
                    )}
                    {activeTab === 'appearance' && (
                        <AppearanceTab t={t} appearanceState={appearanceState} actions={actions} />
                    )}
                    {activeTab === 'billing' && (
                        <BillingTab user={user} t={t} isLoading={isLoading} actions={actions} />
                    )}
                    {activeTab === 'notifications' && (
                        <NotificationsTab t={t} notificationsState={notificationsState} actions={actions} />
                    )}
                    {activeTab === 'security' && (
                        <SecurityTab user={user} t={t} isLoading={isLoading} securityState={securityState} actions={{ ...actions, handleFeatureNotImplemented }} />
                    )}
                    {activeTab === 'advanced' && (
                        <AdvancedTab t={t} isLoading={isLoading} actions={actions} />
                    )}
                </div>
            </div>
        </div>
    );
};
