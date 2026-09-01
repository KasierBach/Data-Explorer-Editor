import { useQuery } from '@tanstack/react-query';
import { connectionService } from '@/core/services/ConnectionService';
import { useAppStore } from '@/core/services/store';
import { parseNodeId } from '@/core/utils/id-parser';
import type { QueryResult, TableMetadata } from '@/core/domain/entities';

interface DataGridDataParams {
    tableId: string;
    tabId: string;
    enabled: boolean;
    includeTotalCount?: boolean;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC' | 'asc' | 'desc';
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
    dialect: 'mysql' | 'postgres' | 'mssql';
    pkField: string | undefined;
}

export function useDataGridData({ tableId, tabId, enabled, includeTotalCount = false, sortBy, sortOrder }: DataGridDataParams): DataGridDataResult {
    const { activeConnectionId, connections, tabs } = useAppStore();
    const activeConnection = connections.find(c => c.id === activeConnectionId);
    const tab = tabs.find(t => t.id === tabId);

    // Pagination state from tab metadata
    const page = tab?.metadata?.page || 1;
    const pageSize = tab?.metadata?.pageSize || 100;
    const offset = (page - 1) * pageSize;

    const { dbName, schema, table: cleanTableName } = parseNodeId(tableId);
    const connType = activeConnection?.type;
    const dialect: 'mysql' | 'postgres' | 'mssql' =
        connType === 'mysql' || connType === 'mariadb'
            ? 'mysql'
            : connType === 'mssql'
                ? 'mssql'
                : 'postgres'; // postgres, cockroach, sqlite, clickhouse
    const resolvedTableName = cleanTableName || tableId;

    // Fetch Metadata with long-term cache (5 minutes)
    const {
        data: metadata,
        isLoading: isLoadingMeta,
        refetch: refetchMetadata,
    } = useQuery({
        queryKey: ['metadata', activeConnectionId, tableId],
        queryFn: async () => {
            if (!activeConnection) throw new Error("No active connection");
            const adapter = connectionService.getAdapter(activeConnection.id, activeConnection.type);
            return adapter.getMetadata(tableId);
        },
        enabled: enabled && !!activeConnectionId,
        staleTime: Infinity, // Metadata doesn't change unless schema changes
        refetchOnWindowFocus: false,
    });

    // Fetch Data with smart cache (30 seconds)
    const {
        data: queryResult,
        isLoading: isLoadingData,
        isFetching: isFetchingData,
        refetch: refetchData,
    } = useQuery({
        queryKey: ['data', activeConnectionId, tableId, page, pageSize, includeTotalCount, sortBy, sortOrder],
        queryFn: async () => {
            if (!activeConnection) throw new Error("No active connection");
            if (!resolvedTableName) throw new Error("No table selected");
            const adapter = connectionService.getAdapter(activeConnection.id, activeConnection.type);

            return adapter.fetchTableWindow({
                database: dbName,
                schema,
                table: resolvedTableName,
                includeTotalCount,
                limit: pageSize,
                offset,
                sortBy,
                sortOrder,
            });
        },
        enabled: enabled && !!activeConnectionId && !!metadata,
        staleTime: 60 * 1000, // Keep data fresh for 1 minute
        gcTime: 15 * 60 * 1000,
        refetchOnWindowFocus: false, // CRITICAL: Stop the flickering/delay on refocus
    });

    const pkField = metadata?.columns?.find(c => c.isPrimaryKey)?.name;
    const refetch = () => {
        void refetchMetadata();
        void refetchData();
    };

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
