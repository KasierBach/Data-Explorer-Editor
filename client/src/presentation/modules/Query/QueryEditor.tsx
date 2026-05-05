import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/presentation/components/ui/button';
import { SqlEditor } from '@/presentation/components/code-editor/SqlEditor';
import { Play, Loader2, Eraser, AlignLeft, Save, FolderOpen, RefreshCw, History, Zap, Sparkles, PanelRightOpen } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { connectionService } from '@/core/services/ConnectionService';
import { useAppStore, type SavedQuery } from '@/core/services/store';
import { SavedQueriesDialog } from './SavedQueriesDialog';
import { QueryHistoryDialog } from './QueryHistoryDialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/presentation/components/ui/dropdown-menu";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/presentation/components/ui/popover";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/presentation/components/ui/select";
import type { QueryResult } from '@/core/domain/entities';
import { QueryResults } from './QueryResults';
import { useSchemaInfo } from '@/presentation/hooks/useSchemaInfo';
import { useResponsiveLayoutMode } from '@/presentation/hooks/useResponsiveLayoutMode';
import { useVerticalResizablePanel } from '@/presentation/hooks/useVerticalResizablePanel';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';
import { ApiError } from '@/core/services/api.service';
import { SavedQueryService } from '@/core/services/SavedQueryService';
import { SaveQueryDialog, type SaveQueryFormValues } from './SaveQueryDialog';
import { toast } from 'sonner';
import { DashboardService } from '@/core/services/DashboardService';
import { SaveToDashboardDialog, type SaveToDashboardFormValues } from '@/presentation/modules/Dashboard/SaveToDashboardDialog';
import { AiQueryBox } from './components/AiQueryBox';
import { QueryProjectPanel } from './QueryProjectPanel';
import { useResourcePresence } from '@/presentation/hooks/useResourcePresence';
import { PresenceBadge } from '@/presentation/components/presence/PresenceBadge';

export const QueryEditor: React.FC<{ tabId: string }> = ({ tabId }) => {
    const queryClient = useQueryClient();
    const { 
        activeConnectionId, connections, tabs, updateTabMetadata, 
        activeDatabase, lang, isResultPanelOpen, toggleResultPanel 
    } = useAppStore();
    const activeConnection = connections.find(c => c.id === activeConnectionId);
    const schemaInfo = useSchemaInfo();

    // Find options for this tab
    const tab = tabs.find(t => t.id === tabId);
    const initialMetadata = tab?.metadata || {};
    const externalSql = tab?.metadata?.sql ?? tab?.initialSql ?? '';
    const externalRunRequest = tab?.metadata?.runRequestedAt as number | undefined;

    const handleHeightChange = useCallback((newHeight: number) => {
        updateTabMetadata(tabId, { resultHeight: newHeight });
    }, [tabId, updateTabMetadata]);

    const resizer = useVerticalResizablePanel({
        initialHeight: initialMetadata.resultHeight || 300,
        minHeight: 150,
        maxHeight: 0.8,
        onHeightChange: handleHeightChange
    });

    const [query, setQuery] = useState(initialMetadata.sql || tab?.initialSql || '');
    const [executedQuery, setExecutedQuery] = useState<string | null>(null);
    const [limit, setLimit] = useState(initialMetadata.limit || "1000");
    const [runNonce, setRunNonce] = useState(0);
    const [activeResultTab, setActiveResultTab] = useState("data");
    const [isSavedDialogOpen, setIsSavedDialogOpen] = useState(false);
    const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
    const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
    const [isProjectPanelOpen, setIsProjectPanelOpen] = useState(true);
    const [currentSavedQueryId, setCurrentSavedQueryId] = useState<string | null>(initialMetadata.savedQueryId || null);
    const [explainPlan, setExplainPlan] = useState<any>(null);
    const [saveDialogInitialValues, setSaveDialogInitialValues] = useState<SaveQueryFormValues>({
        name: '',
        visibility: 'private',
        folderId: '',
        tags: '',
        description: '',
    });
    const [isDashboardDialogOpen, setIsDashboardDialogOpen] = useState(false);
    const [dashboardDialogInitialValues, setDashboardDialogInitialValues] = useState<SaveToDashboardFormValues>({
        mode: 'new',
        dashboardId: '',
        dashboardName: '',
        dashboardDescription: '',
        visibility: 'private',
        widgetTitle: '',
        chartType: 'bar',
        xAxis: '',
        yAxis: [],
    });

    const isFirstLoad = useRef(true);
    const lastHandledRunRequestRef = useRef<number | null>(null);
    const editorRef = useRef<any>(null);
    const effectiveLimit = limit === 'all' ? undefined : Number.parseInt(limit, 10);
    const requestLimit = Number.isInteger(effectiveLimit) ? effectiveLimit : undefined;

    const {
        saveQuery,
        openTab,
        addQueryHistory,
        savedQueries,
        queryHistory,
        pinnedQueryIds,
        togglePinnedQuery,
        openDashboardTab,
    } = useAppStore();
    const currentSavedQuery = savedQueries.find((savedQuery) => savedQuery.id === currentSavedQueryId) || null;
    const queryPresence = useResourcePresence(
        currentSavedQuery?.organizationId && currentSavedQueryId
            ? {
                organizationId: currentSavedQuery.organizationId,
                resourceType: 'QUERY',
                resourceId: currentSavedQueryId,
            }
            : null,
        {
            enabled: Boolean(currentSavedQuery?.organizationId && currentSavedQueryId),
            intervalMs: 20_000,
        },
    );

    // Persist SQL query to store
    useEffect(() => {
        if (isFirstLoad.current) {
            isFirstLoad.current = false;
            return;
        }

        const timer = setTimeout(() => {
            updateTabMetadata(tabId, {
                sql: query,
                limit: limit
            });
        }, 500);

        return () => clearTimeout(timer);
    }, [query, limit, tabId, updateTabMetadata]);

    useEffect(() => {
        if (typeof externalSql === 'string' && externalSql !== query) {
            setQuery(externalSql);
        }
    }, [externalSql]);

    useEffect(() => {
        if (!externalRunRequest || lastHandledRunRequestRef.current === externalRunRequest) {
            return;
        }

        lastHandledRunRequestRef.current = externalRunRequest;

        if (externalSql.trim()) {
            setQuery(externalSql);
            setExecutedQuery(externalSql);
            setRunNonce((current) => current + 1);
            updateTabMetadata(tabId, { runRequestedAt: null });
        }
    }, [externalRunRequest, externalSql, tabId, updateTabMetadata]);

    const { data: results, isLoading, error, dataUpdatedAt, isSuccess, isError } = useQuery<QueryResult | null, Error>({
        queryKey: ['query-execution', activeConnectionId, activeDatabase, executedQuery, requestLimit, runNonce],
        queryFn: async () => {
            if (!executedQuery) return null;
            if (!activeConnection) throw new Error("No active connection");

            const adapter = connectionService.getAdapter(activeConnection.id, activeConnection.type as any);
            await adapter.connect(activeConnection);

            return adapter.executeQuery(executedQuery, {
                database: activeDatabase || undefined,
                limit: requestLimit,
            });
        },
        enabled: !!executedQuery && !!activeConnectionId && runNonce > 0,
        retry: false
    });
    const blockedReason = (error as ApiError | null)?.reason;
    const hasPersistentGuardrail = Boolean(
        activeConnection?.readOnly || activeConnection?.allowQueryExecution === false
    );
    const guardrailMessage = React.useMemo(() => {
        if (!activeConnection) return null;
        const parts: string[] = [];
        if (activeConnection.readOnly) {
            parts.push(lang === 'vi' ? 'Kết nối đang ở chế độ chỉ đọc' : 'Connection is read-only');
        }
        if (activeConnection.allowQueryExecution === false) {
            parts.push(lang === 'vi' ? 'đã tắt chạy truy vấn' : 'query execution is disabled');
        } else {
            parts.push(lang === 'vi' ? `giới hạn ${limit === 'all' ? '50,000+' : limit} dòng` : `${limit === 'all' ? '50,000+' : limit} row limit`);
            parts.push(lang === 'vi' ? 'timeout ~30s' : '~30s timeout');
        }
        return parts.join(' • ');
    }, [activeConnection, lang, limit]);
    const resultColumns = React.useMemo(() => {
        if (results?.columns?.length) return results.columns;
        if (results?.rows?.length) return Object.keys(results.rows[0]);
        return [];
    }, [results]);
    const resultNumericColumns = React.useMemo(() => {
        if (!results?.rows?.length) return [];
        const sample = results.rows[0];
        return resultColumns.filter((column) => typeof sample?.[column] === 'number');
    }, [results, resultColumns]);

    // Record history on success/error
    useEffect(() => {
        if (isSuccess && results && executedQuery) {
            setActiveResultTab("data");
            addQueryHistory({
                id: `history-${Date.now()}`,
                sql: executedQuery,
                database: activeDatabase || undefined,
                connectionName: activeConnection?.name,
                executedAt: Date.now(),
                durationMs: results.durationMs,
                rowCount: results.rowCount ?? results.rows?.length,
                status: 'success',
            });
        }
    }, [isSuccess, results]);

    useEffect(() => {
        if (isError && executedQuery) {
            setActiveResultTab("messages");
            addQueryHistory({
                id: `history-${Date.now()}`,
                sql: executedQuery,
                database: activeDatabase || undefined,
                connectionName: activeConnection?.name,
                executedAt: Date.now(),
                status: 'error',
                errorMessage: (error as Error)?.message,
            });
        }
    }, [isError]);

    const handleRun = (overrideSql?: string) => {
        let sqlToExecute = overrideSql || query;

        // Check if there is a selection
        if (!overrideSql && editorRef.current) {
            const selection = editorRef.current.getSelection();
            if (selection && !selection.isEmpty()) {
                const selectedText = editorRef.current.getModel()?.getValueInRange(selection);
                if (selectedText && selectedText.trim()) {
                    sqlToExecute = selectedText;
                }
            }
        }

        if (!sqlToExecute.trim()) return;
        setExecutedQuery(sqlToExecute);
        setRunNonce((current) => current + 1);
    };

    const handleExplain = async () => {
        let sqlToExplain = query;
        if (editorRef.current) {
            const selection = editorRef.current.getSelection();
            if (selection && !selection.isEmpty()) {
                const selectedText = editorRef.current.getModel()?.getValueInRange(selection);
                if (selectedText && selectedText.trim()) sqlToExplain = selectedText;
            }
        }
        if (!sqlToExplain.trim()) return;

        // Use FORMAT JSON for structured plan data
        const explainSql = `EXPLAIN (ANALYZE, FORMAT JSON) ${sqlToExplain}`;
        setExecutedQuery(explainSql);
        setExplainPlan(null);

        try {
            // Execute explain query directly
            const adapter = connectionService.getAdapter(activeConnection!.id, activeConnection!.type as any);
            const result = await adapter.executeQuery(
                explainSql,
                activeDatabase ? { database: activeDatabase } : undefined
            );
            setExplainPlan(result.rows);
            setActiveResultTab('plan');

            addQueryHistory({
                id: `history-${Date.now()}`,
                sql: explainSql,
                database: activeDatabase || undefined,
                connectionName: activeConnection?.name,
                executedAt: Date.now(),
                durationMs: result.durationMs,
                status: 'success',
            });
        } catch (e: any) {
            setActiveResultTab('messages');
            addQueryHistory({
                id: `history-${Date.now()}`,
                sql: explainSql,
                database: activeDatabase || undefined,
                connectionName: activeConnection?.name,
                executedAt: Date.now(),
                status: 'error',
                errorMessage: e.message,
            });
        }
    };

    const handleFormat = async () => {
        try {
            const { format } = await import('sql-formatter');
            const formatted = format(query, {
                language: activeConnection?.type === 'mysql' ? 'mysql' : 'postgresql',
                keywordCase: 'upper',
            });
            setQuery(formatted);
        } catch (e) {
            console.error("Formatting failed", e);
        }
    };

    const handleClear = () => setQuery('');

    const handleClearResults = () => {
        setExecutedQuery(null);
        setExplainPlan(null);
        queryClient.removeQueries({ queryKey: ['query-execution', activeConnectionId] });
    };

    // Save query
    const handleSave = useCallback(async () => {
        if (!query.trim()) return;

        if (currentSavedQueryId && currentSavedQuery?.isOwner) {
            try {
                const updated = await SavedQueryService.updateSavedQuery(currentSavedQueryId, { sql: query });
                saveQuery(updated);
                toast.success(lang === 'vi' ? 'Da cap nhat saved query' : 'Saved query updated');
            } catch (err: any) {
                toast.error(err.message || 'Failed to update saved query');
            }
        } else {
            const defaultName = lang === 'vi' ? `Truy van ${new Date().toLocaleString('vi-VN')}` : `Query ${new Date().toLocaleString('en-US')}`;
            setSaveDialogInitialValues({
                name: currentSavedQuery?.name || defaultName,
                visibility: currentSavedQuery?.isOwner ? (currentSavedQuery.visibility || 'private') : 'private',
                folderId: currentSavedQuery?.folderId || '',
                tags: currentSavedQuery?.tags?.join(', ') || '',
                description: currentSavedQuery?.description || '',
            });
            setIsSaveDialogOpen(true);
        }
    }, [query, currentSavedQueryId, currentSavedQuery, saveQuery, lang]);

    const handleSaveDialogSubmit = useCallback(async (values: SaveQueryFormValues) => {
        const payload = {
            name: values.name,
            sql: query,
            database: activeDatabase || activeConnection?.database || undefined,
            connectionId: activeConnection?.id,
            visibility: values.visibility,
            folderId: values.folderId || undefined,
            tags: values.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
            description: values.description || undefined,
        } as const;

        if (currentSavedQueryId && currentSavedQuery?.isOwner) {
            const updated = await SavedQueryService.updateSavedQuery(currentSavedQueryId, payload);
            saveQuery(updated);
            toast.success(lang === 'vi' ? 'Da cap nhat saved query' : 'Saved query updated');
            return;
        }

        const created = await SavedQueryService.createSavedQuery(payload);
        saveQuery(created);
        setCurrentSavedQueryId(created.id);
        updateTabMetadata(tabId, { savedQueryId: created.id });
        toast.success(lang === 'vi' ? 'Da luu saved query' : 'Query saved');
    }, [query, activeDatabase, activeConnection, currentSavedQueryId, currentSavedQuery, saveQuery, lang, tabId, updateTabMetadata]);

    // Open saved query into a new tab
    const handleOpenSavedQuery = useCallback((sq: SavedQuery) => {
        openTab({
            id: `query-${Date.now()}`,
            title: sq.name,
            type: 'query',
            metadata: { sql: sq.sql, savedQueryId: sq.id },
            initialSql: sq.sql,
        });
    }, [openTab]);

    const handleRefreshSchema = async () => {
        console.log("♻️ Triggering Hierarchy Refresh via QueryClient");
        await queryClient.resetQueries({ queryKey: ['hierarchy'] });
    };

    const handleOpenDashboardDialog = useCallback(() => {
        if (!results?.rows?.length) return;
        const defaultName = currentSavedQuery?.name || tab?.title || (lang === 'vi' ? 'Query Widget' : 'Query Widget');
        setDashboardDialogInitialValues({
            mode: 'new',
            dashboardId: '',
            dashboardName: activeConnection?.name ? `${activeConnection.name} Dashboard` : 'New Dashboard',
            dashboardDescription: '',
            visibility: 'private',
            widgetTitle: defaultName,
            chartType: resultNumericColumns.length ? 'bar' : 'table',
            xAxis: resultColumns[0] || '',
            yAxis: resultNumericColumns.slice(0, 1),
        });
        setIsDashboardDialogOpen(true);
    }, [results, currentSavedQuery?.name, tab?.title, lang, activeConnection?.name, resultColumns, resultNumericColumns]);

    const handleSaveToDashboard = useCallback(async (values: SaveToDashboardFormValues) => {
        if (!results) return;

        let dashboardId = values.dashboardId;
        let dashboardName = values.dashboardName;

        if (values.mode === 'new') {
            const dashboard = await DashboardService.createDashboard({
                name: values.dashboardName,
                description: values.dashboardDescription || undefined,
                visibility: values.visibility,
                connectionId: activeConnection?.id,
                database: activeDatabase || activeConnection?.database || undefined,
            });
            dashboardId = dashboard.id;
            dashboardName = dashboard.name;
        }

        const updatedDashboard = await DashboardService.addWidget(dashboardId, {
            title: values.widgetTitle,
            chartType: values.chartType,
            queryText: executedQuery || query,
            connectionId: activeConnection?.id,
            database: activeDatabase || activeConnection?.database || undefined,
            columns: resultColumns,
            xAxis: values.chartType === 'table' ? undefined : values.xAxis,
            yAxis: values.chartType === 'table' ? [] : values.yAxis,
            config: {
                source: 'query-editor',
                savedQueryId: currentSavedQueryId || undefined,
            },
            dataSnapshot: (results.rows || []).slice(0, 200),
        });

        queryClient.invalidateQueries({ queryKey: ['dashboards'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard', dashboardId] });
        openDashboardTab(updatedDashboard.id, dashboardName || updatedDashboard.name);
        toast.success(lang === 'vi' ? 'Da luu widget vao dashboard' : 'Widget saved to dashboard');
    }, [
        results,
        activeConnection?.id,
        activeConnection?.database,
        activeDatabase,
        executedQuery,
        query,
        resultColumns,
        currentSavedQueryId,
        queryClient,
        openDashboardTab,
        lang,
    ]);

    const { isCompactMobileLayout, isSmallMobile } = useResponsiveLayoutMode();

    useEffect(() => {
        if (isCompactMobileLayout) {
            setIsProjectPanelOpen(false);
        }
    }, [isCompactMobileLayout]);

    const handleRunRef = useRef(handleRun);
    handleRunRef.current = handleRun;

    const handleSaveRef = useRef(handleSave);
    handleSaveRef.current = handleSave;

    // Keyboard shortcuts
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                e.stopPropagation();
                handleSaveRef.current();
            }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
                e.preventDefault();
                e.stopPropagation();
                setIsSavedDialogOpen(true);
            }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') {
                e.preventDefault();
                e.stopPropagation();
                setIsHistoryDialogOpen(true);
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                handleRunRef.current();
            }
        };
        window.addEventListener('keydown', handler, { capture: true });
        return () => window.removeEventListener('keydown', handler, { capture: true });
    }, []);

    return (
        <>
            <div className="flex flex-col h-full bg-background">
                {/* Toolbar */}
                <div className="p-1 px-2 border-b flex items-center justify-between bg-muted/30 min-h-[40px] flex-wrap gap-x-2 gap-y-1">
                    <div className="flex items-center gap-1 flex-wrap min-w-0">
                        <Button
                            size="sm"
                            onClick={() => handleRun()}
                            disabled={isLoading || activeConnection?.allowQueryExecution === false}
                            className={cn(
                                "h-8 gap-1.5 px-3 bg-green-600 hover:bg-green-700 text-white border-none shadow-sm transition-all",
                                isCompactMobileLayout && "px-2"
                            )}
                        >
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                            <span className="font-bold">
                                {isCompactMobileLayout ? (lang === 'vi' ? "Chạy" : "Run") : (lang === 'vi' ? "Thực thi" : "Execute")}
                            </span>
                        </Button>

                        <div className="h-4 w-[1px] bg-border mx-1" />

                        <Popover>
                            <PopoverTrigger asChild>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="h-8 gap-1.5 px-3 border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 text-blue-500 transition-all shadow-none"
                                >
                                    <Sparkles className="w-3.5 h-3.5 fill-blue-500/20" />
                                    <span className="font-medium">{isSmallMobile ? 'AI' : 'AI SQL'}</span>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[min(450px,calc(100vw-1rem))] p-0 border-white/10 bg-background/95 backdrop-blur-xl shadow-2xl rounded-2xl overflow-hidden" align="start" sideOffset={10}>
                                <AiQueryBox 
                                    currentConnectionId={activeConnectionId || ''}
                                    currentDatabase={activeDatabase || undefined}
                                    onGenerate={(generatedSql) => {
                                        setQuery(generatedSql);
                                        if (editorRef.current) {
                                            editorRef.current.focus();
                                        }
                                    }}
                                />
                            </PopoverContent>
                        </Popover>

                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsProjectPanelOpen((current) => !current)}
                            className="h-7 gap-1 px-2 text-xs"
                            title={lang === 'vi' ? 'Project query' : 'Query project'}
                        >
                            <PanelRightOpen className="w-3.5 h-3.5" />
                            {isCompactMobileLayout ? 'Project' : (lang === 'vi' ? 'Project' : 'Project')}
                        </Button>

                        {!isCompactMobileLayout && (
                            <>
                                <div className="h-4 w-[1px] bg-border mx-1" />
                                <Button variant="ghost" size="sm" onClick={handleRefreshSchema} className="h-7 gap-1 px-2 text-xs" title={lang === 'vi' ? "Tải lại thanh bên" : "Refresh Sidebar"}>
                                    <RefreshCw className="w-3.5 h-3.5" />
                                    {lang === 'vi' ? 'Tải lại' : 'Refresh'}
                                </Button>
                                <div className="h-4 w-[1px] bg-border mx-1" />
                            </>
                        )}

                        {!isCompactMobileLayout ? (
                            <>
                                <Button variant="ghost" size="sm" onClick={handleFormat} className="h-7 gap-1 px-2 text-xs">
                                    <AlignLeft className="w-3.5 h-3.5" />
                                    {lang === 'vi' ? 'Định dạng' : 'Format'}
                                </Button>
                                <Button variant="ghost" size="sm" onClick={handleClear} className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-destructive">
                                    <Eraser className="w-3.5 h-3.5" />
                                    {lang === 'vi' ? 'Xóa' : 'Clear'}
                                </Button>
                                <div className="h-4 w-[1px] bg-border mx-1" />
                                <Button variant="ghost" size="sm" onClick={handleSave} className="h-7 gap-1 px-2 text-xs" title="Ctrl+S">
                                    <Save className="w-3.5 h-3.5" />
                                    {lang === 'vi' ? 'Lưu' : 'Save'}
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => setIsSavedDialogOpen(true)} className="h-7 gap-1 px-2 text-xs" title="Ctrl+O">
                                    <FolderOpen className="w-3.5 h-3.5" />
                                    {lang === 'vi' ? 'Mở' : 'Open'}
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => setIsHistoryDialogOpen(true)} className="h-7 gap-1 px-2 text-xs" title="Ctrl+H">
                                    <History className="w-3.5 h-3.5" />
                                    {lang === 'vi' ? 'Lịch sử' : 'History'}
                                </Button>
                                <div className="h-4 w-[1px] bg-border mx-1" />
                                <Button variant="ghost" size="sm" onClick={handleExplain} disabled={isLoading || activeConnection?.allowQueryExecution === false} className="h-7 gap-1 px-2 text-xs text-orange-500 hover:text-orange-600" title="EXPLAIN ANALYZE">
                                    <Zap className="w-3.5 h-3.5" />
                                    {lang === 'vi' ? 'Giải thích' : 'Explain'}
                                </Button>
                            </>
                        ) : (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 gap-1 px-2 text-xs">
                                        <History className="w-4 h-4" />
                                        {lang === 'vi' ? 'Hành động' : 'Actions'}
                                        <ChevronDown className="w-3 h-3 opacity-50" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-48">
                                    <DropdownMenuItem onClick={handleFormat}>
                                        <AlignLeft className="mr-2 h-4 w-4" />
                                        <span>{lang === 'vi' ? 'Định dạng SQL' : 'Format SQL'}</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={handleSave}>
                                        <Save className="mr-2 h-4 w-4" />
                                        <span>{lang === 'vi' ? 'Lưu truy vấn' : 'Save Query'}</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setIsSavedDialogOpen(true)}>
                                        <FolderOpen className="mr-2 h-4 w-4" />
                                        <span>{lang === 'vi' ? 'Mở đã lưu' : 'Open Saved'}</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setIsProjectPanelOpen((current) => !current)}>
                                        <PanelRightOpen className="mr-2 h-4 w-4" />
                                        <span>{lang === 'vi' ? 'Project query' : 'Query project'}</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setIsHistoryDialogOpen(true)}>
                                        <History className="mr-2 h-4 w-4" />
                                        <span>{lang === 'vi' ? 'Lịch sử' : 'History'}</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={handleExplain} className="text-orange-500" disabled={activeConnection?.allowQueryExecution === false}>
                                        <Zap className="mr-2 h-4 w-4" />
                                        <span>{lang === 'vi' ? 'Giải thích thực thi' : 'Explain Plan'}</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={handleClear} className="text-red-600">
                                        <Eraser className="mr-2 h-4 w-4" />
                                        <span>{lang === 'vi' ? 'Xóa tất cả' : 'Clear All'}</span>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}

                        <div className="flex items-center gap-1.5 px-2">
                            {!isCompactMobileLayout && <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{lang === 'vi' ? 'Giới hạn' : 'Limit'}</span>}
                            <Select value={limit} onValueChange={setLimit}>
                                <SelectTrigger className="h-7 w-[80px] text-[10px] py-0 border-none bg-muted hover:bg-muted/80 focus:ring-0 shadow-none">
                                    <SelectValue placeholder={lang === 'vi' ? 'Giới hạn' : 'Limit'} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="100">100</SelectItem>
                                    <SelectItem value="500">500</SelectItem>
                                    <SelectItem value="1000">1000</SelectItem>
                                    <SelectItem value="5000">5000</SelectItem>
                                    <SelectItem value="all">{lang === 'vi' ? 'Không' : 'No Limit'}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 min-w-0">
                        {currentSavedQuery?.organizationId && (
                            <PresenceBadge
                                entries={queryPresence.entries}
                                isLoading={queryPresence.isLoading}
                                label={lang === 'vi' ? 'Query live' : 'Query live'}
                                emptyLabel={lang === 'vi' ? 'Chua ai mo query nay' : 'No one on this query'}
                                className="max-w-[280px]"
                            />
                        )}
                        {activeConnection && !isSmallMobile && (
                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-50 dark:bg-blue-950/30 rounded border border-blue-100 dark:border-blue-900/50 min-w-0">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse shrink-0" />
                                <span className="text-[10px] font-medium text-blue-700 dark:text-blue-400 truncate max-w-[150px]">
                                    {activeConnection.name}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {activeConnection && (blockedReason || hasPersistentGuardrail) && (
                    <div className={cn(
                        "mx-2 mt-2 rounded-lg border px-3 py-2 text-xs",
                        activeConnection.allowQueryExecution === false
                            ? "border-red-500/20 bg-red-500/10 text-red-400"
                            : activeConnection.readOnly
                                ? "border-amber-500/20 bg-amber-500/10 text-amber-400"
                                : "border-blue-500/20 bg-blue-500/10 text-blue-400"
                    )}>
                        <div className="font-semibold uppercase tracking-wide text-[10px]">
                            {blockedReason === 'READ_ONLY_CONNECTION'
                                ? (lang === 'vi' ? 'Truy vấn bị chặn bởi chế độ chỉ đọc' : 'Read-only protection active')
                                : blockedReason === 'QUERY_EXECUTION_DISABLED'
                                    ? (lang === 'vi' ? 'Truy vấn bị chặn bởi policy kết nối' : 'Execution blocked by connection policy')
                                    : (lang === 'vi' ? 'Guardrails kết nối' : 'Connection guardrails')}
                        </div>
                        <div className="mt-1 text-muted-foreground">
                            {blockedReason
                                ? (error as Error)?.message
                                : guardrailMessage}
                        </div>
                    </div>
                )}


                <div className="flex-1 flex flex-col min-h-0 relative">
                    {isProjectPanelOpen && (
                        <div className="border-b border-border/60 bg-muted/20 px-2 py-2">
                            <QueryProjectPanel
                                lang={lang}
                                savedQueries={savedQueries}
                                queryHistory={queryHistory}
                                pinnedQueryIds={pinnedQueryIds}
                                currentSavedQueryId={currentSavedQueryId}
                                onOpenQuery={handleOpenSavedQuery}
                                onRunQuery={(sql) => {
                                    setQuery(sql);
                                    handleRun(sql);
                                }}
                                onTogglePinnedQuery={togglePinnedQuery}
                                onOpenSavedQueries={() => setIsSavedDialogOpen(true)}
                            />
                        </div>
                    )}

                    {/* Top Editor - takes remaining space */}
                    <div className="flex-1 min-h-0 relative">
                        <SqlEditor
                            value={query}
                            onChange={(val: string | undefined) => setQuery(val || '')}
                            height="100%"
                            onMount={(editor) => {
                                editorRef.current = editor;
                            }}
                            schemaInfo={schemaInfo}
                        />
                    </div>

                    {/* Resize Handle - Custom Separator */}
                    <div 
                        onPointerDown={resizer.startResizing}
                        className={cn(
                            "h-1.5 bg-muted/20 border-y border-border/10 cursor-row-resize flex items-center justify-center group transition-colors select-none z-20 touch-none",
                            resizer.isDragging ? "bg-blue-500/20" : "hover:bg-blue-500/10",
                            !isResultPanelOpen && "hidden"
                        )}
                    >
                        <div className={cn(
                            "w-12 h-0.5 rounded-full bg-muted-foreground/20 group-hover:bg-blue-500/50 transition-colors",
                            resizer.isDragging && "bg-blue-500"
                        )} />
                    </div>

                    {/* Bottom Result Panel - with smooth transition */}
                    <div 
                        style={{ height: isResultPanelOpen ? `${resizer.height}px` : '0px' }}
                        className={cn(
                            "flex flex-col overflow-hidden bg-card shrink-0 relative z-10",
                            resizer.isDragging ? "" : "transition-[height] duration-300 ease-in-out"
                        )}
                    >
                        <QueryResults
                            results={results || null}
                            isLoading={isLoading}
                            error={(error as Error) || null}
                            executedQuery={executedQuery}
                            dataUpdatedAt={dataUpdatedAt}
                            activeTab={activeResultTab}
                            onTabChange={setActiveResultTab}
                            explainPlan={explainPlan}
                            onClearResults={handleClearResults}
                            onClose={toggleResultPanel}
                            onSaveToDashboard={results ? handleOpenDashboardDialog : undefined}
                        />
                    </div>
                </div>


            </div>

            <SavedQueriesDialog
                open={isSavedDialogOpen}
                onOpenChange={setIsSavedDialogOpen}
                onOpenQuery={handleOpenSavedQuery}
                onRestoreQuery={(restoredQuery) => {
                    saveQuery(restoredQuery);
                    if (currentSavedQueryId === restoredQuery.id) {
                        setQuery(restoredQuery.sql);
                        updateTabMetadata(tabId, {
                            savedQueryId: restoredQuery.id,
                            sql: restoredQuery.sql,
                        });
                    }
                }}
            />
            <QueryHistoryDialog
                open={isHistoryDialogOpen}
                onOpenChange={setIsHistoryDialogOpen}
                onRunQuery={(sql) => {
                    setQuery(sql);
                    handleRun(sql);
                }}
            />
            <SaveQueryDialog
                open={isSaveDialogOpen}
                onOpenChange={setIsSaveDialogOpen}
                lang={lang}
                initialValues={saveDialogInitialValues}
                currentQuery={currentSavedQuery?.isOwner ? currentSavedQuery : null}
                onSubmit={handleSaveDialogSubmit}
            />
            <SaveToDashboardDialog
                open={isDashboardDialogOpen}
                onOpenChange={setIsDashboardDialogOpen}
                columns={resultColumns}
                numericColumns={resultNumericColumns}
                initialValues={dashboardDialogInitialValues}
                onSubmit={handleSaveToDashboard}
            />
        </>
    );
};
