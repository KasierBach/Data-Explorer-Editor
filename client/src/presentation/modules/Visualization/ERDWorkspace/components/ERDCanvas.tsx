import React, { useRef } from 'react';
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
    BackgroundVariant,
} from '@xyflow/react';
import { Database } from 'lucide-react';
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
    setPendingConnection: (v: any) => void;
    handleCreateForeignKey: (data: ForeignKeyData) => void;
    handleEdgeMouseEnter?: (event: React.MouseEvent, edge: Edge) => void;
    handleEdgeMouseLeave?: (event: React.MouseEvent, edge: Edge) => void;
    hoverPosition?: { x: number, y: number } | null;
    hoveredEdgeId?: string | null;
    backgroundVariant?: 'dots' | 'lines' | 'cross';
    toolbar?: React.ReactNode;
}

export const ERDCanvas: React.FC<ERDCanvasProps> = ({
    nodes, edges, onNodesChange, onEdgesChange, onConnect, isLoading, effectiveDatabase, lang, showMinimap, pendingConnection, setPendingConnection, handleCreateForeignKey,
    handleEdgeMouseEnter, handleEdgeMouseLeave, hoverPosition, hoveredEdgeId, backgroundVariant = 'dots', toolbar
}) => {
    const reactFlowRef = useRef<any>(null);

    return (
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
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onEdgeMouseEnter={handleEdgeMouseEnter}
                onEdgeMouseLeave={handleEdgeMouseLeave}
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
