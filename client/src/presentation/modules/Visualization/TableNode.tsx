import { memo } from 'react';
import { Handle, Position, useStore } from '@xyflow/react';
import { Table, Hash, Type, Key, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/presentation/components/ui/context-menu';

export interface TableNodeData {
    tableName: string;
    columns: Array<{
        name: string;
        type: string;
        isPrimaryKey?: boolean;
        isForeignKey?: boolean;
        nullable?: boolean;
        pkConstraintName?: string | null;
        fkConstraintName?: string | null;
    }>;
    onRemoveConstraint?: (tableName: string, type: 'pk' | 'fk', constraintName: string) => void;
    isCollapsed?: boolean;
    onToggleCollapse?: () => void;
    detailLevel?: 'all' | 'keys' | 'name';
}

const connectionNodeIdSelector = (state: any) => state.connectionNodeId ?? state.connection?.fromNodeId;

const TableNode = ({ data }: { data: TableNodeData }) => {
    const connectionNodeId = useStore(connectionNodeIdSelector);
    const isConnecting = !!connectionNodeId;
    const isCollapsed = data.isCollapsed;
    const columnCount = data.columns?.length || 0;

    return (
        <div className="min-w-[260px] max-w-[340px] bg-card/90 backdrop-blur-2xl border-border/40 border rounded-2xl shadow-2xl ring-1 ring-white/5 group transition-all hover:ring-primary/20 hover:border-primary/20">
            {/* Header */}
            <div
                className="bg-primary/10 px-4 py-3 border-b border-border/40 rounded-t-2xl flex items-center gap-3 cursor-pointer select-none"
                onClick={data.onToggleCollapse}
            >
                <div className="p-2 bg-primary/20 rounded-xl text-primary group-hover:scale-110 group-hover:bg-primary group-hover:text-white transition-all shadow-lg shadow-primary/5">
                    <Table className="h-4 w-4" />
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                    <h3 className="font-black text-[11px] uppercase tracking-widest text-foreground truncate">{data.tableName}</h3>
                    <span className="text-[8px] text-muted-foreground uppercase tracking-tighter opacity-40 font-bold">
                        {columnCount} columns
                    </span>
                </div>
                {data.onToggleCollapse && (
                    <div className="text-muted-foreground/40">
                        {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </div>
                )}
            </div>

            {/* Columns - hidden when collapsed */}
            {!isCollapsed && data.columns.length > 0 && (
                <div className="flex flex-col py-1.5 relative">
                    {data.columns.map((col) => (
                        <div
                            key={`${data.tableName}-${col.name}`}
                            className="px-5 py-1.5 flex items-center justify-between gap-4 hover:bg-primary/5 transition-all relative group/row"
                        >
                            {/* Target Handle (Left) - Visible only when connecting */}
                            <Handle
                                type="target"
                                position={Position.Left}
                                id={col.name}
                                className={cn(
                                    "!w-3.5 !h-3.5 !absolute !left-0 !top-1/2 !-translate-y-1/2 !-translate-x-1/2 !rounded-full !border-2 !border-primary !bg-background !z-50 transition-all duration-300",
                                    isConnecting ? "opacity-100 scale-100 ring-4 ring-primary/20 animate-pulse" : "opacity-0 scale-50 pointer-events-none"
                                )}
                                isConnectable={true}
                            />

                            {/* Source Handle (Right) - Visible on row hover */}
                            <Handle
                                type="source"
                                position={Position.Right}
                                id={col.name}
                                className={cn(
                                    "!w-3.5 !h-3.5 !absolute !right-0 !top-1/2 !-translate-y-1/2 !translate-x-1/2 !rounded-full !border-2 !border-background !bg-primary !z-50 !cursor-crosshair transition-all duration-200",
                                    !isConnecting && "group-hover/row:opacity-100 group-hover/row:scale-100",
                                    isConnecting || "opacity-0 scale-50",
                                    isConnecting && "pointer-events-none"
                                )}
                                isConnectable={!isConnecting}
                            />

                            <div className="flex items-center gap-2.5 min-w-0 pointer-events-none ml-1.5 mr-1.5">
                                <div className="shrink-0 flex items-center justify-center w-4">
                                    {col.isPrimaryKey ? (
                                        <Key className="h-3.5 w-3.5 text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.4)]" />
                                    ) : col.fkConstraintName ? (
                                        <Key className="h-3 w-3 text-blue-400 rotate-90" />
                                    ) : typeof col.type === 'string' && (col.type.toLowerCase().includes('int') || col.type.toLowerCase().includes('decimal') || col.type.toLowerCase().includes('numeric')) ? (
                                        <Hash className="h-3 w-3 text-muted-foreground/30" />
                                    ) : (
                                        <Type className="h-3 w-3 text-muted-foreground/30" />
                                    )}
                                </div>

                                <span className={cn(
                                    "text-[11px] truncate select-none tracking-tight",
                                    "font-medium text-muted-foreground group-hover/row:text-foreground",
                                    col.isPrimaryKey && "font-black text-foreground",
                                    col.fkConstraintName && "text-blue-400"
                                )}>
                                    {col.name}
                                </span>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 pointer-events-none">
                                {col.nullable === false && (
                                    <span className="text-[7px] font-bold text-orange-400/60 uppercase tracking-tight">NN</span>
                                )}
                                <span className="text-[9px] font-bold uppercase opacity-20 tracking-tighter select-none">{col.type}</span>
                            </div>

                            {/* Context Menu Wrapper */}
                            <div className="absolute top-0 bottom-0 left-4 right-4 z-30 pointer-events-auto">
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
            )}

            {/* Collapsed footer */}
            {isCollapsed && (
                <div className="px-4 py-2 text-[9px] text-muted-foreground/40 font-bold uppercase tracking-widest text-center">
                    {columnCount} columns hidden
                </div>
            )}
        </div>
    );
};

export default memo(TableNode);
