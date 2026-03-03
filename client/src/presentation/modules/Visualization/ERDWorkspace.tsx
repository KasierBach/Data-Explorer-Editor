import React, { useEffect, useCallback, useState, useMemo, useRef } from 'react';
import {
    ReactFlow,
    Controls,
    Background,
    MiniMap,
    useNodesState,
    useEdgesState,
    ConnectionLineType,
    Panel,
    addEdge,
    type Edge,
    type Node,
    type Connection,
    type EdgeChange
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/core/services/store';
import { connectionService } from '@/core/services/ConnectionService';
import { GitGraph, RefreshCw, Table, Plus, X, Search, LayoutGrid, Database, Download, FileCode, PanelLeftClose, PanelLeft, CheckSquare, Square, Eye, Maximize2, Layers } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { cn } from '@/lib/utils';
import TableNode from './TableNode';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/presentation/components/ui/select"
import { ForeignKeyDialog } from './ForeignKeyDialog';
import type { ForeignKeyData } from './ForeignKeyDialog';
import { toast } from 'sonner';
import { queryService } from '@/core/services/QueryService';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/presentation/components/ui/dropdown-menu"

const nodeTypes = {
    table: TableNode,
};

interface ERDWorkspaceProps {
    tabId: string;
    connectionId: string;
    database?: string;
}

type DetailLevel = 'all' | 'keys' | 'name';

export const ERDWorkspace: React.FC<ERDWorkspaceProps> = ({ tabId, connectionId, database: databaseProp }) => {
    const { connections, tabs, updateTabMetadata, pageStates, setPageState, lang } = useAppStore();
    const activeConnection = connections.find(c => c.id === connectionId);

    // Manage database selection locally so it works in both tab and standalone page modes
    const [selectedDatabase, setSelectedDatabase] = useState<string | undefined>(databaseProp);

    // Sync if prop changes externally
    useEffect(() => {
        if (databaseProp) setSelectedDatabase(databaseProp);
    }, [databaseProp]);

    // Get initial state from either tab metadata (if in a tab) or pageStates (if standalone)
    const isStandalone = tabId.startsWith('erd-page-');
    const tab = tabs.find(t => t.id === tabId);
    const initialMetadata = isStandalone ? (pageStates[tabId] || {}) : (tab?.metadata || {});

    const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initialMetadata.nodes || []);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialMetadata.edges || []);

    // Selection state
    const [visibleTableNames, setVisibleTableNames] = useState<Set<string>>(new Set(initialMetadata.visibleTables || []));
    const [searchTerm, setSearchTerm] = useState('');
    const [pendingConnection, setPendingConnection] = useState<{ sourceTable: string; sourceColumn: string; targetTable: string; targetColumn: string } | null>(null);

    // New UI state
    const [isSidebarCollapsed, setSidebarCollapsed] = useState(initialMetadata.isSidebarCollapsed || false);
    const [detailLevel, setDetailLevel] = useState<DetailLevel>(initialMetadata.detailLevel || 'all');
    const [schemaFilter, setSchemaFilter] = useState<string>(initialMetadata.schemaFilter || 'all');
    const [showMinimap, setShowMinimap] = useState(initialMetadata.showMinimap ?? true);
    const [collapsedTables, setCollapsedTables] = useState<Set<string>>(new Set(initialMetadata.collapsedTables || []));

    const isFirstLoad = useRef(true);
    const reactFlowRef = useRef<any>(null);

    // Persist changes to Store
    useEffect(() => {
        if (isFirstLoad.current) {
            isFirstLoad.current = false;
            return;
        }

        // Debounce metadata updates to avoid store spam
        const timer = setTimeout(() => {
            const stateToSave = {
                visibleTables: Array.from(visibleTableNames),
                nodes: nodes,
                // Only save manual edges, DB edges are re-calculated
                edges: edges.filter(e => !e.id.startsWith('db-e-')),
                isSidebarCollapsed,
                detailLevel,
                schemaFilter,
                showMinimap,
                collapsedTables: Array.from(collapsedTables)
            };

            if (isStandalone) {
                setPageState(tabId, stateToSave);
            } else {
                updateTabMetadata(tabId, stateToSave);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [nodes, edges, visibleTableNames, tabId, updateTabMetadata]);

    // 1. Fetch Hierarchy to get all tables
    const { data: hierarchy, isLoading: isLoadingHierarchy } = useQuery({
        queryKey: ['erd-hierarchy', connectionId, selectedDatabase],
        queryFn: async () => {
            if (!connectionId) return [];
            const adapter = connectionService.getAdapter(connectionId, activeConnection?.type as any);
            const results: any[] = [];
            const crawl = async (parentId: string | null) => {
                const nodes = await adapter.getHierarchy(parentId);
                for (const node of nodes) {
                    if (node.type === 'table' || node.type === 'view') {
                        results.push(node);
                    } else if (node.type === 'database') {
                        if (!selectedDatabase || node.name === selectedDatabase || node.id.includes(selectedDatabase)) {
                            await crawl(node.id);
                        }
                    } else if (node.type === 'schema' || node.type === 'folder') {
                        await crawl(node.id);
                    }
                }
            };
            await crawl(selectedDatabase ? `db:${selectedDatabase}` : null);
            return results;
        },
        enabled: !!connectionId,
        staleTime: 0
    });

    // 2. Fetch Relationships
    const { data: relationships } = useQuery({
        queryKey: ['erd-rels', connectionId, selectedDatabase],
        queryFn: async () => {
            if (!connectionId) return [];
            const adapter = connectionService.getAdapter(connectionId, activeConnection?.type as any);
            return adapter.getRelationships(selectedDatabase);
        },
        enabled: !!connectionId,
        staleTime: 0
    });

    // Fetch generic hierarchy (root) to get list of databases
    const { data: allDatabases } = useQuery({
        queryKey: ['erd-databases', connectionId],
        queryFn: async () => {
            if (!connectionId) return [];
            const adapter = connectionService.getAdapter(connectionId, activeConnection?.type as any);
            const nodes = await adapter.getHierarchy(null);
            return nodes.filter((n: any) => n.type === 'database');
        },
        enabled: !!connectionId,
        staleTime: 0
    });

    // Auto-select database for connections that don't list databases (e.g. Supabase)
    const hasDatabases = allDatabases && allDatabases.length > 0;
    const effectiveDatabase = selectedDatabase || (hasDatabases ? undefined : '__schema_only__');

    // 3. Fetch All Columns for visible tables
    const { data: tableData, isLoading: isLoadingCols, refetch: refetchCols } = useQuery({
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
        staleTime: 0
    });

    const isLoading = isLoadingHierarchy || isLoadingCols;

    const queryClient = useQueryClient();

    // Map of "table.column" -> constraintName for FKs
    const fkConstraintMap = useMemo(() => {
        const map = new Map<string, string>();
        if (!relationships) return map;
        relationships.forEach((rel: any) => {
            if (rel.constraint_name) {
                // Remove schema prefix if present, because edge.source is usually just the bare table name
                const sourceTable = rel.source_table?.split('.').pop() || rel.source_table;
                map.set(`${sourceTable}.${rel.source_column}`, rel.constraint_name);
            }
        });
        return map;
    }, [relationships]);

    const handleRemoveConstraint = useCallback(async (tableName: string, type: 'pk' | 'fk', constraintName: string) => {
        const confirmMsg = lang === 'vi'
            ? `Bạn có chắc muốn xóa ${type.toUpperCase()} (${constraintName}) này không?`
            : `Are you sure you want to remove this ${type.toUpperCase()} (${constraintName})?`;
        if (!window.confirm(confirmMsg)) return;

        try {
            await queryService.updateSchema({
                connectionId,
                database: selectedDatabase,
                table: tableName,
                operations: [{
                    type: type === 'pk' ? 'drop_pk' : 'drop_fk',
                    name: constraintName,
                    constraintName: constraintName
                }]
            });
            toast.success(lang === 'vi' ? `${type.toUpperCase()} đã được xóa thành công` : `${type.toUpperCase()} removed successfully`);
            queryClient.invalidateQueries({ queryKey: ['erd-rels'] });
            queryClient.invalidateQueries({ queryKey: ['erd-columns'] });
        } catch (error: any) {
            toast.error(lang === 'vi' ? `Không thể xóa ${type.toUpperCase()}` : `Failed to remove ${type.toUpperCase()}`, {
                description: error.message
            });
        }
    }, [connectionId, selectedDatabase, queryClient, lang]);

    const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
        const removals = changes.filter(c => c.type === 'remove');
        const others = changes.filter(c => c.type !== 'remove');

        if (others.length > 0) {
            onEdgesChange(others);
        }

        removals.forEach(async (change) => {
            if (change.type !== 'remove') return;
            const edge = edges.find(e => e.id === change.id);
            if (!edge) {
                onEdgesChange([change]);
                return;
            }

            // Only DB-backed edges representing foreign keys
            if (edge.id.startsWith('db-e-')) {
                const constraintName = fkConstraintMap.get(`${edge.source}.${edge.sourceHandle}`);
                if (!constraintName) {
                    toast.info(lang === 'vi' ? "Không thể xóa: không tìm thấy tên ràng buộc cho liên kết này." : "Cannot remove: unknown constraint name for this relationship.");
                    // Still remove visually if it's glitched out
                    onEdgesChange([change]);
                    return;
                }

                if (window.confirm(lang === 'vi' ? `Bạn có chắc muốn xóa ràng buộc khóa ngoại (${constraintName}) này không?` : `Are you sure you want to drop the foreign key constraint (${constraintName})?`)) {
                    try {
                        await queryService.updateSchema({
                            connectionId: connectionId!,
                            database: selectedDatabase,
                            table: edge.source,
                            operations: [{
                                type: 'drop_fk',
                                name: constraintName,
                                constraintName: constraintName
                            }]
                        });
                        toast.success(lang === 'vi' ? "Đã xóa liên kết thành công" : "Relationship removed successfully");
                        queryClient.invalidateQueries({ queryKey: ['erd-rels'] });
                        queryClient.invalidateQueries({ queryKey: ['erd-columns'] });
                        onEdgesChange([change]);
                    } catch (error: any) {
                        toast.error(lang === 'vi' ? "Không thể xóa liên kết" : "Failed to remove relationship", { description: error.message });
                    }
                }
            } else {
                // Manual visual edge, remove immediately
                onEdgesChange([change]);
            }
        });
    }, [edges, onEdgesChange, fkConstraintMap, connectionId, selectedDatabase, queryClient, lang]);

    const onConnect = useCallback(
        (params: Connection) => {
            if (params.source === params.target) return;
            setPendingConnection({
                sourceTable: params.source,
                sourceColumn: params.sourceHandle!,
                targetTable: params.target,
                targetColumn: params.targetHandle!
            });
        },
        []
    );

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

            toast.success(lang === 'vi' ? "Đã tạo liên kết" : "Relationship Created", {
                description: lang === 'vi' ? `Đã liên kết thành công ${data.sourceTable} với ${data.targetTable}.` : `Successfully linked ${data.sourceTable} to ${data.targetTable}.`,
            });

            setEdges((eds) => addEdge({
                source: data.sourceTable,
                target: data.targetTable,
                sourceHandle: data.sourceColumn,
                targetHandle: data.targetColumn,
                animated: true,
                type: ConnectionLineType.SmoothStep,
                style: { stroke: 'hsl(var(--primary))', strokeWidth: 2, strokeDasharray: 5 }
            }, eds));

        } catch (error: any) {
            let errorMessage = error.message || "Unknown error occurred";
            try {
                const errObj = JSON.parse(errorMessage);
                if (errObj.statusCode === 404 && errObj.message?.includes('Connection with ID')) {
                    errorMessage = lang === 'vi' ? "Phiên kết nối đã hết hạn. Vui lòng tải lại trang." : "Connection session expired. Please refresh the page.";
                } else if (errObj.message) {
                    errorMessage = errObj.message;
                }
            } catch {
                // If parsing fails, use the raw message
            }
            toast.error(lang === 'vi' ? "Không thể tạo liên kết" : "Failed to create relationship", { description: errorMessage });
        }
    };

    const getLayoutedElements = useCallback((nodes: Node[], edges: Edge[], direction = 'LR') => {
        const dagreGraph = new dagre.graphlib.Graph();
        dagreGraph.setDefaultEdgeLabel(() => ({}));
        const isHorizontal = direction === 'LR';
        dagreGraph.setGraph({ rankdir: direction, nodesep: 100, ranksep: 200 });

        const connectedNodeIds = new Set<string>();
        edges.forEach(e => {
            connectedNodeIds.add(e.source);
            connectedNodeIds.add(e.target);
        });

        const connectedNodes = nodes.filter(n => connectedNodeIds.has(n.id));
        const standaloneNodes = nodes.filter(n => !connectedNodeIds.has(n.id));

        connectedNodes.forEach((node) => {
            const columnCount = (node.data as any).columns?.length || 5;
            dagreGraph.setNode(node.id, { width: 300, height: 100 + columnCount * 30 });
        });

        edges.forEach((edge) => {
            dagreGraph.setEdge(edge.source, edge.target);
        });

        dagre.layout(dagreGraph);

        const newNodes = nodes.map((node) => {
            if (connectedNodeIds.has(node.id)) {
                const nodeWithPosition = dagreGraph.node(node.id);
                return {
                    ...node,
                    targetPosition: isHorizontal ? 'left' as any : 'top' as any,
                    sourcePosition: isHorizontal ? 'right' as any : 'bottom' as any,
                    position: {
                        x: nodeWithPosition.x - 150,
                        y: nodeWithPosition.y - 50,
                    },
                };
            } else {
                const index = standaloneNodes.indexOf(node);
                return {
                    ...node,
                    position: {
                        x: -500,
                        y: index * 400
                    }
                };
            }
        });

        return { nodes: newNodes, edges };
    }, []);

    const toggleTable = (name: string) => {
        setVisibleTableNames(prev => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name);
            else next.add(name);
            return next;
        });
    };

    const handleAutoLayout = () => {
        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(nodes, edges);
        setNodes([...layoutedNodes]);
        setEdges([...layoutedEdges]);
    };

    const handleSelectAll = () => {
        if (!filteredHierarchy) return;
        const allNames = new Set(filteredHierarchy.map(h => h.name));
        setVisibleTableNames(allNames);
    };

    const handleDeselectAll = () => {
        setVisibleTableNames(new Set());
        setNodes([]);
        setEdges([]);
    };

    const handleToggleCollapse = (name: string) => {
        setCollapsedTables(prev => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name);
            else next.add(name);
            return next;
        });
    };

    // Export as PNG
    const handleExportPNG = useCallback(() => {
        const svgEl = document.querySelector('.react-flow__viewport');
        if (!svgEl) return;

        import('html-to-image').then(({ toPng }) => {
            const el = document.querySelector('.react-flow') as HTMLElement;
            if (!el) return;
            toPng(el, {
                backgroundColor: '#0a0a0b',
                quality: 1,
                pixelRatio: 2,
            }).then((dataUrl) => {
                const link = document.createElement('a');
                link.download = `erd-${selectedDatabase || 'diagram'}-${Date.now()}.png`;
                link.href = dataUrl;
                link.click();
                toast.success(lang === 'vi' ? 'Đã xuất thành PNG' : 'Exported as PNG');
            }).catch(() => {
                toast.error(lang === 'vi' ? 'Không thể xuất. Hãy thử thu nhỏ sơ đồ trước.' : 'Failed to export. Try zooming out first.');
            });
        });
    }, [selectedDatabase, lang]);

    // Export as SQL DDL
    const handleExportSQL = useCallback(() => {
        if (!tableData || visibleTableNames.size === 0) return;

        let sql = `-- Generated by Data Explorer ERD\n-- Database: ${selectedDatabase || 'unknown'}\n-- Date: ${new Date().toISOString()}\n\n`;

        Array.from(visibleTableNames).forEach(tableName => {
            const cols = tableData[tableName];
            if (!cols || cols.length === 0) return;

            sql += `CREATE TABLE "${tableName}" (\n`;
            const colDefs = cols.map((c: any) => {
                let def = `    "${c.name}" ${c.type}`;
                if (c.isPrimaryKey) def += ' PRIMARY KEY';
                if (c.nullable === false) def += ' NOT NULL';
                return def;
            });
            sql += colDefs.join(',\n');
            sql += `\n);\n\n`;
        });

        const blob = new Blob([sql], { type: 'text/sql' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `erd-${selectedDatabase || 'schema'}-${Date.now()}.sql`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
        toast.success(lang === 'vi' ? 'Đã xuất thành SQL' : 'Exported as SQL');
    }, [tableData, visibleTableNames, selectedDatabase, lang]);

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
        }).filter((e: Edge) => visibleTableNames.has(e.source) && visibleTableNames.has(e.target));

        const baseNodes: Node[] = Array.from(visibleTableNames).map((name) => {
            const cols = tableData[name] || [];
            const isCollapsed = collapsedTables.has(name);

            // Filter columns based on detail level
            let filteredCols = cols;
            if (detailLevel === 'keys') {
                filteredCols = cols.filter((c: any) => c.isPrimaryKey || c.isForeignKey || fkConstraintMap.has(`${name}.${c.name}`));
            } else if (detailLevel === 'name') {
                filteredCols = [];
            }

            const enrichedCols = (isCollapsed ? [] : filteredCols).map((c: any) => ({
                ...c,
                fkConstraintName: fkConstraintMap.get(`${name}.${c.name}`)
            }));

            const data = {
                tableName: name,
                columns: enrichedCols,
                onRemoveConstraint: handleRemoveConstraint,
                isCollapsed,
                onToggleCollapse: () => handleToggleCollapse(name),
                detailLevel,
            };

            const existing = nodes.find(n => n.id === name);
            if (existing) {
                return { ...existing, data };
            }

            return {
                id: name,
                type: 'table',
                data,
                position: { x: Math.random() * 400, y: Math.random() * 400 },
            };
        });

        const finalNodes = baseNodes.filter(n => visibleTableNames.has(n.id));
        const manualEdges = edges.filter(e => !e.id.startsWith('db-e-') && visibleTableNames.has(e.source) && visibleTableNames.has(e.target));

        setNodes(finalNodes);
        setEdges([...dbEdges, ...manualEdges]);

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visibleTableNames, tableData, relationships, hierarchy, detailLevel, collapsedTables]);

    // Extract unique schemas from hierarchy
    const schemas = useMemo(() => {
        if (!hierarchy) return [];
        const schemaSet = new Set<string>();
        hierarchy.forEach(h => {
            // Extract schema from id like "db:postgres.schema:public.folder:tables"
            const match = h.id?.match(/schema:([^.]+)/);
            if (match) schemaSet.add(match[1]);
        });
        return Array.from(schemaSet).sort();
    }, [hierarchy]);

    const filteredHierarchy = useMemo(() => {
        if (!hierarchy) return [];
        let filtered = hierarchy;

        // Filter by schema
        if (schemaFilter !== 'all') {
            filtered = filtered.filter(h => h.id?.includes(`schema:${schemaFilter}`));
        }

        // Filter by search
        if (searchTerm) {
            filtered = filtered.filter(h => h.name.toLowerCase().includes(searchTerm.toLowerCase()));
        }

        return filtered;
    }, [hierarchy, searchTerm, schemaFilter]);

    return (
        <div className="h-full w-full bg-background relative flex overflow-hidden">
            {/* Sidebar for table selection */}
            <div className={cn(
                "border-r bg-card/30 backdrop-blur-3xl flex flex-col shrink-0 custom-scrollbar transition-all duration-300",
                isSidebarCollapsed ? "w-0 opacity-0 overflow-hidden" : "w-80"
            )}>
                <div className="p-5 border-b bg-muted/5">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-500 rounded-xl text-white shadow-lg shadow-blue-500/10">
                                <Table className="h-4 w-4" />
                            </div>
                            <div>
                                <h2 className="font-black text-sm uppercase tracking-widest">{lang === 'vi' ? 'Thực thể' : 'Entities'}</h2>
                                <span className="text-[9px] text-muted-foreground">
                                    {visibleTableNames.size}/{hierarchy?.length || 0} {lang === 'vi' ? 'đã chọn' : 'selected'}
                                </span>
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSidebarCollapsed(true)}>
                            <PanelLeftClose className="h-4 w-4" />
                        </Button>
                    </div>

                    {/* Database Selector - only show if connection has multiple databases */}
                    {hasDatabases && (
                        <div className="mb-3">
                            <Select
                                value={selectedDatabase}
                                onValueChange={(val) => {
                                    setSelectedDatabase(val);
                                    setVisibleTableNames(new Set());
                                    setNodes([]);
                                    setEdges([]);
                                }}
                            >
                                <SelectTrigger className="h-8 text-xs bg-muted/20 border-border/20">
                                    <SelectValue placeholder={lang === 'vi' ? 'Chọn Cơ sở dữ liệu' : 'Select Database'} />
                                </SelectTrigger>
                                <SelectContent>
                                    {allDatabases.map((db: any) => (
                                        <SelectItem key={db.id} value={db.name} className="text-xs">
                                            {db.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* Schema Filter */}
                    {schemas.length > 1 && (
                        <div className="mb-3">
                            <Select value={schemaFilter} onValueChange={setSchemaFilter}>
                                <SelectTrigger className="h-8 text-xs bg-muted/20 border-border/20">
                                    <Layers className="w-3 h-3 mr-1" />
                                    <SelectValue placeholder={lang === 'vi' ? 'Tất cả Schema' : 'All Schemas'} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all" className="text-xs">{lang === 'vi' ? 'Tất cả Schema' : 'All Schemas'}</SelectItem>
                                    {schemas.map(s => (
                                        <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground opacity-40" />
                        <Input
                            placeholder={lang === 'vi' ? "Lọc bảng..." : "Filter tables..."}
                            className="pl-8 bg-muted/20 border-border/20 h-8 text-[11px] rounded-lg"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* Bulk actions */}
                    <div className="flex gap-2 mt-3">
                        <Button variant="outline" size="sm" className="flex-1 h-7 text-[9px] font-bold uppercase tracking-wider gap-1" onClick={handleSelectAll}>
                            <CheckSquare className="h-3 w-3" />
                            {lang === 'vi' ? 'Tất cả' : 'All'}
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1 h-7 text-[9px] font-bold uppercase tracking-wider gap-1" onClick={handleDeselectAll}>
                            <Square className="h-3 w-3" />
                            {lang === 'vi' ? 'Bỏ chọn' : 'None'}
                        </Button>
                    </div>
                </div>

                <div className="flex-1 overflow-auto custom-scrollbar">
                    <div className="p-3 space-y-1">
                        {filteredHierarchy.map((t) => (
                            <div
                                key={t.id}
                                className={cn(
                                    "px-3 py-2.5 rounded-xl cursor-pointer transition-all flex items-center justify-between group",
                                    visibleTableNames.has(t.name)
                                        ? "bg-primary/10 text-primary border border-primary/20"
                                        : "hover:bg-muted/50 text-muted-foreground border border-transparent"
                                )}
                                onClick={() => toggleTable(t.name)}
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    <Table className={cn("h-3.5 w-3.5 shrink-0", visibleTableNames.has(t.name) ? "opacity-100" : "opacity-30")} />
                                    <span className="text-[11px] font-bold truncate">{t.name}</span>
                                </div>
                                {visibleTableNames.has(t.name) ? (
                                    <X className="h-3 w-3 opacity-40 group-hover:opacity-100" />
                                ) : (
                                    <Plus className="h-3 w-3 opacity-0 group-hover:opacity-40" />
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="p-4 border-t bg-muted/10">
                    <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-[10px] font-black uppercase tracking-widest gap-2 rounded-xl"
                        onClick={handleDeselectAll}
                    >
                        {lang === 'vi' ? 'XÓA SƠ ĐỒ' : 'Clear Canvas'}
                    </Button>
                </div>
            </div>

            <div className="flex-1 relative">
                {isLoading && (
                    <div className="absolute top-0 left-0 w-full z-50 overflow-hidden">
                        <div className="h-0.5 bg-primary/20 w-full relative">
                            <div className="absolute top-0 left-0 h-full bg-primary animate-pulse w-1/3" />
                        </div>
                    </div>
                )}

                {!effectiveDatabase && !isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-10">
                        <div className="text-center">
                            <div className="w-12 h-12 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4 animate-bounce">
                                <Database className="w-6 h-6 text-muted-foreground" />
                            </div>
                            <h3 className="font-bold text-lg mb-2">{lang === 'vi' ? 'Chọn Cơ sở dữ liệu' : 'Select a Database'}</h3>
                            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                                {lang === 'vi' ? 'Chọn một cơ sở dữ liệu từ thanh bên để bắt đầu trực quan hóa sơ đồ.' : 'Choose a database from the sidebar to start visualizing your schema.'}
                            </p>
                        </div>
                    </div>
                )}

                <ReactFlow
                    ref={reactFlowRef}
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={handleEdgesChange}
                    onConnect={onConnect}
                    nodeTypes={nodeTypes}
                    connectionLineType={ConnectionLineType.SmoothStep}
                    connectionLineStyle={{ stroke: 'hsl(var(--primary))', strokeWidth: 2, strokeDasharray: '5,5' }}
                    fitView
                    minZoom={0.05}
                    maxZoom={2}
                    colorMode="system"
                    connectionRadius={30}
                    snapToGrid={true}
                    snapGrid={[15, 15]}
                >
                    <Background color="hsl(var(--muted-foreground))" gap={20} style={{ opacity: 0.05 }} />
                    <Controls className="bg-card border-border/40 shadow-2xl rounded-xl overflow-hidden" />

                    {showMinimap && (
                        <MiniMap
                            className="bg-card/80 border border-border/40 rounded-xl overflow-hidden !shadow-2xl"
                            maskColor="rgba(0,0,0,0.2)"
                            nodeColor="hsl(var(--primary))"
                            pannable
                            zoomable
                        />
                    )}

                    {/* Top-left: Title + Toolbar */}
                    <Panel position="top-left" className="m-4">
                        <div className="flex flex-col gap-3">
                            <div className="bg-card/80 backdrop-blur-xl border border-border/40 p-4 rounded-2xl shadow-2xl ring-1 ring-white/5">
                                <div className="flex items-center gap-3 mb-3">
                                    {isSidebarCollapsed && (
                                        <Button variant="ghost" size="icon" className="h-8 w-8 mr-1" onClick={() => setSidebarCollapsed(false)}>
                                            <PanelLeft className="h-4 w-4" />
                                        </Button>
                                    )}
                                    <div className="p-2 bg-blue-500 rounded-xl text-white shadow-lg shadow-blue-500/20">
                                        <GitGraph className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <h2 className="font-black text-base tracking-tight leading-none uppercase">{lang === 'vi' ? 'Sơ đồ CSDL' : 'Database Diagram'}</h2>
                                        <p className="text-[9px] text-muted-foreground uppercase tracking-[0.15em] font-bold opacity-40 mt-0.5">
                                            {activeConnection?.name} • {selectedDatabase || (lang === 'vi' ? 'Sơ đồ' : 'Schema')}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex gap-1.5 flex-wrap">
                                    <Button variant="outline" size="sm" className="h-7 rounded-full bg-muted/20 border-border/40 text-[9px] font-bold uppercase tracking-wider gap-1.5" onClick={() => refetchCols()}>
                                        <RefreshCw className={cn("h-3 w-3", isLoading && "animate-spin")} />
                                        {lang === 'vi' ? 'Tải lại' : 'Refresh'}
                                    </Button>
                                    <Button variant="outline" size="sm" className="h-7 rounded-full bg-primary/10 border-primary/20 text-primary text-[9px] font-bold uppercase tracking-wider gap-1.5" onClick={handleAutoLayout}>
                                        <LayoutGrid className="h-3 w-3" />
                                        {lang === 'vi' ? 'Tự động sắp xếp' : 'Auto Layout'}
                                    </Button>

                                    {/* Detail Level */}
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="outline" size="sm" className="h-7 rounded-full bg-muted/20 border-border/40 text-[9px] font-bold uppercase tracking-wider gap-1.5">
                                                <Eye className="h-3 w-3" />
                                                {detailLevel === 'all' ? (lang === 'vi' ? 'Tất cả cột' : 'All Cols') : detailLevel === 'keys' ? (lang === 'vi' ? 'Chỉ khóa' : 'Keys Only') : (lang === 'vi' ? 'Tên bảng' : 'Names')}
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent className="w-44">
                                            <DropdownMenuItem onClick={() => setDetailLevel('all')} className={cn(detailLevel === 'all' && "bg-primary/10 text-primary")}>
                                                {lang === 'vi' ? 'Tất cả các cột' : 'All Columns'}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => setDetailLevel('keys')} className={cn(detailLevel === 'keys' && "bg-primary/10 text-primary")}>
                                                {lang === 'vi' ? 'Chỉ khóa (PK/FK)' : 'Keys Only (PK/FK)'}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => setDetailLevel('name')} className={cn(detailLevel === 'name' && "bg-primary/10 text-primary")}>
                                                {lang === 'vi' ? 'Chỉ tên bảng' : 'Table Names Only'}
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>

                                    {/* Export */}
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="outline" size="sm" className="h-7 rounded-full bg-muted/20 border-border/40 text-[9px] font-bold uppercase tracking-wider gap-1.5">
                                                <Download className="h-3 w-3" />
                                                {lang === 'vi' ? 'Xuất' : 'Export'}
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent className="w-48">
                                            <DropdownMenuItem onClick={handleExportPNG} className="gap-2">
                                                <Download className="h-3.5 w-3.5" />
                                                {lang === 'vi' ? 'Xuất PNG' : 'Export as PNG'}
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem onClick={handleExportSQL} className="gap-2">
                                                <FileCode className="h-3.5 w-3.5" />
                                                {lang === 'vi' ? 'Xuất SQL DDL' : 'Export as SQL DDL'}
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>

                                    {/* Toggle Minimap */}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className={cn("h-7 rounded-full text-[9px] font-bold uppercase tracking-wider gap-1.5",
                                            showMinimap ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" : "bg-muted/20 border-border/40"
                                        )}
                                        onClick={() => setShowMinimap(!showMinimap)}
                                    >
                                        <Maximize2 className="h-3 w-3" />
                                        {lang === 'vi' ? 'Bản đồ nhỏ' : 'Minimap'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </Panel>

                    {/* Top-right: Status */}
                    <Panel position="top-right" className="m-4">
                        <div className="bg-card/80 backdrop-blur-xl border border-border/40 p-3 rounded-2xl shadow-2xl flex flex-col gap-1 items-end">
                            <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-emerald-500">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Live Designer Mode
                            </div>
                            <div className="text-[8px] text-muted-foreground opacity-40 font-bold">
                                {lang === 'vi' ? 'Kéo từ các nút để tạo liên kết FK' : 'Drag from handles to create FK links'}
                            </div>
                        </div>
                    </Panel>
                </ReactFlow>
            </div>

            <style>{`
                .react-flow__edge-path {
                    stroke-dasharray: 5;
                    stroke-dashoffset: 10;
                    animation: dashdraw 0.5s linear infinite;
                }
                @keyframes dashdraw {
                    from { stroke-dashoffset: 10; }
                    to { stroke-dashoffset: 0; }
                }
                .react-flow__handle {
                    width: 10px;
                    height: 10px;
                    background: hsl(var(--primary));
                    border: 2px solid hsl(var(--background));
                    transition: all 0.2s;
                }
                .react-flow__handle:hover {
                    transform: scale(1.5);
                    background: #fff;
                }
                .react-flow__minimap {
                    border-radius: 12px !important;
                }
            `}</style>

            {pendingConnection && (
                <ForeignKeyDialog
                    isOpen={true}
                    onClose={() => setPendingConnection(null)}
                    onConfirm={handleCreateForeignKey}
                    sourceTable={pendingConnection.sourceTable}
                    sourceColumn={pendingConnection.sourceColumn}
                    targetTable={pendingConnection.targetTable}
                    targetColumn={pendingConnection.targetColumn}
                    existingTables={Array.from(visibleTableNames)}
                />
            )}
        </div>
    );
};
