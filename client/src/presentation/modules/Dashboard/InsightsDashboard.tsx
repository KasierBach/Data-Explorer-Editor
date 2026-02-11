import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/core/services/store';
import { connectionService } from '@/core/services/ConnectionService';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/presentation/components/ui/card';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie
} from 'recharts';
import { Database, Table, Zap, HardDrive, RefreshCw, ArrowRight, Share2, GitBranch, Layers, BarChart3 } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/presentation/components/ui/select";

export interface InsightsDashboardProps {
    connectionId?: string;
    database?: string;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export const InsightsDashboard: React.FC<InsightsDashboardProps> = ({
    connectionId: propConnectionId,
    database: propDatabase
}) => {
    const { activeConnectionId: globalActiveId, connections } = useAppStore();
    const activeConnectionId = propConnectionId || globalActiveId;
    const activeConnection = connections.find(c => c.id === activeConnectionId);

    const [selectedDatabase, setSelectedDatabase] = useState<string | undefined>(propDatabase || activeConnection?.database);

    // Fetch Database list
    const { data: databases } = useQuery({
        queryKey: ['db-list', activeConnectionId],
        queryFn: async () => {
            if (!activeConnectionId) return [];
            const adapter = connectionService.getAdapter(activeConnectionId, activeConnection?.type as any);
            return adapter.getDatabases();
        },
        enabled: !!activeConnectionId
    });

    const { data: metrics, isLoading, refetch, isFetching } = useQuery({
        queryKey: ['db-metrics', activeConnectionId, selectedDatabase],
        queryFn: async () => {
            if (!activeConnectionId) throw new Error("No active connection");
            const adapter = connectionService.getAdapter(activeConnectionId, activeConnection?.type as any);
            return adapter.getMetrics(selectedDatabase);
        },
        enabled: !!activeConnectionId
    });

    const { data: relationships } = useQuery({
        queryKey: ['db-relationships', activeConnectionId, selectedDatabase],
        queryFn: async () => {
            if (!activeConnectionId) return [];
            const adapter = connectionService.getAdapter(activeConnectionId, activeConnection?.type as any);
            return adapter.getRelationships(selectedDatabase);
        },
        enabled: !!activeConnectionId
    });

    if (!activeConnectionId) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
                <Database className="h-12 w-12 opacity-20" />
                <p>Please select a connection to view insights.</p>
            </div>
        );
    }

    if (isLoading && !metrics) {
        return (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground animate-pulse p-20">
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                Gathering database intelligence...
            </div>
        );
    }

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const stats = [
        { title: 'Total Tables', value: metrics?.tableCount || 0, icon: Table, color: 'text-blue-500', bg: 'bg-blue-500/10' },
        { title: 'Storage Usage', value: formatBytes(metrics?.sizeBytes || 0), icon: HardDrive, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
        { title: 'Active Sessions', value: metrics?.activeConnections || 0, icon: Zap, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    ];

    return (
        <div className="h-full w-full overflow-auto">
            <div className="p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto pb-20">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 rounded-lg text-purple-600">
                            <BarChart3 className="h-6 w-6" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold tracking-tight">Intelligence Dashboard</h2>
                            <p className="text-muted-foreground text-sm">Real-time metrics for <span className="text-foreground font-medium">{activeConnection?.name}</span></p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 bg-card p-1.5 rounded-xl border shadow-sm">
                        <Select value={selectedDatabase} onValueChange={setSelectedDatabase}>
                            <SelectTrigger className="w-[180px] h-8 border-none bg-transparent focus:ring-0">
                                <SelectValue placeholder="Select Database" />
                            </SelectTrigger>
                            <SelectContent>
                                {databases?.map((db: string) => (
                                    <SelectItem key={db} value={db}>{db}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <div className="w-px h-4 bg-border" />
                        <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching} className="h-8 gap-2">
                            <RefreshCw className={`h-3 w-3 ${isFetching ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {stats.map((stat) => (
                        <Card key={stat.title} className="overflow-hidden border-none shadow-md bg-card/50 backdrop-blur-sm">
                            <CardContent className="p-6">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-1">
                                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{stat.title}</p>
                                        <p className="text-3xl font-bold tracking-tight">{stat.value}</p>
                                    </div>
                                    <div className={`p-3 rounded-2xl ${stat.bg} ${stat.color}`}>
                                        <stat.icon className="h-6 w-6" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
                    {/* Top Tables Chart */}
                    <Card className="lg:col-span-2 border-none shadow-lg bg-card/50 backdrop-blur-sm overflow-hidden">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-lg font-bold">Top Entities</CardTitle>
                                <CardDescription>Largest tables by storage consumption</CardDescription>
                            </div>
                            <HardDrive className="h-5 w-5 text-emerald-500 opacity-50" />
                        </CardHeader>
                        <CardContent className="h-[350px] pt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={metrics?.topTables || []} layout="vertical" margin={{ left: 20, right: 40, top: 0, bottom: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} opacity={0.1} />
                                    <XAxis type="number" hide />
                                    <YAxis
                                        dataKey="name"
                                        type="category"
                                        width={140}
                                        fontSize={11}
                                        tickLine={false}
                                        axisLine={false}
                                        tick={{ fill: 'currentColor', opacity: 0.7 }}
                                    />
                                    <Tooltip
                                        cursor={{ fill: 'var(--muted)', opacity: 0.1 }}
                                        contentStyle={{ backgroundColor: 'hsl(var(--background))', borderRadius: '12px', border: '1px solid hsl(var(--border))', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                        formatter={(value: any) => [formatBytes(Number(value) || 0), 'Total Size']}
                                    />
                                    <Bar dataKey="sizeBytes" radius={[0, 6, 6, 0]} maxBarSize={40}>
                                        {(metrics?.topTables || []).map((_entry: any, index: number) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    {/* Storage Breakdown */}
                    <Card className="border-none shadow-lg bg-card/50 backdrop-blur-sm">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-lg font-bold">Entity Types</CardTitle>
                                <CardDescription>Database structure distribution</CardDescription>
                            </div>
                            <Layers className="h-5 w-5 text-blue-500 opacity-50" />
                        </CardHeader>
                        <CardContent className="h-[350px] flex flex-col items-center justify-center pt-0">
                            {metrics?.tableTypes && metrics.tableTypes.length > 0 ? (
                                <>
                                    <ResponsiveContainer width="100%" height={240}>
                                        <PieChart>
                                            <Pie
                                                data={metrics.tableTypes}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={65}
                                                outerRadius={95}
                                                paddingAngle={8}
                                                dataKey="count"
                                                nameKey="type"
                                                animationBegin={0}
                                                animationDuration={1500}
                                            >
                                                {metrics.tableTypes.map((_entry: any, index: number) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                contentStyle={{ backgroundColor: 'hsl(var(--background))', borderRadius: '12px', border: '1px solid hsl(var(--border))' }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="mt-4 w-full px-4 space-y-2">
                                        {metrics.tableTypes.map((t: any, i: number) => (
                                            <div key={t.type} className="flex items-center justify-between text-xs">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                                    <span className="font-medium capitalize">{t.type.replace(/_/g, ' ')}</span>
                                                </div>
                                                <span className="font-bold">{t.count}</span>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <div className="flex flex-col items-center gap-2">
                                    <Layers className="h-10 w-10 opacity-10" />
                                    <p className="text-sm text-muted-foreground italic">No distribution data</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Relationship Graph Area */}
                <Card className="border-none shadow-xl bg-card/40 backdrop-blur-md overflow-hidden ring-1 ring-white/10">
                    <CardHeader className="border-b bg-muted/20 pb-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-purple-500/10 rounded-lg">
                                    <Share2 className="h-5 w-5 text-purple-600" />
                                </div>
                                <div>
                                    <CardTitle className="text-xl font-bold">Relationship Architecture</CardTitle>
                                    <CardDescription>Mapping foreign key connections (1-n, n-n)</CardDescription>
                                </div>
                            </div>
                            {relationships && (
                                <div className="px-3 py-1 bg-purple-500/10 text-purple-700 text-[10px] font-bold uppercase tracking-widest rounded-full border border-purple-200">
                                    {relationships.length} Links Found
                                </div>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {relationships && relationships.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 divide-x divide-y divide-border/30">
                                {relationships.map((rel: any, i: number) => (
                                    <div key={i} className="p-5 group hover:bg-muted/30 transition-all duration-300">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Source</span>
                                                <span className="text-sm font-black text-blue-600 truncate max-w-[120px]">{rel.source_table}</span>
                                            </div>
                                            <div className="flex items-center px-3">
                                                <div className="h-[2px] w-8 bg-gradient-to-r from-blue-400 to-emerald-400 opacity-40 group-hover:opacity-100 transition-opacity" />
                                            </div>
                                            <div className="flex flex-col text-right">
                                                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Target</span>
                                                <span className="text-sm font-black text-emerald-600 truncate max-w-[120px]">{rel.target_table}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between text-[10px] font-mono bg-muted/50 p-2 rounded-md border text-muted-foreground">
                                            <div className="flex items-center gap-1.5 overflow-hidden">
                                                <GitBranch className="h-3 w-3 shrink-0" />
                                                <span className="truncate">{rel.source_column}</span>
                                            </div>
                                            <ArrowRight className="h-2.5 w-2.5 mx-2 shrink-0 opacity-30" />
                                            <span className="truncate">{rel.target_column}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="min-h-[300px] flex flex-col items-center justify-center gap-4 text-muted-foreground border-t">
                                <GitBranch className="h-16 w-16 opacity-5" />
                                <div className="text-center">
                                    <p className="font-bold">No foreign key constraints found.</p>
                                    <p className="text-xs opacity-60">Try selecting a different database or checking your schema.</p>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};
