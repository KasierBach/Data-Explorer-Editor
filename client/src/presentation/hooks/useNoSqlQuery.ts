import { useState, useCallback } from 'react';
import { connectionService } from '@/core/services/ConnectionService';
import { useAppStore } from '@/core/services/store';
import { toast } from 'sonner';
import type { RowData } from '@/core/domain/entities';

interface NoSqlQueryResult {
    rows: RowData[];
    columns?: string[];
    rowCount?: number;
    durationMs?: number;
    summaryLabel?: string;
    summaryValue?: number;
    summaryHint?: string;
}

type MqlPayload = Record<string, unknown>;
type MutationAction =
    | 'insertOne'
    | 'insertMany'
    | 'updateOne'
    | 'updateMany'
    | 'deleteOne'
    | 'deleteMany';

const MUTATING_ACTIONS = new Set<MutationAction>([
    'insertOne',
    'insertMany',
    'updateOne',
    'updateMany',
    'deleteOne',
    'deleteMany',
]);

const isMqlPayload = (value: unknown): value is MqlPayload => (
    typeof value === 'object' && value !== null
);

const toError = (error: unknown) => (
    error instanceof Error ? error : new Error('MQL Execution Failed')
);

const getNumericField = (row: RowData | undefined, field: string) => {
    const value = row?.[field];
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

const summarizeNoSqlExecution = (
    action: string,
    queryResult: { rows: RowData[]; rowCount?: number },
    durationMs: number,
    lang: 'vi' | 'en',
) => {
    const rows = queryResult.rows || [];
    const baseCount = queryResult.rowCount ?? rows.length;

    switch (action) {
        case 'aggregate':
            return {
                summaryValue: baseCount,
                summaryLabel: lang === 'vi' ? 'kết quả' : 'results',
                successMessage: lang === 'vi'
                    ? `Đã nạp ${baseCount} kết quả pipeline (${durationMs}ms)`
                    : `Loaded ${baseCount} pipeline results (${durationMs}ms)`,
            };
        case 'count': {
            const counted = getNumericField(rows[0], 'count') ?? baseCount;
            return {
                summaryValue: counted,
                summaryLabel: 'count',
                successMessage: lang === 'vi'
                    ? `Đếm được ${counted} tài liệu (${durationMs}ms)`
                    : `Counted ${counted} documents (${durationMs}ms)`,
            };
        }
        case 'insertOne':
            return {
                summaryValue: 1,
                summaryLabel: lang === 'vi' ? 'đã thêm' : 'inserted',
                successMessage: lang === 'vi'
                    ? `Đã thêm 1 tài liệu (${durationMs}ms)`
                    : `Inserted 1 document (${durationMs}ms)`,
            };
        case 'insertMany': {
            const insertedCount = getNumericField(rows[0], 'insertedCount') ?? baseCount;
            return {
                summaryValue: insertedCount,
                summaryLabel: lang === 'vi' ? 'đã thêm' : 'inserted',
                successMessage: lang === 'vi'
                    ? `Đã thêm ${insertedCount} tài liệu (${durationMs}ms)`
                    : `Inserted ${insertedCount} documents (${durationMs}ms)`,
            };
        }
        case 'updateOne':
        case 'updateMany': {
            const matchedCount = getNumericField(rows[0], 'matchedCount') ?? 0;
            const modifiedCount = getNumericField(rows[0], 'modifiedCount') ?? baseCount;
            const summaryHint = matchedCount > modifiedCount
                ? (lang === 'vi'
                    ? `${matchedCount} tài liệu khớp điều kiện`
                    : `${matchedCount} documents matched the filter`)
                : undefined;

            return {
                summaryValue: modifiedCount,
                summaryLabel: lang === 'vi' ? 'đã sửa' : 'updated',
                summaryHint,
                successMessage: lang === 'vi'
                    ? `Đã cập nhật ${modifiedCount} tài liệu (${durationMs}ms)`
                    : `Updated ${modifiedCount} documents (${durationMs}ms)`,
            };
        }
        case 'deleteOne':
        case 'deleteMany': {
            const deletedCount = getNumericField(rows[0], 'deletedCount') ?? baseCount;
            return {
                summaryValue: deletedCount,
                summaryLabel: lang === 'vi' ? 'đã xoá' : 'deleted',
                successMessage: lang === 'vi'
                    ? `Đã xoá ${deletedCount} tài liệu (${durationMs}ms)`
                    : `Deleted ${deletedCount} documents (${durationMs}ms)`,
            };
        }
        case 'distinct':
            return {
                summaryValue: baseCount,
                summaryLabel: lang === 'vi' ? 'giá trị' : 'values',
                successMessage: lang === 'vi'
                    ? `Đã lấy ${baseCount} giá trị distinct (${durationMs}ms)`
                    : `Loaded ${baseCount} distinct values (${durationMs}ms)`,
            };
        case 'find':
        default:
            return {
                summaryValue: baseCount,
                summaryLabel: lang === 'vi' ? 'tài liệu' : 'docs',
                successMessage: lang === 'vi'
                    ? `Đã nạp ${baseCount} tài liệu (${durationMs}ms)`
                    : `Loaded ${baseCount} documents (${durationMs}ms)`,
            };
    }
};

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
            nosqlActiveConnectionId,
            connections,
            lang,
        } = state;

        const activeConnection = connections.find(c => c.id === nosqlActiveConnectionId);

        if (!activeConnection) {
            toast.error('No active connection');
            return;
        }

        if (activeConnection.allowQueryExecution === false) {
            toast.error('Query execution is disabled for this connection');
            return;
        }

        if (!nosqlActiveCollection) {
            toast.warning('Please select a Collection first');
            return;
        }

        // Parse MQL Query from JSON string in the store
        let payload: MqlPayload = {};
        try {
            const parsed = JSON.parse(state.nosqlMqlQuery || '{}') as unknown;
            if (!isMqlPayload(parsed)) {
                throw new Error('MQL payload must be a JSON object');
            }
            payload = parsed;
        } catch {
            toast.error('Invalid MQL JSON');
            return;
        }

        // Validate basic payload structure
        if (!payload.action || !payload.collection) {
            toast.error('MQL JSON must contain "action" and "collection" fields');
            return;
        }

        const action = String(payload.action || '');
        const isMutatingAction = MUTATING_ACTIONS.has(action as MutationAction);
        if (activeConnection.readOnly && isMutatingAction) {
            toast.error('This connection is read-only. Only find and aggregate are allowed.');
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
            const executionSummary = summarizeNoSqlExecution(
                action,
                queryResult,
                durationMs,
                lang,
            );

            const enrichedResult: NoSqlQueryResult = {
                ...queryResult,
                durationMs,
                summaryLabel: executionSummary.summaryLabel,
                summaryValue: executionSummary.summaryValue,
                summaryHint: executionSummary.summaryHint,
            };

            setResult(enrichedResult);
            state.setNosqlResult(queryResult.rows);
            toast.success(executionSummary.successMessage);
        } catch (err) {
            const error = toError(err);
            setError(error);
            toast.error(error.message || 'MQL Execution Failed');
        } finally {
            setIsLoading(false);
            state.setNosqlQueryRunning(false);
        }
    }, []);

    return { result, isLoading, error, executeMql };
}
