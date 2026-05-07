import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    useNodesState,
    useEdgesState,
    addEdge,
    ConnectionLineType,
    type Connection,
    type EdgeChange,
    type Node,
    type Edge,
} from '@xyflow/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAppStore } from '@/core/services/store';
import { connectionService } from '@/core/services/ConnectionService';
import { queryService } from '@/core/services/QueryService';
import { ErdWorkspaceService, type SaveErdWorkspacePayload } from '@/core/services/ErdWorkspaceService';
import { ApiError } from '@/core/services/api.service';
import { MetadataService } from '@/core/services/MetadataService';
import { SearchService, type SearchResult } from '@/core/services/SearchService';
import type { ErdWorkspaceEntity } from '@/core/domain/entities';
import type { ForeignKeyData } from '../ForeignKeyDialog';
import {
    buildWorkspaceLayoutSnapshot,
    normalizeWorkspaceLayout,
    type BackgroundVariant,
    type DetailLevel,
    type EdgeRouting,
} from './workspace-layout';
import { applyAutoLayout } from './erd-auto-layout';

export const useERDLogic = (tabId: string, connectionId: string, databaseProp?: string) => {
    const {
        connections,
        tabs,
        updateTabMetadata,
        pageStates,
        setPageState,
        lang,
        setActiveDatabase,
        setNosqlDatabase,
    } = useAppStore();
    const activeConnection = connections.find((connection) => connection.id === connectionId);
    const queryClient = useQueryClient();

    const isStandalone = tabId.startsWith('erd-page-');
    const tab = tabs.find((entry) => entry.id === tabId);
    const initialMetadata = isStandalone ? (pageStates[tabId] || {}) : (tab?.metadata || {});
    const initialLayout = normalizeWorkspaceLayout(initialMetadata);

    const [selectedDatabase, setLocalSelectedDatabase] = useState<string | undefined>(databaseProp);
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initialLayout.nodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialLayout.edges);
    const [visibleTableNames, setVisibleTableNames] = useState<Set<string>>(new Set(initialLayout.visibleTables));
    const [searchTerm, setSearchTerm] = useState('');
    const [pendingConnection, setPendingConnection] = useState<{
        sourceTable: string;
        sourceColumn: string;
        targetTable: string;
        targetColumn: string;
    } | null>(null);
    const [isSidebarCollapsed, setSidebarCollapsed] = useState(initialLayout.isSidebarCollapsed);
    const [detailLevel, setDetailLevel] = useState<DetailLevel>(initialLayout.detailLevel);
    const [schemaFilter, setSchemaFilter] = useState<string>(initialLayout.schemaFilter);
    const [showMinimap, setShowMinimap] = useState(initialLayout.showMinimap);
    const [collapsedTables, setCollapsedTables] = useState<Set<string>>(new Set(initialLayout.collapsedTables));
    const [performanceMode, setPerformanceMode] = useState<boolean>(initialLayout.performanceMode);
    const [edgeRouting, setEdgeRouting] = useState<EdgeRouting>(initialLayout.edgeRouting);
    const [backgroundVariant, setBackgroundVariant] = useState<BackgroundVariant>(initialLayout.backgroundVariant);
    const [isEdgeAnimated, setIsEdgeAnimated] = useState<boolean>(initialLayout.isEdgeAnimated);
    const [isToolbarCollapsed, setIsToolbarCollapsed] = useState<boolean>(initialLayout.isToolbarCollapsed);
    const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(initialMetadata.currentWorkspaceId || null);
    const [currentWorkspaceName, setCurrentWorkspaceName] = useState<string | null>(initialMetadata.currentWorkspaceName || null);
    const [currentWorkspaceNotes, setCurrentWorkspaceNotes] = useState<string>(initialMetadata.currentWorkspaceNotes || '');
    const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
    const [isOpenWorkspaceDialogOpen, setIsOpenWorkspaceDialogOpen] = useState(false);
    const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
    const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number } | null>(null);
    const [globalSearchResults, setGlobalSearchResults] = useState<SearchResult[]>([]);
    const [isSearchingGlobal, setIsSearchingGlobal] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const isFirstLoad = useRef(true);
    const hasShownWorkspaceWarning = useRef(false);

    const handleSetSelectedDatabase = useCallback((value: string | undefined) => {
        setLocalSelectedDatabase(value);
        if (value && activeConnection) {
            const isNoSql = activeConnection.type.toLowerCase().includes('mongo');
            if (isNoSql) {
                setNosqlDatabase(value);
            } else {
                setActiveDatabase(value);
            }
        }
    }, [activeConnection, setActiveDatabase, setNosqlDatabase]);

    const buildWorkspaceLayout = useCallback(() => buildWorkspaceLayoutSnapshot({
        visibleTables: visibleTableNames,
        nodes,
        edges,
        isSidebarCollapsed,
        detailLevel,
        schemaFilter,
        showMinimap,
        performanceMode,
        edgeRouting,
        backgroundVariant,
        isEdgeAnimated,
        isToolbarCollapsed,
        collapsedTables,
    }), [
        visibleTableNames,
        nodes,
        edges,
        isSidebarCollapsed,
        detailLevel,
        schemaFilter,
        showMinimap,
        performanceMode,
        edgeRouting,
        backgroundVariant,
        isEdgeAnimated,
        isToolbarCollapsed,
        collapsedTables,
    ]);

    const applyWorkspaceLayout = useCallback((layout?: Record<string, any> | null) => {
        const normalized = normalizeWorkspaceLayout(layout);
        setVisibleTableNames(new Set(normalized.visibleTables));
        setNodes(normalized.nodes);
        setEdges(normalized.edges);
        setSidebarCollapsed(normalized.isSidebarCollapsed);
        setDetailLevel(normalized.detailLevel);
        setSchemaFilter(normalized.schemaFilter);
        setShowMinimap(normalized.showMinimap);
        setPerformanceMode(normalized.performanceMode);
        setEdgeRouting(normalized.edgeRouting);
        setBackgroundVariant(normalized.backgroundVariant);
        setIsEdgeAnimated(normalized.isEdgeAnimated);
        setIsToolbarCollapsed(normalized.isToolbarCollapsed);
        setCollapsedTables(new Set(normalized.collapsedTables));
    }, [setEdges, setNodes]);

    useEffect(() => {
        if (databaseProp) {
            handleSetSelectedDatabase(databaseProp);
        }
    }, [databaseProp, handleSetSelectedDatabase]);

    useEffect(() => {
        if (!connectionId) return;
        const connection = connections.find((entry) => entry.id === connectionId);
        if (connection) {
            connectionService.setActiveConnection(connection);
        }
    }, [connectionId, connections]);

    const handleWorkspaceListError = useCallback((error: unknown) => {
        console.error('[ERD] Failed to load saved workspaces', error);

        if (hasShownWorkspaceWarning.current) return;
        hasShownWorkspaceWarning.current = true;

        const isStorageUnavailable =
            error instanceof ApiError &&
            (error.reason === 'ERD_WORKSPACE_STORAGE_UNAVAILABLE' || error.statusCode === 503);

        toast.error(
            isStorageUnavailable
                ? (lang === 'vi' ? 'Kho workspace ERD chÆ°a sáºµn sÃ ng' : 'ERD workspace storage is not ready yet')
                : (lang === 'vi' ? 'KhÃ´ng thá»ƒ táº£i danh sÃ¡ch workspace ERD' : 'Failed to load ERD workspaces'),
            {
                description: isStorageUnavailable
                    ? (lang === 'vi'
                        ? 'Trang ERD váº«n dÃ¹ng Ä‘Æ°á»£c, nhÆ°ng báº¡n cáº§n sync schema backend Ä‘á»ƒ lÆ°u workspace.'
                        : 'The ERD page still works, but the backend schema must be synced before workspaces can be saved.')
                    : (error instanceof Error ? error.message : undefined),
            },
        );
    }, [lang]);

    const { data: erdWorkspaces = [], isLoading: isLoadingWorkspaces } = useQuery({
        queryKey: ['erd-workspaces', connectionId],
        queryFn: async () => {
            try {
                return await ErdWorkspaceService.getWorkspaces(connectionId);
            } catch (error) {
                handleWorkspaceListError(error);
                return [];
            }
        },
        enabled: !!connectionId,
        staleTime: 60_000,
        retry: false,
    });

    const { data: hierarchy, isLoading: isLoadingHierarchy } = useQuery({
        queryKey: ['erd-hierarchy-v2', connectionId, selectedDatabase, !!activeConnection],
        queryFn: async () => {
            if (!connectionId || !activeConnection) return [];
            const adapter = connectionService.getAdapter(connectionId, activeConnection.type as any);
            const results: any[] = [];

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
            const adapter = connectionService.getAdapter(connectionId, activeConnection.type as any);
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
            const adapter = connectionService.getAdapter(connectionId, activeConnection.type as any);
            const dbs = await adapter.getDatabases();
            return dbs.map(db => ({ id: `db:${db}`, name: db, type: 'database' }));
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
            const adapter = connectionService.getAdapter(connectionId, activeConnection.type as any);
            const results: Record<string, any> = {};
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

    const filteredHierarchy = useMemo(() => {
        if (!hierarchy || !Array.isArray(hierarchy)) return [];
        
        let filtered = [...hierarchy];

        // 1. Schema Filter
        if (schemaFilter && schemaFilter !== 'all') {
            const schemaPrefix = `schema:${schemaFilter}`;
            filtered = filtered.filter((entry) => 
                entry.id?.includes(schemaPrefix) || 
                entry.schema === schemaFilter
            );
        }

        // 2. Text Search Term
        const term = searchTerm?.trim()?.toLowerCase();
        if (term) {
            filtered = filtered.filter((entry) => {
                const name = (entry.name || '').toLowerCase();
                return name.includes(term);
            });
        }

        return filtered;
    }, [hierarchy, schemaFilter, searchTerm]);

    useEffect(() => {
        const handler = setTimeout(async () => {
            if (!searchTerm || searchTerm.length < 2) {
                setGlobalSearchResults([]);
                return;
            }

            setIsSearchingGlobal(true);
            try {
                const results = await SearchService.search(searchTerm);
                // Filter out results that are already in the local hierarchy to avoid duplicates
                const localNames = new Set(hierarchy?.map((h: any) => h.name.toLowerCase()) || []);
                const globalOnly = results.filter((r: SearchResult) => !localNames.has(r.name.toLowerCase()));
                setGlobalSearchResults(globalOnly);
            } catch (error) {
                console.error('[ERD] Global search failed', error);
            } finally {
                setIsSearchingGlobal(false);
            }
        }, 300);

        return () => clearTimeout(handler);
    }, [searchTerm, hierarchy]);

    const fkConstraintMap = useMemo(() => {
        const map = new Map<string, string>();
        if (!relationships) return map;

        relationships.forEach((relationship: any) => {
            if (!relationship.constraint_name) return;
            const sourceTable = relationship.source_table?.split('.').pop() || relationship.source_table;
            map.set(`${sourceTable}.${relationship.source_column}`, relationship.constraint_name);
        });

        return map;
    }, [relationships]);

    const saveWorkspace = useCallback(async (values: { name: string; notes: string }) => {
        if (!connectionId) {
            throw new Error(lang === 'vi' ? 'Chưa có connection để lưu workspace.' : 'No connection selected for this workspace.');
        }

        const payload: Partial<SaveErdWorkspacePayload> = {
            name: values.name,
            notes: values.notes,
            connectionId,
            database: selectedDatabase,
            layout: buildWorkspaceLayout(),
        };

        const workspace = currentWorkspaceId
            ? await ErdWorkspaceService.updateWorkspace(currentWorkspaceId, payload)
            : await ErdWorkspaceService.createWorkspace(payload as SaveErdWorkspacePayload);

        setCurrentWorkspaceId(workspace.id);
        setCurrentWorkspaceName(workspace.name);
        setCurrentWorkspaceNotes(workspace.notes || '');

        await queryClient.invalidateQueries({ queryKey: ['erd-workspaces', connectionId] });
        toast.success(lang === 'vi' ? 'Đã lưu workspace ERD' : 'ERD workspace saved');
    }, [buildWorkspaceLayout, connectionId, currentWorkspaceId, lang, queryClient, selectedDatabase]);

    const loadWorkspace = useCallback(async (workspace: ErdWorkspaceEntity) => {
        if (workspace.database !== selectedDatabase) {
            handleSetSelectedDatabase(workspace.database || undefined);
        }

        setSearchTerm('');
        applyWorkspaceLayout(workspace.layout);
        setCurrentWorkspaceId(workspace.id);
        setCurrentWorkspaceName(workspace.name);
        setCurrentWorkspaceNotes(workspace.notes || '');
        toast.success(lang === 'vi' ? 'Đã mở workspace ERD' : 'ERD workspace loaded');
    }, [applyWorkspaceLayout, handleSetSelectedDatabase, lang, selectedDatabase]);

    const deleteWorkspace = useCallback(async (workspace: ErdWorkspaceEntity) => {
        await ErdWorkspaceService.deleteWorkspace(workspace.id);
        if (workspace.id === currentWorkspaceId) {
            setCurrentWorkspaceId(null);
            setCurrentWorkspaceName(null);
            setCurrentWorkspaceNotes('');
        }
        await queryClient.invalidateQueries({ queryKey: ['erd-workspaces', connectionId] });
        toast.success(lang === 'vi' ? 'Đã xóa workspace ERD' : 'ERD workspace deleted');
    }, [connectionId, currentWorkspaceId, lang, queryClient]);

    const handleRefreshMetadata = useCallback(async () => {
        if (!connectionId) return;
        setIsRefreshing(true);
        try {
            await MetadataService.refresh(connectionId, selectedDatabase);
            toast.success(lang === 'vi' ? 'Đã làm mới metadata' : 'Metadata refreshed');
            await queryClient.invalidateQueries({ queryKey: ['erd-hierarchy-v2'] });
            await queryClient.invalidateQueries({ queryKey: ['erd-databases'] });
            await queryClient.invalidateQueries({ queryKey: ['erd-rels'] });
        } catch (error: any) {
            toast.error(lang === 'vi' ? 'Không thể làm mới metadata' : 'Failed to refresh metadata', {
                description: error.message
            });
        } finally {
            setIsRefreshing(false);
        }
    }, [connectionId, queryClient, selectedDatabase, lang]);

    const handleRemoveConstraint = useCallback(async (tableName: string, type: 'pk' | 'fk', constraintName: string) => {
        const confirmed = window.confirm(
            lang === 'vi'
                ? `Bạn có chắc muốn xóa ${type.toUpperCase()} (${constraintName}) này không?`
                : `Are you sure you want to remove this ${type.toUpperCase()} (${constraintName})?`,
        );
        if (!confirmed) return;

        try {
            await queryService.updateSchema({
                connectionId,
                database: selectedDatabase,
                table: tableName,
                operations: [{ type: type === 'pk' ? 'drop_pk' : 'drop_fk', name: constraintName, constraintName }],
            });
            toast.success(lang === 'vi' ? `${type.toUpperCase()} đã được xóa thành công` : `${type.toUpperCase()} removed successfully`);
            queryClient.invalidateQueries({ queryKey: ['erd-rels'] });
            queryClient.invalidateQueries({ queryKey: ['erd-columns-v2'] });
        } catch (error: any) {
            toast.error(lang === 'vi' ? `Không thể xóa ${type.toUpperCase()}` : `Failed to remove ${type.toUpperCase()}`, {
                description: error.message,
            });
        }
    }, [connectionId, lang, queryClient, selectedDatabase]);

    const handleEdgeMouseEnter = useCallback((event: React.MouseEvent, edge: Edge) => {
        setHoveredEdgeId(edge.id);
        setHoverPosition({ x: event.clientX, y: event.clientY });
    }, []);

    const handleEdgeMouseLeave = useCallback(() => {
        setHoveredEdgeId(null);
        setHoverPosition(null);
    }, []);

    const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
        const removals = changes.filter((change) => change.type === 'remove');
        const others = changes.filter((change) => change.type !== 'remove');

        if (others.length > 0) {
            onEdgesChange(others);
        }

        removals.forEach(async (change) => {
            if (change.type !== 'remove') return;
            const edge = edges.find((entry) => entry.id === change.id);
            if (!edge || !edge.id.startsWith('db-e-')) {
                onEdgesChange([change]);
                return;
            }

            const constraintName = fkConstraintMap.get(`${edge.target}.${edge.targetHandle}`);
            if (!constraintName) {
                onEdgesChange([change]);
                return;
            }

            const confirmed = window.confirm(
                lang === 'vi'
                    ? `Bạn có chắc muốn xóa ràng buộc khóa ngoại (${constraintName}) này không?`
                    : `Are you sure you want to drop the foreign key constraint (${constraintName})?`,
            );
            if (!confirmed) return;

            try {
                await queryService.updateSchema({
                    connectionId,
                    database: selectedDatabase,
                    table: edge.target as string,
                    operations: [{ type: 'drop_fk', name: constraintName, constraintName }],
                });
                toast.success(lang === 'vi' ? 'Đã xóa liên kết thành công' : 'Relationship removed successfully');
                queryClient.invalidateQueries({ queryKey: ['erd-rels'] });
                queryClient.invalidateQueries({ queryKey: ['erd-columns-v2'] });
                onEdgesChange([change]);
            } catch (error: any) {
                toast.error(lang === 'vi' ? 'Không thể xóa liên kết' : 'Failed to remove relationship', {
                    description: error.message,
                });
            }
        });
    }, [connectionId, edges, fkConstraintMap, lang, onEdgesChange, queryClient, selectedDatabase]);

    const onConnect = useCallback((params: Connection) => {
        if (params.source === params.target) return;
        setPendingConnection({
            sourceTable: params.source as string,
            sourceColumn: params.sourceHandle!,
            targetTable: params.target as string,
            targetColumn: params.targetHandle!,
        });
    }, []);

    const handleCreateForeignKey = async (data: ForeignKeyData) => {
        try {
            if (!connectionId || !selectedDatabase) return;
            await queryService.updateSchema({
                connectionId,
                database: selectedDatabase,
                table: data.sourceTable,
                operations: [{
                    type: 'add_fk',
                    name: data.constraintName,
                    columns: [data.sourceColumn],
                    refTable: data.targetTable,
                    refColumns: [data.targetColumn],
                    onDelete: data.onDelete,
                    onUpdate: data.onUpdate,
                }],
            });

            toast.success(lang === 'vi' ? 'Đã tạo liên kết' : 'Relationship created');
            setEdges((currentEdges) => addEdge({
                source: data.sourceTable,
                target: data.targetTable,
                sourceHandle: data.sourceColumn,
                targetHandle: data.targetColumn,
                animated: true,
                type: ConnectionLineType.SmoothStep,
                style: { stroke: 'hsl(var(--primary))', strokeWidth: 2, strokeDasharray: '5,5' },
            }, currentEdges));

            queryClient.invalidateQueries({ queryKey: ['erd-rels'] });
            queryClient.invalidateQueries({ queryKey: ['erd-columns-v2'] });
        } catch (error: any) {
            toast.error(lang === 'vi' ? 'Không thể tạo liên kết' : 'Failed to create relationship', {
                description: error.message,
            });
        }
    };

    const handleAutoLayout = useCallback((direction: 'TB' | 'LR' = 'LR') => {
        setNodes(applyAutoLayout(nodes, edges, direction));
    }, [edges, nodes, setNodes]);

    const toggleTable = (name: string) => {
        setVisibleTableNames((current) => {
            const next = new Set(current);
            if (next.has(name)) {
                next.delete(name);
            } else {
                next.add(name);
            }
            return next;
        });
    };

    const handleSelectAll = useCallback(() => {
        setVisibleTableNames((current) => {
            const next = new Set(current);
            filteredHierarchy.forEach((entry) => next.add(entry.name));
            return next;
        });
    }, [filteredHierarchy]);

    const handleDeselectAll = useCallback(() => {
        setVisibleTableNames(new Set());
    }, []);

    const handleToggleCollapse = (name: string) => {
        setCollapsedTables((current) => {
            const next = new Set(current);
            if (next.has(name)) {
                next.delete(name);
            } else {
                next.add(name);
            }
            return next;
        });
    };

    useEffect(() => {
        if (visibleTableNames.size > 0) {
            if (!hierarchy || !tableData || !relationships) return;
            const allTablesReady = Array.from(visibleTableNames).every((name) => name in (tableData || {}));
            if (!allTablesReady) return;
        }

        const dbEdges: Edge[] = (relationships || [])
            .map((relationship: any, index: number) => {
                const targetTable = relationship.target_table?.split('.').pop() || relationship.target_table;
                const sourceTable = relationship.source_table?.split('.').pop() || relationship.source_table;

                return {
                    id: `db-e-${index}`,
                    source: targetTable,
                    target: sourceTable,
                    sourceHandle: relationship.target_column,
                    targetHandle: relationship.source_column,
                    data: { isVirtual: relationship.constraint_name?.startsWith('vfk_') },
                    type: 'smoothstep',
                    animated: isEdgeAnimated,
                    pathOptions: { borderRadius: 40 },
                    style: {
                        stroke: 'hsl(var(--primary))',
                        strokeWidth: performanceMode ? 1.5 : 2,
                        opacity: performanceMode ? 0.3 : 0.8,
                        transition: 'all 0.2s ease-in-out',
                    },
                    zIndex: 1,
                };
            })
            .filter((edge) => visibleTableNames.has(edge.source as string) && visibleTableNames.has(edge.target as string));

        setNodes((currentNodes) => (
            Array.from(visibleTableNames)
                .map((name) => {
                    const metadata = (tableData || {})[name] || { columns: [] };
                    const columns = metadata.columns || [];
                    const isCollapsed = collapsedTables.has(name);

                    let filteredColumns = columns;
                    if (detailLevel === 'keys') {
                        filteredColumns = columns.filter((column: any) => (
                            column.isPrimaryKey ||
                            column.isForeignKey ||
                            fkConstraintMap.has(`${name}.${column.name}`)
                        ));
                    } else if (detailLevel === 'name') {
                        filteredColumns = [];
                    }

                    const data = {
                        tableName: name,
                        columns: (isCollapsed ? [] : filteredColumns).map((column: any) => ({
                            ...column,
                            fkConstraintName: fkConstraintMap.get(`${name}.${column.name}`),
                        })),
                        comment: metadata.comment,
                        indices: metadata.indices,
                        rowCount: metadata.rowCount,
                        onRemoveConstraint: handleRemoveConstraint,
                        isCollapsed,
                        onToggleCollapse: () => handleToggleCollapse(name),
                        detailLevel,
                        performanceMode,
                    };

                    const existingNode = currentNodes.find((node) => node.id === name);
                    if (existingNode) {
                        return { ...existingNode, data };
                    }

                    return {
                        id: name,
                        type: 'table',
                        data,
                        position: { x: Math.random() * 400, y: Math.random() * 400 },
                    };
                })
                .filter((node) => visibleTableNames.has(node.id))
        ));

        setEdges((currentEdges) => {
            const manualEdges = currentEdges.filter((edge) => (
                !edge.id.startsWith('db-e-') &&
                visibleTableNames.has(edge.source as string) &&
                visibleTableNames.has(edge.target as string)
            ));

            return [...dbEdges, ...manualEdges];
        });
    }, [
        collapsedTables,
        detailLevel,
        fkConstraintMap,
        handleRemoveConstraint,
        hierarchy,
        isEdgeAnimated,
        performanceMode,
        relationships,
        setEdges,
        setNodes,
        tableData,
        visibleTableNames,
    ]);

    useEffect(() => {
        setEdges((currentEdges) => currentEdges.map((edge) => {
            const isHovered = edge.id === hoveredEdgeId;
            const isVirtual = edge.data?.isVirtual;

            const updatedStyle = {
                ...edge.style,
                strokeWidth: isHovered ? 4 : (performanceMode ? 1.5 : 2),
                opacity: isHovered ? 1 : (performanceMode ? 0.3 : 0.8),
                ...(isVirtual ? { strokeDasharray: isHovered ? '8,8' : '5,5' } : {}),
            };

            const baseEdgeProps = {
                ...edge,
                type: edgeRouting,
                label: '',
                animated: isEdgeAnimated,
                ...(edgeRouting === 'smoothstep' ? { pathOptions: { borderRadius: 40 } } : {}),
            };

            if (isHovered) {
                return {
                    ...baseEdgeProps,
                    labelStyle: { fill: 'hsl(var(--primary))', fontWeight: 'bold', fontSize: '10px' },
                    labelBgStyle: { fill: 'hsl(var(--background))', fillOpacity: 0.8, rx: 4, ry: 4 },
                    style: updatedStyle,
                    zIndex: 20,
                };
            }

            return {
                ...baseEdgeProps,
                style: updatedStyle,
                zIndex: 1,
            };
        }));
    }, [edgeRouting, hoveredEdgeId, isEdgeAnimated, performanceMode, setEdges]);

    const handleExportPNG = useCallback(() => {
        import('html-to-image').then(({ toPng }) => {
            const canvas = document.querySelector('.react-flow') as HTMLElement | null;
            if (!canvas) return;

            toPng(canvas, { backgroundColor: '#0a0a0b', quality: 1, pixelRatio: 2 }).then((dataUrl) => {
                const link = document.createElement('a');
                link.download = `erd-${selectedDatabase || 'diagram'}-${Date.now()}.png`;
                link.href = dataUrl;
                link.click();
                toast.success(lang === 'vi' ? 'Đã xuất PNG' : 'Exported as PNG');
            });
        });
    }, [lang, selectedDatabase]);

    const handleExportSQL = useCallback(() => {
        if (!tableData || visibleTableNames.size === 0) return;

        let sql = '-- Generated by Data Explorer ERD\n\n';
        Array.from(visibleTableNames).forEach((tableName) => {
            const metadata = tableData[tableName];
            if (!metadata) return;

            sql += `CREATE TABLE "${tableName}" (\n`;
            sql += metadata.columns
                .map((column: any) => `    "${column.name}" ${column.type}${column.isPrimaryKey ? ' PRIMARY KEY' : ''}${column.nullable === false ? ' NOT NULL' : ''}`)
                .join(',\n');
            sql += '\n);\n\n';
        });

        const blob = new Blob([sql], { type: 'text/sql' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `erd-${selectedDatabase || 'schema'}-${Date.now()}.sql`;
        link.href = url;
        link.click();
        toast.success(lang === 'vi' ? 'Đã xuất SQL' : 'Exported as SQL');
    }, [lang, selectedDatabase, tableData, visibleTableNames]);

    useEffect(() => {
        if (isFirstLoad.current) {
            isFirstLoad.current = false;
            return;
        }

        const timer = setTimeout(() => {
            const stateToSave = {
                ...buildWorkspaceLayout(),
                currentWorkspaceId,
                currentWorkspaceName,
                currentWorkspaceNotes,
            };

            if (isStandalone) {
                setPageState(tabId, stateToSave);
            } else {
                updateTabMetadata(tabId, stateToSave);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [
        buildWorkspaceLayout,
        currentWorkspaceId,
        currentWorkspaceName,
        currentWorkspaceNotes,
        isStandalone,
        setPageState,
        tabId,
        updateTabMetadata,
    ]);

    const hasDatabases = allDatabases && allDatabases.length > 0;
    const effectiveDatabase = selectedDatabase || (hasDatabases ? undefined : '__schema_only__');

    return {
        state: {
            nodes,
            edges,
            visibleTableNames,
            searchTerm,
            pendingConnection,
            isSidebarCollapsed,
            detailLevel,
            schemaFilter,
            showMinimap,
            collapsedTables,
            selectedDatabase,
            allDatabases,
            hierarchy,
            filteredHierarchy,
            hoverPosition,
            hoveredEdgeId,
            tableData,
            isLoadingHierarchy,
            isLoadingCols,
            lang,
            activeConnection,
            effectiveDatabase,
            performanceMode,
            edgeRouting,
            backgroundVariant,
            isEdgeAnimated,
            isToolbarCollapsed,
            erdWorkspaces,
            isLoadingWorkspaces,
            currentWorkspaceId,
            currentWorkspaceName,
            currentWorkspaceNotes,
            isSaveDialogOpen,
            isOpenWorkspaceDialogOpen,
            globalSearchResults,
            isSearchingGlobal,
            isRefreshing,
        },
        actions: {
            setNodes,
            setEdges,
            onNodesChange,
            onEdgesChange,
            handleEdgesChange,
            onConnect,
            handleCreateForeignKey,
            handleAutoLayout,
            toggleTable,
            handleSelectAll,
            handleDeselectAll,
            handleToggleCollapse,
            setSidebarCollapsed,
            setDetailLevel,
            setSchemaFilter,
            setShowMinimap,
            setSearchTerm,
            handleRefreshMetadata,
            setSelectedDatabase: handleSetSelectedDatabase,
            setPerformanceMode,
            setEdgeRouting,
            setBackgroundVariant,
            setIsEdgeAnimated,
            setIsToolbarCollapsed,
            handleExportPNG,
            handleExportSQL,
            openSaveDialog: () => setIsSaveDialogOpen(true),
            openWorkspaceDialog: () => setIsOpenWorkspaceDialogOpen(true),
            saveWorkspace,
            loadWorkspace,
            deleteWorkspace,
            handleEdgeMouseEnter,
            handleEdgeMouseLeave,
            setPendingConnection,
            setIsSaveDialogOpen,
            setIsOpenWorkspaceDialogOpen,
        },
    };
};
