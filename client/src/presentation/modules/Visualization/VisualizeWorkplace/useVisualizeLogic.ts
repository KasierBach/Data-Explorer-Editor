import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/core/services/store';
import { connectionService } from '@/core/services/ConnectionService';
import { toast } from 'sonner';
import type { TreeNode } from '@/core/domain/entities';

export type DataMode = 'table' | 'sql';

export const useVisualizeLogic = () => {
    const { activeConnectionId, connections, activeDatabase, pageStates, setPageState } = useAppStore();
    const activeConnection = connections.find(c => c.id === activeConnectionId);

    // Ensure adapter is connected
    useEffect(() => {
        if (activeConnectionId && activeConnection) {
            connectionService.setActiveConnection(activeConnection);
        }
    }, [activeConnectionId, activeConnection]);


    const pageId = `visualize-page-${activeConnectionId || 'default'}`;
    const savedState = pageStates[pageId] || {};

    // ─── State ───
    const [dataMode, setDataMode] = useState<DataMode>(savedState.dataMode || 'table');
    const [selectedTable, setSelectedTable] = useState<string>(savedState.selectedTable || '');
    const [customSql, setCustomSql] = useState<string>(savedState.customSql || 'SELECT * FROM ');
    const [dataLimit, setDataLimit] = useState<number>(savedState.dataLimit || 200);
    const [sortColumn, setSortColumn] = useState<string>(savedState.sortColumn || '');
    const [sortDir, setSortDir] = useState<'ASC' | 'DESC'>(savedState.sortDir || 'ASC');
    const [searchTable, setSearchTable] = useState(savedState.searchTable || '');
    const [chartType, setChartType] = useState<string>(savedState.chartType || 'bar');
    const [xAxis, setXAxis] = useState<string>(savedState.xAxis || '');
    const [yAxis, setYAxis] = useState<string[]>(savedState.yAxis || []);
    const [paletteIdx, setPaletteIdx] = useState(savedState.paletteIdx || 0);
    const [title, setTitle] = useState(savedState.title || 'New Visualization');
    const [showGrid, setShowGrid] = useState(savedState.showGrid ?? true);
    const [showLegend, setShowLegend] = useState(savedState.showLegend ?? true);
    const [showBrush, setShowBrush] = useState(savedState.showBrush ?? false);
    const [curveType, setCurveType] = useState<string>(savedState.curveType || 'monotone');
    const [animationEnabled, setAnimationEnabled] = useState(savedState.animationEnabled ?? true);
    const [labelVisible, setLabelVisible] = useState(savedState.labelVisible ?? false);
    const [isSidebarCollapsed, setSidebarCollapsed] = useState(savedState.isSidebarCollapsed || false);
    const [activeSection, setActiveSection] = useState<string>(savedState.activeSection || 'source');
    const [error, setError] = useState<string | null>(null);
    const chartRef = useRef<HTMLDivElement>(null);

    const [currentDb, setCurrentDb] = useState<string>(activeDatabase || '');
    useEffect(() => { if (activeDatabase) setCurrentDb(activeDatabase); }, [activeDatabase]);

    // ─── Save State ───
    useEffect(() => {
        const timer = setTimeout(() => {
            setPageState(pageId, {
                dataMode, selectedTable, customSql, dataLimit, sortColumn, sortDir, searchTable,
                chartType, xAxis, yAxis, paletteIdx, title,
                showGrid, showLegend, showBrush, curveType, animationEnabled, labelVisible,
                isSidebarCollapsed, activeSection
            });
        }, 500);
        return () => clearTimeout(timer);
    }, [
        dataMode, selectedTable, customSql, dataLimit, sortColumn, sortDir, searchTable,
        chartType, xAxis, yAxis, paletteIdx, title,
        showGrid, showLegend, showBrush, curveType, animationEnabled, labelVisible,
        isSidebarCollapsed, activeSection, pageId, setPageState
    ]);

    // ─── Queries ───
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
                const toCrawlIds = [];
                for (const node of nodes) {
                    if (node.type === 'table' || node.type === 'view') {
                        results.push(node);
                    } else if (node.type === 'database') {
                        if (!currentDb || node.name === currentDb || node.id.includes(currentDb)) {
                            toCrawlIds.push(node.id);
                        }
                    } else if (node.type === 'schema' || node.type === 'folder') {
                        toCrawlIds.push(node.id);
                    }
                }
                
                // Execute strictly sequentially to prevent recursion concurrency explosion
                for (const id of toCrawlIds) {
                    await crawl(id);
                }
            };
            await crawl(currentDb ? `db:${currentDb}` : null);
            return results;
        },
        enabled: !!activeConnectionId
    });

    const buildQuery = useCallback(() => {
        if (dataMode === 'sql') return customSql;
        if (!selectedTable) return '';
        let q = `SELECT * FROM ${selectedTable}`;
        if (sortColumn && sortColumn !== 'none') q += ` ORDER BY ${sortColumn} ${sortDir}`;
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

    // ─── Memos ───
    const columns = useMemo(() => (chartData && chartData.length > 0) ? Object.keys(chartData[0]) : [], [chartData]);
    const numericColumns = useMemo(() => columns.filter(col => typeof (chartData?.[0]?.[col]) === 'number'), [chartData, columns]);
    const filteredTables = useMemo(() => allTables ? (searchTable ? allTables.filter(t => t.name.toLowerCase().includes(searchTable.toLowerCase())) : allTables) : [], [allTables, searchTable]);

    const downsampledData = useMemo(() => {
        if (!chartData || chartData.length <= 300) return chartData;
        const step = Math.ceil(chartData.length / 150);
        return chartData.filter((_: any, i: number) => i % step === 0 || i === chartData.length - 1);
    }, [chartData]);

    // Auto-setup axes
    useEffect(() => {
        if (chartData && chartData.length > 0 && columns.length > 0) {
            if (!xAxis || !columns.includes(xAxis)) {
                setXAxis(columns[0]);
                const nums = columns.filter(col => typeof chartData[0][col] === 'number');
                if (nums.length > 0) setYAxis([nums[0]]);
                else if (columns.length > 1) setYAxis([columns[1]]);
            }
        }
    }, [chartData, columns]);

    // ─── Handlers ───
    const handleExportPNG = useCallback(() => {
        if (!chartRef.current) return;
        import('html-to-image')
            .then(({ toPng }) => toPng(chartRef.current!, { backgroundColor: '#0a0a0a', pixelRatio: 2 }))
            .then((dataUrl) => {
                const link = document.createElement('a');
                link.download = `chart-${title.replace(/\s+/g, '_')}-${Date.now()}.png`;
                link.href = dataUrl;
                link.click();
                toast.success('Chart exported as PNG');
            })
            .catch(() => toast.error('Failed to export PNG'));
    }, [title]);

    const handleExportCSV = useCallback(() => {
        if (!chartData || chartData.length === 0) return;
        const headers = Object.keys(chartData[0]).join(',');
        const rows = chartData.map(r => Object.values(r).map(v => typeof v === 'string' ? `"${v}"` : v).join(','));
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

    return {
        state: {
            dataMode, selectedTable, customSql, dataLimit, sortColumn, sortDir, searchTable,
            chartType, xAxis, yAxis, paletteIdx, title, showGrid, showLegend, showBrush,
            curveType, animationEnabled, labelVisible, isSidebarCollapsed, activeSection,
            error, chartData, isLoading, databases, allTables, isLoadingTables, currentDb,
            columns, numericColumns, filteredTables, downsampledData, chartRef
        },
        actions: {
            setDataMode, setSelectedTable, setCustomSql, setDataLimit, setSortColumn, setSortDir,
            setSearchTable, setChartType, setXAxis, setYAxis, setPaletteIdx, setTitle,
            setShowGrid, setShowLegend, setShowBrush, setCurveType, setAnimationEnabled,
            setLabelVisible, setSidebarCollapsed, setActiveSection, setCurrentDb, refetch,
            handleExportPNG, handleExportCSV
        }
    };
};
