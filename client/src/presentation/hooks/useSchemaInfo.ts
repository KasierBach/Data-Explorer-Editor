import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/core/services/store';
import type { SchemaInfo, SchemaTable } from '@/presentation/components/code-editor/sqlAutocomplete';

/**
 * Hook that gathers table/column metadata from TanStack Query cache
 * to provide SQL autocomplete suggestions.
 * 
 * It scans the cache for:
 * - hierarchy queries → extract table/view names
 * - metadata queries → extract column details
 */
export function useSchemaInfo(): SchemaInfo {
    const queryClient = useQueryClient();
    const { activeConnectionId } = useAppStore();

    return useMemo(() => {
        if (!activeConnectionId) return { tables: [] };

        const tables: SchemaTable[] = [];
        const schemas = new Set<string>();
        const databases = new Set<string>();
        const tableMap = new Map<string, SchemaTable>();

        // Scan ALL cached queries for hierarchy data
        const cache = queryClient.getQueryCache().getAll();

        for (const query of cache) {
            const key = query.queryKey;

            // Match hierarchy queries: ['hierarchy', connectionId, parentId]
            if (key[0] === 'hierarchy' && key[1] === activeConnectionId && query.state.data) {
                const nodes = query.state.data as any[];

                for (const node of nodes) {
                    if (node.type === 'table' || node.type === 'view') {
                        const tableName = node.name;
                        if (!tableMap.has(tableName)) {
                            const entry: SchemaTable = { name: tableName };
                            tableMap.set(tableName, entry);
                        }
                    }

                    if (node.type === 'schema') {
                        schemas.add(node.name);
                    }

                    if (node.type === 'database') {
                        databases.add(node.name);
                    }
                }
            }

            // Match metadata queries: ['metadata', connectionId, tableId]
            if (key[0] === 'metadata' && key[1] === activeConnectionId && query.state.data) {
                const metadata = query.state.data as any;
                const columns = metadata?.columns || [];

                if (columns.length > 0) {
                    // Extract table name from the query key (tableId)
                    const tableId = key[2] as string;
                    // tableId format: "db:xxx.schema:public.table:users" — extract last part
                    const tableMatch = tableId.match(/(?:table:|view:)(\w+)/);
                    const tableName = tableMatch ? tableMatch[1] : tableId;

                    const entry = tableMap.get(tableName) || { name: tableName };
                    entry.columns = columns.map((col: any) => ({
                        name: col.name,
                        type: col.type || 'unknown',
                        isPrimaryKey: col.isPrimaryKey || false,
                    }));
                    tableMap.set(tableName, entry);
                }
            }
        }

        tableMap.forEach(t => tables.push(t));

        return {
            tables,
            schemas: schemas.size > 0 ? [...schemas] : undefined,
            databases: databases.size > 0 ? [...databases] : undefined,
        };
    }, [activeConnectionId, queryClient.getQueryCache().getAll().length]);
}
