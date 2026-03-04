import { useState } from 'react';
import { useAppStore } from '@/core/services/store';
import { Users, Shield, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/presentation/components/ui/button';
import { UsersView } from './UsersView';
import { AuditLogsView } from './AuditLogsView';

export function AdminDashboardPage() {
    const { lang } = useAppStore();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'users' | 'audit'>('users');

    return (
        <div className="flex h-screen w-full bg-background overflow-hidden page-enter">
            {/* Sidebar */}
            <div className="w-64 border-r bg-card flex flex-col">
                <div className="p-4 border-b flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/app')} className="h-8 w-8">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div className="font-bold text-lg flex items-center gap-2">
                        <Shield className="h-5 w-5 text-primary" />
                        Admin Panel
                    </div>
                </div>
                <div className="p-2 flex-1 flex flex-col gap-1">
                    <Button
                        variant={activeTab === 'users' ? 'secondary' : 'ghost'}
                        className="w-full justify-start mt-2"
                        onClick={() => setActiveTab('users')}
                    >
                        <Users className="h-4 w-4 mr-2" />
                        {lang === 'vi' ? 'Quản lý Người dùng' : 'User Management'}
                    </Button>
                    <Button
                        variant={activeTab === 'audit' ? 'secondary' : 'ghost'}
                        className="w-full justify-start"
                        onClick={() => setActiveTab('audit')}
                    >
                        <Shield className="h-4 w-4 mr-2" />
                        {lang === 'vi' ? 'Nhật ký Hệ thống' : 'Audit Logs'}
                    </Button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col overflow-hidden bg-muted/10">
                <header className="h-14 border-b bg-card flex items-center px-6">
                    <h1 className="font-semibold text-lg">
                        {activeTab === 'users'
                            ? (lang === 'vi' ? 'Quản lý Người dùng' : 'User Management')
                            : (lang === 'vi' ? 'Nhật ký Hệ thống' : 'Audit Logs')}
                    </h1>
                </header>
                <main className="flex-1 overflow-auto p-6">
                    {activeTab === 'users' && <UsersView />}
                    {activeTab === 'audit' && <AuditLogsView />}
                </main>
            </div>
        </div>
    );
}
