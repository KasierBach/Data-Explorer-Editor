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
            nosqlActiveCollection, nosqlFilter,
            activeConnectionId, connections, activeDatabase 
        } = state;

        const activeConnection = connections.find(c => c.id === activeConnectionId);

        if (!activeConnection) {
            toast.error('No active connection');
            return;
        }

        if (!nosqlActiveCollection) {
            toast.warning('Please select a Collection first');
            return;
        }

        // Parse filter & options from JSON strings in the store
        let filter: any = {};
        let options: any = {};
        try {
            filter = JSON.parse(nosqlFilter.filter || '{}');
        } catch {
            toast.error('Invalid Filter JSON');
            return;
        }
        try {
            options = JSON.parse(nosqlFilter.options || '{}');
        } catch {
            toast.error('Invalid Options JSON');
            return;
        }

        // Build Mongo query payload
        const payload = {
            action: nosqlFilter.action || 'find',
            collection: nosqlActiveCollection,
            filter,
            options,
            limit: options.limit || 50,
        };

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
                { database: activeDatabase || undefined }
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
