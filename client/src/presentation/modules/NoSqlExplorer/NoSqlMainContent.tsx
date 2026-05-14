import React from 'react';
import { useAppStore } from '@/core/services/store';
import { Leaf, Database, Play, Filter, TreeDeciduous, Loader2, X, BarChart3, SearchCode, Layers, AlignLeft, AlertCircle } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { useVerticalResizablePanel } from '@/presentation/hooks/useVerticalResizablePanel';
import { useResponsiveLayoutMode } from '@/presentation/hooks/useResponsiveLayoutMode';
import { cn } from '@/lib/utils';
import { useNoSqlQuery } from '@/presentation/hooks/useNoSqlQuery';
import { JsonTreeView } from './JsonTreeView';
import { MqlEditor } from './MqlEditor';
import { NoSqlGridView } from './NoSqlGridView';
import { NoSqlDashboard } from './NoSqlDashboard';
import { NoSqlVisualizeView } from './NoSqlVisualizeView';
import { NoSqlSchemaAnalysisView } from './NoSqlSchemaAnalysisView';
import { NoSqlAggregationBuilderView } from './NoSqlAggregationBuilderView';
import { NoSqlAiQueryBox } from './components/NoSqlAiQueryBox';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/presentation/components/ui/popover";
import { Sparkles } from 'lucide-react';

export const NoSqlMainContent: React.FC = () => {
    const { 
        nosqlActiveCollection, 
        setNosqlCollection,
        nosqlMqlQuery, 
        setNosqlMqlQuery,
        nosqlResult,
        nosqlViewMode, 
        setNosqlViewMode,
        nosqlActiveConnectionId,
        connections,
        lang,
        isResultPanelOpen,
        defaultResultHeight,
        setDefaultResultHeight
    } = useAppStore();

    const activeConnection = connections.find(c => c.id === nosqlActiveConnectionId);
    const isNoSql = activeConnection?.type === 'mongodb' || activeConnection?.type === 'mongodb+srv' || activeConnection?.type === 'redis';
    const hasPersistentGuardrail = Boolean(
        activeConnection?.readOnly || activeConnection?.allowQueryExecution === false
    );
    const guardrailMessage = activeConnection?.allowQueryExecution === false
        ? (lang === 'vi' ? 'Kết nối này đang tắt quyền chạy truy vấn.' : 'Query execution is disabled for this connection.')
        : activeConnection?.readOnly
            ? (lang === 'vi' ? 'Chế độ chỉ đọc đang bật. Chỉ cho phép find/aggregate.' : 'Read-only mode is enabled. Only find/aggregate actions are allowed.')
            : (lang === 'vi' ? 'Kết quả được giới hạn để bảo vệ hiệu năng và tránh quá tải.' : 'Results are guarded with execution limits to protect performance.');

    const { isCompactMobileLayout } = useResponsiveLayoutMode();
    const resizer = useVerticalResizablePanel({
        initialHeight: defaultResultHeight || 300,
        minHeight: 150,
        maxHeight: 0.8,
        onHeightChange: setDefaultResultHeight
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
            {hasPersistentGuardrail && (
                <div className={cn(
                    "mx-4 mt-4 rounded-lg border px-3 py-2 text-xs",
                    activeConnection?.allowQueryExecution === false
                        ? "border-red-500/20 bg-red-500/10 text-red-400"
                        : "border-amber-500/20 bg-amber-500/10 text-amber-400"
                )}>
                    <div className="font-semibold uppercase tracking-wide text-[10px]">
                        {lang === 'vi' ? 'Guardrails NoSQL' : 'NoSQL guardrails'}
                    </div>
                    <div className="mt-1 text-muted-foreground">{guardrailMessage}</div>
                </div>
            )}
            {/* Top Bar: Collection name + View modes + Close */}
            <div className={cn(`border-b bg-card px-3 py-1.5 shrink-0 flex items-center gap-2 overflow-hidden ${hasPersistentGuardrail ? 'mt-4' : ''}`)}>
                <div className="flex items-center gap-1.5 min-w-0 shrink-0">
                    <Database className="w-4 h-4 text-green-500 shrink-0" />
                    <span className="font-semibold text-sm truncate max-w-[160px]">db.{nosqlActiveCollection}</span>
                </div>

                <div className="w-px h-5 bg-border/40 shrink-0" />

                {/* View mode buttons - scrollable if space is tight */}
                <div className="flex items-center bg-muted/50 rounded-md p-1 border flex-1 min-w-0 overflow-x-auto scrollbar-none">
                    <Button 
                        variant={nosqlViewMode === 'tree' ? 'secondary' : 'ghost'} 
                        size="sm" 
                        className="h-7 px-3 text-xs gap-1.5 shrink-0"
                        onClick={() => setNosqlViewMode('tree')}
                    >
                        <TreeDeciduous className="w-3.5 h-3.5 text-green-600" /> <span className="whitespace-nowrap">{isCompactMobileLayout ? 'Tree' : 'Tree (JSON)'}</span>
                    </Button>
                    <Button 
                        variant={nosqlViewMode === 'grid' ? 'secondary' : 'ghost'} 
                        size="sm" 
                        className="h-7 px-3 text-xs gap-1.5 shrink-0"
                        onClick={() => setNosqlViewMode('grid')}
                    >
                        <Filter className="w-3.5 h-3.5 text-blue-500" /> <span className="whitespace-nowrap">{isCompactMobileLayout ? 'Grid' : 'Auto-Flatten Grid'}</span>
                    </Button>
                    <Button 
                        variant={nosqlViewMode === 'charts' ? 'secondary' : 'ghost'} 
                        size="sm" 
                        className="h-7 px-3 text-xs gap-1.5 shrink-0"
                        onClick={() => setNosqlViewMode('charts')}
                    >
                        <BarChart3 className="w-3.5 h-3.5 text-orange-500" /> <span className="whitespace-nowrap">{isCompactMobileLayout ? 'Viz' : 'Visualize'}</span>
                    </Button>
                    <Button 
                        variant={nosqlViewMode === 'schema' ? 'secondary' : 'ghost'} 
                        size="sm" 
                        className="h-7 px-3 text-xs gap-1.5 shrink-0"
                        onClick={() => setNosqlViewMode('schema')}
                    >
                        <SearchCode className="w-3.5 h-3.5 text-indigo-500" /> <span className="whitespace-nowrap">{isCompactMobileLayout ? 'Schema' : 'Schema Analysis'}</span>
                    </Button>
                    <Button 
                        variant={nosqlViewMode === 'aggregation' ? 'secondary' : 'ghost'} 
                        size="sm" 
                        className="h-7 px-3 text-xs gap-1.5 shrink-0"
                        onClick={() => setNosqlViewMode('aggregation')}
                    >
                        <Layers className="w-3.5 h-3.5 text-pink-500" /> <span className="whitespace-nowrap">{isCompactMobileLayout ? 'Steps' : 'Aggregation Builder'}</span>
                    </Button>
                </div>

                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                    onClick={() => setNosqlCollection(null)}
                    title={lang === 'vi' ? 'Đóng collection' : 'Close collection'}
                >
                    <X className="w-4 h-4" />
                </Button>
            </div>

            <div className="flex-1 flex flex-col min-h-0 relative">
                {/* Visual Filter Area (Top) */}
                <div className="flex-1 min-h-0 relative bg-muted/10 flex flex-col">
                    {/* MQL Designer bar - nowrap, overflow hidden */}
                    <div className="px-3 py-1.5 border-b text-xs font-semibold text-muted-foreground bg-muted/30 uppercase tracking-widest flex items-center justify-between gap-2 overflow-hidden">
                        <div className="flex items-center gap-2 min-w-0 shrink truncate">
                            <span className="truncate whitespace-nowrap">{lang === 'vi' ? 'Trình thiết kế Truy vấn (MQL)' : 'Visual MQL Builder'}</span>
                            <span className="text-[9px] font-normal lowercase bg-background border border-border/50 px-1.5 py-0.5 rounded text-muted-foreground tracking-normal whitespace-nowrap hidden md:inline">
                                Shift + Alt + F to format
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                            {/* AI NoSQL Button */}
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 gap-1.5 px-2 hover:bg-green-500/10 text-green-500/80 hover:text-green-400 transition-all border border-transparent hover:border-green-500/20"
                                        title={lang === 'vi' ? 'Hỏi trợ lý AI sinh MQL' : 'Ask AI to generate MQL'}
                                    >
                                        <Sparkles className="w-3.5 h-3.5 fill-green-500/10" />
                                        <span className="font-semibold text-[10px] uppercase tracking-wider">{isCompactMobileLayout ? 'AI' : 'AI NoSQL'}</span>
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[min(450px,calc(100vw-1rem))] p-0 border-white/10 bg-background/95 backdrop-blur-xl shadow-2xl rounded-2xl overflow-hidden" align="start" sideOffset={10}>
                                    <NoSqlAiQueryBox
                                        currentConnectionId={nosqlActiveConnectionId || ''}
                                        currentDatabase={activeConnection?.database || undefined}
                                        collectionName={nosqlActiveCollection}
                                        onGenerate={(generatedMql) => {
                                            setNosqlMqlQuery(generatedMql);
                                        }}
                                    />
                                </PopoverContent>
                            </Popover>

                            <div className="w-px h-4 bg-border/40" />

                            {/* Result chip */}
                            {result && (
                                <div className="flex items-center gap-1 px-2 py-0.5 bg-green-500/10 border border-green-500/20 rounded-full shrink-0">
                                    <span className="text-[10px] font-bold text-green-500/80">{result.rowCount ?? result.rows.length}</span>
                                    <span className="text-[9px] text-green-500/50 uppercase tracking-tighter">docs</span>
                                    <div className="w-1 h-1 rounded-full bg-green-500/20 mx-0.5" />
                                    <span className="text-[10px] font-medium text-green-500/70">{result.durationMs}ms</span>
                                </div>
                            )}

                            <div className="w-px h-4 bg-border/40" />

                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-muted-foreground hover:text-green-500 hover:bg-green-500/10 gap-1.5 px-2"
                                onClick={() => {
                                    try {
                                        const formatted = JSON.stringify(JSON.parse(nosqlMqlQuery), null, 2);
                                        setNosqlMqlQuery(formatted);
                                    } catch (e) {
                                        console.error('Failed to format MQL:', e);
                                    }
                                }}
                                title="Alt+Shift+F"
                            >
                                <AlignLeft className="w-3.5 h-3.5" />
                                <span>Format</span>
                            </Button>
                            <span className={cn("text-[10px] font-normal lowercase bg-muted border px-1.5 py-0.5 rounded text-muted-foreground tracking-normal", isCompactMobileLayout && "hidden")}>Ctrl + Enter</span>
                            <Button 
                                size="sm" 
                                className={cn("h-7 bg-green-600 hover:bg-green-700 text-white gap-1", isCompactMobileLayout && "ml-auto")} 
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
                    onPointerDown={resizer.startResizing}
                    className={cn(
                        "h-1.5 bg-muted/20 border-y border-border/10 cursor-row-resize flex items-center justify-center group transition-colors select-none z-20 touch-none",
                        resizer.isDragging ? "bg-green-500/20" : "hover:bg-green-500/10",
                        !isResultPanelOpen && "hidden"
                    )}
                >
                    <div className={cn(
                        "w-12 h-0.5 rounded-full bg-muted-foreground/20 group-hover:bg-green-500/50 transition-colors",
                        resizer.isDragging && "bg-green-500"
                    )} />
                </div>
                
                {/* Result Area (Bottom) */}
                <div 
                    style={{ height: isResultPanelOpen ? `${resizer.height}px` : '0px' }}
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
                            <>
                                {nosqlViewMode === 'tree' && (
                                    <div className="bg-muted/20 p-6 rounded-xl border border-border/50 shadow-inner">
                                        <JsonTreeView data={nosqlResult} initialExpanded={true} />
                                    </div>
                                )}
                                {nosqlViewMode === 'grid' && (
                                    <NoSqlGridView data={nosqlResult} />
                                )}
                                {nosqlViewMode === 'charts' && (
                                    <NoSqlVisualizeView data={nosqlResult} />
                                )}
                                {nosqlViewMode === 'schema' && (
                                    <NoSqlSchemaAnalysisView />
                                )}
                                {nosqlViewMode === 'aggregation' && (
                                    <NoSqlAggregationBuilderView />
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
