import React from 'react';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger
} from "@/presentation/components/ui/tabs";
import { Info, Table as TableIcon, Loader2, Play, GitBranch, X, Eraser, LayoutDashboard, Sparkles, Download } from 'lucide-react';
import type { QueryResult } from '@/core/domain/entities';
import { ResultTable } from './ResultTable';
import { QueryPlanVisualizer } from './QueryPlanVisualizer';
import { useResponsiveLayoutMode } from '@/presentation/hooks/useResponsiveLayoutMode';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/core/services/store';
import { getWorkspaceText } from '@/core/utils/workspaceText';
import { Button } from '@/presentation/components/ui/button';
import { toast } from 'sonner';

interface QueryResultsProps {
    results: QueryResult | null;
    isLoading: boolean;
    isFetching?: boolean;
    error: Error | null;
    executedQuery: string | null;
    dataUpdatedAt: number;
    activeTab: string;
    onTabChange: (tab: string) => void;
    explainPlan?: unknown;
    onClearResults?: () => void;
    onClose?: () => void;
    onSaveToDashboard?: () => void;
    onFixWithAi?: () => void;
    pageIndex: number;
    pageSize: number;
    totalCount?: number;
    onPaginationChange: (pageIndex: number, pageSize: number) => void;
}

export const QueryResults: React.FC<QueryResultsProps> = ({
    results,
    isLoading,
    isFetching = false,
    error,
    executedQuery,
    dataUpdatedAt,
    activeTab,
    onTabChange,
    explainPlan,
    onClearResults,
    onClose,
    onSaveToDashboard,
    onFixWithAi,
    pageIndex,
    pageSize,
    totalCount,
    onPaginationChange,
}) => {
    const { lang } = useAppStore();
    const text = getWorkspaceText(lang).queryResults;
    const { isCompactMobileLayout, isSmallMobile } = useResponsiveLayoutMode();
    const hasExplainPlan = explainPlan !== null && explainPlan !== undefined;
    const isError = !!error;
    const renderDataContent = () => {
        if (isError) {
            return (
                <div className="p-8 text-center flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                        <Info className="w-6 h-6 text-red-500" />
                    </div>
                    <div className="text-red-500 font-bold text-sm">
                        {text.failed}
                    </div>
                    <p className="max-w-md text-red-400/80 text-xs font-mono whitespace-pre-wrap break-words">{(error as Error).message}</p>
                </div>
            );
        }

        if (isLoading) {
            return (
                <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-6 h-6 animate-spin text-primary opacity-50" />
                </div>
            );
        }

        if (!results && !error) {
            return (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm flex-col gap-2">
                    <Play className="w-10 h-10 opacity-10" />
                    <span>{text.empty}</span>
                </div>
            );
        }

        return (
            <ResultTable
                results={results}
                pageIndex={pageIndex}
                pageSize={pageSize}
                totalCount={totalCount}
                isFetching={isFetching}
                onPaginationChange={onPaginationChange}
            />
        );
    };

    return (
        <Tabs value={activeTab} onValueChange={onTabChange} className="h-full flex flex-col">
            <div className="px-2 border-b bg-muted/10 flex items-center justify-between h-9 md:h-8 flex-shrink-0 flex-wrap overflow-hidden">
                <TabsList className="h-full bg-transparent p-0 gap-2 md:gap-4">
                    <TabsTrigger
                        value="data"
                        className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent shadow-none px-1 text-[10px] md:text-[11px] flex gap-1.5"
                    >
                        <TableIcon className="w-3 h-3" />
                        {isCompactMobileLayout ? text.dataCompact : text.dataFull}
                    </TabsTrigger>
                    <TabsTrigger
                        value="messages"
                        className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent shadow-none px-1 text-[10px] md:text-[11px] flex gap-1.5"
                    >
                        <Info className="w-3 h-3" />
                        {isCompactMobileLayout ? text.messagesCompact : text.messagesFull}
                    </TabsTrigger>
                    {hasExplainPlan && (
                        <TabsTrigger
                            value="plan"
                            className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-orange-500 data-[state=active]:bg-transparent shadow-none px-1 text-[10px] md:text-[11px] flex gap-1.5 text-orange-500"
                        >
                            <GitBranch className="w-3 h-3" />
                            {isCompactMobileLayout ? text.planCompact : text.planFull}
                        </TabsTrigger>
                    )}
                </TabsList>

                <div className="flex items-center gap-2">
                    {!isSmallMobile && (
                        <div className="text-[9px] md:text-[10px] text-muted-foreground font-mono flex gap-2 md:gap-3 items-center">
                            {results?.durationMs !== undefined && (
                                <span>{isCompactMobileLayout ? "" : text.timePrefix}{results.durationMs}ms</span>
                            )}
                            {dataUpdatedAt > 0 && (
                                <span className={cn(isCompactMobileLayout && "hidden")}>{new Date(dataUpdatedAt).toLocaleTimeString()}</span>
                            )}
                        </div>
                    )}
                    {(error || results) && onClearResults && (
                        <button
                            onClick={onClearResults}
                            className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors"
                            title={text.clearResults}
                        >
                            <Eraser className="w-3.5 h-3.5" />
                        </button>
                    )}
                    {results && !error && (
                        <button
                            onClick={() => {
                                if (!results.rows?.length) return;
                                const cols = results.columns || Object.keys(results.rows[0] || {});
                                const csvHeaders = cols.join(',');
                                const csvRows = results.rows.map(row =>
                                    cols.map(col => {
                                        const val = row[col];
                                        if (val === null || val === undefined) return '';
                                        const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
                                        return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str.replace(/"/g, '""')}"` : str;
                                    }).join(',')
                                ).join('\n');
                                const blob = new Blob([`${csvHeaders}\n${csvRows}`], { type: 'text/csv;charset=utf-8;' });
                                const url = URL.createObjectURL(blob);
                                const link = document.createElement('a');
                                link.href = url;
                                link.download = `query_result_${Date.now()}.csv`;
                                link.click();
                                URL.revokeObjectURL(url);
                                toast.success(lang === 'vi' ? 'Đã xuất trang kết quả hiện tại' : 'Exported the current result page');
                            }}
                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-green-500 transition-colors"
                            title={lang === 'vi' ? 'Xuất trang hiện tại' : 'Export current page'}
                        >
                            <Download className="w-3.5 h-3.5" />
                        </button>
                    )}
                    {results && !error && onSaveToDashboard && (
                        <button
                            onClick={onSaveToDashboard}
                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                            title={text.saveToDashboard}
                        >
                            <LayoutDashboard className="w-3.5 h-3.5" />
                        </button>
                    )}
                    
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-red-500 transition-colors"
                            title={text.closePanel}
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 relative overflow-hidden bg-card">
                <TabsContent value="data" className="m-0 h-full overflow-hidden">
                    {renderDataContent()}
                </TabsContent>

                <TabsContent value="messages" className="m-0 h-full p-4 font-mono text-[13px] overflow-auto select-text uppercase">
                    {error ? (
                        <div className="space-y-3 text-red-500 whitespace-pre-wrap leading-relaxed">
                            <div>
                                <div className="font-bold mb-2">{text.error}</div>
                                {(error as Error).message}
                            </div>
                            {onFixWithAi && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-fit gap-2 border-violet-500/30 text-violet-400 hover:bg-violet-500/10"
                                    onClick={onFixWithAi}
                                >
                                    <Sparkles className="h-3.5 w-3.5" />
                                    {lang === 'vi' ? 'Sửa bằng AI' : 'Fix with AI'}
                                </Button>
                            )}
                        </div>
                    ) : results ? (
                        <div className="space-y-4">
                            <div className="text-green-600 font-bold flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-600" />
                                {text.success}
                            </div>

                            <div className="text-muted-foreground border-l-2 pl-4 space-y-1">
                                <div>{text.rowsAffected} {results.rowCount ?? 0}</div>
                                <div>{text.columnsReturned} {results.columns?.length ?? 0}</div>
                                <div>{text.executionTime} {results.durationMs ?? 0}ms</div>
                                <div>{text.completedAt} {dataUpdatedAt > 0 ? new Date(dataUpdatedAt).toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US') : '-'}</div>
                            </div>

                            {executedQuery && (
                                <div className="mt-8 pt-4 border-t">
                                    <div className="text-[10px] text-muted-foreground mb-2">{text.sqlStatement}</div>
                                    <pre className="text-xs bg-muted/30 p-3 rounded text-foreground/80 lowercase">
                                        {executedQuery}
                                    </pre>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-muted-foreground italic">{text.noMessages}</div>
                    )}
                </TabsContent>

                {hasExplainPlan && (
                    <TabsContent value="plan" className="m-0 h-full overflow-auto">
                        <QueryPlanVisualizer planData={explainPlan} />
                    </TabsContent>
                )}
            </div>
        </Tabs>
    );
};
