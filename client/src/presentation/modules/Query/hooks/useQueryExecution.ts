import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/core/services/api.service';
import { useAppStore } from '@/core/services/store';
import type { QueryResult } from '@/core/domain/entities';
import { ApiError } from '@/core/services/api.service';
import { SearchService } from '@/core/services/SearchService';
import { MetadataService } from '@/core/services/MetadataService';

interface UseQueryExecutionOptions {
    tabId: string;
    query: string;
    limit: string;
    onExecutionStart?: () => void;
    onExecutionEnd?: () => void;
}

function shouldSyncSearchIndex(sql: string) {
    const trimmed = sql.trim();
    return /^(CREATE|ALTER|DROP|TRUNCATE|RENAME|COMMENT|REFRESH)\b/i.test(trimmed);
}

export function useQueryExecution({
    tabId,
    query,
    limit,
    onExecutionStart,
    onExecutionEnd,
}: UseQueryExecutionOptions) {
    const queryClient = useQueryClient();
    const { activeConnectionId, activeDatabase, connections, addQueryHistory } = useAppStore();
    const activeConnection = connections.find((c) => c.id === activeConnectionId);
    const [executedQuery, setExecutedQuery] = useState<string | null>(null);
    const [runNonce, setRunNonce] = useState(0);
    const effectiveLimit = limit === 'all' ? undefined : Number.parseInt(limit, 10);
    const requestLimit = Number.isInteger(effectiveLimit) ? effectiveLimit : undefined;

    const {
        data: results,
        isLoading,
        error,
        // refetch intentionally not used in this lightweight flow
        dataUpdatedAt,
    } = useQuery<QueryResult | null, ApiError>({
        queryKey: ['query', tabId, runNonce],
        queryFn: async () => {
            if (!activeConnectionId || !query.trim()) return null;
            
            onExecutionStart?.();
            const startTime = Date.now();
            try {
                const targetDb = activeDatabase || activeConnection?.database || undefined;
                const result = await apiService.post<QueryResult>('/query', {
                    connectionId: activeConnectionId,
                    sql: query,
                    database: targetDb,
                    limit: requestLimit,
                    confirmed: true,
                });
                const elapsedMs = Date.now() - startTime;
                
                setExecutedQuery(query);
                addQueryHistory({
                    id: `hist-${Date.now()}`,
                    sql: query,
                    database: targetDb,
                    connectionName: activeConnection?.name,
                    executedAt: Date.now(),
                    durationMs: result?.durationMs ?? elapsedMs,
                    rowCount: result?.rowCount ?? result?.rows?.length,
                    status: 'success',
                });

                if (shouldSyncSearchIndex(query)) {
                    void MetadataService.refresh(activeConnectionId, targetDb)
                        .then(() => Promise.all([
                            queryClient.invalidateQueries({ queryKey: ['hierarchy'] }),
                            queryClient.invalidateQueries({ queryKey: ['metadata'] }),
                        ]))
                        .catch((error) => {
                            console.warn('useQueryExecution: metadata refresh failed', error);
                        });
                    void SearchService.syncIndex().catch((error) => {
                        console.warn('useQueryExecution: search sync failed', error);
                    });
                }
                
                return result;
            } catch (err) {
                const elapsedMs = Date.now() - startTime;
                addQueryHistory({
                    id: `hist-${Date.now()}`,
                    sql: query,
                    database: activeDatabase || activeConnection?.database || undefined,
                    connectionName: activeConnection?.name,
                    executedAt: Date.now(),
                    durationMs: elapsedMs,
                    status: 'error',
                    errorMessage: err instanceof Error ? err.message : 'Unknown error',
                });
                throw err;
            } finally {
                onExecutionEnd?.();
            }
        },
        enabled: runNonce > 0 && !!activeConnectionId && !!query.trim(),
        retry: false,
        staleTime: 0,
    });

    const executeQuery = useCallback(() => {
        if (!query.trim()) return;
        setRunNonce(n => n + 1);
    }, [query]);

    const clearResults = useCallback(() => {
        queryClient.removeQueries({ queryKey: ['query', tabId] });
        setExecutedQuery(null);
    }, [queryClient, tabId]);

    return {
        results: results || null,
        isLoading,
        error,
        executedQuery,
        executeQuery,
        clearResults,
        dataUpdatedAt,
    };
}
