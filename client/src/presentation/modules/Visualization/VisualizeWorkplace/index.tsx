import React from 'react';
import { 
    BarChart3, Columns3, LineChart as LineIcon, Layers, TrendingUp, 
    PieChart as PieIcon, Grid3X3, Hash, GitFork, SlidersHorizontal, 
    Maximize2, FileText, Play, Type
} from 'lucide-react';
import { useVisualizeLogic } from './useVisualizeLogic';
import { VizSidebar } from './components/VizSidebar';
import { VizCanvas } from './components/VizCanvas';
import { useResponsiveLayoutMode } from '@/presentation/hooks/useResponsiveLayoutMode';
import { cn } from '@/lib/utils';

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

export const VisualizeWorkplace: React.FC = () => {
    const { state, actions } = useVisualizeLogic();
    const { setSidebarCollapsed } = actions;

    const chartTypeName = CHART_TYPES.find(t => t.id === state.chartType)?.name;
    const activePalette = COLOR_PALETTES[state.paletteIdx].colors;

    const rowCount = state.chartData?.length || 0;
    const isLargeDataset = rowCount > 150;
    const isVeryLarge = rowCount > 300;

    const getChartData = (type: string) => {
        if (['line', 'area', 'scatter', 'composed'].includes(type) && isVeryLarge) {
            return state.downsampledData || [];
        }
        return state.chartData || [];
    };

    const options = [
        { label: 'Grid Lines', value: state.showGrid, set: actions.setShowGrid, icon: Grid3X3 },
        { label: 'Legend', value: state.showLegend, set: actions.setShowLegend, icon: FileText },
        { label: 'Data Labels', value: state.labelVisible, set: actions.setLabelVisible, icon: Type },
        { label: 'Animations', value: state.animationEnabled, set: actions.setAnimationEnabled, icon: Play },
        { label: 'Brush Zoom', value: state.showBrush, set: actions.setShowBrush, icon: Maximize2 },
    ];

    const { isCompactMobileLayout } = useResponsiveLayoutMode();

    // Auto-collapse only in compact mobile mode. Desktop mode on a mobile browser
    // should preserve the desktop-style canvas/sidebar layout.
    React.useEffect(() => {
        if (isCompactMobileLayout) {
            setSidebarCollapsed(true);
        }
    }, [isCompactMobileLayout, setSidebarCollapsed]);

    return (
        <div className={cn(
            "h-full flex bg-background overflow-hidden font-sans",
            isCompactMobileLayout ? "flex-col" : "flex-row"
        )}>
            <VizSidebar
                isCollapsed={state.isSidebarCollapsed}
                setCollapsed={actions.setSidebarCollapsed}
                activeSection={state.activeSection}
                setActiveSection={actions.setActiveSection}
                dataMode={state.dataMode}
                setDataMode={actions.setDataMode}
                currentDb={state.currentDb}
                setCurrentDb={actions.setCurrentDb}
                databases={state.databases || []}
                searchTable={state.searchTable}
                setSearchTable={actions.setSearchTable}
                selectedTable={state.selectedTable}
                setSelectedTable={actions.setSelectedTable}
                filteredTables={state.filteredTables}
                isLoadingTables={state.isLoadingTables}
                dataLimit={state.dataLimit}
                setDataLimit={actions.setDataLimit}
                sortColumn={state.sortColumn}
                setSortColumn={actions.setSortColumn}
                sortDir={state.sortDir}
                setSortDir={actions.setSortDir}
                customSql={state.customSql}
                setCustomSql={actions.setCustomSql}
                isLoading={state.isLoading}
                refetch={actions.refetch}
                chartType={state.chartType}
                setChartType={actions.setChartType}
                xAxis={state.xAxis}
                setXAxis={actions.setXAxis}
                yAxis={state.yAxis}
                setYAxis={actions.setYAxis}
                columns={state.columns}
                numericColumns={state.numericColumns}
                title={state.title}
                setTitle={actions.setTitle}
                paletteIdx={state.paletteIdx}
                setPaletteIdx={actions.setPaletteIdx}
                colorPalettes={COLOR_PALETTES}
                chartTypes={CHART_TYPES}
                curveType={state.curveType}
                setCurveType={actions.setCurveType}
                curveTypes={CURVE_TYPES}
                options={options}
                handleExportPNG={actions.handleExportPNG}
                handleExportCSV={actions.handleExportCSV}
                chartData={state.chartData}
            />

            <VizCanvas
                chartData={state.chartData || []}
                error={state.error}
                refetch={actions.refetch}
                chartType={state.chartType}
                xAxis={state.xAxis}
                yAxis={state.yAxis}
                showGrid={state.showGrid}
                showLegend={state.showLegend}
                showBrush={state.showBrush}
                curveType={state.curveType}
                animationEnabled={state.animationEnabled}
                labelVisible={state.labelVisible}
                palette={activePalette}
                isLargeDataset={isLargeDataset}
                getChartData={getChartData}
                chartRef={state.chartRef}
                title={state.title}
                isSidebarCollapsed={state.isSidebarCollapsed}
                setSidebarCollapsed={actions.setSidebarCollapsed}
                isLoading={state.isLoading}
                selectedTable={state.selectedTable}
                chartTypeName={chartTypeName}
            />
        </div>
    );
};
