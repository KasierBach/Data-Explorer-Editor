import { useQuery } from '@tanstack/react-query';
import { connectionService } from '@/core/services/ConnectionService';
import type { Connection } from '@/core/domain/entities';

interface UseErdDataFetchOptions {
    connectionId: string;
    selectedDatabase?: string;
    activeConnection?: Connection;
    visibleTableNames: Set<string>;
    hierarchy?: Array<{ name: string; id: string }>;
}

export function useErdDataFetch({
    connectionId,
    selectedDatabase,
    activeConnection,
    visibleTableNames,
    hierarchy,
}: UseErdDataFetchOptions) {
    const { data: hierarchy, isLoading: isLoadingHierarchy } = useQuery({
        queryKey: ['erd-hierarchy-v2', connectionId, selectedDatabase, !!activeConnection],
        queryFn: async () => {
            if (!connectionId || !activeConnection) return [];
            const adapter = connectionService.getAdapter(connectionId, activeConnection.type as never);
            const results: Array<{ name: string; id: string; type: string }> = [];

            const crawl = async (parentId: string | null) => {
                try {
                    const entries = await adapter.getHierarchy(parentId);
                    for (const entry of entries) {
                        if (entry.type === 'table' || entry.type === 'view' || entry.type === 'collection') {
                            results.push(entry);
                            continue;
                        }
                        if (entry.type === 'database') {
                            if (!selectedDatabase || entry.name === selectedDatabase || entry.id.includes(`db:${selectedDatabase}`)) {
                                await crawl(entry.id);
                            }
                            continue;
                        }
                        if (entry.type === 'schema' || entry.type === 'folder') {
                            await crawl(entry.id);
                        }
                    }
                } catch (error) {
                    console.error(`[ERD] Failed to crawl ${parentId || 'root'}`, error);
                }
            };

            await crawl(selectedDatabase ? `db:${selectedDatabase}` : null);
            return results;
        },
        enabled: !!connectionId && !!activeConnection,
        placeholderData: (prev) => prev,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    const { data: relationships } = useQuery({
        queryKey: ['erd-rels', connectionId, selectedDatabase, !!activeConnection],
        queryFn: async () => {
            if (!connectionId || !activeConnection) return [];
            const adapter = connectionService.getAdapter(connectionId, activeConnection.type as never);
            return adapter.getRelationships(selectedDatabase);
        },
        enabled: !!connectionId && !!hierarchy && hierarchy.length > 0,
        placeholderData: (prev) => prev,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    const { data: allDatabases } = useQuery({
        queryKey: ['erd-databases', connectionId, !!activeConnection],
        queryFn: async () => {
            if (!connectionId || !activeConnection) return [];
            const adapter = connectionService.getAdapter(connectionId, activeConnection.type as never);
            const entries = await adapter.getHierarchy(null);
            return entries.filter((entry: { type: string }) => entry.type === 'database');
        },
        enabled: !!connectionId && !!activeConnection,
        placeholderData: (prev) => prev,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    const { data: tableData, isLoading: isLoadingCols } = useQuery({
        queryKey: ['erd-columns-v2', connectionId, Array.from(visibleTableNames), selectedDatabase],
        queryFn: async () => {
            if (visibleTableNames.size === 0 || !hierarchy || !activeConnection) return {};
            const adapter = connectionService.getAdapter(connectionId, activeConnection.type as never);
            const results: Record<string, unknown> = {};
            const nameToIdMap = new Map<string, string>();

            hierarchy.forEach((item) => nameToIdMap.set(item.name, item.id));

            const tablesArray = Array.from(visibleTableNames);
            const chunkSize = 2;

            for (let index = 0; index < tablesArray.length; index += chunkSize) {
                const chunk = tablesArray.slice(index, index + chunkSize);
                await Promise.all(chunk.map(async (name) => {
                    const nodeId = nameToIdMap.get(name);
                    if (!nodeId) return;
                    try {
                        results[name] = await adapter.getMetadata(nodeId);
                    } catch (error) {
                        console.error(`[ERD] Failed to fetch metadata for ${name}`, error);
                    }
                }));
            }

            return results;
        },
        enabled: !!connectionId && !!activeConnection && !!hierarchy && visibleTableNames.size > 0,
        placeholderData: (prev) => prev,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    return {
        hierarchy,
        relationships,
        allDatabases,
        tableData,
        isLoadingHierarchy,
        isLoadingCols,
    };
}
