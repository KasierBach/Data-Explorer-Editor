import { useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/core/services/store';
import type { TableMetadata, TreeNode } from '@/core/domain/entities';
import type { SchemaInfo, SchemaTable } from '@/presentation/components/code-editor/sqlAutocomplete';

/**
 * Gathers table/column metadata from TanStack Query cache for SQL autocomplete.
 */
export function useSchemaInfo(): SchemaInfo {
    const queryClient = useQueryClient();
    const { activeConnectionId } = useAppStore();

    if (!activeConnectionId) return { tables: [] };

    const tables: SchemaTable[] = [];
    const schemas = new Set<string>();
    const databases = new Set<string>();
    const tableMap = new Map<string, SchemaTable>();
    const cache = queryClient.getQueryCache().getAll();

    for (const query of cache) {
        const key = query.queryKey;

        if (key[0] === 'hierarchy' && key[1] === activeConnectionId && query.state.data) {
            const nodes = query.state.data as TreeNode[];

            for (const node of nodes) {
                if (node.type === 'table' || node.type === 'view') {
                    const tableName = node.name;
                    if (!tableMap.has(tableName)) {
                        tableMap.set(tableName, { name: tableName });
                    }
                }

                if (node.type === 'schema') schemas.add(node.name);
                if (node.type === 'database') databases.add(node.name);
            }
        }

        if (key[0] === 'metadata' && key[1] === activeConnectionId && query.state.data && typeof key[2] === 'string') {
            const metadata = query.state.data as TableMetadata;
            const columns = metadata.columns || [];
            if (columns.length === 0) continue;

            const tableId = key[2];
            const tableMatch = tableId.match(/(?:table:|view:)(\w+)/);
            const tableName = tableMatch ? tableMatch[1] : tableId;
            const entry = tableMap.get(tableName) || { name: tableName };

            entry.columns = columns.map((column) => ({
                name: column.name,
                type: column.type || 'unknown',
                isPrimaryKey: column.isPrimaryKey || false,
            }));
            tableMap.set(tableName, entry);
        }
    }

    tableMap.forEach((table) => tables.push(table));

    return {
        tables,
        schemas: schemas.size > 0 ? [...schemas] : undefined,
        databases: databases.size > 0 ? [...databases] : undefined,
    };
}
