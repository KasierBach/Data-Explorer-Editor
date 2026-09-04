import React, { useEffect, useRef } from 'react';
import {
    ReactFlow,
    Controls,
    Background,
    MiniMap,
    ConnectionLineType,
    type Node,
    type Edge,
    type OnNodesChange,
    type OnEdgesChange,
    type OnConnect,
    type ReactFlowInstance,
    BackgroundVariant,
} from '@xyflow/react';
import { Database, GitGraph, Loader2 } from 'lucide-react';
import TableNode from '../../TableNode';
import { ForeignKeyDialog, type ForeignKeyData } from '../../ForeignKeyDialog';

const nodeTypes = {
    table: TableNode,
};

interface ERDCanvasProps {
    nodes: Node[];
    edges: Edge[];
    onNodesChange: OnNodesChange;
    onEdgesChange: OnEdgesChange;
    onConnect: OnConnect;
    isLoading: boolean;
    effectiveDatabase?: string;
    lang: string;
    showMinimap: boolean;
    pendingConnection: { sourceTable: string; sourceColumn: string; targetTable: string; targetColumn: string } | null;
    setPendingConnection: (v: ERDCanvasProps['pendingConnection']) => void;
    handleCreateForeignKey: (data: ForeignKeyData) => void;
    handleEdgeMouseEnter?: (event: React.MouseEvent, edge: Edge) => void;
    handleEdgeMouseLeave?: (event: React.MouseEvent, edge: Edge) => void;
    hoverPosition?: { x: number, y: number } | null;
    hoveredEdgeId?: string | null;
    backgroundVariant?: 'dots' | 'lines' | 'cross';
    toolbar?: React.ReactNode;
    fitViewSignal?: number;
}

export const ERDCanvas: React.FC<ERDCanvasProps> = ({
    nodes, edges, onNodesChange, onEdgesChange, onConnect, isLoading, lang, showMinimap, pendingConnection, setPendingConnection, handleCreateForeignKey,
    handleEdgeMouseEnter, handleEdgeMouseLeave, hoverPosition, hoveredEdgeId, backgroundVariant = 'dots', toolbar, fitViewSignal = 0
}) => {
    const reactFlowRef = useRef<HTMLDivElement | null>(null);
    const flowInstanceRef = useRef<ReactFlowInstance | null>(null);
    const renderVisibleOnly = nodes.length > 30 || edges.length > 60;

    // Re-fit the viewport whenever the toolbar requests it (fitViewSignal bump).
    useEffect(() => {
        if (fitViewSignal > 0) flowInstanceRef.current?.fitView({ padding: 0.2, duration: 300 });
    }, [fitViewSignal]);

    return (
        <div className="flex-1 relative">
            {isLoading && (
                <div className="absolute right-4 top-3 z-50 w-[min(420px,calc(100%-2rem))] overflow-hidden rounded-xl border border-primary/20 bg-card/90 shadow-lg backdrop-blur-md sm:right-6">
                    <div className="flex items-center justify-between gap-3 px-3 py-2">
                        <div className="flex min-w-0 items-center gap-2">
                            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
                            <span className="truncate text-[11px] font-semibold text-foreground/80">
                                {lang === 'vi'
                                    ? (nodes.length > 0 ? 'Đang hoàn thiện metadata ERD...' : 'Đang khám phá cấu trúc database...')
                                    : (nodes.length > 0 ? 'Finishing ERD metadata...' : 'Exploring database structure...')}
                            </span>
                        </div>
                        <span className="hidden shrink-0 items-center gap-1.5 text-[10px] text-muted-foreground sm:flex">
                            <Database className="h-3 w-3" />
                            {nodes.length > 0 ? `${nodes.length} ${lang === 'vi' ? 'bảng' : 'tables'}` : (lang === 'vi' ? 'Đang kết nối' : 'Connecting')}
                        </span>
                    </div>
                    <div className="h-1 overflow-hidden bg-primary/10">
                        <div className="h-full w-1/3 animate-[erd-progress_1.2s_ease-in-out_infinite] rounded-full bg-primary shadow-[0_0_12px_hsl(var(--primary)/0.8)]" />
                    </div>
                </div>
            )}


            <ReactFlow
                ref={reactFlowRef}
                onInit={(instance) => { flowInstanceRef.current = instance; }}
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onEdgeMouseEnter={handleEdgeMouseEnter}
                onEdgeMouseLeave={handleEdgeMouseLeave}
                nodeTypes={nodeTypes}
                connectionLineType={ConnectionLineType.SmoothStep}
                connectionLineStyle={{ stroke: 'hsl(var(--primary))', strokeWidth: 2, strokeDasharray: '5,5' }}
                fitView
                onlyRenderVisibleElements={renderVisibleOnly}
                minZoom={0.05}
                maxZoom={2}
                colorMode="system"
                connectionRadius={30}
                snapToGrid={true}
                snapGrid={[15, 15]}
            >
                {backgroundVariant !== 'lines' && backgroundVariant !== 'cross' ?
                    <Background color="hsl(var(--muted-foreground))" gap={20} style={{ opacity: 0.1 }} variant={BackgroundVariant.Dots} />
                    : backgroundVariant === 'lines' ?
                        <Background color="hsl(var(--muted-foreground))" gap={20} style={{ opacity: 0.05 }} variant={BackgroundVariant.Lines} />
                        :
                        <Background color="hsl(var(--muted-foreground))" gap={20} style={{ opacity: 0.05 }} variant={BackgroundVariant.Cross} />
                }
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
                {toolbar}
            </ReactFlow>

            {!isLoading && nodes.length === 0 && (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-6 text-center">
                    <div className="flex max-w-sm flex-col items-center gap-3 text-muted-foreground">
                        <GitGraph className="h-14 w-14 text-primary/35" />
                        <div className="space-y-1">
                            <p className="text-sm font-semibold text-foreground/80">
                                {lang === 'vi' ? 'Chưa có bảng trên sơ đồ' : 'No tables on the diagram'}
                            </p>
                            <p className="text-xs text-muted-foreground/70">
                                {lang === 'vi' ? 'Chọn bảng từ thanh bên để bắt đầu dựng ERD.' : 'Select tables from the sidebar to start building the ERD.'}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {hoverPosition && (
                <div
                    className="fixed z-[9999] pointer-events-none transform -translate-x-1/2 -translate-y-[120%]"
                    style={{
                        left: hoverPosition.x,
                        top: hoverPosition.y,
                    }}
                >
                    <div className="bg-card/80 backdrop-blur-xl border border-primary/20 p-3 rounded-xl shadow-2xl ring-1 ring-white/10 flex flex-col items-center gap-1 min-w-[200px] animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium uppercase tracking-widest opacity-60">
                            {lang === 'vi' ? 'Mối quan hệ' : 'Relationship'}
                        </div>
                        <div className="flex items-center gap-2 font-bold text-xs whitespace-nowrap">
                            {(() => {
                                const hoveredEdge = edges.find(e => e.id === hoveredEdgeId);
                                if (!hoveredEdge) return '...';
                                return `${hoveredEdge.source}(${hoveredEdge.sourceHandle}) → ${hoveredEdge.target}(${hoveredEdge.targetHandle})`;
                            })()}
                        </div>
                    </div>
                </div>
            )}

            {pendingConnection && (
                <ForeignKeyDialog
                    isOpen={!!pendingConnection}
                    onClose={() => setPendingConnection(null)}
                    onConfirm={handleCreateForeignKey}
                    {...pendingConnection}
                />
            )}
        </div>
    );
};
