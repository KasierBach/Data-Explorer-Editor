import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SqlEditor } from '@/presentation/components/code-editor/SqlEditor';
import type { editor } from 'monaco-editor';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { connectionService } from '@/core/services/ConnectionService';
import { useAppStore, type SavedQuery } from '@/core/services/store';
import { SavedQueriesDialog } from './SavedQueriesDialog';
import { QueryHistoryDialog } from './QueryHistoryDialog';
import type { QueryResult } from '@/core/domain/entities';
import { QueryResults } from './QueryResults';
import { useSchemaInfo } from '@/presentation/hooks/useSchemaInfo';
import { useResponsiveLayoutMode } from '@/presentation/hooks/useResponsiveLayoutMode';
import { useVerticalResizablePanel } from '@/presentation/hooks/useVerticalResizablePanel';
import { cn } from '@/lib/utils';
import { ApiError } from '@/core/services/api.service';
import { SavedQueryService } from '@/core/services/SavedQueryService';
import { OrganizationService } from '@/core/services/OrganizationService';
import { SaveQueryDialog, type SaveQueryFormValues } from './SaveQueryDialog';
import { toast } from 'sonner';
import { SaveToDashboardDialog } from '@/presentation/modules/Dashboard/SaveToDashboardDialog';
import { useQueryDashboard } from './hooks';
import { QueryToolbar } from './components/QueryToolbar';
import { useResourcePresence } from '@/presentation/hooks/useResourcePresence';
import { PresenceBadge } from '@/presentation/components/presence/PresenceBadge';

type SqlEditorHandle = editor.IStandaloneCodeEditor;


function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Unexpected error';
}

export const QueryEditor: React.FC<{ tabId: string }> = ({ tabId }) => {
    const queryClient = useQueryClient();
    const {
        activeConnectionId, connections, tabs, updateTabMetadata,
        activeDatabase, lang, isResultPanelOpen, toggleResultPanel,
        defaultResultHeight, setDefaultResultHeight
    } = useAppStore();
    const activeConnection = connections.find(c => c.id === activeConnectionId);
    const activeOrganizationId = activeConnection?.organizationId || undefined;
    const schemaInfo = useSchemaInfo();

    // Find options for this tab
    const tab = tabs.find(t => t.id === tabId);
    const initialMetadata = tab?.metadata || {};
    const externalSql = tab?.metadata?.sql ?? tab?.initialSql ?? '';
    const externalRunRequest = tab?.metadata?.runRequestedAt as number | undefined;

    const handleHeightChange = useCallback((newHeight: number) => {
        updateTabMetadata(tabId, { resultHeight: newHeight });
        setDefaultResultHeight(newHeight);
    }, [tabId, updateTabMetadata, setDefaultResultHeight]);

    const resizer = useVerticalResizablePanel({
        initialHeight: initialMetadata.resultHeight || defaultResultHeight || 300,
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
    const [currentSavedQueryId, setCurrentSavedQueryId] = useState<string | null>(initialMetadata.savedQueryId || null);
    const [explainPlan, setExplainPlan] = useState<unknown>(null);
    const [saveDialogInitialValues, setSaveDialogInitialValues] = useState<SaveQueryFormValues>({
        name: '',
        visibility: 'private',
        organizationId: '',
        folderId: '',
        tags: '',
        description: '',
    });
    const isFirstLoad = useRef(true);
    const lastHandledRunRequestRef = useRef<number | null>(null);
    const lastSuccessHistoryAtRef = useRef(0);
    const lastErrorHistoryAtRef = useRef(0);
    const editorRef = useRef<SqlEditorHandle | null>(null);
    const effectiveLimit = limit === 'all' ? undefined : Number.parseInt(limit, 10);
    const requestLimit = Number.isInteger(effectiveLimit) ? effectiveLimit : undefined;

    const {
        saveQuery,
        openTab,
        addQueryHistory,
        savedQueries,
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
    }, [externalSql, query]);

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

    const { data: results, isLoading, error, dataUpdatedAt, errorUpdatedAt, isSuccess, isError } = useQuery<QueryResult | null, Error>({
        queryKey: ['query-execution', activeConnectionId, activeDatabase, executedQuery, requestLimit, runNonce],
        queryFn: async () => {
            if (!executedQuery) return null;
            if (!activeConnection) throw new Error("No active connection");

            const adapter = connectionService.getAdapter(activeConnection.id, activeConnection.type);
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

    // Dashboard hook — extracted from inline state + handlers
    const {
        isDashboardDialogOpen,
        setIsDashboardDialogOpen,
        dashboardDialogInitialValues,
        openDashboardDialog,
        saveToDashboard,
    } = useQueryDashboard({
        results,
        executedQuery,
        query,
        resultColumns,
        resultNumericColumns,
        currentSavedQueryId,
        currentSavedQueryName: currentSavedQuery?.name,
        tabTitle: tab?.title,
    });
    const { data: organizations = [] } = useQuery({
        queryKey: ['organizations'],
        queryFn: () => OrganizationService.getMyOrganizations(),
        enabled: isSaveDialogOpen || isDashboardDialogOpen,
    });
    const workspaceOptions = React.useMemo(
        () => organizations.map((organization) => ({
            id: organization.id,
            name: organization.name,
        })),
        [organizations],
    );

    // Record history on success/error
    useEffect(() => {
        if (!isSuccess || !results || !executedQuery || !dataUpdatedAt) {
            return;
        }

        if (lastSuccessHistoryAtRef.current === dataUpdatedAt) {
            return;
        }

        lastSuccessHistoryAtRef.current = dataUpdatedAt;
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
    }, [isSuccess, results, executedQuery, dataUpdatedAt, activeDatabase, activeConnection?.name, addQueryHistory]);

    useEffect(() => {
        if (!isError || !executedQuery || !errorUpdatedAt) {
            return;
        }

        if (lastErrorHistoryAtRef.current === errorUpdatedAt) {
            return;
        }

        lastErrorHistoryAtRef.current = errorUpdatedAt;
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
    }, [isError, executedQuery, errorUpdatedAt, activeDatabase, activeConnection?.name, error, addQueryHistory]);

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
        if (!activeConnection) return;

        // Use FORMAT JSON for structured plan data
        const explainSql = `EXPLAIN (ANALYZE, FORMAT JSON) ${sqlToExplain}`;
        setExecutedQuery(explainSql);
        setExplainPlan(null);

        try {
            // Execute explain query directly
            const adapter = connectionService.getAdapter(activeConnection.id, activeConnection.type);
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
        } catch (error) {
            setActiveResultTab('messages');
            addQueryHistory({
                id: `history-${Date.now()}`,
                sql: explainSql,
                database: activeDatabase || undefined,
                connectionName: activeConnection?.name,
                executedAt: Date.now(),
                status: 'error',
                errorMessage: getErrorMessage(error),
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
            } catch (err) {
                toast.error(getErrorMessage(err) || 'Failed to update saved query');
            }
        } else {
            const defaultName = lang === 'vi' ? `Truy van ${new Date().toLocaleString('vi-VN')}` : `Query ${new Date().toLocaleString('en-US')}`;
            const currentVisibility = currentSavedQuery?.visibility === 'workspace' ? 'workspace' : 'private';
            setSaveDialogInitialValues({
                name: currentSavedQuery?.name || defaultName,
                visibility: currentSavedQuery?.isOwner ? currentVisibility : 'private',
                organizationId: currentSavedQuery?.organizationId || activeOrganizationId || '',
                folderId: currentSavedQuery?.folderId || '',
                tags: currentSavedQuery?.tags?.join(', ') || '',
                description: currentSavedQuery?.description || '',
            });
            setIsSaveDialogOpen(true);
        }
    }, [query, currentSavedQueryId, currentSavedQuery, saveQuery, lang, activeOrganizationId]);

    const handleSaveDialogSubmit = useCallback(async (values: SaveQueryFormValues) => {
        const payload = {
            name: values.name,
            sql: query,
            database: activeDatabase || activeConnection?.database || undefined,
            connectionId: activeConnection?.id,
            organizationId: values.visibility === 'workspace' ? values.organizationId : undefined,
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
        await queryClient.resetQueries({ queryKey: ['hierarchy'] });
    };

    const { isCompactMobileLayout, isSmallMobile } = useResponsiveLayoutMode();

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
                <QueryToolbar
                    isLoading={isLoading}
                    allowQueryExecution={activeConnection?.allowQueryExecution}
                    isCompactMobileLayout={isCompactMobileLayout}
                    isSmallMobile={isSmallMobile}
                    lang={lang}
                    limit={limit}
                    activeConnectionId={activeConnectionId}
                    activeDatabase={activeDatabase}
                    onRun={() => handleRun()}
                    onGenerateSql={(generatedSql) => {
                        setQuery(generatedSql);
                        editorRef.current?.focus();
                    }}
                    onRefreshSchema={handleRefreshSchema}
                    onFormat={handleFormat}
                    onClear={handleClear}
                    onSave={handleSave}
                    onOpenSaved={() => setIsSavedDialogOpen(true)}
                    onOpenHistory={() => setIsHistoryDialogOpen(true)}
                    onExplain={handleExplain}
                    onLimitChange={setLimit}
                    rightSlot={currentSavedQuery?.organizationId ? (
                        <PresenceBadge
                            entries={queryPresence.entries}
                            isLoading={queryPresence.isLoading}
                            label={lang === 'vi' ? 'Query live' : 'Query live'}
                            emptyLabel={lang === 'vi' ? 'Chua ai mo query nay' : 'No one on this query'}
                            className="max-w-[280px]"
                        />
                    ) : null}
                />

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
                            onSaveToDashboard={results ? openDashboardDialog : undefined}
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
                workspaceOptions={workspaceOptions}
                onSubmit={handleSaveDialogSubmit}
            />
            <SaveToDashboardDialog
                open={isDashboardDialogOpen}
                onOpenChange={setIsDashboardDialogOpen}
                columns={resultColumns}
                numericColumns={resultNumericColumns}
                initialValues={dashboardDialogInitialValues}
                workspaceOptions={workspaceOptions}
                onSubmit={saveToDashboard}
            />
        </>
    );
};
