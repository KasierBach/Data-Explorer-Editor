import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/core/services/store';
import { connectionService } from '@/core/services/ConnectionService';
import { Card, CardContent } from '@/presentation/components/ui/card';
import {
    BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend
} from 'recharts';
import {
    Database, PieChart as PieIcon, BarChart3, LineChart as LineIcon,
    Settings2, Play, Download, Layers, Type, Palette, Hash, AlertCircle, Table, ChevronRight, Search
} from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/presentation/components/ui/select";
import { Input } from '@/presentation/components/ui/input';
import { cn } from '@/lib/utils';
import type { TreeNode } from '@/core/domain/entities';

const CHART_TYPES = [
    { id: 'bar', name: 'Bar Chart', icon: BarChart3 },
    { id: 'line', name: 'Line Chart', icon: LineIcon },
    { id: 'area', name: 'Area Chart', icon: Layers },
    { id: 'pie', name: 'Pie Chart', icon: PieIcon },
    { id: 'radar', name: 'Radar Chart', icon: Hash },
];

const COLOR_PALETTES = [
    ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'],
    ['#ec4899', '#f97316', '#6366f1', '#14b8a6', '#facc15', '#475569'],
    ['#2dd4bf', '#fb923c', '#818cf8', '#fb7185', '#a78bfa', '#ca8a04'],
];

export const VisualizeWorkplace: React.FC = () => {
    const { activeConnectionId, connections } = useAppStore();
    const activeConnection = connections.find(c => c.id === activeConnectionId);

    // Designer State
    const [selectedTable, setSelectedTable] = useState<string>('');
    const [chartType, setChartType] = useState<string>('bar');
    const [xAxis, setXAxis] = useState<string>('');
    const [yAxis, setYAxis] = useState<string[]>([]);
    const [paletteIdx, setPaletteIdx] = useState(0);
    const [title, setTitle] = useState('New Visualization');
    const [error, setError] = useState<string | null>(null);
    const [searchTable, setSearchTable] = useState('');

    const activePalette = COLOR_PALETTES[paletteIdx];

    // 1. Fetch Databases
    const { data: databases } = useQuery({
        queryKey: ['db-list', activeConnectionId],
        queryFn: async () => {
            if (!activeConnectionId) return [];
            const adapter = connectionService.getAdapter(activeConnectionId, activeConnection?.type as any);
            return adapter.getDatabases();
        },
        enabled: !!activeConnectionId
    });

    const [currentDb, setCurrentDb] = useState<string>('');

    // 2. Fetch Flattened Tables (Supports Database -> Schema -> Table)
    const { data: allTables, isLoading: isLoadingTables } = useQuery({
        queryKey: ['flat-tables', activeConnectionId, currentDb],
        queryFn: async () => {
            if (!activeConnectionId) return [];
            const adapter = connectionService.getAdapter(activeConnectionId, activeConnection?.type as any);

            const results: TreeNode[] = [];

            const crawl = async (parentId: string | null) => {
                const nodes = await adapter.getHierarchy(parentId);
                for (const node of nodes) {
                    if (node.type === 'table' || node.type === 'view') {
                        results.push(node);
                    } else if (node.type === 'database') {
                        // If we are looking for a specific DB, only crawl if it matches
                        if (!currentDb || node.name === currentDb || node.id.includes(currentDb)) {
                            await crawl(node.id);
                        }
                    } else if (node.type === 'schema' || node.type === 'folder') {
                        await crawl(node.id);
                    }
                }
            };

            // If we have a selected DB, start from there to be faster
            if (currentDb) {
                await crawl(`db:${currentDb}`);
            } else {
                await crawl(null);
            }

            return results;
        },
        enabled: !!activeConnectionId
    });

    // 3. Query Data
    const { data: chartData, isLoading, refetch } = useQuery({
        queryKey: ['viz-data', activeConnectionId, selectedTable],
        queryFn: async () => {
            if (!activeConnectionId || !selectedTable) return [];
            const adapter = connectionService.getAdapter(activeConnectionId, activeConnection?.type as any);
            try {
                setError(null);
                const result = await adapter.executeQuery(`SELECT * FROM ${selectedTable} LIMIT 500`, { database: currentDb });
                return result.rows || [];
            } catch (err: any) {
                setError(err.message || 'Failed to fetch data');
                throw err;
            }
        },
        enabled: false,
        retry: false
    });

    const columns = useMemo(() => {
        if (!chartData || chartData.length === 0) return [];
        return Object.keys(chartData[0]);
    }, [chartData]);

    const filteredTables = useMemo(() => {
        if (!allTables) return [];
        if (!searchTable) return allTables;
        return allTables.filter(t => t.name.toLowerCase().includes(searchTable.toLowerCase()));
    }, [allTables, searchTable]);

    // Auto-setup axes
    useEffect(() => {
        if (chartData && chartData.length > 0) {
            const cols = Object.keys(chartData[0]);
            if (cols.length > 0 && (!xAxis || !cols.includes(xAxis))) {
                setXAxis(cols[0]);
                const numericCols = cols.filter(col => typeof chartData[0][col] === 'number');
                if (numericCols.length > 0) setYAxis([numericCols[0]]);
                else if (cols.length > 1) setYAxis([cols[1]]);
            }
        }
    }, [chartData]);

    const renderChart = () => {
        if (error) return (
            <div className="h-full flex flex-col items-center justify-center text-red-500/60 gap-4 p-8 text-center animate-in fade-in zoom-in duration-300">
                <AlertCircle className="h-20 w-20 text-red-500/20" />
                <div className="space-y-2">
                    <p className="font-black text-xs uppercase tracking-[0.2em] opacity-40">Operational Error</p>
                    <p className="text-sm border border-red-500/20 bg-red-500/5 p-5 rounded-2xl max-w-md font-mono shadow-2xl shadow-red-500/5 leading-relaxed">
                        {error}
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => refetch()} className="border-red-500/20 text-red-500 hover:bg-red-500/10 rounded-full px-6">
                    Recalibrate Query
                </Button>
            </div>
        );

        if (!chartData || chartData.length === 0) return (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-10 gap-6">
                <div className="relative">
                    <BarChart3 className="h-32 w-32" />
                    <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
                </div>
                <p className="font-black text-xl uppercase tracking-[0.4em]">Designer Idle</p>
            </div>
        );

        const CommonProps = { width: "100%", height: "100%", data: chartData, margin: { top: 20, right: 30, left: 20, bottom: 20 } };

        switch (chartType) {
            case 'bar':
                return (
                    <ResponsiveContainer {...CommonProps as any}>
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                            <XAxis dataKey={xAxis} axisLine={false} tickLine={false} fontSize={12} stroke="currentColor" />
                            <YAxis axisLine={false} tickLine={false} fontSize={12} stroke="currentColor" />
                            <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '16px', border: '1px solid hsl(var(--border))', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.5)' }} />
                            <Legend verticalAlign="top" height={36} />
                            {yAxis.map((col, i) => (
                                <Bar key={col} dataKey={col} fill={activePalette[i % activePalette.length]} radius={[6, 6, 0, 0]} />
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                );
            case 'line':
                return (
                    <ResponsiveContainer {...CommonProps as any}>
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                            <XAxis dataKey={xAxis} axisLine={false} tickLine={false} fontSize={12} stroke="currentColor" />
                            <YAxis axisLine={false} tickLine={false} fontSize={12} stroke="currentColor" />
                            <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '16px', border: '1px solid hsl(var(--border))' }} />
                            <Legend verticalAlign="top" height={36} />
                            {yAxis.map((col, i) => (
                                <Line key={col} type="monotone" dataKey={col} stroke={activePalette[i % activePalette.length]} strokeWidth={4} dot={{ r: 4, strokeWidth: 2, fill: 'hsl(var(--background))' }} activeDot={{ r: 7, strokeWidth: 0 }} />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                );
            case 'area':
                return (
                    <ResponsiveContainer {...CommonProps as any}>
                        <AreaChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                            <XAxis dataKey={xAxis} axisLine={false} tickLine={false} fontSize={12} stroke="currentColor" />
                            <YAxis axisLine={false} tickLine={false} fontSize={12} stroke="currentColor" />
                            <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '16px', border: '1px solid hsl(var(--border))' }} />
                            <Legend verticalAlign="top" height={36} />
                            {yAxis.map((col, i) => (
                                <Area key={col} type="monotone" dataKey={col} fill={activePalette[i % activePalette.length]} stroke={activePalette[i % activePalette.length]} fillOpacity={0.15} strokeWidth={3} />
                            ))}
                        </AreaChart>
                    </ResponsiveContainer>
                );
            case 'pie':
                return (
                    <ResponsiveContainer {...CommonProps as any}>
                        <PieChart>
                            <Pie
                                data={chartData.slice(0, 10)}
                                cx="50%" cy="50%"
                                innerRadius={80} outerRadius={120}
                                dataKey={yAxis[0] || columns[0]} nameKey={xAxis || columns[1]}
                                paddingAngle={8}
                            >
                                {chartData.slice(0, 10).map((_entry, index) => (
                                    <Cell key={`cell-${index}`} fill={activePalette[index % activePalette.length]} stroke="hsl(var(--background))" strokeWidth={4} />
                                ))}
                            </Pie>
                            <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '16px', border: '1px solid hsl(var(--border))' }} />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                );
            case 'radar':
                return (
                    <ResponsiveContainer {...CommonProps as any}>
                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData.slice(0, 8)}>
                            <PolarGrid opacity={0.1} stroke="currentColor" />
                            <PolarAngleAxis dataKey={xAxis} tick={{ fontSize: 10 }} />
                            <PolarRadiusAxis axisLine={false} tick={false} />
                            {yAxis.map((col, i) => (
                                <Radar key={col} name={col} dataKey={col} stroke={activePalette[i % activePalette.length]} fill={activePalette[i % activePalette.length]} fillOpacity={0.3} strokeWidth={2} />
                            ))}
                            <Legend />
                        </RadarChart>
                    </ResponsiveContainer>
                );
            default: return null;
        }
    };

    return (
        <div className="h-full flex bg-background overflow-hidden">
            {/* Sidebar Controls */}
            <div className="w-80 border-r bg-card/30 backdrop-blur-3xl flex flex-col shrink-0 overflow-auto custom-scrollbar">
                <div className="p-8 border-b bg-muted/5">
                    <div className="flex items-center gap-4 mb-1">
                        <div className="p-2.5 bg-emerald-500 rounded-2xl shadow-lg shadow-emerald-500/20 text-white">
                            <PieIcon className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="font-black text-lg tracking-tight leading-none">Visualizer</h2>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-black opacity-40 mt-1">v2.0 Beta Engine</p>
                        </div>
                    </div>
                </div>

                <div className="p-8 space-y-10">
                    {/* Source Selection */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
                                <Database className="h-3 w-3" />
                                Data Context
                            </div>
                        </div>

                        <div className="space-y-3">
                            {/* DB Select */}
                            {databases && databases.length > 0 && (
                                <Select value={currentDb} onValueChange={setCurrentDb}>
                                    <SelectTrigger className="bg-muted/10 border-border/30 h-9 text-[11px] rounded-xl focus:ring-emerald-500/20 ring-offset-0">
                                        <div className="flex items-center gap-2">
                                            <Database className="h-3 w-3 opacity-50" />
                                            <SelectValue placeholder="Target Database" />
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent>
                                        {databases.map(db => <SelectItem key={db} value={db} className="text-xs">{db}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            )}

                            {/* Entity Browser */}
                            <div className="space-y-2">
                                <div className="relative group">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground opacity-40" />
                                    <Input
                                        placeholder="Search tables..."
                                        value={searchTable}
                                        onChange={(e) => setSearchTable(e.target.value)}
                                        className="pl-9 bg-muted/20 border-border/20 h-9 text-xs rounded-xl focus:ring-emerald-500/20"
                                    />
                                </div>

                                <Select value={selectedTable} onValueChange={setSelectedTable}>
                                    <SelectTrigger className="bg-emerald-500/10 border-none transition-all hover:bg-emerald-500/20 text-emerald-600 text-xs h-10 rounded-2xl shadow-inner font-black overflow-hidden ring-offset-0 ring-0 focus:ring-0">
                                        <div className="flex items-center gap-2 truncate">
                                            <Table className="h-4 w-4" />
                                            <SelectValue placeholder={isLoadingTables ? "Scanning..." : "Select Entity"} />
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent className="max-h-[350px] rounded-2xl overflow-hidden shadow-2xl border-border/20">
                                        {filteredTables.map(t => (
                                            <SelectItem key={t.id} value={t.name} className="text-xs focus:bg-emerald-500/10 focus:text-emerald-600 transition-colors">
                                                <div className="flex items-center justify-between w-full gap-8">
                                                    <span className="font-bold">{t.name}</span>
                                                    <span className="text-[9px] opacity-30 uppercase font-black px-1.5 py-0.5 bg-muted rounded">{t.type}</span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                        {filteredTables.length === 0 && !isLoadingTables && (
                                            <div className="p-8 text-center opacity-30">
                                                <Search className="h-8 w-8 mx-auto mb-2 opacity-20" />
                                                <p className="text-[10px] font-black uppercase tracking-widest">Dead End</p>
                                            </div>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <Button
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-3 h-11 shadow-2xl shadow-emerald-500/30 transition-all active:scale-95 rounded-2xl font-black text-xs uppercase tracking-widest"
                            onClick={() => refetch()}
                            disabled={!selectedTable || isLoading}
                        >
                            <Play className={cn("h-4 w-4", isLoading && "animate-spin")} />
                            {isLoading ? 'Rending Canvas...' : 'Activate View'}
                        </Button>
                    </div>

                    {/* Chart Types */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
                            <Settings2 className="h-3 w-3" />
                            Visual Blueprint
                        </div>
                        <div className="grid grid-cols-5 gap-2">
                            {CHART_TYPES.map((type) => (
                                <Button
                                    key={type.id}
                                    variant={chartType === type.id ? 'default' : 'ghost'}
                                    className={cn(
                                        "p-0 h-10 rounded-xl transition-all duration-300",
                                        chartType === type.id ? "bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 scale-110" : "hover:bg-muted opacity-40 hover:opacity-100"
                                    )}
                                    onClick={() => setChartType(type.id)}
                                >
                                    <type.icon className="h-4.5 w-4.5" />
                                </Button>
                            ))}
                        </div>
                    </div>

                    {/* Mapping Control */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
                            <Type className="h-3 w-3" />
                            Coordinate Data
                        </div>

                        <div className="space-y-3">
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-black uppercase tracking-tighter opacity-30 px-1">Dimension (X)</label>
                                <Select value={xAxis} onValueChange={setXAxis}>
                                    <SelectTrigger className="bg-muted/10 border-border/20 text-xs h-9 rounded-xl font-bold ring-0">
                                        <SelectValue placeholder="Choose Dimension" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {columns.map(col => <SelectItem key={col} value={col} className="text-xs">{col}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[9px] font-black uppercase tracking-tighter opacity-30 px-1">Metrics (Y)</label>
                                <div className="grid grid-cols-1 gap-1.5 max-h-[180px] overflow-auto pr-2 custom-scrollbar">
                                    {columns.map(col => (
                                        <div
                                            key={col}
                                            className={cn(
                                                "flex items-center gap-3 p-2.5 rounded-xl cursor-pointer text-[11px] transition-all border font-bold",
                                                yAxis.includes(col) ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-muted/5 hover:bg-muted/10 border-transparent opacity-60"
                                            )}
                                            onClick={() => setYAxis(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col])}
                                        >
                                            <div className={cn("w-3.5 h-3.5 rounded-md border-2 transition-all shrink-0", yAxis.includes(col) ? "bg-emerald-500 border-emerald-500 scale-110 shadow-lg shadow-emerald-500/20" : "border-muted-foreground/30")} />
                                            <span className="truncate">{col}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Palette */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
                            <Palette className="h-3 w-3" />
                            Aesthetic Filter
                        </div>
                        <div className="flex gap-4 px-1">
                            {COLOR_PALETTES.map((p, i) => (
                                <div
                                    key={i}
                                    className={cn(
                                        "flex gap-0.5 p-1.5 rounded-2xl cursor-pointer transition-all hover:scale-125 hover:shadow-xl group",
                                        paletteIdx === i ? "bg-muted/10 ring-2 ring-emerald-500 ring-offset-4 ring-offset-background" : "opacity-30 hover:opacity-100"
                                    )}
                                    onClick={() => setPaletteIdx(i)}
                                >
                                    {p.slice(0, 3).map(c => <div key={c} className="w-4 h-4 rounded-lg shadow-lg" style={{ backgroundColor: c }} />)}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="mt-auto p-8 border-t bg-muted/10">
                    <Button variant="outline" className="w-full gap-2 border-dashed h-10 rounded-2xl text-[10px] font-black uppercase tracking-widest opacity-60 hover:opacity-100 transition-all">
                        <Download className="h-3.5 w-3.5" />
                        Export Snapshot
                    </Button>
                </div>
            </div>

            {/* Main Canvas Area */}
            <div className="flex-1 flex flex-col min-w-0 p-12 overflow-auto custom-scrollbar relative">
                {/* Loading Overlay */}
                {isLoading && (
                    <div className="absolute inset-0 z-[100] flex items-center justify-center bg-background/40 backdrop-blur-xl animate-in fade-in duration-500">
                        <div className="flex flex-col items-center gap-8">
                            <div className="relative scale-150">
                                <div className="w-20 h-20 rounded-full border-[6px] border-emerald-500/10 border-t-emerald-500 animate-spin" />
                                <PieIcon className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-8 text-emerald-500 animate-pulse" />
                            </div>
                            <div className="text-center space-y-2">
                                <p className="font-black uppercase tracking-[0.5em] text-lg text-emerald-500">Processing</p>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-[0.3em] font-black animate-pulse">Syncing Vector Streams</p>
                            </div>
                        </div>
                    </div>
                )}

                <div className="mb-12 flex items-end justify-between">
                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            <span className="px-2 py-1 bg-emerald-500/10 text-emerald-600 rounded-lg text-[9px] font-black uppercase tracking-widest border border-emerald-500/20">Active Session</span>
                            <div className="h-0.5 w-12 bg-border opacity-20" />
                        </div>
                        <Input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="bg-transparent border-none text-5xl font-black p-0 h-auto focus:ring-0 w-full max-w-2xl placeholder:opacity-5 shadow-none ring-0 selection:bg-emerald-500/20"
                            placeholder="Snapshot Title..."
                        />
                        <div className="flex items-center gap-4 text-xs text-muted-foreground font-bold opacity-40">
                            <span className="flex items-center gap-1.5"><Table className="h-3 w-3" /> {selectedTable || 'No Target'}</span>
                            <ChevronRight className="h-3 w-3" />
                            <span className="flex items-center gap-1.5"><Database className="h-3 w-3" /> {activeConnection?.name || 'Local'}</span>
                        </div>
                    </div>
                    <div className="flex gap-4">
                        <div className="px-5 py-2.5 bg-card/40 backdrop-blur-3xl border rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ring-1 ring-white/5 shadow-2xl flex items-center gap-3">
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
                            {chartType} Active
                        </div>
                    </div>
                </div>

                <div className="flex-1 min-h-[500px] relative group">
                    {/* Floating ambient glows */}
                    <div className="absolute -top-24 -right-24 w-[500px] h-[500px] bg-emerald-500/5 blur-[120px] rounded-full pointer-events-none group-hover:bg-emerald-500/10 transition-colors duration-1000" />
                    <div className="absolute -bottom-24 -left-24 w-[500px] h-[500px] bg-blue-500/5 blur-[120px] rounded-full pointer-events-none group-hover:bg-blue-500/10 transition-colors duration-1000" />

                    <Card className="h-full border-border/10 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] bg-card/30 backdrop-blur-2xl relative overflow-hidden rounded-[40px] transition-all duration-700 hover:shadow-[0_80px_150px_-30px_rgba(16,185,129,0.15)] ring-1 ring-white/5">
                        <CardContent className="h-full p-12 relative flex items-center justify-center">
                            <div className="w-full h-full">
                                {renderChart()}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};
