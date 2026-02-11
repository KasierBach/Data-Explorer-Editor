import React, { useState } from 'react';
import { useAppStore } from '@/core/services/store';
import { Button } from '@/presentation/components/ui/button';
import { Plus, Database, Search, Clock, FileText, BarChart3, ArrowLeft } from 'lucide-react';
import { InsightsDashboard } from '../modules/Dashboard/InsightsDashboard';

export const Dashboard: React.FC = () => {
    const { connections, openQueryTab, setSidebarOpen, openConnectionDialog, activeConnectionId } = useAppStore();
    const [view, setView] = useState<'welcome' | 'insights'>('welcome');

    // Mock stats for now
    const queryCount = 12;
    const tableCount = 45;

    if (view === 'insights') {
        return (
            <div className="h-full w-full bg-background overflow-auto animate-in fade-in duration-300">
                <div className="max-w-7xl mx-auto">
                    <div className="p-4 border-b flex items-center justify-between bg-muted/20">
                        <Button variant="ghost" size="sm" onClick={() => setView('welcome')} className="gap-2">
                            <ArrowLeft className="h-4 w-4" /> Back to Welcome
                        </Button>
                        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mr-12">Database Intelligence</h2>
                    </div>
                    <InsightsDashboard />
                </div>
            </div>
        );
    }

    return (
        <div className="h-full w-full bg-background p-8 overflow-auto animate-in fade-in duration-300">
            <div className="max-w-5xl mx-auto space-y-8">

                {/* Header / Welcome Banner */}
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-bold tracking-tight">Welcome to Data Explorer</h1>
                    <p className="text-muted-foreground text-lg">
                        Manage your databases, execute queries, and visualize data with ease.
                    </p>
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="group relative overflow-hidden rounded-xl border bg-card text-card-foreground shadow transition-all hover:shadow-md cursor-pointer" onClick={() => openQueryTab()}>
                        <div className="p-6 flex flex-col gap-4">
                            <div className="p-3 w-fit rounded-lg bg-blue-100 text-blue-600">
                                <FileText className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-lg">New Query</h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Open a SQL editor to run arbitrary queries.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="group relative overflow-hidden rounded-xl border bg-card text-card-foreground shadow transition-all hover:shadow-md cursor-pointer" onClick={() => openConnectionDialog()}>
                        <div className="p-6 flex flex-col gap-4">
                            <div className="p-3 w-fit rounded-lg bg-green-100 text-green-600">
                                <Plus className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-lg">New Connection</h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Connect to a new PostgreSQL or MySQL database.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="group relative overflow-hidden rounded-xl border bg-card text-card-foreground shadow transition-all hover:shadow-md cursor-pointer" onClick={() => setSidebarOpen(true)}>
                        <div className="p-6 flex flex-col gap-4">
                            <div className="p-3 w-fit rounded-lg bg-orange-100 text-orange-600">
                                <Search className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-lg">Browse Data</h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Explore tables and schemas in the sidebar.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div
                        className={`group relative overflow-hidden rounded-xl border bg-card text-card-foreground shadow transition-all hover:shadow-md cursor-pointer ${!activeConnectionId ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
                        onClick={() => activeConnectionId && setView('insights')}
                    >
                        <div className="p-6 flex flex-col gap-4">
                            <div className="p-3 w-fit rounded-lg bg-purple-100 text-purple-600">
                                <BarChart3 className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-lg">Database Insights</h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                    View metrics, storage usage, and trends.
                                </p>
                            </div>
                        </div>
                        {!activeConnectionId && (
                            <div className="absolute inset-x-0 bottom-0 bg-purple-600 text-[10px] text-white text-center py-1 font-bold uppercase tracking-widest">
                                Select a connection first
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
                            Recent Connections
                        </h2>

                        <div className="rounded-lg border bg-card">
                            {connections.length > 0 ? (
                                <div className="divide-y">
                                    {connections.map((conn) => (
                                        <div key={conn.id} className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors group">
                                            <div className="flex items-center gap-4">
                                                <div className="p-2 rounded-full bg-primary/10 text-primary">
                                                    <Database className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <p className="font-medium">{conn.name}</p>
                                                    <p className="text-sm text-muted-foreground">
                                                        {conn.type} • {conn.host}:{conn.port} • {conn.database}
                                                    </p>
                                                </div>
                                            </div>
                                            <Button variant="outline" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                Connect
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-8 text-center text-muted-foreground">
                                    No connections yet. Create one to get started.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Quick Stats Sidebar */}
                    <div className="space-y-4">
                        <h2 className="text-xl font-semibold">Quick Stats</h2>
                        <div className="rounded-lg border bg-card p-6 space-y-6">
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Active Connections</span>
                                <span className="text-2xl font-bold">{connections.length}</span>
                            </div>
                            <div className="h-px bg-border" />
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Queries Run</span>
                                <span className="text-2xl font-bold">{queryCount}</span>
                            </div>
                            <div className="h-px bg-border" />
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Tables Accessed</span>
                                <span className="text-2xl font-bold">{tableCount}</span>
                            </div>
                        </div>

                        <div className="rounded-lg border bg-card p-6 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                            <h3 className="font-semibold mb-2 text-primary">Pro Tip</h3>
                            <p className="text-sm text-muted-foreground">
                                You can use <code>Ctrl+N</code> to quickly open a new query tab from anywhere in the application.
                            </p>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};
