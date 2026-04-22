import { memo, useState, useMemo } from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import { Table, Hash, Key, ChevronDown, ChevronRight, X, Settings, Link as LinkIcon, Info, Database, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

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
        comment?: string | null;
    }>;
    comment?: string | null;
    rowCount?: number;
    indices?: Array<{
        name: string;
        columns: string[];
        isUnique: boolean;
        isPrimary: boolean;
    }>;
    onRemove?: (id: string) => void;
    onToggleCollapse?: () => void;
    isCollapsed?: boolean;
    detailLevel?: 'all' | 'keys' | 'name';
    selected?: boolean;
    performanceMode?: boolean;
}

const TableNode = ({ data, selected }: { data: TableNodeData, selected?: boolean }) => {
    // Memoize the base columns map to prevent full regeneration on each table re-render
    const columns = useMemo(() => data.columns || [], [data.columns]);
    const shouldShowAll = data.detailLevel !== 'name';
    const [showIndices, setShowIndices] = useState(false);
    
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, column: string } | null>(null);

    const showContextMenu = (e: React.MouseEvent, columnName: string) => {
        setContextMenu({ x: e.clientX, y: e.clientY, column: columnName });
    };

    const handleRemove = (e: React.MouseEvent) => {
        e.stopPropagation();
        data.onRemove?.(data.id);
    };

    const isPerf = data.performanceMode;

    return (
        <div className={cn("group relative h-full", isPerf ? "will-change-transform" : "")}>
            <NodeResizer 
                minWidth={300} 
                minHeight={150} 
                isVisible={selected} 
                lineClassName="border-blue-500/50" 
                handleClassName="h-3 w-3 bg-white border-2 border-blue-500 rounded-full"
            />
            
            {/* Glow effect on hover (Disabled in Performance Mode) */}
            {!isPerf && (
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/10 to-violet-500/10 rounded-[2rem] blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            )}
            
            <div className={cn(
                "border rounded-3xl h-full flex flex-col ring-1 ring-white/5 relative z-10",
                isPerf 
                    ? "bg-card/80 backdrop-blur-md transition-none" 
                    : "bg-zinc-950 border-white/10 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.4)] transition-all duration-500",
                selected ? "border-blue-500/50 shadow-[0_0_30px_rgba(59,130,246,0.2)]" : "group-hover:border-blue-500/30"
            )}>
                {/* Header */}
                <div 
                    className="p-5 border-b border-white/5 space-y-1 relative bg-gradient-to-br from-blue-500/10 via-transparent to-violet-500/10 cursor-pointer select-none shrink-0"
                    onClick={data.onToggleCollapse}
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-blue-500/20 rounded-2xl border border-blue-500/20 shadow-lg">
                                <Table className="w-4 h-4 text-blue-400" />
                            </div>
                            {data.rowCount !== undefined && data.rowCount > 0 && (
                                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/5 rounded-full border border-white/5">
                                    <Hash className="w-3 h-3 text-muted-foreground/60" />
                                    <span className="text-[10px] font-bold text-muted-foreground/80">~{data.rowCount.toLocaleString()}</span>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 px-3 py-1 rounded-full bg-muted/30 border border-white/5">
                                {data.type || 'TABLE'}
                            </div>
                            <X className="w-3.5 h-3.5 text-muted-foreground/30 hover:text-red-400 cursor-pointer transition-colors" onClick={handleRemove} />
                        </div>
                    </div>
                    <div className="pt-3">
                        <h3 className="font-black text-sm tracking-tight truncate group-hover:text-blue-400 transition-colors duration-300">
                             {data.tableName}
                        </h3>
                        {data.comment && (
                            <p className="text-[10px] text-muted-foreground/50 mt-1 line-clamp-1 italic font-medium leading-relaxed">
                                "{data.comment}"
                            </p>
                        )}
                        <div className="flex items-center justify-between mt-3">
                            <div className="flex gap-2">
                                <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">{columns.length} Fields</span>
                                {data.indices?.length ? (
                                    <button 
                                        className={cn(
                                            "text-[9px] font-bold uppercase tracking-widest transition-colors flex items-center gap-1",
                                            showIndices ? "text-blue-400" : "text-muted-foreground/40 hover:text-muted-foreground/60"
                                        )}
                                        onClick={(e) => { e.stopPropagation(); setShowIndices(!showIndices); }}
                                    >
                                        <Layers className="w-2.5 h-2.5" />
                                        {data.indices.length} Indices
                                    </button>
                                ) : null}
                            </div>
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

                {/* Indices Section */}
                {showIndices && data.indices && (
                    <div className="bg-blue-500/5 border-b border-white/5 p-3 space-y-2 animate-in slide-in-from-top duration-300">
                        <div className="flex items-center gap-2 mb-1">
                            <Layers className="w-3 h-3 text-blue-400" />
                            <span className="text-[9px] font-black text-blue-400/80 uppercase tracking-widest">Indices</span>
                        </div>
                        {data.indices.map(idx => (
                            <div key={idx.name} className="flex flex-col gap-1 p-2 bg-black/20 rounded-xl border border-white/5">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-white/80 truncate">{idx.name}</span>
                                    {idx.isUnique && <span className="text-[8px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-md border border-blue-500/20">UNIQUE</span>}
                                </div>
                                <span className="text-[9px] text-muted-foreground/40 italic">{idx.columns.join(', ')}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Content */}
                {shouldShowAll && (
                    <div className="flex-1 overflow-y-auto custom-scrollbar bg-black/10">
                        {columns.length > 0 ? columns.map((col) => {
                            const nestLevel = (col.name.match(/\./g) || []).length;
                            const displayName = col.name.split('.').pop() || col.name;
                            const isArrayNode = col.name.includes('[]');

                            return (
                            <div
                                key={col.name}
                                className={cn(
                                    "group/row flex items-center justify-between px-5 py-3 hover:bg-white/5 transition-all duration-300 relative border-b border-white/5 last:border-0",
                                    col.isPrimaryKey && "bg-blue-500/5"
                                )}
                                style={{ paddingLeft: `${1.25 + nestLevel * 1}rem` }}
                                onContextMenu={(e) => {
                                    e.preventDefault();
                                    showContextMenu(e, col.name);
                                }}
                            >
                                <div className="flex items-center gap-3 relative z-10 w-full">
                                    <div className="relative shrink-0 flex items-center justify-center w-4">
                                        <Handle
                                            type="target"
                                            position={Position.Left}
                                            id={col.name}
                                            className="!w-2 !h-2 !-left-1 !bg-blue-500 !border-0 !opacity-0 group-hover/row:!opacity-100 transition-opacity z-[100]"
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
                                        <div className="flex items-center justify-between gap-2">
                                            <span className={cn(
                                                "text-xs font-bold tracking-tight transition-colors duration-300 truncate",
                                                col.isPrimaryKey ? "text-amber-500/90" : "text-muted-foreground group-hover/row:text-white"
                                            )}>
                                                {isArrayNode && !displayName.includes('[]') ? displayName + ' []' : displayName}
                                            </span>
                                            <span className="text-[9px] font-medium text-muted-foreground/40 uppercase tracking-widest">{col.type}</span>
                                        </div>
                                        {col.comment && (
                                            <p className="text-[9px] text-muted-foreground/30 truncate mt-0.5" title={col.comment}>
                                                {col.comment}
                                            </p>
                                        )}
                                    </div>
                                    <Handle
                                        type="source"
                                        position={Position.Right}
                                        id={col.name}
                                        className="!w-2 !h-2 !-right-1 !bg-blue-500 !border-0 !opacity-0 group-hover/row:!opacity-100 transition-opacity z-[100]"
                                    />
                                </div>
                                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-blue-500 opacity-0 group-hover/row:opacity-100 transition-opacity" />
                            </div>
                        )}) : (
                            <div className="p-10 text-center space-y-3 opacity-30">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mx-auto animate-pulse" />
                                <span className="text-[9px] font-black uppercase tracking-[0.3em] block">No Fields Found</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Footer Info */}
                {!data.isCollapsed && data.detailLevel === 'all' && (
                     <div className="p-3 bg-muted/5 border-t border-white/5 flex items-center justify-center gap-4 shrink-0">
                         <div className="flex items-center gap-1.5 text-[9px] font-bold text-muted-foreground/40 uppercase tracking-widest">
                             <Database className="w-2.5 h-2.5" />
                             Persistent
                         </div>
                         <div className="w-1 h-1 rounded-full bg-white/10" />
                         <div className="flex items-center gap-1.5 text-[9px] font-bold text-muted-foreground/40 uppercase tracking-widest">
                             <Info className="w-2.5 h-2.5" />
                             Informative
                         </div>
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
