import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
    useNodesState, 
    useEdgesState, 
    addEdge, 
    ConnectionLineType,
    type Connection, 
    type EdgeChange, 
    type Node, 
    type Edge 
} from '@xyflow/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dagre from 'dagre';
import { toast } from 'sonner';
import { useAppStore } from '@/core/services/store';
import { connectionService } from '@/core/services/ConnectionService';
import { queryService } from '@/core/services/QueryService';
import type { ForeignKeyData } from '../ForeignKeyDialog';

export type DetailLevel = 'all' | 'keys' | 'name';

export const useERDLogic = (tabId: string, connectionId: string, databaseProp?: string) => {
    const { connections, tabs, updateTabMetadata, pageStates, setPageState, lang } = useAppStore();
    const activeConnection = connections.find(c => c.id === connectionId);
    const queryClient = useQueryClient();

    const [selectedDatabase, setSelectedDatabase] = useState<string | undefined>(databaseProp);
    
    const isStandalone = tabId.startsWith('erd-page-');
    const tab = tabs.find(t => t.id === tabId);
    const initialMetadata = isStandalone ? (pageStates[tabId] || {}) : (tab?.metadata || {});

    const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initialMetadata.nodes || []);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialMetadata.edges || []);
    
    const [visibleTableNames, setVisibleTableNames] = useState<Set<string>>(new Set(initialMetadata.visibleTables || []));
    const [searchTerm, setSearchTerm] = useState('');
    const [pendingConnection, setPendingConnection] = useState<{ sourceTable: string; sourceColumn: string; targetTable: string; targetColumn: string } | null>(null);
    const [isSidebarCollapsed, setSidebarCollapsed] = useState(initialMetadata.isSidebarCollapsed || false);
    const [detailLevel, setDetailLevel] = useState<DetailLevel>(initialMetadata.detailLevel || 'all');
    const [schemaFilter, setSchemaFilter] = useState<string>(initialMetadata.schemaFilter || 'all');
    const [showMinimap, setShowMinimap] = useState(initialMetadata.showMinimap ?? true);
    const [collapsedTables, setCollapsedTables] = useState<Set<string>>(new Set(initialMetadata.collapsedTables || []));

    const isFirstLoad = useRef(true);

    // Sync if prop changes externally
    useEffect(() => {
        if (databaseProp) setSelectedDatabase(databaseProp);
    }, [databaseProp]);

    // Data Fetching
    const { data: hierarchy, isLoading: isLoadingHierarchy } = useQuery({
        queryKey: ['erd-hierarchy', connectionId, selectedDatabase],
        queryFn: async () => {
            if (!connectionId) return [];
            const adapter = connectionService.getAdapter(connectionId, activeConnection?.type as any);
            const results: any[] = [];
            const crawl = async (parentId: string | null) => {
                const nodes = await adapter.getHierarchy(parentId);
                for (const node of nodes) {
                    if (node.type === 'table' || node.type === 'view') results.push(node);
                    else if (node.type === 'database') {
                        if (!selectedDatabase || node.name === selectedDatabase || node.id.includes(selectedDatabase)) await crawl(node.id);
                    } else if (node.type === 'schema' || node.type === 'folder') await crawl(node.id);
                }
            };
            await crawl(selectedDatabase ? `db:${selectedDatabase}` : null);
            return results;
        },
        enabled: !!connectionId,
    });

    const { data: relationships } = useQuery({
        queryKey: ['erd-rels', connectionId, selectedDatabase],
        queryFn: async () => {
            if (!connectionId) return [];
            const adapter = connectionService.getAdapter(connectionId, activeConnection?.type as any);
            return adapter.getRelationships(selectedDatabase);
        },
        enabled: !!connectionId,
    });

    const { data: allDatabases } = useQuery({
        queryKey: ['erd-databases', connectionId],
        queryFn: async () => {
            if (!connectionId) return [];
            const adapter = connectionService.getAdapter(connectionId, activeConnection?.type as any);
            const nodes = await adapter.getHierarchy(null);
            return nodes.filter((n: any) => n.type === 'database');
        },
        enabled: !!connectionId,
    });

    const { data: tableData, isLoading: isLoadingCols } = useQuery({
        queryKey: ['erd-columns', connectionId, Array.from(visibleTableNames)],
        queryFn: async () => {
            if (visibleTableNames.size === 0 || !hierarchy) return {};
            const adapter = connectionService.getAdapter(connectionId, activeConnection?.type as any);
            const results: Record<string, any> = {};
            await Promise.all(Array.from(visibleTableNames).map(async (name) => {
                const hNode = hierarchy.find(h => h.name === name);
                if (hNode) {
                    const metadata = await adapter.getMetadata(hNode.id);
                    results[name] = metadata.columns;
                }
            }));
            return results;
        },
        enabled: visibleTableNames.size > 0 && !!hierarchy,
    });

    const fkConstraintMap = useMemo(() => {
        const map = new Map<string, string>();
        if (!relationships) return map;
        relationships.forEach((rel: any) => {
            if (rel.constraint_name) {
                const sourceTable = rel.source_table?.split('.').pop() || rel.source_table;
                map.set(`${sourceTable}.${rel.source_column}`, rel.constraint_name);
            }
        });
        return map;
    }, [relationships]);

    // Handlers
    const handleRemoveConstraint = useCallback(async (tableName: string, type: 'pk' | 'fk', constraintName: string) => {
        const confirmMsg = lang === 'vi' ? `Bạn có chắc muốn xóa ${type.toUpperCase()} (${constraintName}) này không?` : `Are you sure you want to remove this ${type.toUpperCase()} (${constraintName})?`;
        if (!window.confirm(confirmMsg)) return;
        try {
            await queryService.updateSchema({ connectionId, database: selectedDatabase, table: tableName, operations: [{ type: type === 'pk' ? 'drop_pk' : 'drop_fk', name: constraintName, constraintName: constraintName }] });
            toast.success(lang === 'vi' ? `${type.toUpperCase()} đã được xóa thành công` : `${type.toUpperCase()} removed successfully`);
            queryClient.invalidateQueries({ queryKey: ['erd-rels'] });
            queryClient.invalidateQueries({ queryKey: ['erd-columns'] });
        } catch (error: any) {
            toast.error(lang === 'vi' ? `Không thể xóa ${type.toUpperCase()}` : `Failed to remove ${type.toUpperCase()}`, { description: error.message });
        }
    }, [connectionId, selectedDatabase, queryClient, lang]);

    const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
        const removals = changes.filter(c => c.type === 'remove');
        const others = changes.filter(c => c.type !== 'remove');
        if (others.length > 0) onEdgesChange(others);
        removals.forEach(async (change) => {
            if (change.type !== 'remove') return;
            const edge = edges.find(e => e.id === change.id);
            if (!edge || !edge.id.startsWith('db-e-')) {
                onEdgesChange([change]);
                return;
            }
            const constraintName = fkConstraintMap.get(`${edge.target}.${edge.targetHandle}`);
            if (!constraintName) {
                onEdgesChange([change]);
                return;
            }
            if (window.confirm(lang === 'vi' ? `Bạn có chắc muốn xóa ràng buộc khóa ngoại (${constraintName}) này không?` : `Are you sure you want to drop the foreign key constraint (${constraintName})?`)) {
                try {
                    await queryService.updateSchema({ connectionId, database: selectedDatabase, table: edge.target, operations: [{ type: 'drop_fk', name: constraintName, constraintName: constraintName }] });
                    toast.success(lang === 'vi' ? "Đã xóa liên kết thành công" : "Relationship removed successfully");
                    queryClient.invalidateQueries({ queryKey: ['erd-rels'] });
                    queryClient.invalidateQueries({ queryKey: ['erd-columns'] });
                    onEdgesChange([change]);
                } catch (error: any) {
                    toast.error(lang === 'vi' ? "Không thể xóa liên kết" : "Failed to remove relationship", { description: error.message });
                }
            }
        });
    }, [edges, onEdgesChange, fkConstraintMap, connectionId, selectedDatabase, queryClient, lang]);

    const onConnect = useCallback((params: Connection) => {
        if (params.source === params.target) return;
        setPendingConnection({ 
            sourceTable: params.source as string, 
            sourceColumn: params.sourceHandle!, 
            targetTable: params.target as string, 
            targetColumn: params.targetHandle! 
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
                    onUpdate: data.onUpdate 
                }] 
            });
            toast.success(lang === 'vi' ? "Đã tạo liên kết" : "Relationship Created");
            
            setEdges((eds) => addEdge({
                source: data.sourceTable,
                target: data.targetTable,
                sourceHandle: data.sourceColumn,
                targetHandle: data.targetColumn,
                animated: true,
                type: ConnectionLineType.SmoothStep,
                style: { stroke: 'hsl(var(--primary))', strokeWidth: 2, strokeDasharray: '5,5' }
            }, eds));

            queryClient.invalidateQueries({ queryKey: ['erd-rels'] });
            queryClient.invalidateQueries({ queryKey: ['erd-columns'] });
        } catch (error: any) {
            toast.error(lang === 'vi' ? "Không thể tạo liên kết" : "Failed to create relationship", { description: error.message });
        }
    };

    const handleAutoLayout = useCallback(() => {
        const dagreGraph = new dagre.graphlib.Graph();
        dagreGraph.setDefaultEdgeLabel(() => ({}));
        dagreGraph.setGraph({ rankdir: 'LR', nodesep: 100, ranksep: 200 });
        
        const connectedNodeIds = new Set<string>();
        edges.forEach(e => { connectedNodeIds.add(e.source); connectedNodeIds.add(e.target); });
        
        const connectedNodes = nodes.filter(n => connectedNodeIds.has(n.id));
        const standaloneNodes = nodes.filter(n => !connectedNodeIds.has(n.id));
        
        connectedNodes.forEach((node) => {
            const columnCount = (node.data as any).columns?.length || 5;
            dagreGraph.setNode(node.id, { width: 300, height: 100 + columnCount * 30 });
        });
        
        edges.forEach((edge) => dagreGraph.setEdge(edge.source, edge.target));
        dagre.layout(dagreGraph);
        
        const newNodes = nodes.map((node) => {
            if (connectedNodeIds.has(node.id)) {
                const nodeWithPosition = dagreGraph.node(node.id);
                return { 
                    ...node, 
                    targetPosition: 'left' as any, 
                    sourcePosition: 'right' as any, 
                    position: { x: nodeWithPosition.x - 150, y: nodeWithPosition.y - 50 } 
                };
            }
            const index = standaloneNodes.indexOf(node);
            return { ...node, position: { x: -500, y: index * 400 } };
        });
        
        setNodes([...newNodes]);
    }, [nodes, edges, setNodes]);

    const toggleTable = (name: string) => {
        setVisibleTableNames(prev => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name);
            else next.add(name);
            return next;
        });
    };

    const handleToggleCollapse = (name: string) => {
        setCollapsedTables(prev => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name);
            else next.add(name);
            return next;
        });
    };

    // Schema sync effect
    useEffect(() => {
        if (!hierarchy || !tableData || !relationships) return;

        const dbEdges: Edge[] = relationships.map((rel: any, idx: number) => {
            const targetTable = rel.target_table?.split('.').pop() || rel.target_table;
            const sourceTable = rel.source_table?.split('.').pop() || rel.source_table;

            return {
                id: `db-e-${idx}`,
                source: targetTable,
                target: sourceTable,
                sourceHandle: rel.target_column,
                targetHandle: rel.source_column,
                type: ConnectionLineType.SmoothStep,
                animated: true,
                style: { stroke: 'hsl(var(--primary))', strokeWidth: 2, opacity: 0.5 },
            };
        }).filter((e: Edge) => visibleTableNames.has(e.source as string) && visibleTableNames.has(e.target as string));

        const baseNodes: Node[] = Array.from(visibleTableNames).map((name) => {
            const cols = tableData[name] || [];
            const isCollapsed = collapsedTables.has(name);

            let filteredCols = cols;
            if (detailLevel === 'keys') {
                filteredCols = cols.filter((c: any) => c.isPrimaryKey || c.isForeignKey || fkConstraintMap.has(`${name}.${c.name}`));
            } else if (detailLevel === 'name') {
                filteredCols = [];
            }

            const data = {
                tableName: name,
                columns: (isCollapsed ? [] : filteredCols).map((c: any) => ({
                    ...c,
                    fkConstraintName: fkConstraintMap.get(`${name}.${c.name}`)
                })),
                onRemoveConstraint: handleRemoveConstraint,
                isCollapsed,
                onToggleCollapse: () => handleToggleCollapse(name),
                detailLevel,
            };

            const existing = nodes.find(n => n.id === name);
            if (existing) return { ...existing, data };

            return {
                id: name,
                type: 'table',
                data,
                position: { x: Math.random() * 400, y: Math.random() * 400 },
            };
        });

        const finalNodes = baseNodes.filter(n => visibleTableNames.has(n.id));
        const manualEdges = edges.filter(e => !e.id.startsWith('db-e-') && visibleTableNames.has(e.source as string) && visibleTableNames.has(e.target as string));

        setNodes(finalNodes);
        setEdges([...dbEdges, ...manualEdges]);
    }, [visibleTableNames, tableData, relationships, hierarchy, detailLevel, collapsedTables]);

    // Export logic
    const handleExportPNG = useCallback(() => {
        import('html-to-image').then(({ toPng }) => {
            const el = document.querySelector('.react-flow') as HTMLElement;
            if (!el) return;
            toPng(el, { backgroundColor: '#0a0a0b', quality: 1, pixelRatio: 2 }).then((dataUrl) => {
                const link = document.createElement('a');
                link.download = `erd-${selectedDatabase || 'diagram'}-${Date.now()}.png`;
                link.href = dataUrl;
                link.click();
                toast.success(lang === 'vi' ? 'Đã xuất thành PNG' : 'Exported as PNG');
            });
        });
    }, [selectedDatabase, lang]);

    const handleExportSQL = useCallback(() => {
        if (!tableData || visibleTableNames.size === 0) return;
        let sql = `-- Generated by Data Explorer ERD\n\n`;
        Array.from(visibleTableNames).forEach(tableName => {
            const cols = tableData[tableName];
            if (!cols) return;
            sql += `CREATE TABLE "${tableName}" (\n`;
            sql += cols.map((c: any) => `    "${c.name}" ${c.type}${c.isPrimaryKey ? ' PRIMARY KEY' : ''}${c.nullable === false ? ' NOT NULL' : ''}`).join(',\n');
            sql += `\n);\n\n`;
        });
        const blob = new Blob([sql], { type: 'text/sql' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `erd-${selectedDatabase || 'schema'}-${Date.now()}.sql`;
        link.href = url;
        link.click();
        toast.success(lang === 'vi' ? 'Đã xuất thành SQL' : 'Exported as SQL');
    }, [tableData, visibleTableNames, selectedDatabase, lang]);

    // Persist effect
    useEffect(() => {
        if (isFirstLoad.current) {
            isFirstLoad.current = false;
            return;
        }
        const timer = setTimeout(() => {
            const stateToSave = {
                visibleTables: Array.from(visibleTableNames),
                nodes,
                edges: edges.filter(e => !e.id.startsWith('db-e-')),
                isSidebarCollapsed,
                detailLevel,
                schemaFilter,
                showMinimap,
                collapsedTables: Array.from(collapsedTables)
            };
            if (isStandalone) setPageState(tabId, stateToSave);
            else updateTabMetadata(tabId, stateToSave);
        }, 500);
        return () => clearTimeout(timer);
    }, [nodes, edges, visibleTableNames, isSidebarCollapsed, detailLevel, schemaFilter, showMinimap, collapsedTables, isStandalone, setPageState, tabId, updateTabMetadata]);

    const hasDatabases = allDatabases && allDatabases.length > 0;
    const effectiveDatabase = selectedDatabase || (hasDatabases ? undefined : '__schema_only__');

    return {
        state: { 
            nodes, edges, visibleTableNames, searchTerm, pendingConnection, 
            isSidebarCollapsed, detailLevel, schemaFilter, showMinimap, 
            collapsedTables, selectedDatabase, allDatabases, hierarchy, 
            tableData, isLoadingHierarchy, isLoadingCols, lang, 
            activeConnection, effectiveDatabase 
        },
        actions: { 
            setNodes, setEdges, onNodesChange, onEdgesChange, handleEdgesChange, 
            onConnect, setVisibleTableNames, setSearchTerm, setPendingConnection, 
            setSidebarCollapsed, setDetailLevel, setSchemaFilter, setShowMinimap, 
            setCollapsedTables, setSelectedDatabase, handleRemoveConstraint, 
            handleCreateForeignKey, handleAutoLayout, toggleTable, 
            handleToggleCollapse, handleExportPNG, handleExportSQL 
        }
    };
};
