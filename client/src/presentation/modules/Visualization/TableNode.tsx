import { memo, useState, useCallback } from 'react';
import { Handle, Position, useConnection } from '@xyflow/react';
import { Table, Hash, Type, Key, ChevronDown, ChevronRight, X, Settings, Link as LinkIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/core/services/store';

export interface TableNodeData {
    id: string;
    tableName: string;
    type?: 'table' | 'view';
    columns: Array<{
        name: string;
        type: string;
        isPrimaryKey?: boolean;
        isForeignKey?: boolean;
        nullable?: boolean;
    }>;
    onRemove?: (id: string) => void;
    onToggleCollapse?: () => void;
    detailLevel?: 'all' | 'keys' | 'name';
}

const TableNode = ({ data }: { data: TableNodeData }) => {
    const { lang } = useAppStore();
    const connection = useConnection();
    const isConnecting = !!connection.inProgress;
    const columns = data.columns || [];
    const shouldShowAll = data.detailLevel !== 'name';
    
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, column: string } | null>(null);

    const showContextMenu = (e: React.MouseEvent, columnName: string) => {
        setContextMenu({ x: e.clientX, y: e.clientY, column: columnName });
    };

    const handleRemove = (e: React.MouseEvent) => {
        e.stopPropagation();
        data.onRemove?.(data.id);
    };

    return (
        <div className="group relative">
            {/* Glow effect on hover */}
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 to-violet-500/20 rounded-[2rem] blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            
            <div className="bg-card/90 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.4)] overflow-hidden min-w-[300px] ring-1 ring-white/5 group-hover:border-blue-500/30 transition-all duration-500 relative z-10">
                {/* Header */}
                <div 
                    className="p-5 border-b border-white/5 space-y-1 relative bg-gradient-to-br from-blue-500/10 via-transparent to-violet-500/10 cursor-pointer select-none"
                    onClick={data.onToggleCollapse}
                >
                    <div className="flex items-center justify-between">
                        <div className="p-2.5 bg-blue-500/20 rounded-2xl border border-blue-500/20 shadow-lg">
                            <Table className="w-4 h-4 text-blue-400" />
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 px-3 py-1 rounded-full bg-muted/30 border border-white/5">
                                {data.type || 'TABLE'}
                            </div>
                            <X className="w-3.5 h-3.5 text-muted-foreground/30 hover:text-red-400 cursor-pointer transition-colors" onClick={handleRemove} />
                        </div>
                    </div>
                    <div className="pt-3">
                        <h3 className="font-black text-sm tracking-tight truncate pr-8 group-hover:text-blue-400 transition-colors duration-300">
                             {data.tableName}
                        </h3>
                        <div className="flex items-center justify-between mt-2">
                            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">{columns.length} Columns</span>
                            {data.onToggleCollapse && (
                                <div className="text-muted-foreground/40">
                                    {data.detailLevel === 'name' ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <Handle type="target" position={Position.Left} className="!opacity-0 !w-full !h-full" id="table-target" style={{ pointerEvents: 'none' }} />
                    <Handle type="source" position={Position.Right} className="!opacity-0 !w-full !h-full" id="table-source" style={{ pointerEvents: 'none' }} />
                </div>

                {/* Content */}
                {shouldShowAll && (
                    <div className="bg-black/20 backdrop-blur-md max-h-[400px] overflow-y-auto custom-scrollbar">
                        {columns.length > 0 ? columns.map((col) => (
                            <div
                                key={col.name}
                                className={cn(
                                    "group/row flex items-center justify-between px-5 py-3 hover:bg-white/5 transition-all duration-300 relative border-b border-white/5 last:border-0",
                                    col.isPrimaryKey && "bg-blue-500/5"
                                )}
                                onContextMenu={(e) => {
                                    e.preventDefault();
                                    showContextMenu(e, col.name);
                                }}
                            >
                                <div className="flex items-center gap-3 relative z-10 w-full">
                                    <div className="relative shrink-0">
                                        <Handle
                                            type="target"
                                            position={Position.Left}
                                            id={col.name}
                                            className="!w-2 !h-2 !-left-[24px] !bg-blue-500 !border-0 !opacity-0 group-hover/row:!opacity-100 transition-opacity"
                                        />
                                        {col.isPrimaryKey ? (
                                            <Key className="w-3.5 h-3.5 text-amber-500 drop-shadow-[0_0_5px_rgba(245,158,11,0.5)]" />
                                        ) : col.isForeignKey ? (
                                            <LinkIcon className="w-3 h-3 text-blue-400 opacity-60" />
                                        ) : (
                                            <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 group-hover/row:bg-blue-400 transition-colors" />
                                        )}
                                    </div>
                                    <div className="flex flex-col min-w-0 flex-1">
                                        <span className={cn(
                                            "text-xs font-bold tracking-tight transition-colors duration-300 truncate",
                                            col.isPrimaryKey ? "text-amber-500/90" : "text-muted-foreground group-hover/row:text-white"
                                        )}>
                                            {col.name}
                                        </span>
                                        <span className="text-[9px] font-medium text-muted-foreground/40 uppercase tracking-widest">{col.type}</span>
                                    </div>
                                    <Handle
                                        type="source"
                                        position={Position.Right}
                                        id={col.name}
                                        className="!w-2 !h-2 !-right-[24px] !bg-blue-500 !border-0 !opacity-0 group-hover/row:!opacity-100 transition-opacity"
                                    />
                                </div>
                                
                                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-blue-500 opacity-0 group-hover/row:opacity-100 transition-opacity" />
                            </div>
                        )) : (
                            <div className="p-10 text-center space-y-3 opacity-30">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mx-auto animate-pulse" />
                                <span className="text-[9px] font-black uppercase tracking-[0.3em] block">No Fields Found</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
            
            {/* Custom Context Menu Overlay */}
            {contextMenu && (
                <div 
                    className="fixed inset-0 z-[110]" 
                    onClick={() => setContextMenu(null)}
                    onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}
                >
                    <div 
                        className="absolute bg-zinc-900/95 backdrop-blur-2xl border border-white/10 p-1.5 rounded-2xl shadow-2xl min-w-[200px]"
                        style={{ top: contextMenu.y, left: contextMenu.x }}
                    >
                        <div className="px-3 py-2 text-[9px] font-black text-muted-foreground/40 uppercase tracking-[0.2em] border-b border-white/5 mb-1">
                            {contextMenu.column}
                        </div>
                        <button className="flex items-center gap-2 w-full px-3 py-2.5 text-xs text-muted-foreground hover:bg-white/10 hover:text-white rounded-xl transition-all">
                            <Settings className="w-3.5 h-3.5" /> Toggle visibility
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default memo(TableNode);
