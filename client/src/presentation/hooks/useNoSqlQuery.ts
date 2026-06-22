import { useState, useCallback } from 'react';
import { connectionService } from '@/core/services/ConnectionService';
import { useAppStore } from '@/core/services/store';
import { toast } from 'sonner';
import type { RowData } from '@/core/domain/entities';
import { getWorkspaceText } from '@/core/utils/workspaceText';

interface NoSqlQueryResult {
    rows: RowData[];
    columns?: string[];
    rowCount?: number;
    durationMs?: number;
    truncated?: boolean;
    appliedLimit?: number;
    limitSource?: 'requested' | 'protective_default' | 'table_window';
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

const buildNoSqlLimitHint = (
    action: string,
    queryResult: {
        truncated?: boolean;
        appliedLimit?: number;
        limitSource?: 'requested' | 'protective_default' | 'table_window';
    },
    lang: 'vi' | 'en',
) => {
    const text = getWorkspaceText(lang).noSqlQuery;
    if (!queryResult.truncated || !queryResult.appliedLimit) {
        return undefined;
    }

    const formattedLimit = queryResult.appliedLimit.toLocaleString(
        lang === 'vi' ? 'vi-VN' : 'en-US',
    );
    const noun =
        action === 'aggregate'
            ? text.pipelineResults
            : text.documents;

    if (queryResult.limitSource === 'requested') {
        return text.requestedLimitHint(formattedLimit, noun);
    }

    return text.guardrailLimitHint(formattedLimit, noun);
};

const summarizeNoSqlExecution = (
    action: string,
    queryResult: { rows: RowData[]; rowCount?: number },
    durationMs: number,
    lang: 'vi' | 'en',
) => {
    const text = getWorkspaceText(lang).noSqlQuery;
    const rows = queryResult.rows || [];
    const baseCount = queryResult.rowCount ?? rows.length;

    switch (action) {
        case 'aggregate':
            return {
                summaryValue: baseCount,
                summaryLabel: text.resultsLabel,
                successMessage: text.loadedPipeline(baseCount, durationMs),
            };
        case 'count': {
            const counted = getNumericField(rows[0], 'count') ?? baseCount;
            return {
                summaryValue: counted,
                summaryLabel: text.countLabel,
                successMessage: text.countedDocuments(counted, durationMs),
            };
        }
        case 'insertOne':
            return {
                summaryValue: 1,
                summaryLabel: text.insertedLabel,
                successMessage: text.insertedOne(durationMs),
            };
        case 'insertMany': {
            const insertedCount = getNumericField(rows[0], 'insertedCount') ?? baseCount;
            return {
                summaryValue: insertedCount,
                summaryLabel: text.insertedLabel,
                successMessage: text.insertedMany(insertedCount, durationMs),
            };
        }
        case 'updateOne':
        case 'updateMany': {
            const matchedCount = getNumericField(rows[0], 'matchedCount') ?? 0;
            const modifiedCount = getNumericField(rows[0], 'modifiedCount') ?? baseCount;
            const summaryHint = matchedCount > modifiedCount
                ? text.matchedHint(matchedCount)
                : undefined;

            return {
                summaryValue: modifiedCount,
                summaryLabel: text.updatedLabel,
                summaryHint,
                successMessage: text.updatedDocuments(modifiedCount, durationMs),
            };
        }
        case 'deleteOne':
        case 'deleteMany': {
            const deletedCount = getNumericField(rows[0], 'deletedCount') ?? baseCount;
            return {
                summaryValue: deletedCount,
                summaryLabel: text.deletedLabel,
                successMessage: text.deletedDocuments(deletedCount, durationMs),
            };
        }
        case 'distinct':
            return {
                summaryValue: baseCount,
                summaryLabel: text.valuesLabel,
                successMessage: text.loadedDistinct(baseCount, durationMs),
            };
        case 'find':
        default:
            return {
                summaryValue: baseCount,
                summaryLabel: text.docsLabel,
                successMessage: text.loadedDocuments(baseCount, durationMs),
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
        const text = getWorkspaceText(lang).noSqlQuery;

        const activeConnection = connections.find(c => c.id === nosqlActiveConnectionId);

        if (!activeConnection) {
            toast.error(text.noActiveConnection);
            return;
        }

        if (activeConnection.allowQueryExecution === false) {
            toast.error(text.executionDisabled);
            return;
        }

        if (!nosqlActiveCollection) {
            toast.warning(text.selectCollection);
            return;
        }

        // Parse MQL Query from JSON string in the store
        let payload: MqlPayload = {};
        try {
            const parsed = JSON.parse(state.nosqlMqlQuery || '{}') as unknown;
            if (!isMqlPayload(parsed)) {
                throw new Error(text.payloadObjectRequired);
            }
            payload = parsed;
        } catch {
            toast.error(text.invalidJson);
            return;
        }

        // Validate basic payload structure
        if (!payload.action || !payload.collection) {
            toast.error(text.missingActionCollection);
            return;
        }

        const action = String(payload.action || '');
        const isMutatingAction = MUTATING_ACTIONS.has(action as MutationAction);
        if (activeConnection.readOnly && isMutatingAction) {
            toast.error(text.readOnlyViolation);
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
                summaryHint:
                    buildNoSqlLimitHint(action, queryResult, lang) ??
                    executionSummary.summaryHint,
            };

            setResult(enrichedResult);
            state.setNosqlResult(queryResult.rows);
            toast.success(executionSummary.successMessage);
        } catch (err) {
            const error = toError(err);
            setError(error);
            toast.error(error.message || text.executionFailed);
        } finally {
            setIsLoading(false);
            state.setNosqlQueryRunning(false);
        }
    }, []);

    return { result, isLoading, error, executeMql };
}
