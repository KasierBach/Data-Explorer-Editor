import { useState, useCallback } from 'react';
import { connectionService } from '@/core/services/ConnectionService';
import { useAppStore } from '@/core/services/store';
import { toast } from 'sonner';

interface NoSqlQueryResult {
    rows: any[];
    columns?: string[];
    rowCount?: number;
    durationMs?: number;
}

interface UseNoSqlQueryReturn {
    result: NoSqlQueryResult | null;
    isLoading: boolean;
    error: Error | null;
    executeMql: () => Promise<void>;
}

/**
 * Custom hook to execute MQL queries against a connected MongoDB instance.
 * 
 * Constructs a JSON payload from the NoSQL slice state and sends it
 * through the existing `executeQuery` pipeline (which the backend's 
 * MongoDbStrategy already understands).
 * 
 * Follows SRP: this hook ONLY handles query execution, not UI state.
 */
export function useNoSqlQuery(): UseNoSqlQueryReturn {
    const [result, setResult] = useState<NoSqlQueryResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const executeMql = useCallback(async () => {
        const state = useAppStore.getState();
        const { 
            nosqlActiveCollection,
            nosqlActiveDatabase,
            nosqlActiveConnectionId, connections
        } = state;

        const activeConnection = connections.find(c => c.id === nosqlActiveConnectionId);

        if (!activeConnection) {
            toast.error('No active connection');
            return;
        }

        if (!nosqlActiveCollection) {
            toast.warning('Please select a Collection first');
            return;
        }

// Parse MQL Query from JSON string in the store
        let payload: any = {};
        try {
            payload = JSON.parse(state.nosqlMqlQuery || '{}');
        } catch (err: any) {
            toast.error('Invalid MQL JSON');
            return;
        }

        // Validate basic payload structure
        if (!payload.action || !payload.collection) {
            toast.error('MQL JSON must contain "action" and "collection" fields');
            return;
        }

        setIsLoading(true);
        setError(null);
        state.setNosqlQueryRunning(true);

        const startTime = performance.now();

        try {
            const adapter = connectionService.getAdapter(activeConnection.id, activeConnection.type);
            await adapter.connect(activeConnection);

            // The executeQuery method sends `sql` to backend, which MongoDbStrategy 
            // interprets as a JSON payload string — zero modification needed.
            const queryResult = await adapter.executeQuery(
                JSON.stringify(payload),
                { database: nosqlActiveDatabase || undefined }
            );

            const durationMs = Math.round(performance.now() - startTime);

            const enrichedResult: NoSqlQueryResult = {
                ...queryResult,
                durationMs,
            };

            setResult(enrichedResult);
            state.setNosqlResult(queryResult.rows);
            toast.success(`${queryResult.rowCount ?? queryResult.rows.length} documents returned (${durationMs}ms)`);
        } catch (err: any) {
            setError(err);
            toast.error(err.message || 'MQL Execution Failed');
        } finally {
            setIsLoading(false);
            state.setNosqlQueryRunning(false);
        }
    }, []);

    return { result, isLoading, error, executeMql };
}
