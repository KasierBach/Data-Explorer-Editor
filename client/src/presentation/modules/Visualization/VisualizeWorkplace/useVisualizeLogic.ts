import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/core/services/store';
import { connectionService } from '@/core/services/ConnectionService';
import { toast } from 'sonner';
import type { RowData, TreeNode } from '@/core/domain/entities';
import { csvDocument } from '@/core/utils/csv';

export type DataMode = 'table' | 'sql';
export type CurveType = 'basis' | 'linear' | 'monotone' | 'natural' | 'step';

const getErrorMessage = (error: unknown) => (
    error instanceof Error ? error.message : 'Failed to fetch data'
);

const isCurveType = (value: unknown): value is CurveType => (
    value === 'basis'
    || value === 'linear'
    || value === 'monotone'
    || value === 'natural'
    || value === 'step'
);

export const useVisualizeLogic = () => {
    const location = useLocation();
    const isNoSql = location.pathname.startsWith('/nosql');

    const { activeConnectionId: sqlId, nosqlActiveConnectionId: nosqlId, connections, activeDatabase, pageStates, setPageState } = useAppStore();
    const activeConnectionId = isNoSql ? nosqlId : sqlId;
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
    const [curveType, setCurveType] = useState<CurveType>(isCurveType(savedState.curveType) ? savedState.curveType : 'monotone');
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
    const { data: databases } = useQuery<string[]>({
        queryKey: ['db-list', activeConnectionId],
        queryFn: async () => {
            if (!activeConnectionId || !activeConnection) return [];
            const adapter = connectionService.getAdapter(activeConnectionId, activeConnection.type);
            return adapter.getDatabases();
        },
        enabled: !!activeConnectionId && !!activeConnection
    });

    const { data: allTables, isLoading: isLoadingTables } = useQuery<TreeNode[]>({
        queryKey: ['flat-tables', activeConnectionId, currentDb],
        queryFn: async () => {
            if (!activeConnectionId || !activeConnection) return [];
            const adapter = connectionService.getAdapter(activeConnectionId, activeConnection.type);
            const results: TreeNode[] = [];
            const crawl = async (parentId: string | null) => {
                const nodes = await adapter.getHierarchy(parentId, currentDb || undefined);
                const toCrawlIds: string[] = [];
                for (const node of nodes) {
                    if (node.type === 'table' || node.type === 'view' || node.type === 'collection') {
                        results.push(node);
                    } else if (node.type === 'database') {
                        if (!currentDb || node.name === currentDb || node.id.includes(currentDb)) {
                            toCrawlIds.push(node.id);
                        }
                    } else if (node.type === 'schema') {
                        toCrawlIds.push(node.id);
                    } else if (node.type === 'folder') {
                        if (node.id.endsWith('folder:tables') || node.id.endsWith('folder:views')) {
                            toCrawlIds.push(node.id);
                        }
                    }
                }

                if (toCrawlIds.length > 0) {
                    await Promise.all(toCrawlIds.map((id) => crawl(id)));
                }
            };
            await crawl(null);
            return results;
        },
        enabled: !!activeConnectionId && !!activeConnection,
        staleTime: 5 * 60 * 1000,
    });

    const buildQuery = useCallback(() => {
        if (dataMode === 'sql') return customSql;
        if (!selectedTable) return '';

        if (activeConnection?.type.toLowerCase().includes('mongo')) {
            return JSON.stringify({
                action: 'find',
                collection: selectedTable,
                filter: {},
                limit: dataLimit,
                options: (sortColumn && sortColumn !== 'none') ? {
                    sort: { [sortColumn]: sortDir === 'ASC' ? 1 : -1 }
                } : {}
            });
        }

        let q = `SELECT * FROM ${selectedTable}`;
        if (sortColumn && sortColumn !== 'none') q += ` ORDER BY ${sortColumn} ${sortDir}`;
        q += ` LIMIT ${dataLimit}`;
        return q;
    }, [dataMode, customSql, selectedTable, dataLimit, sortColumn, sortDir, activeConnection]);

    const { data: rawChartData, isLoading, refetch } = useQuery<RowData[]>({
        queryKey: ['viz-data', activeConnectionId, buildQuery()],
        queryFn: async () => {
            const query = buildQuery();
            if (!activeConnectionId || !activeConnection || !query) return [];
            const adapter = connectionService.getAdapter(activeConnectionId, activeConnection.type);
            try {
                setError(null);
                const result = await adapter.executeQuery(query, { database: currentDb });
                return result.rows || [];
            } catch (err) {
                setError(getErrorMessage(err));
                throw err;
            }
        },
        enabled: false,
        retry: false
    });

    const MAX_CHART_ROWS = 2000;
    const truncationWarnedRef = useRef(false);
    const chartData = useMemo(() => {
        if (!rawChartData || rawChartData.length === 0) return rawChartData;

        let rows = rawChartData;
        if (rows.length > MAX_CHART_ROWS) {
            rows = rows.slice(0, MAX_CHART_ROWS);
            if (!truncationWarnedRef.current) {
                truncationWarnedRef.current = true;
                toast.warning(
                    `Result set too large for charting — showing the first ${MAX_CHART_ROWS} rows. Add a LIMIT or filter to visualize more precisely.`,
                );
            }
        } else {
            truncationWarnedRef.current = false;
        }

        let hasComplex = false;
        for (const row of rows) {
            for (const key of Object.keys(row)) {
                const v = row[key];
                if (v !== null && typeof v === 'object') { hasComplex = true; break; }
            }
            if (hasComplex) break;
        }
        if (!hasComplex) return rows;
        return rows.map((row) => {
            const out: Record<string, unknown> = {};
            for (const key of Object.keys(row)) {
                const v = row[key];
                out[key] = v !== null && typeof v === 'object'
                    ? JSON.stringify(v)
                    : v;
            }
            return out as RowData;
        });
    }, [rawChartData]);

    // ─── Memos ───
    const columns = useMemo(() => {
        if (!chartData || chartData.length === 0) return [];
        const seen = new Set<string>();
        for (const row of chartData) {
            for (const key of Object.keys(row)) seen.add(key);
        }
        return Array.from(seen);
    }, [chartData]);
    const numericColumns = useMemo(
        () => columns.filter((col) =>
            chartData?.some((row) => typeof row[col] === 'number' && Number.isFinite(row[col] as number)),
        ),
        [chartData, columns],
    );
    const filteredTables = useMemo(() => allTables ? (searchTable ? allTables.filter(t => t.name.toLowerCase().includes(searchTable.toLowerCase())) : allTables) : [], [allTables, searchTable]);

    const downsampledData = useMemo(() => {
        if (!chartData || chartData.length <= 300) return chartData;
        const step = Math.ceil(chartData.length / 150);
        return chartData.filter((_, i) => i % step === 0 || i === chartData.length - 1);
    }, [chartData]);

    // Auto-setup axes
    useEffect(() => {
        if (chartData && chartData.length > 0 && columns.length > 0) {
            if (!xAxis || !columns.includes(xAxis)) {
                setXAxis(columns[0]);
                const nums = numericColumns;
                if (nums.length > 0) setYAxis([nums[0]]);
                else if (columns.length > 1) setYAxis([columns[1]]);
            }
        }
    }, [chartData, columns, numericColumns, xAxis]);

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
        const headers = Object.keys(chartData[0]);
        const csv = csvDocument(headers, chartData.map((row) => headers.map((header) => row[header])));
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
