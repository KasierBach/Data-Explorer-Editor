import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Table, Hash, Type, Key } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TableNodeData {
    tableName: string;
    columns: Array<{
        name: string;
        type: string;
        isPrimaryKey?: boolean;
        isForeignKey?: boolean;
    }>;
}

const TableNode = ({ data }: { data: TableNodeData }) => {
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
                        {/* Target Handle (Input) - Left side */}
                        <Handle
                            type="target"
                            position={Position.Left}
                            id={col.name}
                            className="!w-3 !h-3 !-left-1.5 !bg-background !border-2 !border-primary !opacity-0 group-hover/row:!opacity-100 group-hover/row:!scale-125 transition-all !shadow-lg !shadow-primary/20 !z-50"
                        />

                        <div className="flex items-center gap-3 min-w-0">
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
                                col.isPrimaryKey ? "font-black text-foreground" : "font-medium text-muted-foreground group-hover/row:text-foreground"
                            )}>
                                {col.name}
                            </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[9px] font-black uppercase opacity-20 tracking-tighter select-none">{col.type}</span>

                            {/* Source Handle (Output) - Right side */}
                            <Handle
                                type="source"
                                position={Position.Right}
                                id={col.name}
                                className="!w-3 !h-3 !-right-1.5 !bg-primary !border-2 !border-background !opacity-0 group-hover/row:!opacity-100 group-hover/row:!scale-125 transition-all !shadow-lg !shadow-primary/20 !z-50"
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default memo(TableNode);
