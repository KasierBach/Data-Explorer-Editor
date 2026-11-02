import React, { useLayoutEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/presentation/components/ui/dialog';
import { Button } from '@/presentation/components/ui/button';
import { User, Settings, CreditCard, Bell, Palette, Shield, LogOut, Bot } from 'lucide-react';
import { useAppStore } from '@/core/services/store';

import { useProfileLogic } from './hooks/useProfileLogic';
import { translations } from './constants/translations';

// Tab Components
import { ProfileTab } from './components/ProfileTab';
import { AppearanceTab } from './components/AppearanceTab';
import { BillingTab } from './components/BillingTab';
import { NotificationsTab } from './components/NotificationsTab';
import { SecurityTab } from './components/SecurityTab';
import { AiConfigTab } from './components/AiConfigTab';
import { AdvancedTab } from './components/AdvancedTab';

type TranslationNode = string | { [key: string]: TranslationNode };

interface ProfileDialogProps {
    isOpen: boolean;
    onClose: () => void;
    returnFocusRef?: React.RefObject<HTMLElement | null>;
    initialTab?: string;
}

export const ProfileDialog: React.FC<ProfileDialogProps> = ({ isOpen, onClose, initialTab, returnFocusRef }) => {
    const contentRef = useRef<HTMLDivElement | null>(null);
    const lang = useAppStore((state) => state.lang);
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
        const res = translations[lang as keyof typeof translations] as TranslationNode;
        const keys = key.split('.');
        let current: TranslationNode | undefined = res;
        for (const k of keys) {
            current = typeof current === 'object' ? current[k] : undefined;
        }
        return typeof current === 'string' ? current : key;
    };

    useLayoutEffect(() => {
        if (!isOpen || !contentRef.current) return;

        const contentNode = contentRef.current;
        contentNode.scrollTop = 0;

        const frameId = window.requestAnimationFrame(() => {
            contentNode.scrollTop = 0;
        });

        return () => window.cancelAnimationFrame(frameId);
    }, [activeTab, isOpen]);

    if (!isOpen) return null;

    const tabsList = [
        { id: 'profile', icon: User },
        { id: 'appearance', icon: Palette },
        { id: 'billing', icon: CreditCard },
        { id: 'notifications', icon: Bell },
        { id: 'security', icon: Shield },
        { id: 'ai', icon: Bot },
        { id: 'advanced', icon: Settings },
    ];

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent onCloseAutoFocus={(event) => { if (returnFocusRef?.current) { event.preventDefault(); returnFocusRef.current.focus(); } }} className="z-[200] flex max-w-4xl flex-col gap-0 overflow-hidden rounded-xl p-0 sm:flex-row" style={{ height: 'min(600px, calc(100dvh - 1rem))', maxHeight: 'calc(100dvh - 1rem)' }}>
                {/* Sidebar */}
                <div className="w-full bg-muted/20 border-b flex max-h-52 shrink-0 flex-col sm:h-full sm:w-64 sm:max-h-none sm:border-b-0 sm:border-r">
                    <div className="p-4 pb-3 sm:p-6 sm:pb-4">
                        <DialogTitle className="text-xl font-bold tracking-tight">{t('title')}</DialogTitle>
                        <DialogDescription className="mt-1 text-xs">{t('subtitle')}</DialogDescription>
                    </div>
                    <div className="flex gap-1 overflow-x-auto px-3 pb-3 sm:block sm:flex-1 sm:space-y-1 sm:overflow-y-auto sm:pb-0">
                        {tabsList.map(tab => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            const label = t(`tabs.${tab.id}`);
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:w-full sm:gap-3 ${isActive
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
                    <div className="hidden p-4 border-t border-border/50 sm:block">
                        <Button variant="ghost" className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-500/10" onClick={onClose}>
                            <LogOut className="w-4 h-4 mr-2" />
                            {t('sign_out')}
                        </Button>
                    </div>
                </div>

                {/* Content Area */}
                <div
                    ref={contentRef}
                    className="relative flex-1 min-h-0 min-w-0 overflow-y-auto p-4 sm:p-8"
                >
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
                        <SecurityTab user={user} t={t} isLoading={isLoading} securityState={securityState} actions={actions} />
                    )}
                    {activeTab === 'ai' && (
                        <AiConfigTab t={t} />
                    )}
                    {activeTab === 'advanced' && (
                        <AdvancedTab t={t} isLoading={isLoading} actions={actions} />
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};
