import React from 'react';
import {
    BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, RadarChart, PolarGrid,
    PolarAngleAxis, PolarRadiusAxis, Radar, ScatterChart, Scatter, Treemap, FunnelChart,
    Funnel, LabelList, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Cell, Legend, Brush
} from 'recharts';
import { AlertCircle, BarChart3, PieChart as PieIcon, PanelLeft, RotateCcw } from 'lucide-react';
import { useResponsiveLayoutMode } from '@/presentation/hooks/useResponsiveLayoutMode';
import { cn } from '@/lib/utils';
import { Button } from '@/presentation/components/ui/button';
import { useAppStore } from '@/core/services/store';
import type { RowData } from '@/core/domain/entities';
import type { CurveType } from '../useVisualizeLogic';

interface TreemapContentProps {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    name?: string | number;
    fill?: string;
}

interface VizCanvasProps {
    chartData: RowData[];
    error: string | null;
    refetch: () => void;
    chartType: string;
    xAxis: string;
    yAxis: string[];
    showGrid: boolean;
    showLegend: boolean;
    showBrush: boolean;
    curveType: CurveType;
    animationEnabled: boolean;
    labelVisible: boolean;
    palette: string[];
    isLargeDataset: boolean;
    getChartData: (type: string) => RowData[];
    chartRef: React.RefObject<HTMLDivElement | null>;
    title: string;
    isSidebarCollapsed: boolean;
    setSidebarCollapsed: (v: boolean) => void;
    isLoading: boolean;
    selectedTable?: string;
    chartTypeName?: string;
}

export const VizCanvas: React.FC<VizCanvasProps> = ({
    chartData, error, refetch, chartType, xAxis, yAxis, showGrid, showLegend, showBrush,
    curveType, animationEnabled, labelVisible, palette, isLargeDataset,
    getChartData, chartRef, title, isSidebarCollapsed, setSidebarCollapsed, isLoading,
    selectedTable, chartTypeName
}) => {
    const { isCompactMobileLayout } = useResponsiveLayoutMode();
    const { connections, activeConnectionId, nosqlActiveConnectionId } = useAppStore();

    const isNoSql = (nosqlActiveConnectionId && connections.find(c => c.id === nosqlActiveConnectionId)) || 
                    connections.find(c => c.id === activeConnectionId)?.type.toLowerCase().includes('mongo');


    const tooltipStyle = {
        backgroundColor: 'hsl(var(--card))',
        borderRadius: '16px',
        border: '1px solid hsl(var(--border))',
        boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.5)',
        fontSize: '11px',
    };

    const effectiveAnimation = isLargeDataset ? false : animationEnabled;
    const effectiveLabels = isLargeDataset ? false : labelVisible;
    const effectiveDots = isLargeDataset ? false : true;

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
                <p className="font-black text-lg uppercase tracking-[0.3em]">{isNoSql ? 'Select Data & Fetch' : 'Select Data & Run'}</p>
            </div>
        );

        const gridEl = showGrid ? <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.08} /> : null;
        const legendEl = showLegend ? <Legend verticalAlign="top" height={36} /> : null;
        const brushEl = (showBrush && !isLargeDataset) ? <Brush dataKey={xAxis} height={25} stroke="hsl(var(--primary))" /> : null;

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
                                <Bar key={col} dataKey={col} fill={palette[i % palette.length]} radius={[6, 6, 0, 0]} isAnimationActive={effectiveAnimation}>
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
                                <Bar key={col} dataKey={col} fill={palette[i % palette.length]} stackId="stack" radius={i === yAxis.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]} isAnimationActive={effectiveAnimation} />
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
                                <Bar key={col} dataKey={col} fill={palette[i % palette.length]} radius={[0, 6, 6, 0]} isAnimationActive={effectiveAnimation} />
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
                                <Line key={col} type={curveType} dataKey={col} stroke={palette[i % palette.length]}
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
                                <Area key={col} type={curveType} dataKey={col} fill={palette[i % palette.length]}
                                    stroke={palette[i % palette.length]} fillOpacity={0.15} strokeWidth={2} isAnimationActive={effectiveAnimation} />
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
                                    <Bar key={col} dataKey={col} fill={palette[i % palette.length]} radius={[6, 6, 0, 0]} isAnimationActive={effectiveAnimation} barSize={30} /> :
                                    <Line key={col} type={curveType} dataKey={col} stroke={palette[i % palette.length]} strokeWidth={isLargeDataset ? 2 : 3} dot={effectiveDots ? { r: 3 } : false} isAnimationActive={effectiveAnimation} />
                            ))}
                        </ComposedChart>
                    </ResponsiveContainer>
                );

            case 'pie':
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie data={chartData.slice(0, 20)} cx="50%" cy="50%" outerRadius="75%"
                                dataKey={yAxis[0] || Object.keys(chartData[0])[0]} nameKey={xAxis} paddingAngle={3} isAnimationActive={effectiveAnimation}>
                                {chartData.slice(0, 20).map((_entry, index) => (
                                    <Cell key={`cell-${index}`} fill={palette[index % palette.length]} stroke="hsl(var(--background))" strokeWidth={2} />
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
                                dataKey={yAxis[0] || Object.keys(chartData[0])[0]} nameKey={xAxis} paddingAngle={5} isAnimationActive={effectiveAnimation}>
                                {chartData.slice(0, 20).map((_entry, index) => (
                                    <Cell key={`cell-${index}`} fill={palette[index % palette.length]} stroke="hsl(var(--background))" strokeWidth={3} />
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
                            <Scatter name={`${xAxis} vs ${yAxis[0]}`} data={renderData} fill={palette[0]} isAnimationActive={effectiveAnimation} />
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
                                <Radar key={col} name={col} dataKey={col} stroke={palette[i % palette.length]}
                                    fill={palette[i % palette.length]} fillOpacity={0.2} strokeWidth={2} isAnimationActive={effectiveAnimation} />
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
                                fill: palette[i % palette.length]
                            }))}
                            dataKey="size" nameKey="name"
                            aspectRatio={4 / 3}
                            stroke="hsl(var(--background))"
                            isAnimationActive={effectiveAnimation}
                            content={(props: TreemapContentProps) => {
                                const { x = 0, y = 0, width = 0, height = 0, name = '', fill = palette[0] } = props;

                                return (
                                    <g>
                                        <rect x={x} y={y} width={width} height={height} fill={fill} rx={4} stroke="hsl(var(--background))" strokeWidth={2} />
                                        {width > 40 && height > 20 && (
                                            <text x={x + width / 2} y={y + height / 2} textAnchor="middle" dominantBaseline="central"
                                                fill="#fff" fontSize={Math.min(11, width / 8)} fontWeight="bold">
                                                {String(name).substring(0, Math.floor(width / 7))}
                                            </text>
                                        )}
                                    </g>
                                );
                            }}
                        />
                    </ResponsiveContainer>
                );

            case 'funnel':
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <FunnelChart>
                            <Tooltip contentStyle={tooltipStyle} />
                            <Funnel
                                dataKey={yAxis[0] || Object.keys(chartData[0])[0]}
                                nameKey={xAxis}
                                data={chartData.slice(0, 8).map((d, i) => ({ ...d, fill: palette[i % palette.length] }))}
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

    return (
        <div className="flex-1 flex flex-col min-w-0 relative overflow-hidden">
            {isSidebarCollapsed && (
                <Button variant="ghost" size="icon" onClick={() => setSidebarCollapsed(false)}
                    className="absolute top-3 left-3 z-50 h-8 w-8 bg-card/80 backdrop-blur border border-border/30 shadow-lg hover:bg-card">
                    <PanelLeft className="h-3.5 w-3.5" />
                </Button>
            )}

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

            <div className={cn(
                "pb-4 flex items-end justify-between",
                isCompactMobileLayout ? "px-4 pt-4" : "px-8 pt-8"
            )}>
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <span className="px-2 py-1 bg-emerald-500/10 text-emerald-600 rounded-lg text-[8px] font-black uppercase tracking-widest border border-emerald-500/20">
                            {chartData ? `${chartData.length} ${isNoSql ? 'docs' : 'rows'}` : 'Idle'}
                        </span>
                        {selectedTable && (
                            <span className="text-[9px] text-muted-foreground/40 font-bold uppercase tracking-wider">
                                {selectedTable}
                            </span>
                        )}
                    </div>
                    <h1 className={cn(
                        "font-black tracking-tight",
                        isCompactMobileLayout ? "text-xl" : "text-3xl"
                    )}>{title}</h1>
                </div>
                <div className="flex gap-2">
                    <div className="px-4 py-2 bg-card/40 backdrop-blur-xl border rounded-xl text-[9px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                        {chartTypeName}
                    </div>
                </div>
            </div>

            <div className={cn(
                "flex-1 pb-8 min-h-0",
                isCompactMobileLayout ? "px-2" : "px-8"
            )}>
                <div ref={chartRef} className="h-full relative group rounded-3xl overflow-hidden">
                    <div className="absolute -top-24 -right-24 w-[400px] h-[400px] bg-emerald-500/5 blur-[120px] rounded-full pointer-events-none group-hover:bg-emerald-500/8 transition-colors duration-1000" />
                    <div className="absolute -bottom-24 -left-24 w-[400px] h-[400px] bg-blue-500/5 blur-[120px] rounded-full pointer-events-none group-hover:bg-blue-500/8 transition-colors duration-1000" />

                    <div className={cn(
                        "h-full border border-border/10 bg-card/30 backdrop-blur-xl rounded-3xl shadow-2xl ring-1 ring-white/5",
                        isCompactMobileLayout ? "p-2" : "p-8"
                    )}>
                        {renderChart()}
                    </div>
                </div>
            </div>
        </div>
    );
};
