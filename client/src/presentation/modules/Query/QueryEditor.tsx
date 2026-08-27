import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SqlEditor } from '@/presentation/components/code-editor/SqlEditor';
import type { editor } from 'monaco-editor';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { connectionService } from '@/core/services/ConnectionService';
import { apiService } from '@/core/services/api.service';
import { useAppStore, type SavedQuery } from '@/core/services/store';
import { resolveAiSelection, useAiPreferences } from '@/core/services/aiPreferences';
import { SavedQueriesDialog } from './SavedQueriesDialog';
import { QueryHistoryDialog } from './QueryHistoryDialog';
import type { QueryResult } from '@/core/domain/entities';
import { QueryResults } from './QueryResults';
import { useSchemaInfo } from '@/presentation/hooks/useSchemaInfo';
import { useResponsiveLayoutMode } from '@/presentation/hooks/useResponsiveLayoutMode';
import { useVerticalResizablePanel } from '@/presentation/hooks/useVerticalResizablePanel';
import { cn } from '@/lib/utils';
import { SavedQueryService } from '@/core/services/SavedQueryService';
import { OrganizationService } from '@/core/services/OrganizationService';
import { SaveQueryDialog, type SaveQueryFormValues } from './SaveQueryDialog';
import { toast } from 'sonner';
import { SaveToDashboardDialog } from '@/presentation/modules/Dashboard/SaveToDashboardDialog';
import { useQueryDashboard } from './hooks';
import { QueryToolbar } from './components/QueryToolbar';
import { useResourcePresence } from '@/presentation/hooks/useResourcePresence';
import { PresenceBadge } from '@/presentation/components/presence/PresenceBadge';
import { SqlSequenceDialog } from './SqlSequenceDialog';
import { AiQueryExplanationDialog } from './AiQueryExplanationDialog';
import { getWorkspaceText } from '@/core/utils/workspaceText';
import { openAiQueryFixDraft } from '@/core/services/aiQueryFix';

type SqlEditorHandle = editor.IStandaloneCodeEditor;

type AiExplanationResponse = {
    message?: string;
    explanation?: string;
};

const SQL_SEQUENCE_TYPES = new Set(['postgres', 'mysql', 'mssql', 'sqlite', 'clickhouse']);

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Unexpected error';
}

export const QueryEditor: React.FC<{ tabId: string; isActive: boolean }> = ({ tabId, isActive }) => {
    const queryClient = useQueryClient();
    const {
        activeConnectionId, connections, tabs, updateTabMetadata,
        activeDatabase, lang, isResultPanelOpen, toggleResultPanel,
        defaultResultHeight, setDefaultResultHeight, aiModel, aiRoutingMode,
    } = useAppStore();
    const activeConnection = connections.find(c => c.id === activeConnectionId);
    const activeOrganizationId = activeConnection?.organizationId || undefined;
    const schemaInfo = useSchemaInfo();
    const preferences = useAiPreferences();
    const text = getWorkspaceText(lang).queryEditor;

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
        onHeightChange: handleHeightChange,
    });

    const [query, setQuery] = useState(initialMetadata.sql || tab?.initialSql || '');
    const [executedQuery, setExecutedQuery] = useState<string | null>(
        typeof initialMetadata.executedQuery === 'string' ? initialMetadata.executedQuery : null,
    );
    const [clientPageIndex, setClientPageIndex] = useState<number>(
        typeof initialMetadata.pageIndex === 'number' ? initialMetadata.pageIndex : 0,
    );
    const [clientPageSize, setClientPageSize] = useState<number>(
        typeof initialMetadata.pageSize === 'number' &&
            [50, 100, 500, 1000].includes(initialMetadata.pageSize)
            ? initialMetadata.pageSize
            : 100,
    );
    const [serverTotalCount, setServerTotalCount] = useState<number | undefined>(
        typeof initialMetadata.totalCount === 'number' ? initialMetadata.totalCount : undefined,
    );
    const [runNonce, setRunNonce] = useState(initialMetadata.executedQuery ? 1 : 0);
    const [activeResultTab, setActiveResultTab] = useState(
        typeof initialMetadata.resultTab === 'string' ? initialMetadata.resultTab : 'data',
    );
    const [isSavedDialogOpen, setIsSavedDialogOpen] = useState(false);
    const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
    const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
    const [isSqlSequenceDialogOpen, setIsSqlSequenceDialogOpen] = useState(false);
    const [currentSavedQueryId, setCurrentSavedQueryId] = useState<string | null>(initialMetadata.savedQueryId || null);
    const [explainPlan, setExplainPlan] = useState<unknown>(null);
    const [isAiExplainDialogOpen, setIsAiExplainDialogOpen] = useState(false);
    const [isAiExplaining, setIsAiExplaining] = useState(false);
    const [aiExplainSql, setAiExplainSql] = useState('');
    const [aiExplanation, setAiExplanation] = useState<string | null>(null);
    const [aiExplainError, setAiExplainError] = useState<string | null>(null);
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
    const lastExternalSqlRef = useRef(externalSql);
    const lastSuccessRunNonceRef = useRef(0);
    const lastErrorRunNonceRef = useRef(0);
    const editorRef = useRef<SqlEditorHandle | null>(null);
    const editorAliveRef = useRef(false);

    useEffect(() => () => {
        editorAliveRef.current = false;
        editorRef.current = null;
    }, []);

    useEffect(() => {
        if (!isActive) return;

        const frame = requestAnimationFrame(() => {
            const editor = editorRef.current;
            if (!editor || !editorAliveRef.current) return;
            editor.layout();
        });
        return () => cancelAnimationFrame(frame);
    }, [isActive]);

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
    const supportsSqlSequence = activeConnection ? SQL_SEQUENCE_TYPES.has(activeConnection.type) : false;
    const assistantSelection = preferences.assistantModel || aiModel;
    const resolvedExplain = React.useMemo(
        () => resolveAiSelection(preferences.explainModel, assistantSelection, preferences.customProviders),
        [preferences.explainModel, assistantSelection, preferences.customProviders],
    );

    useEffect(() => {
        if (isFirstLoad.current) {
            isFirstLoad.current = false;
            return;
        }

        const timer = setTimeout(() => {
            updateTabMetadata(tabId, {
                sql: query,
                resultTab: activeResultTab,
                executedQuery,
                pageIndex: clientPageIndex,
                pageSize: clientPageSize,
                totalCount: serverTotalCount,
            });
        }, 500);

        return () => clearTimeout(timer);
    }, [query, activeResultTab, executedQuery, clientPageIndex, clientPageSize, serverTotalCount, tabId, updateTabMetadata]);

    useEffect(() => {
        if (activeResultTab === 'plan' && !explainPlan) {
            setActiveResultTab('data');
        }
    }, [activeResultTab, explainPlan]);

    useEffect(() => {
        if (typeof externalSql !== 'string' || lastExternalSqlRef.current === externalSql) {
            return;
        }

        lastExternalSqlRef.current = externalSql;
        setQuery(externalSql);
    }, [externalSql]);

    useEffect(() => {
        if (!externalRunRequest || lastHandledRunRequestRef.current === externalRunRequest) {
            return;
        }

        lastHandledRunRequestRef.current = externalRunRequest;

        if (externalSql.trim()) {
            setQuery(externalSql);
            setClientPageIndex(0);
            setServerTotalCount(undefined);
            setExecutedQuery(externalSql);
            setRunNonce((current) => current + 1);
            updateTabMetadata(tabId, { runRequestedAt: null, pageIndex: 0, totalCount: undefined });
        }
    }, [externalRunRequest, externalSql, tabId, updateTabMetadata]);

    const { data: results, isLoading, isFetching, error, dataUpdatedAt, errorUpdatedAt, isSuccess, isError } = useQuery<QueryResult | null, Error>({
        queryKey: ['query-execution', activeConnectionId, activeDatabase, executedQuery, clientPageIndex, clientPageSize, runNonce],
        queryFn: async () => {
            if (!executedQuery) return null;
            if (!activeConnection) throw new Error('No active connection');

            const adapter = connectionService.getAdapter(activeConnection.id, activeConnection.type);
            await adapter.connect(activeConnection);

            const shouldPaginate = /^\s*(SELECT|WITH)\b/i.test(executedQuery);
            return adapter.executeQuery(executedQuery, {
                database: activeDatabase || undefined,
                limit: shouldPaginate ? clientPageSize : undefined,
                offset: shouldPaginate ? clientPageIndex * clientPageSize : undefined,
                includeTotalCount: shouldPaginate && clientPageIndex === 0 && serverTotalCount === undefined,
            });
        },
        enabled: !!executedQuery && !!activeConnectionId && runNonce > 0,
        retry: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
    });

    useEffect(() => {
        if (results?.countStatus !== 'available' || typeof results.totalCount !== 'number') return;
        setServerTotalCount(results.totalCount);
        updateTabMetadata(tabId, { totalCount: results.totalCount });
    }, [results?.countStatus, results?.totalCount, tabId, updateTabMetadata]);

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

    useEffect(() => {
        if (!isSuccess || !results || !executedQuery || !dataUpdatedAt) {
            return;
        }

        if (clientPageIndex !== 0 || lastSuccessRunNonceRef.current === runNonce) {
            return;
        }

        lastSuccessRunNonceRef.current = runNonce;
        setActiveResultTab('data');
        addQueryHistory({
            id: `history-${crypto.randomUUID()}`,
            sql: executedQuery,
            database: activeDatabase || undefined,
            connectionName: activeConnection?.name,
            executedAt: Date.now(),
            durationMs: results.durationMs,
            rowCount: serverTotalCount ?? results.totalCount ?? results.rowCount ?? results.rows?.length,
            status: 'success',
        });
    }, [isSuccess, results, executedQuery, dataUpdatedAt, clientPageIndex, runNonce, serverTotalCount, activeDatabase, activeConnection?.name, addQueryHistory]);

    useEffect(() => {
        if (!isError || !executedQuery || !errorUpdatedAt) {
            return;
        }

        if (clientPageIndex !== 0 || lastErrorRunNonceRef.current === runNonce) {
            return;
        }

        lastErrorRunNonceRef.current = runNonce;
        setActiveResultTab('messages');
        addQueryHistory({
            id: `history-${crypto.randomUUID()}`,
            sql: executedQuery,
            database: activeDatabase || undefined,
            connectionName: activeConnection?.name,
            executedAt: Date.now(),
            status: 'error',
            errorMessage: (error as Error)?.message,
        });
    }, [isError, executedQuery, errorUpdatedAt, clientPageIndex, runNonce, activeDatabase, activeConnection?.name, error, addQueryHistory]);

    const handleRun = (overrideSql?: string) => {
        let sqlToExecute = overrideSql || query;

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
        setExplainPlan(null);
        setClientPageIndex(0);
        setServerTotalCount(undefined);
        updateTabMetadata(tabId, { pageIndex: 0, totalCount: undefined });
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

        if (!sqlToExplain.trim() || !activeConnectionId) return;

        setExplainPlan(null);
        setAiExplainSql(sqlToExplain);
        setAiExplanation(null);
        setAiExplainError(null);
        setIsAiExplainDialogOpen(true);
        setIsAiExplaining(true);

        try {
            const result = await apiService.post<AiExplanationResponse>('/ai/generate-sql', {
                connectionId: activeConnectionId,
                database: activeDatabase || undefined,
                prompt: text.explainPrompt,
                context: `SQL to explain:\n${sqlToExplain}`,
                model: resolvedExplain.model,
                mode: 'planning',
                routingMode: aiRoutingMode,
                providerOverride: resolvedExplain.providerOverride,
            });

            setAiExplanation(result.message?.trim() || result.explanation?.trim() || null);
        } catch (explainError) {
            setAiExplainError(getErrorMessage(explainError));
        } finally {
            setIsAiExplaining(false);
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
        } catch (formatError) {
            console.error('Formatting failed', formatError);
        }
    };

    const handleClear = () => setQuery('');

    const handleClearResults = () => {
        setExecutedQuery(null);
        setExplainPlan(null);
        queryClient.removeQueries({ queryKey: ['query-execution', activeConnectionId] });
    };

    const handleSave = useCallback(async () => {
        if (!query.trim()) return;

        if (currentSavedQueryId && currentSavedQuery?.isOwner) {
            try {
                const updated = await SavedQueryService.updateSavedQuery(currentSavedQueryId, { sql: query });
                saveQuery(updated);
                toast.success(text.savedQueryUpdated);
            } catch (saveError) {
                toast.error(getErrorMessage(saveError) || 'Failed to update saved query');
            }
        } else {
            const defaultName = text.defaultQueryName(new Date().toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US'));
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
    }, [query, currentSavedQueryId, currentSavedQuery, saveQuery, lang, activeOrganizationId, text]);

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
            toast.success(text.savedQueryUpdated);
            return;
        }

        const created = await SavedQueryService.createSavedQuery(payload);
        saveQuery(created);
        setCurrentSavedQueryId(created.id);
        updateTabMetadata(tabId, { savedQueryId: created.id });
        toast.success(text.querySaved);
    }, [query, activeDatabase, activeConnection, currentSavedQueryId, currentSavedQuery, saveQuery, tabId, text, updateTabMetadata]);

    const handleOpenSavedQuery = useCallback((sq: SavedQuery) => {
        openTab({
            id: `query-${crypto.randomUUID()}`,
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

    useEffect(() => {
        if (!isActive) return;

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
    }, [isActive]);

    return (
        <>
            <div className="flex flex-col h-full bg-background">
                <QueryToolbar
                    isLoading={isLoading}
                    isExplaining={isAiExplaining}
                    allowQueryExecution={activeConnection?.allowQueryExecution}
                    isCompactMobileLayout={isCompactMobileLayout}
                    isSmallMobile={isSmallMobile}
                    lang={lang}
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
                    onExplain={() => void handleExplain()}
                    showSqlSequence={supportsSqlSequence}
                    onOpenSqlSequence={() => setIsSqlSequenceDialogOpen(true)}
                    rightSlot={currentSavedQuery?.organizationId ? (
                        <PresenceBadge
                            entries={queryPresence.entries}
                            isLoading={queryPresence.isLoading}
                            label={text.presenceLabel}
                            emptyLabel={text.presenceEmpty}
                            className="max-w-[280px]"
                        />
                    ) : null}
                />

                <div className="flex-1 flex flex-col min-h-0 relative">
                    <div className="flex-1 min-h-0 relative">
                        <SqlEditor
                            value={query}
                            onChange={(val: string | undefined) => setQuery(val || '')}
                            height="100%"
                            onMount={(editor) => {
                                editorRef.current = editor;
                                editorAliveRef.current = true;
                                requestAnimationFrame(() => {
                                    if (!editorAliveRef.current || editorRef.current !== editor) return;
                                    editor.layout();
                                });
                            }}
                            schemaInfo={schemaInfo}
                        />
                    </div>

                    <div
                        onPointerDown={resizer.startResizing}
                        className={cn(
                            'h-1.5 bg-muted/20 border-y border-border/10 cursor-row-resize flex items-center justify-center group transition-colors select-none z-20 touch-none',
                            resizer.isDragging ? 'bg-blue-500/20' : 'hover:bg-blue-500/10',
                            !isResultPanelOpen && 'hidden',
                        )}
                    >
                        <div className={cn(
                            'w-12 h-0.5 rounded-full bg-muted-foreground/20 group-hover:bg-blue-500/50 transition-colors',
                            resizer.isDragging && 'bg-blue-500',
                        )} />
                    </div>

                    <div
                        style={{ height: isResultPanelOpen ? `${resizer.height}px` : '0px' }}
                        className={cn(
                            'flex flex-col overflow-hidden bg-card shrink-0 relative z-10',
                            resizer.isDragging ? '' : 'transition-[height] duration-300 ease-in-out',
                        )}
                    >
                        <QueryResults
                            results={results || null}
                            isLoading={isLoading}
                            isFetching={isFetching}
                            error={(error as Error) || null}
                            executedQuery={executedQuery}
                            dataUpdatedAt={dataUpdatedAt}
                            activeTab={activeResultTab}
                            onTabChange={setActiveResultTab}
                            explainPlan={explainPlan}
                            onClearResults={handleClearResults}
                            onClose={toggleResultPanel}
                            onSaveToDashboard={results ? openDashboardDialog : undefined}
                            pageIndex={clientPageIndex}
                            pageSize={clientPageSize}
                            totalCount={serverTotalCount ?? results?.totalCount}
                            onPaginationChange={(pageIdx, size) => {
                                setClientPageIndex(pageIdx);
                                setClientPageSize(size);
                                updateTabMetadata(tabId, {
                                    pageIndex: pageIdx,
                                    pageSize: size,
                                });
                            }}
                            onFixWithAi={executedQuery && error
                                ? () => void openAiQueryFixDraft(
                                    executedQuery,
                                    getErrorMessage(error),
                                    'SQL',
                                    lang,
                                )
                                : undefined}
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
            <SqlSequenceDialog
                open={isSqlSequenceDialogOpen}
                onOpenChange={setIsSqlSequenceDialogOpen}
                lang={lang}
                initialSql={query}
                canRun={activeConnection?.allowQueryExecution !== false}
                onApply={(sql) => {
                    setQuery(sql);
                    editorRef.current?.focus();
                }}
                onRun={(sql) => {
                    setQuery(sql);
                    handleRun(sql);
                }}
            />
            <AiQueryExplanationDialog
                open={isAiExplainDialogOpen}
                onOpenChange={setIsAiExplainDialogOpen}
                lang={lang}
                sql={aiExplainSql}
                explanation={aiExplanation}
                isLoading={isAiExplaining}
                error={aiExplainError}
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


