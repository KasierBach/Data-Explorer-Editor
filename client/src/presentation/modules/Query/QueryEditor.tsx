import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/presentation/components/ui/button';
import { SqlEditor } from '@/presentation/components/code-editor/SqlEditor';
import { Play, Loader2, Eraser, AlignLeft, Save, FolderOpen, RefreshCw, History, Zap } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { connectionService } from '@/core/services/ConnectionService';
import { useAppStore, type SavedQuery } from '@/core/services/store';
import { format } from 'sql-formatter';
import { SavedQueriesDialog } from './SavedQueriesDialog';
import { QueryHistoryDialog } from './QueryHistoryDialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/presentation/components/ui/select";
import type { QueryResult } from '@/core/domain/entities';
import { Panel, Group, Separator } from "react-resizable-panels";
import { QueryResults } from './QueryResults';
import { useSchemaInfo } from '@/presentation/hooks/useSchemaInfo';

export const QueryEditor: React.FC<{ tabId: string }> = ({ tabId }) => {
    const queryClient = useQueryClient();
    const { activeConnectionId, connections, tabs, updateTabMetadata, activeDatabase } = useAppStore();
    const activeConnection = connections.find(c => c.id === activeConnectionId);
    const schemaInfo = useSchemaInfo();

    // Find options for this tab
    const tab = tabs.find(t => t.id === tabId);
    const initialMetadata = tab?.metadata || {};

    const [query, setQuery] = useState(initialMetadata.sql || tab?.initialSql || '');
    const [executedQuery, setExecutedQuery] = useState<string | null>(null);
    const [limit, setLimit] = useState(initialMetadata.limit || "1000");
    const [activeResultTab, setActiveResultTab] = useState("data");
    const [isSavedDialogOpen, setIsSavedDialogOpen] = useState(false);
    const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
    const [currentSavedQueryId, setCurrentSavedQueryId] = useState<string | null>(initialMetadata.savedQueryId || null);

    const isFirstLoad = useRef(true);
    const editorRef = useRef<any>(null);

    const { saveQuery, updateSavedQuery, openTab, addQueryHistory } = useAppStore();

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

    const { data: results, isLoading, error, refetch, dataUpdatedAt, isSuccess, isError } = useQuery<QueryResult | null, Error>({
        queryKey: ['query-execution', activeConnectionId, executedQuery, limit],
        queryFn: async () => {
            if (!executedQuery) return null;
            if (!activeConnection) throw new Error("No active connection");

            const adapter = connectionService.getAdapter(activeConnection.id, activeConnection.type as any);
            await adapter.connect(activeConnection);

            return adapter.executeQuery(executedQuery, { database: activeDatabase || undefined });
        },
        enabled: !!executedQuery && !!activeConnectionId,
        retry: false
    });

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
        setTimeout(() => refetch(), 0);
    };

    const handleExplain = () => {
        let sqlToExplain = query;
        if (editorRef.current) {
            const selection = editorRef.current.getSelection();
            if (selection && !selection.isEmpty()) {
                const selectedText = editorRef.current.getModel()?.getValueInRange(selection);
                if (selectedText && selectedText.trim()) sqlToExplain = selectedText;
            }
        }
        if (!sqlToExplain.trim()) return;
        const explainSql = `EXPLAIN ANALYZE ${sqlToExplain}`;
        setExecutedQuery(explainSql);
        setTimeout(() => refetch(), 0);
    };

    const handleFormat = () => {
        try {
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

    // Save query
    const handleSave = useCallback(() => {
        if (!query.trim()) return;

        if (currentSavedQueryId) {
            // Update existing
            updateSavedQuery(currentSavedQueryId, { sql: query });
        } else {
            // New: prompt for name
            const name = prompt('Save Query As:', `Query ${new Date().toLocaleString('vi-VN')}`);
            if (!name) return;

            const id = `saved-${Date.now()}`;
            const newQuery: SavedQuery = {
                id,
                name,
                sql: query,
                database: activeConnection?.database,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            };
            saveQuery(newQuery);
            setCurrentSavedQueryId(id);
            updateTabMetadata(tabId, { savedQueryId: id });
        }
    }, [query, currentSavedQueryId, updateSavedQuery, saveQuery, activeConnection, tabId, updateTabMetadata]);

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

    // Keyboard shortcuts
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                handleSave();
            }
            if (e.ctrlKey && e.key === 'o') {
                e.preventDefault();
                setIsSavedDialogOpen(true);
            }
            if (e.ctrlKey && e.key === 'h') {
                e.preventDefault();
                setIsHistoryDialogOpen(true);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [handleSave]);

    return (
        <>
            <div className="flex flex-col h-full bg-background">
                {/* Toolbar */}
                <div className="p-1 px-2 border-b flex items-center justify-between bg-muted/30">
                    <div className="flex items-center gap-1">
                        <Button size="sm" onClick={() => handleRun()} disabled={isLoading} className="h-7 gap-1 px-3 bg-green-600 hover:bg-green-700 text-white border-none shadow-sm">
                            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                            <span className="font-semibold">Execute</span>
                        </Button>

                        <div className="h-4 w-[1px] bg-border mx-1" />

                        <Button variant="ghost" size="sm" onClick={handleRefreshSchema} className="h-7 gap-1 px-2 text-xs" title="Refresh Sidebar">
                            <RefreshCw className="w-3.5 h-3.5" />
                            Refresh
                        </Button>

                        <div className="h-4 w-[1px] bg-border mx-1" />

                        <Button variant="ghost" size="sm" onClick={handleFormat} className="h-7 gap-1 px-2 text-xs">
                            <AlignLeft className="w-3.5 h-3.5" />
                            Format
                        </Button>

                        <Button variant="ghost" size="sm" onClick={handleClear} className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-destructive">
                            <Eraser className="w-3.5 h-3.5" />
                            Clear
                        </Button>

                        <div className="h-4 w-[1px] bg-border mx-1" />

                        <Button variant="ghost" size="sm" onClick={handleSave} className="h-7 gap-1 px-2 text-xs" title="Ctrl+S">
                            <Save className="w-3.5 h-3.5" />
                            Save
                        </Button>

                        <Button variant="ghost" size="sm" onClick={() => setIsSavedDialogOpen(true)} className="h-7 gap-1 px-2 text-xs" title="Ctrl+O">
                            <FolderOpen className="w-3.5 h-3.5" />
                            Open
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setIsHistoryDialogOpen(true)} className="h-7 gap-1 px-2 text-xs" title="Ctrl+H">
                            <History className="w-3.5 h-3.5" />
                            History
                        </Button>
                        <div className="h-4 w-[1px] bg-border mx-1" />

                        <Button variant="ghost" size="sm" onClick={handleExplain} disabled={isLoading} className="h-7 gap-1 px-2 text-xs text-orange-500 hover:text-orange-600" title="EXPLAIN ANALYZE">
                            <Zap className="w-3.5 h-3.5" />
                            Explain
                        </Button>

                        <div className="flex items-center gap-2 px-2">
                            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Limit</span>
                            <Select value={limit} onValueChange={setLimit}>
                                <SelectTrigger className="h-6 w-[80px] text-[10px] py-0 border-none bg-transparent hover:bg-muted/50 focus:ring-0">
                                    <SelectValue placeholder="Limit" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="100">100</SelectItem>
                                    <SelectItem value="500">500</SelectItem>
                                    <SelectItem value="1000">1000</SelectItem>
                                    <SelectItem value="5000">5000</SelectItem>
                                    <SelectItem value="all">No Limit</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {activeConnection && (
                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-50 dark:bg-blue-950/30 rounded border border-blue-100 dark:border-blue-900/50">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                                <span className="text-[10px] font-medium text-blue-700 dark:text-blue-400">
                                    {activeConnection.name}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                <Group orientation="vertical" className="flex-1">
                    <Panel defaultSize={50} minSize={20} className="flex flex-col relative">
                        {/* Editor Area */}
                        <SqlEditor
                            value={query}
                            onChange={(val: string | undefined) => setQuery(val || '')}
                            height="100%"
                            onMount={(editor) => {
                                editorRef.current = editor;
                            }}
                            schemaInfo={schemaInfo}
                        />
                    </Panel>

                    <Separator className="h-1.5 bg-muted/20 hover:bg-blue-500/20 active:bg-blue-500/40 transition-colors cursor-row-resize flex items-center justify-center group">
                        <div className="w-8 h-1 rounded-full bg-muted-foreground/20 group-hover:bg-blue-500/50 transition-colors" />
                    </Separator>

                    <Panel defaultSize={50} minSize={20} className="flex flex-col overflow-hidden">
                        {/* Result Area with Tabs */}
                        <QueryResults
                            results={results || null}
                            isLoading={isLoading}
                            error={(error as Error) || null}
                            executedQuery={executedQuery}
                            dataUpdatedAt={dataUpdatedAt}
                            activeTab={activeResultTab}
                            onTabChange={setActiveResultTab}
                        />
                    </Panel>
                </Group>
            </div>

            <SavedQueriesDialog
                open={isSavedDialogOpen}
                onOpenChange={setIsSavedDialogOpen}
                onOpenQuery={handleOpenSavedQuery}
            />
            <QueryHistoryDialog
                open={isHistoryDialogOpen}
                onOpenChange={setIsHistoryDialogOpen}
                onRunQuery={(sql) => {
                    setQuery(sql);
                    handleRun(sql);
                }}
            />
        </>
    );
};
