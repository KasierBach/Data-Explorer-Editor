import { useQuery } from '@tanstack/react-query';
import { connectionService } from '../../core/services/ConnectionService';
import { useAppStore } from '../../core/services/store';

// Keys for caching
export const QUERY_KEYS = {
    hierarchy: (connectionId: string, parentId?: string | null) => ['hierarchy', connectionId, parentId],
    tableMetadata: (connectionId: string, tableId: string) => ['metadata', connectionId, tableId],
    query: (connectionId: string, sql: string) => ['query', connectionId, sql],
};

/**
 * Hook to fetch the database hierarchy (Tree Nodes).
 */
export function useDatabaseHierarchy(parentId: string | null) {
    const { activeConnectionId, connections } = useAppStore();
    const activeConnection = connections.find(c => c.id === activeConnectionId);

    return useQuery({
        queryKey: QUERY_KEYS.hierarchy(activeConnectionId || 'none', parentId),
        queryFn: async () => {
            if (!activeConnectionId || !activeConnection) throw new Error("No active connection");

            try {
                const adapter = connectionService.getAdapter(activeConnectionId, activeConnection.type as any);
                // Ensure we are connected. In a real app, connection state should be managed more robustly.
                await adapter.connect(activeConnection);

                return adapter.getHierarchy(parentId);
            } catch (err) {
                console.error("Database Error:", err);
                alert(`Database Error: ${(err as Error).message}`);
                throw err;
            }
        },
        enabled: !!activeConnectionId, // Only run if a connection is selected
    });
}

/**
 * Hook to fetch table metadata.
 */
export function useTableMetadata(tableId: string) {
    const { activeConnectionId, connections } = useAppStore();
    const activeConnection = connections.find(c => c.id === activeConnectionId);

    return useQuery({
        queryKey: QUERY_KEYS.tableMetadata(activeConnectionId || 'none', tableId),
        queryFn: async () => {
            if (!activeConnectionId || !activeConnection) throw new Error("No active connection");
            const adapter = connectionService.getAdapter(activeConnectionId, activeConnection.type as any);
            return adapter.getMetadata(tableId);
        },
        enabled: !!activeConnectionId && !!tableId,
    });
}

/**
 * Hook to execute SQL.
 */
export function useExecuteQuery(sql: string) {
    const { activeConnectionId, connections } = useAppStore();
    const activeConnection = connections.find(c => c.id === activeConnectionId);

    return useQuery({
        queryKey: QUERY_KEYS.query(activeConnectionId || 'none', sql),
        queryFn: async () => {
            if (!activeConnectionId || !activeConnection) throw new Error("No active connection");
            const adapter = connectionService.getAdapter(activeConnectionId, activeConnection.type as any);
            await adapter.connect(activeConnection); // Ensure connection
            return adapter.executeQuery(sql);
        },
        enabled: false, // Manual execution mostly
    });
}
