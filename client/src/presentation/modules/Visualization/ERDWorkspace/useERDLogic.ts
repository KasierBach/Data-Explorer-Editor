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
    const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
    const [hoverPosition, setHoverPosition] = useState<{ x: number, y: number } | null>(null);

    const isFirstLoad = useRef(true);

    // Sync if prop changes externally
    useEffect(() => {
        if (databaseProp) setSelectedDatabase(databaseProp);
    }, [databaseProp]);

    // Explicitly sync adapter when connectionId changes
    useEffect(() => {
        if (!connectionId) return;
        
        const conn = connections.find(c => c.id === connectionId);
        if (conn) {
            console.log(`[ERDWorkspace] Setting active connection: ${conn.name}`);
            connectionService.setActiveConnection(conn);
        }
    }, [connectionId, connections]);

    // Data Fetching
    const { data: hierarchy, isLoading: isLoadingHierarchy } = useQuery({
        queryKey: ['erd-hierarchy', connectionId, selectedDatabase, !!activeConnection],
        queryFn: async () => {
            console.log(`[ERD crawl] Start crawl for connection: ${connectionId}, activeConn ready? ${!!activeConnection}`);
            if (!connectionId || !activeConnection) return [];
            
            const adapter = connectionService.getAdapter(connectionId, activeConnection.type as any);
            const results: any[] = [];
            
            const crawl = async (parentId: string | null) => {
                try {
                    console.log(`[ERD crawl] Fetching ${parentId || 'ROOT'}`);
                    const nodes = await adapter.getHierarchy(parentId);
                    for (const node of nodes) {
                        if (node.type === 'table' || node.type === 'view') {
                            results.push(node);
                        } else if (node.type === 'database') {
                            // If searching whole connection, or specific DB matches
                            if (!selectedDatabase || node.name === selectedDatabase || node.id.includes(`db:${selectedDatabase}`)) {
                                await crawl(node.id);
                            }
                        } else if (node.type === 'schema' || node.type === 'folder') {
                            await crawl(node.id);
                        }
                    }
                } catch (err) {
                    console.error(`[ERD crawl] Error at ${parentId}:`, err);
                }
            };

            await crawl(selectedDatabase ? `db:${selectedDatabase}` : null);
            console.log(`[ERD crawl] Finished. Found ${results.length} entities.`);
            return results;
        },
        enabled: !!connectionId && !!activeConnection,
    });

    const { data: relationships } = useQuery({
        queryKey: ['erd-rels', connectionId, selectedDatabase, !!activeConnection],
        queryFn: async () => {
            if (!connectionId || !activeConnection) return [];
            const adapter = connectionService.getAdapter(connectionId, activeConnection.type as any);
            console.log(`[useERDLogic] Fetching relationships for ${selectedDatabase}`);
            return adapter.getRelationships(selectedDatabase);
        },
        enabled: !!connectionId,
    });

    const { data: allDatabases } = useQuery({
        queryKey: ['erd-databases', connectionId, !!activeConnection],
        queryFn: async () => {
            if (!connectionId || !activeConnection) return [];
            const adapter = connectionService.getAdapter(connectionId, activeConnection.type as any);
            console.log(`[useERDLogic] Fetching database list`);
            const nodes = await adapter.getHierarchy(null);
            return nodes.filter((n: any) => n.type === 'database');
        },
        enabled: !!connectionId,
    });

    const { data: tableData, isLoading: isLoadingCols } = useQuery({
        queryKey: ['erd-columns', connectionId, Array.from(visibleTableNames), selectedDatabase],
        queryFn: async () => {
            if (visibleTableNames.size === 0 || !hierarchy || !activeConnection) return {};
            const adapter = connectionService.getAdapter(connectionId, activeConnection.type as any);
            const results: Record<string, any> = {};
            
            // Map names to full hierarchy IDs for metadata fetching
            const nameToIdMap = new Map<string, string>();
            hierarchy.forEach(h => nameToIdMap.set(h.name, h.id));

            await Promise.all(Array.from(visibleTableNames).map(async (name) => {
                const nodeId = nameToIdMap.get(name);
                if (nodeId) {
                    try {
                        const metadata = await adapter.getMetadata(nodeId);
                        results[name] = metadata;
                    } catch (e) {
                        console.error(`[ERDCols] Failed to fetch metadata for ${name} (${nodeId})`, e);
                    }
                } else {
                    console.warn(`[ERDCols] No hierarchy node found for visible table: ${name}`);
                }
            }));
            return results;
        },
        enabled: !!connectionId && !!activeConnection && !!hierarchy && visibleTableNames.size > 0,
    });

    const filteredHierarchy = useMemo(() => {
        if (!hierarchy) return [];
        let filtered = hierarchy;
        if (schemaFilter !== 'all') {
            filtered = filtered.filter(h => h.id?.includes(`schema:${schemaFilter}`));
        }
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(h => h.name.toLowerCase().includes(term));
        }
        return filtered;
    }, [hierarchy, schemaFilter, searchTerm]);

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

    const handleEdgeMouseEnter = useCallback((event: React.MouseEvent, edge: Edge) => {
        setHoveredEdgeId(edge.id);
        setHoverPosition({ x: event.clientX, y: event.clientY });
    }, []);

    const handleEdgeMouseLeave = useCallback(() => {
        setHoveredEdgeId(null);
        setHoverPosition(null);
    }, []);

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

    const handleAutoLayout = useCallback((direction: 'TB' | 'LR' = 'LR') => {
        const dagreGraph = new dagre.graphlib.Graph();
        dagreGraph.setDefaultEdgeLabel(() => ({}));
        
        // Adjust spacing based on direction and graph size
        const nodesep = direction === 'LR' ? 100 : 150;
        const ranksep = direction === 'LR' ? 200 : 150;
        
        dagreGraph.setGraph({ 
            rankdir: direction, 
            nodesep, 
            ranksep,
            align: 'DL', 
            ranker: 'tight-tree'
        });
        
        const connectedNodeIds = new Set<string>();
        edges.forEach(e => { connectedNodeIds.add(e.source); connectedNodeIds.add(e.target); });
        
        const connectedNodes = nodes.filter(n => connectedNodeIds.has(n.id));
        const standaloneNodes = nodes.filter(n => !connectedNodeIds.has(n.id));
        
        connectedNodes.forEach((node) => {
            const tableData = node.data as any;
            const columnCount = tableData.columns?.length || 0;
            const isCollapsed = tableData.isCollapsed;
            
            // Width: Header is roughly 300px
            // Height: Header is ~40px, each column row is ~30px
            const width = 300; 
            const height = isCollapsed ? 60 : 70 + (columnCount * 30);
            
            dagreGraph.setNode(node.id, { width, height });
        });
        
        edges.forEach((edge) => dagreGraph.setEdge(edge.source, edge.target));
        dagre.layout(dagreGraph);
        
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        
        const newNodes = nodes.map((node) => {
            if (connectedNodeIds.has(node.id)) {
                const nodeWithPosition = dagreGraph.node(node.id);
                // Dagre uses center point, React Flow uses top-left
                const x = nodeWithPosition.x - 150; 
                const y = nodeWithPosition.y - 25; 
                
                minX = Math.min(minX, x);
                maxX = Math.max(maxX, x + 300);
                minY = Math.min(minY, y);
                maxY = Math.max(maxY, y + 100);
                
                return { 
                    ...node, 
                    targetPosition: direction === 'LR' ? 'left' : 'top' as any, 
                    sourcePosition: direction === 'LR' ? 'right' : 'bottom' as any, 
                    position: { x, y } 
                };
            }
            return node;
        });

        if (standaloneNodes.length > 0) {
            const startX = direction === 'LR' ? (maxX === -Infinity ? 0 : maxX + 200) : (minX === Infinity ? 0 : minX);
            const startY = direction === 'LR' ? (minY === Infinity ? 0 : minY) : (maxY === -Infinity ? 0 : maxY + 200);
            
            const cols = direction === 'LR' ? 3 : 5;
            
            standaloneNodes.forEach((node, index) => {
                const row = Math.floor(index / cols);
                const col = index % cols;
                const nodeIdx = newNodes.findIndex(n => n.id === node.id);
                if (nodeIdx !== -1) {
                    newNodes[nodeIdx] = {
                        ...newNodes[nodeIdx],
                        position: {
                            x: startX + (col * 350),
                            y: startY + (row * 150)
                        }
                    };
                }
            });
        }
        
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

    const handleSelectAll = useCallback(() => {
        setVisibleTableNames(prev => {
            const next = new Set(prev);
            filteredHierarchy.forEach(h => next.add(h.name));
            return next;
        });
    }, [filteredHierarchy]);

    const handleDeselectAll = useCallback(() => {
        setVisibleTableNames(new Set());
    }, []);

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
                style: { 
                    stroke: hoveredEdgeId === `db-e-${idx}` ? 'hsl(var(--primary))' : 'hsl(var(--primary))', 
                    strokeWidth: hoveredEdgeId === `db-e-${idx}` ? 4 : 2, 
                    opacity: hoveredEdgeId === `db-e-${idx}` ? 1 : 0.5,
                    transition: 'all 0.2s ease-in-out'
                },
                zIndex: hoveredEdgeId === `db-e-${idx}` ? 10 : 1,
            };
        }).filter((e: Edge) => visibleTableNames.has(e.source as string) && visibleTableNames.has(e.target as string));

        const baseNodes: Node[] = Array.from(visibleTableNames).map((name) => {
            const tableInfo = tableData[name] || { columns: [] };
            const cols = tableInfo.columns || [];
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
                comment: tableInfo.comment,
                indices: tableInfo.indices,
                rowCount: tableInfo.rowCount,
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
    }, [visibleTableNames, tableData, relationships, hierarchy, detailLevel, collapsedTables, hoveredEdgeId]);

    // Dedicated effect to handle hovered styles for immediate feedback
    useEffect(() => {
        if (!hoveredEdgeId) {
            setEdges(eds => eds.map(e => ({
                ...e,
                style: { 
                    ...e.style, 
                    strokeWidth: 2, 
                    opacity: 0.5,
                },
                zIndex: 1
            })));
            return;
        }

        setEdges(eds => eds.map(e => {
            if (e.id === hoveredEdgeId) {
                return {
                    ...e,
                    label: '',
                    labelStyle: { fill: 'hsl(var(--primary))', fontWeight: 'bold', fontSize: '10px' },
                    labelBgStyle: { fill: 'hsl(var(--background))', fillOpacity: 0.8, rx: 4, ry: 4 },
                    style: { 
                        ...e.style, 
                        strokeWidth: 4, 
                        opacity: 1,
                    },
                    zIndex: 20
                };
            }
            return {
                ...e,
                label: '',
                style: { 
                    ...e.style, 
                    strokeWidth: 2, 
                    opacity: 0.2,
                },
                zIndex: 1
            };
        }));
    }, [hoveredEdgeId, setEdges]);

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
            filteredHierarchy, hoverPosition, hoveredEdgeId,
            tableData, isLoadingHierarchy, isLoadingCols, lang, 
            activeConnection, effectiveDatabase 
        },
        actions: { 
            setNodes, setEdges, onNodesChange, onEdgesChange, handleEdgesChange, 
            onConnect, setVisibleTableNames, setSearchTerm, setPendingConnection, 
            setSidebarCollapsed, setDetailLevel, setSchemaFilter, setShowMinimap, 
            setCollapsedTables, setSelectedDatabase, handleRemoveConstraint, 
            handleCreateForeignKey, handleAutoLayout, toggleTable, 
            handleSelectAll, handleDeselectAll,
            handleToggleCollapse, handleExportPNG, handleExportSQL,
            handleEdgeMouseEnter, handleEdgeMouseLeave
        }
    };
};
