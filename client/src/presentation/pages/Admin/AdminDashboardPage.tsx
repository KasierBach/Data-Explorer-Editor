import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, Users } from 'lucide-react';
import { useAppStore } from '@/core/services/store';
import { Button } from '@/presentation/components/ui/button';
import { useResponsiveLayoutMode } from '@/presentation/hooks/useResponsiveLayoutMode';
import { cn } from '@/lib/utils';
import { UsersView } from './UsersView';
import { AuditLogsView } from './AuditLogsView';

export function AdminDashboardPage() {
    const { lang } = useAppStore();
    const navigate = useNavigate();
    const { isCompactMobileLayout } = useResponsiveLayoutMode();
    const [activeTab, setActiveTab] = useState<'users' | 'audit'>('users');

    const tabs = [
        {
            key: 'users' as const,
            icon: Users,
            label: lang === 'vi' ? 'Quan ly nguoi dung' : 'User Management',
        },
        {
            key: 'audit' as const,
            icon: Shield,
            label: lang === 'vi' ? 'Nhat ky he thong' : 'Audit Logs',
        },
    ];

    return (
        <div className="flex h-dvh min-h-screen w-full flex-col overflow-hidden bg-background page-enter md:flex-row">
            <aside className="flex w-full shrink-0 flex-col border-b bg-card md:w-64 md:border-b-0 md:border-r">
                <div className="flex items-center gap-3 border-b px-4 py-3">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/sql-explorer')} className="h-8 w-8">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex min-w-0 items-center gap-2">
                        <Shield className="h-5 w-5 shrink-0 text-primary" />
                        <div className="min-w-0">
                            <div className="truncate font-bold text-base sm:text-lg">Admin Panel</div>
                            {isCompactMobileLayout && (
                                <div className="text-[11px] text-muted-foreground">
                                    {activeTab === 'users'
                                        ? (lang === 'vi' ? 'Nguoi dung' : 'Users')
                                        : (lang === 'vi' ? 'Nhat ky' : 'Audit')}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex gap-2 overflow-x-auto px-3 py-3 hide-scrollbar md:flex-1 md:flex-col md:gap-1 md:overflow-visible md:p-2">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        return (
                            <Button
                                key={tab.key}
                                variant={activeTab === tab.key ? 'secondary' : 'ghost'}
                                className={cn(
                                    'h-9 shrink-0 gap-2 justify-start whitespace-nowrap px-3',
                                    !isCompactMobileLayout && 'w-full mt-0'
                                )}
                                onClick={() => setActiveTab(tab.key)}
                            >
                                <Icon className="h-4 w-4" />
                                {tab.label}
                            </Button>
                        );
                    })}
                </div>
            </aside>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-muted/10">
                <header className="hidden h-14 items-center border-b bg-card px-6 md:flex">
                    <h1 className="text-lg font-semibold">
                        {activeTab === 'users'
                            ? (lang === 'vi' ? 'Quan ly nguoi dung' : 'User Management')
                            : (lang === 'vi' ? 'Nhat ky he thong' : 'Audit Logs')}
                    </h1>
                </header>
                <main className="flex-1 overflow-auto p-4 sm:p-6">
                    {activeTab === 'users' && <UsersView />}
                    {activeTab === 'audit' && <AuditLogsView />}
                </main>
            </div>
        </div>
    );
}
