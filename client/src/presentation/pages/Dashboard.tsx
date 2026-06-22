import React, { useState } from 'react';
import { useAppStore } from '@/core/services/store';
import { Button } from '@/presentation/components/ui/button';
import { InsightsDashboard } from '../modules/Dashboard/InsightsDashboard';
import { Plus, Database, Search, Clock, FileText, BarChart3, ArrowLeft, Trash, Loader2, Share2 } from 'lucide-react';
import { ConnectionService } from '@/core/services/ConnectionService';
import { LanguageSwitcher } from '@/presentation/components/shared/LanguageSwitcher';
import { useQuery } from '@tanstack/react-query';
import { DashboardService } from '@/core/services/DashboardService';
import { OrganizationService } from '@/core/services/OrganizationService';
import { ShareConnectionDialog } from '../modules/Connection/ShareConnectionDialog';
import { Avatar, AvatarImage, AvatarFallback } from '../components/ui/avatar';
import { getWorkspaceText } from '@/core/utils/workspaceText';

interface ActivityLog {
    id: string;
    action: string;
    createdAt: string;
    userId?: string;
    organizationId?: string;
    detail?: Record<string, unknown>;
    details?: Record<string, unknown>;
    user?: {
        id?: string;
        firstName?: string;
        lastName?: string;
        email?: string;
        username?: string;
        avatarUrl?: string;
    };
}

function getStringDetail(details: ActivityLog['details'], key: string) {
    const value = details?.[key];
    return typeof value === 'string' ? value : null;
}

function getActivityActorName(user?: ActivityLog['user'], fallback = 'System') {
    if (!user) {
        return fallback;
    }

    const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
    return name || user.email || user.username || fallback;
}

function formatActivityAction(action: string) {
    return action
        .replace(/^TEAM:/, '')
        .replace(/^DB:/, '')
        .replace(/^AUTH:/, '')
        .replace(/^USER:/, '')
        .replace(/^SYSTEM:/, '')
        .replace(/_/g, ' ')
        .toLowerCase();
}

export const Dashboard: React.FC = () => {
    const { connections, openQueryTab, setSidebarOpen, openConnectionDialog, activeConnectionId, removeConnection, setActiveConnectionId, openDashboardTab, lang } = useAppStore();
    const text = getWorkspaceText(lang).dashboardPage;
    const [view, setView] = useState<'welcome' | 'insights'>('welcome');
    const [isDeleting, setIsDeleting] = useState<string | null>(null);
    const [shareConnectionId, setShareConnectionId] = useState<string | null>(null);
    const { data: dashboards = [] } = useQuery({
        queryKey: ['dashboards'],
        queryFn: () => DashboardService.getDashboards(),
    });

    const { data: organizations = [] } = useQuery({
        queryKey: ['organizations'],
        queryFn: () => OrganizationService.getMyOrganizations(),
    });

    const { data: teamActivities = [] } = useQuery<ActivityLog[]>({
        queryKey: ['team-activities', organizations.map((org) => org.id)],
        queryFn: async () => {
            if (organizations.length === 0) return [];
            const allActivities = await Promise.all(
                organizations.map((org) => OrganizationService.getTeamActivities(org.id))
            );
            return (allActivities.flat() as ActivityLog[])
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .slice(0, 10);
        },
        enabled: organizations.length > 0,
    });

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!confirm(text.confirmDeleteConnection)) return;

        setIsDeleting(id);
        try {
            await ConnectionService.deleteConnection(id);
            removeConnection(id);
        } catch (error) {
            console.error('Error deleting connection:', error);
            alert(error instanceof Error ? error.message : text.deleteConnectionFallback);
        } finally {
            setIsDeleting(null);
        }
    };

    const openShareDialog = (e: React.MouseEvent, connId: string) => {
        e.stopPropagation();
        setShareConnectionId(connId);
    };

    const queryHistory = useAppStore(state => state.queryHistory);
    const expandedNodes = useAppStore(state => state.expandedNodes);

    // Dynamic stats from local state
    const queryCount = queryHistory ? queryHistory.length : 0;
    // Estimate tables accessed by counting the number of expanded tree nodes in the sidebar
    const tableCount = expandedNodes ? expandedNodes.length : 0;

    if (view === 'insights') {
        return (
            <div className="h-full w-full bg-background overflow-auto animate-in fade-in duration-300">
                <div className="max-w-7xl mx-auto">
                    <div className="p-4 border-b flex items-center justify-between bg-muted/20">
                        <Button variant="ghost" size="sm" onClick={() => setView('welcome')} className="gap-2">
                            <ArrowLeft className="h-4 w-4" /> {text.backToWelcome}
                        </Button>
                        <div className="flex items-center gap-6">
                            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                                {text.databaseIntelligence}
                            </h2>
                            <LanguageSwitcher />
                        </div>
                    </div>
                    <InsightsDashboard />
                </div>
            </div>
        );
    }

    return (
        <div className="h-full w-full bg-background p-4 md:p-8 overflow-auto animate-in fade-in duration-300">
            <div className="max-w-5xl mx-auto space-y-8">

                {/* Header / Welcome Banner */}
                <div className="flex flex-col gap-2 relative">
                    <div className="flex items-center justify-between">
                        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                            {text.welcomeTitle}
                        </h1>
                        <LanguageSwitcher />
                    </div>
                    <p className="text-muted-foreground text-base md:text-lg">
                        {text.welcomeDescription}
                    </p>
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                    <div className="group relative overflow-hidden rounded-xl border bg-card text-card-foreground shadow transition-all hover:shadow-md cursor-pointer" onClick={() => openQueryTab()}>
                        <div className="p-4 md:p-6 flex flex-col gap-3 md:gap-4">
                            <div className="p-2 md:p-3 w-fit rounded-lg bg-blue-100 text-blue-600">
                                <FileText className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-base md:text-lg">{text.newQueryTitle}</h3>
                                <p className="text-xs md:text-sm text-muted-foreground mt-1 hidden sm:block">
                                    {text.newQueryDescription}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="group relative overflow-hidden rounded-xl border bg-card text-card-foreground shadow transition-all hover:shadow-md cursor-pointer" onClick={() => openConnectionDialog()}>
                        <div className="p-4 md:p-6 flex flex-col gap-3 md:gap-4">
                            <div className="p-2 md:p-3 w-fit rounded-lg bg-green-100 text-green-600">
                                <Plus className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-base md:text-lg">{text.newConnectionTitle}</h3>
                                <p className="text-xs md:text-sm text-muted-foreground mt-1 hidden sm:block">
                                    {text.newConnectionDescription}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="group relative overflow-hidden rounded-xl border bg-card text-card-foreground shadow transition-all hover:shadow-md cursor-pointer" onClick={() => setSidebarOpen(true)}>
                        <div className="p-4 md:p-6 flex flex-col gap-3 md:gap-4">
                            <div className="p-2 md:p-3 w-fit rounded-lg bg-orange-100 text-orange-600">
                                <Search className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-base md:text-lg">{text.browseDataTitle}</h3>
                                <p className="text-xs md:text-sm text-muted-foreground mt-1 hidden sm:block">
                                    {text.browseDataDescription}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div
                        className={`group relative overflow-hidden rounded-xl border bg-card text-card-foreground shadow transition-all hover:shadow-md cursor-pointer ${!activeConnectionId ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
                        onClick={() => activeConnectionId && setView('insights')}
                    >
                        <div className="p-4 md:p-6 flex flex-col gap-3 md:gap-4">
                            <div className="p-2 md:p-3 w-fit rounded-lg bg-purple-100 text-purple-600">
                                <BarChart3 className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-base md:text-lg">{text.insightsTitle}</h3>
                                <p className="text-xs md:text-sm text-muted-foreground mt-1 hidden sm:block">
                                    {text.insightsDescription}
                                </p>
                            </div>
                        </div>
                        {!activeConnectionId && (
                            <div className="absolute inset-x-0 bottom-0 bg-purple-600 text-[10px] text-white text-center py-1 font-bold uppercase tracking-widest">
                                {text.selectConnectionFirst}
                            </div>
                        )}
                    </div>
                </div>

                {/* Recent Connections & Stats */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Recent Connections List */}
                    <div className="lg:col-span-2 space-y-4">
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                            <Clock className="h-5 w-5 text-muted-foreground" />
                            {text.recentConnections}
                        </h2>

                        <div className="rounded-lg border bg-card">
                            {connections.length > 0 ? (
                                <div className="divide-y">
                                    {connections.map((conn) => (
                                        <div key={conn.id} className="p-3 md:p-4 flex items-center justify-between hover:bg-muted/50 transition-colors group">
                                            <div className="flex items-center gap-3 md:gap-4 min-w-0 flex-1">
                                                <div className="p-2 rounded-full bg-primary/10 text-primary shrink-0">
                                                    <Database className="h-5 w-5" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-medium truncate">{conn.name}</p>
                                                    <p className="text-xs md:text-sm text-muted-foreground truncate">
                                                        {conn.type} • {conn.host}:{conn.port} • {conn.database}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0 ml-2">
                                                <Button variant="outline" size="sm" className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity text-xs" onClick={() => { setActiveConnectionId(conn.id); setSidebarOpen(true); }}>
                                                    {text.connect}
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity text-blue-500 hover:text-blue-600 hover:bg-blue-500/10 h-8 w-8"
                                                    onClick={(e) => openShareDialog(e, conn.id)}
                                                    title={text.shareWithTeam}
                                                >
                                                    <Share2 className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-600 hover:bg-red-500/10 h-8 w-8"
                                                    onClick={(e) => handleDelete(e, conn.id)}
                                                    disabled={isDeleting === conn.id}
                                                >
                                                    {isDeleting === conn.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash className="w-4 h-4" />}
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-8 text-center text-muted-foreground">
                                    {text.noConnections}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Quick Stats Sidebar */}
                    <div className="space-y-4">
                        <h2 className="text-xl font-semibold">{text.quickStats}</h2>
                        <div className="rounded-lg border bg-card p-6 space-y-6">
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">{text.activeConnections}</span>
                                <span className="text-2xl font-bold">{connections.length}</span>
                            </div>
                            <div className="h-px bg-border" />
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">{text.queriesRun}</span>
                                <span className="text-2xl font-bold">{queryCount}</span>
                            </div>
                            <div className="h-px bg-border" />
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">{text.tablesAccessed}</span>
                                <span className="text-2xl font-bold">{tableCount}</span>
                            </div>
                        </div>

                        <div className="rounded-lg border bg-card p-6 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                            <h3 className="font-semibold mb-2 text-primary">{text.proTipTitle}</h3>
                            <p className="text-sm text-muted-foreground">
                                {text.proTipPrefix} <code className="bg-primary/10 px-1 rounded text-primary">Ctrl+N</code> {text.proTipSuffix}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Recent Dashboards */}
                    <div className="lg:col-span-2 space-y-4">
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                            <BarChart3 className="h-5 w-5 text-muted-foreground" />
                            {text.recentDashboards}
                        </h2>
                        <div className="rounded-lg border bg-card">
                            {dashboards.length > 0 ? (
                                <div className="divide-y">
                                    {dashboards.slice(0, 6).map((dashboard) => (
                                        <button
                                            key={dashboard.id}
                                            onClick={() => openDashboardTab(dashboard.id, dashboard.name)}
                                            className="w-full text-left p-4 hover:bg-muted/40 transition-colors"
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className="font-medium truncate">{dashboard.name}</div>
                                                    <div className="text-xs text-muted-foreground truncate">
                                                        {text.widgetCount(dashboard.widgets.length)} • {dashboard.visibility}
                                                    </div>
                                                </div>
                                                <div className="text-[10px] uppercase tracking-widest text-muted-foreground shrink-0">
                                                    {new Date(dashboard.updatedAt).toLocaleDateString()}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-8 text-center text-muted-foreground">
                                    {text.noDashboards}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Team Activity Feed */}
                    <div className="space-y-4">
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                            <Share2 className="h-5 w-5 text-muted-foreground" />
                            {text.teamActivity}
                        </h2>
                        <div className="rounded-lg border bg-card p-4">
                            {teamActivities.length > 0 ? (
                                <div className="space-y-6">
                                    {teamActivities.map((log: ActivityLog) => {
                                        const user = log.user;
                                        const resourceName = getStringDetail(log.details, 'resourceName');
                                        const detailName = getStringDetail(log.details, 'name');
                                        const initials = user
                                            ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}` || user.email?.[0]?.toUpperCase() || 'U'
                                            : 'U';
                                        return (
                                            <div key={log.id} className="relative flex gap-3">
                                                <div className="relative z-10 shrink-0">
                                                    <Avatar className="h-8 w-8 border-2 border-background shadow-sm">
                                                        {user?.avatarUrl && <AvatarImage src={user.avatarUrl} />}
                                                        <AvatarFallback className="bg-blue-500/10 text-blue-600 text-[10px] font-bold">
                                                            {initials}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                </div>
                                                <div className="flex flex-col gap-1 min-w-0 pt-0.5">
                                                    <p className="text-xs leading-relaxed text-foreground">
                                                        <span className="font-bold">{getActivityActorName(user, text.systemActor)}</span>
                                                        {' '}
                                                        <span className="text-muted-foreground lowercase">
                                                            {formatActivityAction(log.action)}
                                                        </span>
                                                        {resourceName && (
                                                            <> <span className="font-semibold text-blue-500">"{resourceName}"</span></>
                                                        )}
                                                        {detailName && (
                                                            <> <span className="font-semibold text-blue-500">"{detailName}"</span></>
                                                        )}
                                                    </p>
                                                    <span className="text-[10px] text-muted-foreground">
                                                        {new Date(log.createdAt).toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US', { 
                                                            hour: '2-digit', 
                                                            minute: '2-digit',
                                                            day: '2-digit',
                                                            month: '2-digit'
                                                        })}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="p-4 text-center text-muted-foreground text-xs italic">
                                    {text.noTeamActivity}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <ShareConnectionDialog 
                    connectionId={shareConnectionId} 
                    open={!!shareConnectionId} 
                    onOpenChange={(open) => !open && setShareConnectionId(null)} 
                />

            </div>
        </div>
    );
};
