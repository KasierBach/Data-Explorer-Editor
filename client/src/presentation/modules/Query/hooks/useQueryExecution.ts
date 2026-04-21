import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/core/services/api.service';
import { useAppStore } from '@/core/services/store';
import type { QueryResult } from '@/core/domain/entities';
import { ApiError } from '@/core/services/api.service';

interface UseQueryExecutionOptions {
    tabId: string;
    query: string;
    limit: string;
    onExecutionStart?: () => void;
    onExecutionEnd?: () => void;
}

export function useQueryExecution({
    tabId,
    query,
    limit,
    onExecutionStart,
    onExecutionEnd,
}: UseQueryExecutionOptions) {
    const queryClient = useQueryClient();
    const { activeConnectionId, activeDatabase, addQueryHistory } = useAppStore();
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
            try {
            const result = await apiService.post<QueryResult>('/query', {
                    connectionId: activeConnectionId,
                    sql: query,
                    database: activeDatabase || undefined,
                    limit: requestLimit,
                    confirmed: true,
                });
                
                setExecutedQuery(query);
                addQueryHistory({
                    sql: query,
                    database: activeDatabase || undefined,
                    executedAt: Date.now(),
                    rowCount: result?.rowCount,
                    status: 'success',
                });
                
                return result;
            } catch (err) {
                addQueryHistory({
                    sql: query,
                    database: activeDatabase || undefined,
                    executedAt: Date.now(),
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
