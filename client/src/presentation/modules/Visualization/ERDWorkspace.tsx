import React, { useEffect, useCallback, useState, useMemo, useRef } from 'react';
import {
    ReactFlow,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    ConnectionLineType,
    Panel,
    addEdge,
    type Edge,
    type Node,
    type Connection
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/core/services/store';
import { connectionService } from '@/core/services/ConnectionService';
import TableNode from './TableNode';
import { GitGraph, RefreshCw, Table, Plus, X, Search, LayoutGrid } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { cn } from '@/lib/utils';

const nodeTypes = {
    table: TableNode,
};

interface ERDWorkspaceProps {
    tabId: string;
    connectionId: string;
    database?: string;
}

export const ERDWorkspace: React.FC<ERDWorkspaceProps> = ({ tabId, connectionId, database }) => {
    const { connections, tabs, updateTabMetadata } = useAppStore();
    const activeConnection = connections.find(c => c.id === connectionId);

    // Get initial state from tab metadata
    const tab = tabs.find(t => t.id === tabId);
    const initialMetadata = tab?.metadata || {};

    const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initialMetadata.nodes || []);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialMetadata.edges || []);

    // Selection state
    const [visibleTableNames, setVisibleTableNames] = useState<Set<string>>(new Set(initialMetadata.visibleTables || []));
    const [searchTerm, setSearchTerm] = useState('');

    const isFirstLoad = useRef(true);

    // Persist changes to Store
    useEffect(() => {
        if (isFirstLoad.current) {
            isFirstLoad.current = false;
            return;
        }

        // Debounce metadata updates to avoid store spam
        const timer = setTimeout(() => {
            updateTabMetadata(tabId, {
                visibleTables: Array.from(visibleTableNames),
                nodes: nodes,
                // Only save manual edges, DB edges are re-calculated
                edges: edges.filter(e => !e.id.startsWith('db-e-'))
            });
        }, 500);

        return () => clearTimeout(timer);
    }, [nodes, edges, visibleTableNames, tabId, updateTabMetadata]);

    // 1. Fetch Hierarchy to get all tables
    const { data: hierarchy, isLoading: isLoadingHierarchy } = useQuery({
        queryKey: ['erd-hierarchy', connectionId, database],
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
                        if (!database || node.name === database || node.id.includes(database)) {
                            await crawl(node.id);
                        }
                    } else if (node.type === 'schema' || node.type === 'folder') {
                        await crawl(node.id);
                    }
                }
            };
            await crawl(database ? `db:${database}` : null);
            return results;
        },
        enabled: !!connectionId
    });

    // 2. Fetch Relationships
    const { data: relationships } = useQuery({
        queryKey: ['erd-rels', connectionId, database],
        queryFn: async () => {
            if (!connectionId) return [];
            const adapter = connectionService.getAdapter(connectionId, activeConnection?.type as any);
            return adapter.getRelationships(database);
        },
        enabled: !!connectionId
    });

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
        enabled: visibleTableNames.size > 0 && !!hierarchy
    });

    const isLoading = isLoadingHierarchy || isLoadingCols;

    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: 'hsl(var(--primary))', strokeWidth: 2, strokeDasharray: 5 } }, eds)),
        [setEdges]
    );

    const getLayoutedElements = useCallback((nodes: Node[], edges: Edge[], direction = 'LR') => {
        const dagreGraph = new dagre.graphlib.Graph();
        dagreGraph.setDefaultEdgeLabel(() => ({}));
        const isHorizontal = direction === 'LR';
        dagreGraph.setGraph({ rankdir: direction, nodesep: 100, ranksep: 200 });

        // Divide nodes into connected and disconnected
        const connectedNodeIds = new Set<string>();
        edges.forEach(e => {
            connectedNodeIds.add(e.source);
            connectedNodeIds.add(e.target);
        });

        const connectedNodes = nodes.filter(n => connectedNodeIds.has(n.id));
        const standaloneNodes = nodes.filter(n => !connectedNodeIds.has(n.id));

        // Layout connected nodes using Dagre
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
                // Positon standalone nodes in a separate grid or column
                const index = standaloneNodes.indexOf(node);
                return {
                    ...node,
                    position: {
                        x: -500, // Left side for standalone
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

    useEffect(() => {
        if (!hierarchy || !tableData || !relationships) return;

        // Auto-generate edges for visible tables based on DB relationships
        const dbEdges: Edge[] = relationships.map((rel, idx) => ({
            id: `db-e-${idx}`,
            source: rel.target_table,
            target: rel.source_table,
            sourceHandle: rel.target_column,
            targetHandle: rel.source_column,
            type: ConnectionLineType.SmoothStep,
            animated: true,
            style: { stroke: 'hsl(var(--primary))', strokeWidth: 2, opacity: 0.5 },
        })).filter(e => visibleTableNames.has(e.source) && visibleTableNames.has(e.target));

        const baseNodes: Node[] = Array.from(visibleTableNames).map((name) => {
            const existing = nodes.find(n => n.id === name);
            if (existing) {
                // Ensure data is synced even if position is kept
                return {
                    ...existing,
                    data: {
                        tableName: name,
                        columns: tableData[name] || []
                    }
                };
            }

            return {
                id: name,
                type: 'table',
                data: {
                    tableName: name,
                    columns: tableData[name] || []
                },
                position: { x: Math.random() * 400, y: Math.random() * 400 },
            };
        });

        // Filter out nodes/edges that are no longer visible
        const finalNodes = baseNodes.filter(n => visibleTableNames.has(n.id));
        const manualEdges = edges.filter(e => !e.id.startsWith('db-e-') && visibleTableNames.has(e.source) && visibleTableNames.has(e.target));

        // Use functional updates to avoid dependency cycles if possible, 
        // but here we need to merge carefully.
        setNodes(finalNodes);
        setEdges([...dbEdges, ...manualEdges]);

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visibleTableNames, tableData, relationships, hierarchy]);

    const filteredHierarchy = useMemo(() => {
        if (!hierarchy) return [];
        return hierarchy.filter(h => h.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [hierarchy, searchTerm]);

    return (
        <div className="h-full w-full bg-background relative flex overflow-hidden">
            {/* Sidebar for table selection */}
            <div className="w-72 border-r bg-card/30 backdrop-blur-3xl flex flex-col shrink-0 custom-scrollbar">
                <div className="p-6 border-b bg-muted/5">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-blue-500 rounded-xl text-white shadow-lg shadow-blue-500/10">
                            <Table className="h-4 w-4" />
                        </div>
                        <h2 className="font-black text-sm uppercase tracking-widest">Entities</h2>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground opacity-40" />
                        <Input
                            placeholder="Filter tables..."
                            className="pl-8 bg-muted/20 border-border/20 h-8 text-[11px] rounded-lg"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
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
                        onClick={() => setVisibleTableNames(new Set())}
                    >
                        Clear Canvas
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

                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    nodeTypes={nodeTypes}
                    connectionLineType={ConnectionLineType.SmoothStep}
                    fitView
                    minZoom={0.05}
                    maxZoom={2}
                    colorMode="system"
                    connectionRadius={25}
                    snapToGrid={true}
                    snapGrid={[15, 15]}
                >
                    <Background color="hsl(var(--muted-foreground))" gap={20} style={{ opacity: 0.05 }} />
                    <Controls className="bg-card border-border/40 shadow-2xl rounded-xl overflow-hidden" />

                    <Panel position="top-left" className="m-6">
                        <div className="flex flex-col gap-4">
                            <div className="bg-card/80 backdrop-blur-xl border border-border/40 p-5 rounded-[24px] shadow-2xl ring-1 ring-white/5">
                                <div className="flex items-center gap-4 mb-3">
                                    <div className="p-2.5 bg-blue-500 rounded-2xl text-white shadow-lg shadow-blue-500/20">
                                        <GitGraph className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h2 className="font-black text-lg tracking-tight leading-none uppercase">Database Diagram</h2>
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-black opacity-40 mt-1">
                                            {activeConnection?.name} @ {database || 'Default'}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" className="h-8 rounded-full bg-muted/20 border-border/40 text-[10px] font-bold uppercase tracking-widest gap-2" onClick={() => refetchCols()}>
                                        <RefreshCw className={cn("h-3 w-3", isLoading && "animate-spin")} />
                                        Refresh
                                    </Button>
                                    <Button variant="outline" size="sm" className="h-8 rounded-full bg-primary/10 border-primary/20 text-primary text-[10px] font-bold uppercase tracking-widest gap-2" onClick={handleAutoLayout}>
                                        <LayoutGrid className="h-3 w-3" />
                                        Auto Layout
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </Panel>

                    <Panel position="top-right" className="m-6">
                        <div className="bg-card/80 backdrop-blur-xl border border-border/40 p-4 rounded-3xl shadow-2xl flex flex-col gap-1 items-end">
                            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-500">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Live Designer Mode
                            </div>
                            <div className="text-[9px] text-muted-foreground opacity-40 font-bold">
                                Drag from handles to create manual links
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
            `}</style>
        </div>
    );
};
