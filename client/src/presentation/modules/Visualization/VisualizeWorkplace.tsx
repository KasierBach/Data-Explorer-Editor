import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/core/services/store';
import { connectionService } from '@/core/services/ConnectionService';
import {
    BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
    ScatterChart, Scatter, Treemap, FunnelChart, Funnel, LabelList, ComposedChart,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend, Brush
} from 'recharts';
import {
    Database, PieChart as PieIcon, BarChart3, LineChart as LineIcon,
    Settings2, Play, Download, Layers, Type, Palette, Hash, AlertCircle, Table, Search,
    PanelLeftClose, PanelLeft, Code2, SlidersHorizontal,
    RotateCcw, Maximize2, FileText, Image, Grid3X3, TrendingUp, Columns3, GitFork
} from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/presentation/components/ui/select";
import { Input } from '@/presentation/components/ui/input';
import { cn } from '@/lib/utils';
import { toPng } from 'html-to-image';
import { toast } from 'sonner';
import type { TreeNode } from '@/core/domain/entities';

// ──────────────────── Chart Registry ────────────────────
const CHART_TYPES = [
    { id: 'bar', name: 'Bar', icon: BarChart3 },
    { id: 'stackedBar', name: 'Stacked Bar', icon: Columns3 },
    { id: 'horizontalBar', name: 'Horizontal', icon: BarChart3 },
    { id: 'line', name: 'Line', icon: LineIcon },
    { id: 'area', name: 'Area', icon: Layers },
    { id: 'composed', name: 'Composed', icon: TrendingUp },
    { id: 'pie', name: 'Pie', icon: PieIcon },
    { id: 'donut', name: 'Donut', icon: PieIcon },
    { id: 'scatter', name: 'Scatter', icon: Grid3X3 },
    { id: 'radar', name: 'Radar', icon: Hash },
    { id: 'treemap', name: 'Treemap', icon: GitFork },
    { id: 'funnel', name: 'Funnel', icon: SlidersHorizontal },
];

const COLOR_PALETTES = [
    { name: 'Ocean', colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'] },
    { name: 'Sunset', colors: ['#ec4899', '#f97316', '#6366f1', '#14b8a6', '#facc15', '#475569', '#ef4444', '#8b5cf6'] },
    { name: 'Forest', colors: ['#22c55e', '#16a34a', '#15803d', '#166534', '#4ade80', '#86efac', '#bbf7d0', '#14532d'] },
    { name: 'Neon', colors: ['#a855f7', '#ec4899', '#3b82f6', '#06b6d4', '#22c55e', '#eab308', '#f97316', '#ef4444'] },
    { name: 'Mono', colors: ['#f8fafc', '#cbd5e1', '#94a3b8', '#64748b', '#475569', '#334155', '#1e293b', '#0f172a'] },
];

const CURVE_TYPES = ['monotone', 'linear', 'step', 'basis', 'natural'] as const;

type DataMode = 'table' | 'sql';

// ──────────────────── Main Component ────────────────────
export const VisualizeWorkplace: React.FC = () => {
    const { activeConnectionId, connections, activeDatabase } = useAppStore();
    const activeConnection = connections.find(c => c.id === activeConnectionId);

    // ─── Data Source State ───
    const [dataMode, setDataMode] = useState<DataMode>('table');
    const [selectedTable, setSelectedTable] = useState<string>('');
    const [customSql, setCustomSql] = useState<string>('SELECT * FROM ');
    const [dataLimit, setDataLimit] = useState<number>(200);
    const [sortColumn, setSortColumn] = useState<string>('');
    const [sortDir, setSortDir] = useState<'ASC' | 'DESC'>('ASC');
    const [searchTable, setSearchTable] = useState('');

    // ─── Chart Config State ───
    const [chartType, setChartType] = useState<string>('bar');
    const [xAxis, setXAxis] = useState<string>('');
    const [yAxis, setYAxis] = useState<string[]>([]);
    const [paletteIdx, setPaletteIdx] = useState(0);
    const [title, setTitle] = useState('New Visualization');

    // ─── Customization State ───
    const [showGrid, setShowGrid] = useState(true);
    const [showLegend, setShowLegend] = useState(true);
    const [showBrush, setShowBrush] = useState(false);
    const [curveType, setCurveType] = useState<typeof CURVE_TYPES[number]>('monotone');
    const [animationEnabled, setAnimationEnabled] = useState(true);
    const [labelVisible, setLabelVisible] = useState(false);

    // ─── UI State ───
    const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeSection, setActiveSection] = useState<string>('source');
    const chartRef = useRef<HTMLDivElement>(null);

    const activePalette = COLOR_PALETTES[paletteIdx].colors;

    // ─── Database Selection (local, persists via store) ───
    const [currentDb, setCurrentDb] = useState<string>(activeDatabase || '');
    useEffect(() => { if (activeDatabase) setCurrentDb(activeDatabase); }, [activeDatabase]);

    // ──────────────────── Data Fetching ────────────────────

    const { data: databases } = useQuery({
        queryKey: ['db-list', activeConnectionId],
        queryFn: async () => {
            if (!activeConnectionId) return [];
            const adapter = connectionService.getAdapter(activeConnectionId, activeConnection?.type as any);
            return adapter.getDatabases();
        },
        enabled: !!activeConnectionId
    });

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
                        if (!currentDb || node.name === currentDb || node.id.includes(currentDb)) {
                            await crawl(node.id);
                        }
                    } else if (node.type === 'schema' || node.type === 'folder') {
                        await crawl(node.id);
                    }
                }
            };
            if (currentDb) await crawl(`db:${currentDb}`);
            else await crawl(null);
            return results;
        },
        enabled: !!activeConnectionId
    });

    const buildQuery = useCallback(() => {
        if (dataMode === 'sql') return customSql;
        if (!selectedTable) return '';
        let q = `SELECT * FROM ${selectedTable}`;
        if (sortColumn) q += ` ORDER BY ${sortColumn} ${sortDir}`;
        q += ` LIMIT ${dataLimit}`;
        return q;
    }, [dataMode, customSql, selectedTable, dataLimit, sortColumn, sortDir]);

    const { data: chartData, isLoading, refetch } = useQuery({
        queryKey: ['viz-data', activeConnectionId, buildQuery()],
        queryFn: async () => {
            const query = buildQuery();
            if (!activeConnectionId || !query) return [];
            const adapter = connectionService.getAdapter(activeConnectionId, activeConnection?.type as any);
            try {
                setError(null);
                const result = await adapter.executeQuery(query, { database: currentDb });
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

    const numericColumns = useMemo(() => {
        if (!chartData || chartData.length === 0) return [];
        return columns.filter(col => typeof chartData[0][col] === 'number');
    }, [chartData, columns]);

    const filteredTables = useMemo(() => {
        if (!allTables) return [];
        if (!searchTable) return allTables;
        return allTables.filter(t => t.name.toLowerCase().includes(searchTable.toLowerCase()));
    }, [allTables, searchTable]);

    // Auto-setup axes when data loads
    useEffect(() => {
        if (chartData && chartData.length > 0) {
            const cols = Object.keys(chartData[0]);
            if (cols.length > 0 && (!xAxis || !cols.includes(xAxis))) {
                setXAxis(cols[0]);
                const nums = cols.filter(col => typeof chartData[0][col] === 'number');
                if (nums.length > 0) setYAxis([nums[0]]);
                else if (cols.length > 1) setYAxis([cols[1]]);
            }
        }
    }, [chartData]);

    // ──────────────────── Performance Optimization ────────────────────
    const rowCount = chartData?.length || 0;
    const isLargeDataset = rowCount > 150;
    const isVeryLarge = rowCount > 300;

    // Auto-disable heavy features for large datasets
    const effectiveAnimation = isLargeDataset ? false : animationEnabled;
    const effectiveLabels = isLargeDataset ? false : labelVisible;
    const effectiveDots = isLargeDataset ? false : true;

    // Downsample data for line/area/scatter when too many points
    const downsampledData = useMemo(() => {
        if (!chartData || !isVeryLarge) return chartData;
        // Keep every Nth point to target ~150 data points
        const step = Math.ceil(chartData.length / 150);
        return chartData.filter((_: any, i: number) => i % step === 0 || i === chartData.length - 1);
    }, [chartData, isVeryLarge]);

    // Use downsampled data only for chart types that benefit from it
    const getChartData = useCallback((type: string) => {
        if (['line', 'area', 'scatter', 'composed'].includes(type) && isVeryLarge) {
            return downsampledData || [];
        }
        return chartData || [];
    }, [chartData, downsampledData, isVeryLarge]);

    // ──────────────────── Export Handlers ────────────────────
    const handleExportPNG = useCallback(() => {
        if (!chartRef.current) return;
        toPng(chartRef.current, { backgroundColor: '#0a0a0a', pixelRatio: 2 }).then(dataUrl => {
            const link = document.createElement('a');
            link.download = `chart-${title.replace(/\s+/g, '_')}-${Date.now()}.png`;
            link.href = dataUrl;
            link.click();
            toast.success('Chart exported as PNG');
        }).catch(() => toast.error('Failed to export PNG'));
    }, [title]);

    const handleExportCSV = useCallback(() => {
        if (!chartData || chartData.length === 0) return;
        const headers = Object.keys(chartData[0]).join(',');
        const rows = chartData.map(r => Object.values(r).join(','));
        const csv = [headers, ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `data-${title.replace(/\s+/g, '_')}-${Date.now()}.csv`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
        toast.success('Data exported as CSV');
    }, [chartData, title]);

    // ──────────────────── Tooltip Styling ────────────────────
    const tooltipStyle = {
        backgroundColor: 'hsl(var(--card))',
        borderRadius: '16px',
        border: '1px solid hsl(var(--border))',
        boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.5)',
        fontSize: '11px',
    };

    // ──────────────────── Chart Renderer ────────────────────
    const renderChart = () => {
        if (error) return (
            <div className="h-full flex flex-col items-center justify-center text-red-500/60 gap-4 p-8 text-center animate-in fade-in zoom-in duration-300">
                <AlertCircle className="h-16 w-16 text-red-500/20" />
                <div className="space-y-2">
                    <p className="font-black text-xs uppercase tracking-[0.2em] opacity-40">Query Error</p>
                    <p className="text-sm border border-red-500/20 bg-red-500/5 p-4 rounded-2xl max-w-md font-mono leading-relaxed">{error}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => refetch()} className="border-red-500/20 text-red-500 hover:bg-red-500/10 rounded-full px-6">
                    <RotateCcw className="h-3 w-3 mr-2" /> Retry
                </Button>
            </div>
        );

        if (!chartData || chartData.length === 0) return (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-10 gap-6">
                <BarChart3 className="h-28 w-28" />
                <p className="font-black text-lg uppercase tracking-[0.3em]">Select Data & Run</p>
            </div>
        );

        const gridEl = showGrid ? <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.08} /> : null;
        const legendEl = showLegend ? <Legend verticalAlign="top" height={36} /> : null;
        const brushEl = showBrush && !isLargeDataset ? <Brush dataKey={xAxis} height={25} stroke="hsl(var(--primary))" /> : null;

        const renderData = getChartData(chartType);

        switch (chartType) {
            case 'bar':
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={renderData}>
                            {gridEl}
                            <XAxis dataKey={xAxis} axisLine={false} tickLine={false} fontSize={11} stroke="currentColor" />
                            <YAxis axisLine={false} tickLine={false} fontSize={11} stroke="currentColor" />
                            <Tooltip contentStyle={tooltipStyle} />
                            {legendEl}{brushEl}
                            {yAxis.map((col, i) => (
                                <Bar key={col} dataKey={col} fill={activePalette[i % activePalette.length]} radius={[6, 6, 0, 0]} isAnimationActive={effectiveAnimation}>
                                    {effectiveLabels && <LabelList dataKey={col} position="top" fontSize={9} />}
                                </Bar>
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                );

            case 'stackedBar':
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={renderData}>
                            {gridEl}
                            <XAxis dataKey={xAxis} axisLine={false} tickLine={false} fontSize={11} stroke="currentColor" />
                            <YAxis axisLine={false} tickLine={false} fontSize={11} stroke="currentColor" />
                            <Tooltip contentStyle={tooltipStyle} />
                            {legendEl}{brushEl}
                            {yAxis.map((col, i) => (
                                <Bar key={col} dataKey={col} fill={activePalette[i % activePalette.length]} stackId="stack" radius={i === yAxis.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]} isAnimationActive={effectiveAnimation} />
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                );

            case 'horizontalBar':
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={renderData} layout="vertical">
                            {gridEl}
                            <XAxis type="number" axisLine={false} tickLine={false} fontSize={11} stroke="currentColor" />
                            <YAxis type="category" dataKey={xAxis} axisLine={false} tickLine={false} fontSize={10} stroke="currentColor" width={100} />
                            <Tooltip contentStyle={tooltipStyle} />
                            {legendEl}
                            {yAxis.map((col, i) => (
                                <Bar key={col} dataKey={col} fill={activePalette[i % activePalette.length]} radius={[0, 6, 6, 0]} isAnimationActive={effectiveAnimation} />
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                );

            case 'line':
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={renderData}>
                            {gridEl}
                            <XAxis dataKey={xAxis} axisLine={false} tickLine={false} fontSize={11} stroke="currentColor" />
                            <YAxis axisLine={false} tickLine={false} fontSize={11} stroke="currentColor" />
                            <Tooltip contentStyle={tooltipStyle} />
                            {legendEl}{brushEl}
                            {yAxis.map((col, i) => (
                                <Line key={col} type={curveType} dataKey={col} stroke={activePalette[i % activePalette.length]}
                                    strokeWidth={isLargeDataset ? 2 : 3} dot={effectiveDots ? { r: 3, strokeWidth: 2, fill: 'hsl(var(--background))' } : false}
                                    activeDot={effectiveDots ? { r: 6, strokeWidth: 0 } : { r: 4 }} isAnimationActive={effectiveAnimation} />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                );

            case 'area':
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={renderData}>
                            {gridEl}
                            <XAxis dataKey={xAxis} axisLine={false} tickLine={false} fontSize={11} stroke="currentColor" />
                            <YAxis axisLine={false} tickLine={false} fontSize={11} stroke="currentColor" />
                            <Tooltip contentStyle={tooltipStyle} />
                            {legendEl}{brushEl}
                            {yAxis.map((col, i) => (
                                <Area key={col} type={curveType} dataKey={col} fill={activePalette[i % activePalette.length]}
                                    stroke={activePalette[i % activePalette.length]} fillOpacity={0.15} strokeWidth={2} isAnimationActive={effectiveAnimation} />
                            ))}
                        </AreaChart>
                    </ResponsiveContainer>
                );

            case 'composed':
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={renderData}>
                            {gridEl}
                            <XAxis dataKey={xAxis} axisLine={false} tickLine={false} fontSize={11} stroke="currentColor" />
                            <YAxis axisLine={false} tickLine={false} fontSize={11} stroke="currentColor" />
                            <Tooltip contentStyle={tooltipStyle} />
                            {legendEl}{brushEl}
                            {yAxis.map((col, i) => (
                                i % 2 === 0 ?
                                    <Bar key={col} dataKey={col} fill={activePalette[i % activePalette.length]} radius={[6, 6, 0, 0]} isAnimationActive={effectiveAnimation} barSize={30} /> :
                                    <Line key={col} type={curveType} dataKey={col} stroke={activePalette[i % activePalette.length]} strokeWidth={isLargeDataset ? 2 : 3} dot={effectiveDots ? { r: 3 } : false} isAnimationActive={effectiveAnimation} />
                            ))}
                        </ComposedChart>
                    </ResponsiveContainer>
                );

            case 'pie':
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie data={chartData.slice(0, 20)} cx="50%" cy="50%" outerRadius="75%"
                                dataKey={yAxis[0] || columns[0]} nameKey={xAxis} paddingAngle={3} isAnimationActive={effectiveAnimation}>
                                {chartData.slice(0, 20).map((_entry, index) => (
                                    <Cell key={`cell-${index}`} fill={activePalette[index % activePalette.length]} stroke="hsl(var(--background))" strokeWidth={2} />
                                ))}
                                {effectiveLabels && <LabelList dataKey={xAxis} position="outside" fontSize={10} />}
                            </Pie>
                            <Tooltip contentStyle={tooltipStyle} />
                            {legendEl}
                        </PieChart>
                    </ResponsiveContainer>
                );

            case 'donut':
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie data={chartData.slice(0, 20)} cx="50%" cy="50%" innerRadius="45%" outerRadius="75%"
                                dataKey={yAxis[0] || columns[0]} nameKey={xAxis} paddingAngle={5} isAnimationActive={effectiveAnimation}>
                                {chartData.slice(0, 20).map((_entry, index) => (
                                    <Cell key={`cell-${index}`} fill={activePalette[index % activePalette.length]} stroke="hsl(var(--background))" strokeWidth={3} />
                                ))}
                            </Pie>
                            <Tooltip contentStyle={tooltipStyle} />
                            {legendEl}
                        </PieChart>
                    </ResponsiveContainer>
                );

            case 'scatter':
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart>
                            {gridEl}
                            <XAxis dataKey={xAxis} name={xAxis} axisLine={false} tickLine={false} fontSize={11} stroke="currentColor" type="number" />
                            <YAxis dataKey={yAxis[0]} name={yAxis[0]} axisLine={false} tickLine={false} fontSize={11} stroke="currentColor" />
                            <Tooltip contentStyle={tooltipStyle} cursor={{ strokeDasharray: '3 3' }} />
                            {legendEl}
                            <Scatter name={`${xAxis} vs ${yAxis[0]}`} data={renderData} fill={activePalette[0]} isAnimationActive={effectiveAnimation} />
                        </ScatterChart>
                    </ResponsiveContainer>
                );

            case 'radar':
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="75%" data={chartData.slice(0, 12)}>
                            <PolarGrid opacity={0.1} stroke="currentColor" />
                            <PolarAngleAxis dataKey={xAxis} tick={{ fontSize: 10 }} />
                            <PolarRadiusAxis axisLine={false} tick={false} />
                            {yAxis.map((col, i) => (
                                <Radar key={col} name={col} dataKey={col} stroke={activePalette[i % activePalette.length]}
                                    fill={activePalette[i % activePalette.length]} fillOpacity={0.2} strokeWidth={2} isAnimationActive={effectiveAnimation} />
                            ))}
                            {legendEl}
                        </RadarChart>
                    </ResponsiveContainer>
                );

            case 'treemap':
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <Treemap
                            data={chartData.slice(0, 30).map((d, i) => ({
                                name: String(d[xAxis] || `Item ${i}`),
                                size: Number(d[yAxis[0]] || 0),
                                fill: activePalette[i % activePalette.length]
                            }))}
                            dataKey="size" nameKey="name"
                            aspectRatio={4 / 3}
                            stroke="hsl(var(--background))"
                            isAnimationActive={effectiveAnimation}
                            content={({ x, y, width, height, name, fill }: any) => (
                                <g>
                                    <rect x={x} y={y} width={width} height={height} fill={fill} rx={4} stroke="hsl(var(--background))" strokeWidth={2} />
                                    {width > 40 && height > 20 && (
                                        <text x={x + width / 2} y={y + height / 2} textAnchor="middle" dominantBaseline="central"
                                            fill="#fff" fontSize={Math.min(11, width / 8)} fontWeight="bold">
                                            {String(name).substring(0, Math.floor(width / 7))}
                                        </text>
                                    )}
                                </g>
                            )}
                        />
                    </ResponsiveContainer>
                );

            case 'funnel':
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <FunnelChart>
                            <Tooltip contentStyle={tooltipStyle} />
                            <Funnel
                                dataKey={yAxis[0] || columns[0]}
                                nameKey={xAxis}
                                data={chartData.slice(0, 8).map((d, i) => ({ ...d, fill: activePalette[i % activePalette.length] }))}
                                isAnimationActive={effectiveAnimation}
                            >
                                <LabelList position="center" fill="#fff" fontSize={11} fontWeight="bold" />
                            </Funnel>
                        </FunnelChart>
                    </ResponsiveContainer>
                );

            default: return null;
        }
    };

    // ──────────────────── Sidebar Sections ────────────────────
    const sidebarSections = [
        { id: 'source', label: 'Data Source', icon: Database },
        { id: 'chart', label: 'Chart Type', icon: BarChart3 },
        { id: 'axes', label: 'Axes & Fields', icon: Type },
        { id: 'style', label: 'Style', icon: Palette },
        { id: 'options', label: 'Options', icon: Settings2 },
    ];

    return (
        <div className="h-full flex bg-background overflow-hidden">
            {/* ───────── Sidebar ───────── */}
            <div className={cn(
                "border-r bg-card/30 backdrop-blur-3xl flex flex-col shrink-0 transition-all duration-300",
                isSidebarCollapsed ? "w-0 overflow-hidden border-none" : "w-80"
            )}>
                <div className="w-80 h-full flex flex-col">
                    {/* Sidebar Header */}
                    <div className="p-5 border-b bg-muted/5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-500 rounded-xl shadow-lg shadow-emerald-500/20 text-white">
                                <PieIcon className="h-4 w-4" />
                            </div>
                            <div>
                                <h2 className="font-black text-sm tracking-tight leading-none">Chart Studio</h2>
                                <p className="text-[9px] text-muted-foreground uppercase tracking-[0.15em] font-bold opacity-40 mt-0.5">
                                    {chartData ? `${chartData.length} rows` : 'No data'}
                                </p>
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-40 hover:opacity-100" onClick={() => setSidebarCollapsed(true)}>
                            <PanelLeftClose className="h-3.5 w-3.5" />
                        </Button>
                    </div>

                    {/* Section Tabs */}
                    <div className="flex border-b bg-muted/5">
                        {sidebarSections.map(s => (
                            <button key={s.id} onClick={() => setActiveSection(s.id)}
                                className={cn(
                                    "flex-1 py-2.5 flex flex-col items-center gap-1 text-[8px] font-bold uppercase tracking-wider transition-all border-b-2",
                                    activeSection === s.id ? "text-emerald-500 border-emerald-500 bg-emerald-500/5" : "text-muted-foreground/40 border-transparent hover:text-muted-foreground/60"
                                )}>
                                <s.icon className="h-3.5 w-3.5" />
                                {s.label.split(' ')[0]}
                            </button>
                        ))}
                    </div>

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-auto custom-scrollbar p-5 space-y-5">

                        {/* ─── SOURCE SECTION ─── */}
                        {activeSection === 'source' && (
                            <>
                                {/* Data Mode Toggle */}
                                <div className="flex gap-1 bg-muted/10 rounded-xl p-1">
                                    <button onClick={() => setDataMode('table')}
                                        className={cn("flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5",
                                            dataMode === 'table' ? "bg-emerald-500 text-white shadow-lg" : "text-muted-foreground hover:text-foreground")}>
                                        <Table className="h-3 w-3" /> Table
                                    </button>
                                    <button onClick={() => setDataMode('sql')}
                                        className={cn("flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5",
                                            dataMode === 'sql' ? "bg-emerald-500 text-white shadow-lg" : "text-muted-foreground hover:text-foreground")}>
                                        <Code2 className="h-3 w-3" /> SQL
                                    </button>
                                </div>

                                {/* DB Select */}
                                {databases && databases.length > 0 && (
                                    <Select value={currentDb} onValueChange={setCurrentDb}>
                                        <SelectTrigger className="bg-muted/10 border-border/30 h-9 text-[11px] rounded-xl">
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

                                {dataMode === 'table' ? (
                                    <>
                                        {/* Table Search */}
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground opacity-40" />
                                            <Input placeholder="Search tables..." value={searchTable} onChange={(e) => setSearchTable(e.target.value)}
                                                className="pl-9 bg-muted/20 border-border/20 h-9 text-xs rounded-xl" />
                                        </div>

                                        {/* Table Select */}
                                        <Select value={selectedTable} onValueChange={setSelectedTable}>
                                            <SelectTrigger className="bg-emerald-500/10 border-none hover:bg-emerald-500/20 text-emerald-600 text-xs h-10 rounded-2xl shadow-inner font-bold overflow-hidden">
                                                <div className="flex items-center gap-2 truncate">
                                                    <Table className="h-4 w-4" />
                                                    <SelectValue placeholder={isLoadingTables ? "Scanning..." : "Select Table"} />
                                                </div>
                                            </SelectTrigger>
                                            <SelectContent className="max-h-[350px] rounded-2xl overflow-hidden shadow-2xl">
                                                {filteredTables.map(t => (
                                                    <SelectItem key={t.id} value={t.name} className="text-xs focus:bg-emerald-500/10 focus:text-emerald-600">
                                                        <div className="flex items-center justify-between w-full gap-8">
                                                            <span className="font-bold">{t.name}</span>
                                                            <span className="text-[9px] opacity-30 uppercase font-bold px-1.5 py-0.5 bg-muted rounded">{t.type}</span>
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>

                                        {/* Data Limit */}
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60">Row Limit</label>
                                                <span className="text-[10px] font-mono text-emerald-500 font-bold">{dataLimit}</span>
                                            </div>
                                            <input type="range" min={10} max={1000} step={10} value={dataLimit}
                                                onChange={(e) => setDataLimit(Number(e.target.value))}
                                                className="w-full h-1.5 bg-muted/20 rounded-full appearance-none cursor-pointer accent-emerald-500" />
                                        </div>

                                        {/* Sort Control */}
                                        {columns.length > 0 && (
                                            <div className="space-y-2">
                                                <label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60">Sort By</label>
                                                <div className="flex gap-2">
                                                    <Select value={sortColumn} onValueChange={setSortColumn}>
                                                        <SelectTrigger className="bg-muted/10 border-border/20 h-8 text-[10px] rounded-lg flex-1">
                                                            <SelectValue placeholder="Column" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="none" className="text-xs">None</SelectItem>
                                                            {columns.map(c => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                    <button onClick={() => setSortDir(d => d === 'ASC' ? 'DESC' : 'ASC')}
                                                        className="px-3 h-8 bg-muted/10 rounded-lg text-[9px] font-bold text-muted-foreground hover:bg-muted/20 transition-colors">
                                                        {sortDir}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    /* Custom SQL */
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60">Custom Query</label>
                                        <textarea value={customSql} onChange={(e) => setCustomSql(e.target.value)}
                                            className="w-full h-32 bg-muted/10 border border-border/20 rounded-xl p-3 text-xs font-mono resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
                                            placeholder="SELECT * FROM ..." spellCheck={false} />
                                    </div>
                                )}

                                {/* Run Button */}
                                <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2 h-10 shadow-xl shadow-emerald-500/20 transition-all active:scale-95 rounded-xl font-bold text-xs uppercase tracking-widest"
                                    onClick={() => refetch()} disabled={dataMode === 'table' ? !selectedTable : !customSql.trim() || isLoading}>
                                    <Play className={cn("h-4 w-4", isLoading && "animate-spin")} />
                                    {isLoading ? 'Loading...' : 'Run Query'}
                                </Button>
                            </>
                        )}

                        {/* ─── CHART TYPE SECTION ─── */}
                        {activeSection === 'chart' && (
                            <div className="grid grid-cols-3 gap-2">
                                {CHART_TYPES.map(type => (
                                    <button key={type.id} onClick={() => setChartType(type.id)}
                                        className={cn(
                                            "p-3 rounded-xl flex flex-col items-center gap-2 transition-all border text-[9px] font-bold uppercase tracking-wider",
                                            chartType === type.id
                                                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30 shadow-lg shadow-emerald-500/5"
                                                : "bg-muted/5 text-muted-foreground/50 border-border/10 hover:bg-muted/10 hover:text-muted-foreground"
                                        )}>
                                        <type.icon className="h-5 w-5" />
                                        {type.name}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* ─── AXES SECTION ─── */}
                        {activeSection === 'axes' && columns.length > 0 && (
                            <>
                                {/* X Axis */}
                                <div className="space-y-2">
                                    <label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60">Dimension (X-Axis)</label>
                                    <Select value={xAxis} onValueChange={setXAxis}>
                                        <SelectTrigger className="bg-muted/10 border-border/20 text-xs h-9 rounded-xl font-bold">
                                            <SelectValue placeholder="Choose Dimension" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {columns.map(col => <SelectItem key={col} value={col} className="text-xs">{col}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Y Axis */}
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60">Metrics (Y-Axis)</label>
                                        <span className="text-[9px] text-emerald-500 font-bold">{yAxis.length} selected</span>
                                    </div>
                                    <div className="grid grid-cols-1 gap-1.5 max-h-[300px] overflow-auto custom-scrollbar">
                                        {columns.map(col => (
                                            <div key={col} onClick={() => setYAxis(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col])}
                                                className={cn(
                                                    "flex items-center gap-3 p-2.5 rounded-xl cursor-pointer text-[11px] transition-all border font-bold",
                                                    yAxis.includes(col) ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-muted/5 hover:bg-muted/10 border-transparent opacity-50"
                                                )}>
                                                <div className={cn("w-3.5 h-3.5 rounded-md border-2 transition-all shrink-0",
                                                    yAxis.includes(col) ? "bg-emerald-500 border-emerald-500 shadow-lg shadow-emerald-500/20" : "border-muted-foreground/30")} />
                                                <span className="truncate flex-1">{col}</span>
                                                {numericColumns.includes(col) && <span className="text-[8px] text-emerald-500/50 font-black">#</span>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}

                        {activeSection === 'axes' && columns.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/30 gap-3">
                                <Table className="h-10 w-10" />
                                <p className="text-[10px] font-bold uppercase tracking-widest">Run a query first</p>
                            </div>
                        )}

                        {/* ─── STYLE SECTION ─── */}
                        {activeSection === 'style' && (
                            <>
                                {/* Title */}
                                <div className="space-y-2">
                                    <label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60">Chart Title</label>
                                    <Input value={title} onChange={(e) => setTitle(e.target.value)}
                                        className="bg-muted/10 border-border/20 h-9 text-xs rounded-xl" placeholder="Chart title..." />
                                </div>

                                {/* Color Palette */}
                                <div className="space-y-3">
                                    <label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60">Color Palette</label>
                                    <div className="space-y-2">
                                        {COLOR_PALETTES.map((p, i) => (
                                            <div key={i} onClick={() => setPaletteIdx(i)}
                                                className={cn(
                                                    "flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all border",
                                                    paletteIdx === i ? "bg-emerald-500/10 border-emerald-500/20" : "border-transparent hover:bg-muted/10 opacity-50"
                                                )}>
                                                <div className="flex gap-1">
                                                    {p.colors.slice(0, 6).map(c => <div key={c} className="w-4 h-4 rounded-md" style={{ backgroundColor: c }} />)}
                                                </div>
                                                <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{p.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Curve Type */}
                                {['line', 'area', 'composed'].includes(chartType) && (
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60">Curve Style</label>
                                        <div className="flex flex-wrap gap-1.5">
                                            {CURVE_TYPES.map(c => (
                                                <button key={c} onClick={() => setCurveType(c)}
                                                    className={cn("px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase transition-all",
                                                        curveType === c ? "bg-emerald-500 text-white" : "bg-muted/10 text-muted-foreground/50 hover:text-muted-foreground")}>
                                                    {c}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {/* ─── OPTIONS SECTION ─── */}
                        {activeSection === 'options' && (
                            <>
                                {[
                                    { label: 'Grid Lines', value: showGrid, set: setShowGrid, icon: Grid3X3 },
                                    { label: 'Legend', value: showLegend, set: setShowLegend, icon: FileText },
                                    { label: 'Data Labels', value: labelVisible, set: setLabelVisible, icon: Type },
                                    { label: 'Animations', value: animationEnabled, set: setAnimationEnabled, icon: Play },
                                    { label: 'Brush Zoom', value: showBrush, set: setShowBrush, icon: Maximize2 },
                                ].map(opt => (
                                    <div key={opt.label} className="flex items-center justify-between p-3 bg-muted/5 rounded-xl border border-border/10 hover:border-border/20 transition-all">
                                        <div className="flex items-center gap-2.5">
                                            <opt.icon className="h-3.5 w-3.5 text-muted-foreground/50" />
                                            <span className="text-xs font-bold">{opt.label}</span>
                                        </div>
                                        <button onClick={() => opt.set(!opt.value)}
                                            className={cn("w-9 h-5 rounded-full transition-all relative",
                                                opt.value ? "bg-emerald-500" : "bg-muted/30")}>
                                            <div className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
                                                opt.value ? "translate-x-4" : "translate-x-0.5")} />
                                        </button>
                                    </div>
                                ))}

                                {/* Export */}
                                <div className="space-y-2 pt-4 border-t border-border/10">
                                    <label className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60">Export</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <Button variant="outline" size="sm" onClick={handleExportPNG}
                                            className="h-9 gap-2 rounded-xl text-[10px] font-bold border-border/20">
                                            <Image className="h-3.5 w-3.5" /> PNG
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={handleExportCSV}
                                            className="h-9 gap-2 rounded-xl text-[10px] font-bold border-border/20">
                                            <Download className="h-3.5 w-3.5" /> CSV
                                        </Button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* ───────── Main Canvas ───────── */}
            <div className="flex-1 flex flex-col min-w-0 relative overflow-hidden">
                {/* Collapse button */}
                {isSidebarCollapsed && (
                    <Button variant="ghost" size="icon" onClick={() => setSidebarCollapsed(false)}
                        className="absolute top-3 left-3 z-50 h-8 w-8 bg-card/80 backdrop-blur border border-border/30 shadow-lg hover:bg-card">
                        <PanelLeft className="h-3.5 w-3.5" />
                    </Button>
                )}

                {/* Loading */}
                {isLoading && (
                    <div className="absolute inset-0 z-[100] flex items-center justify-center bg-background/40 backdrop-blur-xl animate-in fade-in duration-500">
                        <div className="flex flex-col items-center gap-6">
                            <div className="relative">
                                <div className="w-16 h-16 rounded-full border-4 border-emerald-500/10 border-t-emerald-500 animate-spin" />
                                <PieIcon className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-6 w-6 text-emerald-500 animate-pulse" />
                            </div>
                            <p className="font-black uppercase tracking-[0.3em] text-sm text-emerald-500">Processing</p>
                        </div>
                    </div>
                )}

                {/* Chart Header */}
                <div className="px-8 pt-8 pb-4 flex items-end justify-between">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <span className="px-2 py-1 bg-emerald-500/10 text-emerald-600 rounded-lg text-[8px] font-black uppercase tracking-widest border border-emerald-500/20">
                                {chartData ? `${chartData.length} rows` : 'Idle'}
                            </span>
                            {selectedTable && (
                                <span className="text-[9px] text-muted-foreground/40 font-bold uppercase tracking-wider">
                                    {selectedTable}
                                </span>
                            )}
                        </div>
                        <h1 className="text-3xl font-black tracking-tight">{title}</h1>
                    </div>
                    <div className="flex gap-2">
                        <div className="px-4 py-2 bg-card/40 backdrop-blur-xl border rounded-xl text-[9px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                            {CHART_TYPES.find(t => t.id === chartType)?.name}
                        </div>
                    </div>
                </div>

                {/* Chart Canvas */}
                <div className="flex-1 px-8 pb-8 min-h-0">
                    <div ref={chartRef} className="h-full relative group rounded-3xl overflow-hidden">
                        {/* Ambient glows */}
                        <div className="absolute -top-24 -right-24 w-[400px] h-[400px] bg-emerald-500/5 blur-[120px] rounded-full pointer-events-none group-hover:bg-emerald-500/8 transition-colors duration-1000" />
                        <div className="absolute -bottom-24 -left-24 w-[400px] h-[400px] bg-blue-500/5 blur-[120px] rounded-full pointer-events-none group-hover:bg-blue-500/8 transition-colors duration-1000" />

                        <div className="h-full border border-border/10 bg-card/30 backdrop-blur-xl rounded-3xl p-8 shadow-2xl ring-1 ring-white/5">
                            {renderChart()}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
