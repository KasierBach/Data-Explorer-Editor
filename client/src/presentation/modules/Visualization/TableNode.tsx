import { memo } from 'react';
import { Handle, Position, useStore } from '@xyflow/react';
import { Table, Hash, Type, Key } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/presentation/components/ui/context-menu';

export interface TableNodeData {
    tableName: string;
    columns: Array<{
        name: string;
        type: string;
        isPrimaryKey?: boolean;
        isForeignKey?: boolean;
        pkConstraintName?: string | null;
        fkConstraintName?: string | null;
    }>;
    onRemoveConstraint?: (tableName: string, type: 'pk' | 'fk', constraintName: string) => void;
}

const connectionNodeIdSelector = (state: any) => state.connectionNodeId ?? state.connection?.fromNodeId;

const TableNode = ({ data }: { data: TableNodeData }) => {
    const connectionNodeId = useStore(connectionNodeIdSelector);
    const isConnecting = !!connectionNodeId;

    return (
        <div className="min-w-[240px] bg-card/90 backdrop-blur-2xl border-border/40 border rounded-2xl shadow-2xl overflow-hidden ring-1 ring-white/5 group transition-all hover:ring-primary/20 hover:border-primary/20">
            {/* Header */}
            <div className="bg-primary/10 px-4 py-3 border-b border-border/40 flex items-center gap-3">
                <div className="p-2 bg-primary/20 rounded-xl text-primary group-hover:scale-110 group-hover:bg-primary group-hover:text-white transition-all shadow-lg shadow-primary/5">
                    <Table className="h-4 w-4" />
                </div>
                <div className="flex flex-col min-w-0">
                    <h3 className="font-black text-[11px] uppercase tracking-widest text-foreground truncate">{data.tableName}</h3>
                    <span className="text-[8px] text-muted-foreground uppercase tracking-tighter opacity-40 font-bold">Base Table</span>
                </div>
            </div>

            {/* Columns */}
            <div className="flex flex-col py-2 relative">
                {data.columns.map((col) => (
                    <div
                        key={`${data.tableName}-${col.name}`}
                        className="px-5 py-2 flex items-center justify-between gap-6 hover:bg-primary/5 transition-all relative group/row"
                    >
                        {/* 
                            INTERACTION LOGIC:
                            - Source Handle (Right): active when NOT connecting. Covers full row.
                            - Target Handle (Left): active when connecting. Covers full row.
                        */}

                        {/* Target Handle (Input) - Always present, lower z-index */}
                        <Handle
                            type="target"
                            position={Position.Left}
                            id={col.name}
                            className="!w-2 !h-2 !absolute !left-0 !top-1/2 !-translate-y-1/2 !-translate-x-1/2 !rounded-full !border-none !bg-transparent !z-40"
                            style={{ opacity: 0 }}
                            isConnectableStart={false} // Cannot start drag from target
                        />

                        {/* Source Handle (Output) - Higher z-index, disabled during connection */}
                        <Handle
                            type="source"
                            position={Position.Right}
                            id={col.name}
                            className={cn(
                                "!w-2 !h-2 !absolute !right-0 !top-1/2 !-translate-y-1/2 !translate-x-1/2 !rounded-full !border-none !bg-transparent !z-50",
                                isConnecting && "pointer-events-none" // Critically important: hide source when connecting so target below is clickable
                            )}
                            style={{ opacity: 0 }}
                            isConnectable={!isConnecting} // Disable interaction logic
                        />


                        {/* VISUALS ONLY */}

                        {/* Visual Target Dot */}
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 bg-background border-2 border-primary rounded-full opacity-50 group-hover/row:opacity-100 group-hover/row:scale-125 transition-all shadow-lg shadow-primary/20 pointer-events-none" />

                        <div className="flex items-center gap-3 min-w-0 pointer-events-none">
                            <div className="shrink-0 flex items-center justify-center w-4">
                                {col.isPrimaryKey ? (
                                    <Key className="h-3.5 w-3.5 text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.4)]" />
                                ) : col.isForeignKey ? (
                                    <div className="h-3.5 w-3.5 rounded-full bg-blue-500/20 flex items-center justify-center">
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                                    </div>
                                ) : typeof col.type === 'string' && (col.type.toLowerCase().includes('int') || col.type.toLowerCase().includes('decimal') || col.type.toLowerCase().includes('numeric')) ? (
                                    <Hash className="h-3 w-3 text-muted-foreground/30" />
                                ) : (
                                    <Type className="h-3 w-3 text-muted-foreground/30" />
                                )}
                            </div>

                            <span className={cn(
                                "text-[12px] truncate select-none tracking-tight",
                                "font-medium text-muted-foreground group-hover/row:text-foreground",
                                col.isPrimaryKey && "font-black text-foreground",
                                col.isForeignKey && "text-blue-400"
                            )}>
                                {col.name}
                            </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 pointer-events-none">
                            <span className="text-[9px] font-black uppercase opacity-20 tracking-tighter select-none">{col.type}</span>
                        </div>

                        {/* Visual Source Dot */}
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3 h-3 bg-primary border-2 border-background rounded-full opacity-50 group-hover/row:opacity-100 group-hover/row:scale-125 transition-all shadow-lg shadow-primary/20 pointer-events-none" />

                        {/* Context Menu Wrapper */}
                        <div className="absolute inset-0 z-30">
                            <ContextMenu>
                                <ContextMenuTrigger className="w-full h-full block" />
                                <ContextMenuContent>
                                    <ContextMenuItem
                                        disabled={!col.isPrimaryKey && !col.isForeignKey}
                                        className="text-xs text-muted-foreground"
                                    >
                                        Column: <span className="text-foreground font-bold ml-1">{col.name}</span>
                                    </ContextMenuItem>

                                    {col.isPrimaryKey && data.onRemoveConstraint && col.pkConstraintName && (
                                        <ContextMenuItem
                                            className="text-red-500 focus:text-red-500 focus:bg-red-500/10"
                                            onSelect={() => data.onRemoveConstraint!(data.tableName, 'pk', col.pkConstraintName!)}
                                        >
                                            Remove Primary Key
                                        </ContextMenuItem>
                                    )}

                                    {col.isForeignKey && data.onRemoveConstraint && col.fkConstraintName && (
                                        <ContextMenuItem
                                            className="text-red-500 focus:text-red-500 focus:bg-red-500/10"
                                            onSelect={() => data.onRemoveConstraint!(data.tableName, 'fk', col.fkConstraintName!)}
                                        >
                                            Remove Foreign Key
                                        </ContextMenuItem>
                                    )}
                                </ContextMenuContent>
                            </ContextMenu>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default memo(TableNode);
