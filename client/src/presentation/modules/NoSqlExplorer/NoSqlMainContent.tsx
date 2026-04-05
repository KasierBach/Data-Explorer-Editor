import React from 'react';
import { useAppStore } from '@/core/services/store';
import { Leaf, Database, Play, Filter, TreeDeciduous, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { useVerticalResizablePanel } from '@/presentation/hooks/useVerticalResizablePanel';
import { useMediaQuery } from '@/presentation/hooks/useMediaQuery';
import { cn } from '@/lib/utils';
import { useNoSqlQuery } from '@/presentation/hooks/useNoSqlQuery';
import { JsonTreeView } from './JsonTreeView';
import { MqlEditor } from './MqlEditor';
import { NoSqlGridView } from './NoSqlGridView';
import { NoSqlDashboard } from './NoSqlDashboard';

export const NoSqlMainContent: React.FC = () => {
    const { 
        nosqlActiveCollection, 
        nosqlMqlQuery, 
        setNosqlMqlQuery,
        nosqlResult,    
        nosqlViewMode, 
        setNosqlViewMode,
        nosqlActiveConnectionId,
        connections,
        lang
    } = useAppStore();

    const activeConnection = connections.find(c => c.id === nosqlActiveConnectionId);
    const isNoSql = activeConnection?.type === 'mongodb' || activeConnection?.type === 'mongodb+srv' || activeConnection?.type === 'redis';
    const guardrailMessage = activeConnection?.allowQueryExecution === false
        ? (lang === 'vi' ? 'Kết nối này đang tắt quyền chạy truy vấn.' : 'Query execution is disabled for this connection.')
        : activeConnection?.readOnly
            ? (lang === 'vi' ? 'Chế độ chỉ đọc đang bật. Chỉ cho phép find/aggregate.' : 'Read-only mode is enabled. Only find/aggregate actions are allowed.')
            : (lang === 'vi' ? 'Kết quả được giới hạn để bảo vệ hiệu năng và tránh quá tải.' : 'Results are guarded with execution limits to protect performance.');

    const isMobile = useMediaQuery('(max-width: 768px)');
    const resizer = useVerticalResizablePanel({
        initialHeight: 300,
        minHeight: 150,
        maxHeight: 0.8,
    });

    const { isLoading, error, executeMql, result } = useNoSqlQuery();

    if (!isNoSql) {
        return (
            <div className="h-full w-full bg-background flex flex-col items-center justify-center text-muted-foreground p-8 text-center">
                <Leaf className="w-16 h-16 mb-6 opacity-20" />
                <h2 className="text-2xl font-semibold mb-2 text-foreground/80">
                    {lang === 'vi' ? 'Workplace NoSQL đang chờ...' : 'Waiting for NoSQL Workplace...'}
                </h2>
                <p className="max-w-md opacity-70">
                    {lang === 'vi' 
                        ? 'Bạn đang chọn một kết nối Quan hệ (SQL). Hãy chọn một kết nối MongoDB ở thanh Sidebar bên trái để kích hoạt sức mạnh của NoSQL Studio.' 
                        : 'You are currently selecting a Relational (SQL) connection. Select a MongoDB connection from the sidebar to activate the NoSQL Studio.'}
                </p>
            </div>
        );
    }

    if (!nosqlActiveCollection) {
        return <NoSqlDashboard />;
    }

    return (
            <div className="h-full w-full bg-background flex flex-col">
            <div className={cn(
                "mx-4 mt-4 rounded-lg border px-3 py-2 text-xs",
                activeConnection?.allowQueryExecution === false
                    ? "border-red-500/20 bg-red-500/10 text-red-400"
                    : activeConnection?.readOnly
                        ? "border-amber-500/20 bg-amber-500/10 text-amber-400"
                        : "border-green-500/20 bg-green-500/10 text-green-500"
            )}>
                <div className="font-semibold uppercase tracking-wide text-[10px]">
                    {lang === 'vi' ? 'Guardrails NoSQL' : 'NoSQL guardrails'}
                </div>
                <div className="mt-1 text-muted-foreground">{guardrailMessage}</div>
            </div>
            {/* Visual MQL Builder Banner */}
            <div className="h-14 border-b bg-card flex items-center px-4 justify-between shrink-0 mt-4">
                <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-green-500" />
                    <span className="font-semibold text-sm">db.{nosqlActiveCollection}</span>
                    {result && (
                        <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                            {result.rowCount ?? result.rows.length} docs • {result.durationMs}ms
                        </span>
                    )}
                </div>
                
                <div className="flex items-center bg-muted/50 rounded-md p-1 border">
                    <Button 
                        variant={nosqlViewMode === 'tree' ? 'secondary' : 'ghost'} 
                        size="sm" 
                        className="h-7 px-3 text-xs gap-1.5"
                        onClick={() => setNosqlViewMode('tree')}
                    >
                        <TreeDeciduous className="w-3.5 h-3.5 text-green-600" /> Tree (JSON)
                    </Button>
                    <Button 
                        variant={nosqlViewMode === 'grid' ? 'secondary' : 'ghost'} 
                        size="sm" 
                        className="h-7 px-3 text-xs gap-1.5"
                        onClick={() => setNosqlViewMode('grid')}
                    >
                        <Filter className="w-3.5 h-3.5 text-blue-500" /> Auto-Flatten Grid
                    </Button>
                </div>
            </div>

            <div className="flex-1 flex flex-col min-h-0 relative">
                {/* Visual Filter Area (Top) */}
                <div className="flex-1 min-h-0 relative bg-muted/10 flex flex-col">
                    <div className="p-2 border-b text-xs font-semibold text-muted-foreground bg-muted/30 uppercase tracking-widest flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span>{lang === 'vi' ? 'Trình thiết kế Truy vấn (MQL)' : 'Visual MQL Builder'}</span>
                            <span className="text-[9px] font-normal lowercase bg-background border border-border/50 px-1.5 py-0.5 rounded text-muted-foreground tracking-normal">
                                Shift + Alt + F to format
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-normal lowercase bg-muted border px-1.5 py-0.5 rounded text-muted-foreground tracking-normal">Ctrl + Enter</span>
                            <Button 
                                size="sm" 
                                className="h-7 bg-green-600 hover:bg-green-700 text-white gap-1" 
                                onClick={executeMql}
                                disabled={isLoading || activeConnection?.allowQueryExecution === false}
                            >
                                {isLoading 
                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> 
                                    : <Play className="w-3.5 h-3.5 fill-current" />
                                }
                                {lang === 'vi' ? 'Thực thi' : 'Run'}
                            </Button>
                        </div>
                    </div>
                    <div className="flex-1 min-h-0 w-full relative">
                        <MqlEditor 
                            value={nosqlMqlQuery}
                            onChange={(val: string | undefined) => setNosqlMqlQuery(val || '')}
                            onRun={executeMql}
                        />
                    </div>
                </div>
                
                {/* Resize Handle */}
                <div 
                    onMouseDown={resizer.startResizing}
                    className={cn(
                        "h-1.5 bg-muted/20 border-y border-border/10 cursor-row-resize flex items-center justify-center group transition-colors select-none z-20",
                        resizer.isDragging ? "bg-green-500/20" : "hover:bg-green-500/10"
                    )}
                >
                    <div className={cn(
                        "w-12 h-0.5 rounded-full bg-muted-foreground/20 group-hover:bg-green-500/50 transition-colors",
                        resizer.isDragging && "bg-green-500"
                    )} />
                </div>
                
                {/* Result Area (Bottom) */}
                <div 
                    style={{ height: isMobile ? '40vh' : `${resizer.height}px` }}
                    className={cn(
                        "flex flex-col overflow-hidden bg-background shrink-0 relative z-10",
                        resizer.isDragging ? "" : "transition-[height] duration-300 ease-in-out"
                    )}
                >
                    <div className="absolute inset-0 overflow-auto p-4 custom-scrollbar">
                        {isLoading ? (
                            <div className="h-full flex flex-col items-center justify-center gap-3">
                                <div className="w-8 h-8 rounded-full border-2 border-green-500/20 border-t-green-500 animate-spin" />
                                <span className="text-sm font-medium text-green-600 animate-pulse">
                                    {lang === 'vi' ? 'Đang truy vấn BSON...' : 'Querying BSON...'}
                                </span>
                            </div>
                        ) : error ? (
                            <div className="h-full flex flex-col items-center justify-center gap-3 text-destructive">
                                <AlertCircle className="w-8 h-8" />
                                <span className="text-sm font-medium">{error.message}</span>
                            </div>
                        ) : !nosqlResult ? (
                            <div className="h-full flex flex-col items-center justify-center opacity-30 gap-3">
                                <Leaf className="w-8 h-8 text-green-500 animate-pulse" />
                                <span className="text-sm font-medium tracking-wide">
                                    {lang === 'vi' ? 'Nhấn Thực thi để nạp dữ liệu' : 'Click Run to fetch documents'}
                                </span>
                            </div>
                        ) : (
                            nosqlViewMode === 'tree' ? (
                                <div className="bg-muted/20 p-6 rounded-xl border border-border/50 shadow-inner">
                                    <JsonTreeView data={nosqlResult} initialExpanded={true} />
                                </div>
                            ) : (
                                <NoSqlGridView data={nosqlResult} />
                            )
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
