import { useQuery } from '@tanstack/react-query';
import { connectionService } from '@/core/services/ConnectionService';
import { useAppStore } from '@/core/services/store';
import { parseNodeId, getQuotedIdentifier } from '@/core/utils/id-parser';
import type { QueryResult, TableMetadata } from '@/core/domain/entities';

interface DataGridDataParams {
    tableId: string;
}

interface DataGridDataResult {
    metadata: TableMetadata | undefined;
    queryResult: QueryResult | undefined;
    isLoadingMeta: boolean;
    isLoadingData: boolean;
    isFetchingData: boolean;
    refetch: () => void;
    dbName: string | undefined;
    schema: string;
    cleanTableName: string | undefined;
    dialect: 'mysql' | 'postgres';
    pkField: string | undefined;
}

export function useDataGridData({ tableId }: DataGridDataParams): DataGridDataResult {
    const { activeConnectionId, connections } = useAppStore();
    const activeConnection = connections.find(c => c.id === activeConnectionId);

    const { dbName, schema, table: cleanTableName } = parseNodeId(tableId);
    const dialect: 'mysql' | 'postgres' = activeConnection?.type === 'mysql' ? 'mysql' : 'postgres';
    const isLargeDataset = tableId === 'large_dataset' || tableId === 'tbl-large';

    // Fetch Metadata
    const { data: metadata, isLoading: isLoadingMeta } = useQuery({
        queryKey: ['metadata', activeConnectionId, tableId],
        queryFn: async () => {
            if (!activeConnection) throw new Error("No active connection");
            const adapter = connectionService.getAdapter(activeConnection.id, activeConnection.type as any);
            return adapter.getMetadata(tableId);
        },
        enabled: !!activeConnectionId
    });

    // Fetch Data (first page, or all for large datasets)
    const { data: queryResult, isLoading: isLoadingData, isFetching: isFetchingData, refetch } = useQuery({
        queryKey: ['data', activeConnectionId, tableId, isLargeDataset],
        queryFn: async () => {
            if (!activeConnection) throw new Error("No active connection");
            const adapter = connectionService.getAdapter(activeConnection.id, activeConnection.type as any);

            if (isLargeDataset) {
                return adapter.executeQuery(
                    `SELECT * FROM ${getQuotedIdentifier(cleanTableName || tableId, dialect)} -- large_dataset`,
                    dbName ? { database: dbName } : undefined
                );
            }

            const qSchema = getQuotedIdentifier(schema, dialect);
            const qTable = getQuotedIdentifier(cleanTableName || tableId, dialect);
            return adapter.executeQuery(
                `SELECT * FROM ${qSchema}.${qTable} LIMIT 1000`,
                dbName ? { database: dbName } : undefined
            );
        },
        enabled: !!activeConnectionId && !!metadata
    });

    const pkField = metadata?.columns?.find(c => c.isPrimaryKey)?.name;

    return {
        metadata,
        queryResult,
        isLoadingMeta,
        isLoadingData,
        isFetchingData,
        refetch,
        dbName,
        schema,
        cleanTableName,
        dialect,
        pkField,
    };
}
