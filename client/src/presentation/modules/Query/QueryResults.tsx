import React from 'react';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger
} from "@/presentation/components/ui/tabs";
import { Info, Table as TableIcon, Loader2, Play, GitBranch } from 'lucide-react';
import type { QueryResult } from '@/core/domain/entities';
import { ResultTable } from './ResultTable';
import { QueryPlanVisualizer } from './QueryPlanVisualizer';
import { useMediaQuery } from '@/presentation/hooks/useMediaQuery';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/core/services/store';

interface QueryResultsProps {
    results: QueryResult | null;
    isLoading: boolean;
    error: Error | null;
    executedQuery: string | null;
    dataUpdatedAt: number;
    activeTab: string;
    onTabChange: (tab: string) => void;
    explainPlan?: any;
}

export const QueryResults: React.FC<QueryResultsProps> = ({
    results,
    isLoading,
    error,
    executedQuery,
    dataUpdatedAt,
    activeTab,
    onTabChange,
    explainPlan
}) => {
    const { lang } = useAppStore();
    const isMobile = useMediaQuery('(max-width: 768px)');
    const isSmallMobile = useMediaQuery('(max-width: 480px)');

    // Determine content based on state
    const renderDataContent = () => {
        if (isError) {
            return (
                <div className="p-8 text-center flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                        <Info className="w-6 h-6 text-red-500" />
                    </div>
                    <div className="text-red-500 font-bold text-sm">
                        {lang === 'vi' ? 'TRUY VẤN THẤT BẠI' : 'QUERY FAILED'}
                    </div>
                    <p className="text-red-400/80 text-xs max-w-md font-mono whitespace-pre-wrap">{(error as Error).message}</p>
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
                    <span>{lang === 'vi' ? 'Chạy truy vấn để xem kết quả' : 'Run a query to see results'}</span>
                </div>
            );
        }

        return <ResultTable results={results} />;
    };

    const isError = !!error;

    return (
        <Tabs value={activeTab} onValueChange={onTabChange} className="h-full flex flex-col">
            <div className="px-2 border-b bg-muted/10 flex items-center justify-between h-9 md:h-8 flex-shrink-0 flex-wrap overflow-hidden">
                <TabsList className="h-full bg-transparent p-0 gap-2 md:gap-4">
                    <TabsTrigger
                        value="data"
                        className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent shadow-none px-1 text-[10px] md:text-[11px] flex gap-1.5"
                    >
                        <TableIcon className="w-3 h-3" />
                        {isMobile ? (lang === 'vi' ? "Dữ liệu" : "Data") : (lang === 'vi' ? "Kết quả dữ liệu" : "Data Output")}
                    </TabsTrigger>
                    <TabsTrigger
                        value="messages"
                        className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent shadow-none px-1 text-[10px] md:text-[11px] flex gap-1.5"
                    >
                        <Info className="w-3 h-3" />
                        {isMobile ? (lang === 'vi' ? "T.Báo" : "Msgs") : (lang === 'vi' ? "Thông báo" : "Messages")}
                    </TabsTrigger>
                    {explainPlan && (
                        <TabsTrigger
                            value="plan"
                            className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-orange-500 data-[state=active]:bg-transparent shadow-none px-1 text-[10px] md:text-[11px] flex gap-1.5 text-orange-500"
                        >
                            <GitBranch className="w-3 h-3" />
                            {isMobile ? (lang === 'vi' ? "Sơ đồ" : "Plan") : (lang === 'vi' ? "Sơ đồ truy vấn" : "Query Plan")}
                        </TabsTrigger>
                    )}
                </TabsList>

                {!isSmallMobile && (
                    <div className="text-[9px] md:text-[10px] text-muted-foreground font-mono flex gap-2 md:gap-3 items-center">
                        {results?.durationMs !== undefined && (
                            <span>{isMobile ? "" : (lang === 'vi' ? "Thời gian: " : "Time: ")}{results.durationMs}ms</span>
                        )}
                        {dataUpdatedAt > 0 && (
                            <span className={cn(isMobile && "hidden")}>{new Date(dataUpdatedAt).toLocaleTimeString()}</span>
                        )}
                    </div>
                )}
            </div>

            <div className="flex-1 relative overflow-hidden bg-card">
                <TabsContent value="data" className="m-0 h-full overflow-auto">
                    {renderDataContent()}
                </TabsContent>

                <TabsContent value="messages" className="m-0 h-full p-4 font-mono text-[13px] overflow-auto select-text uppercase">
                    {error ? (
                        <div className="text-red-500 whitespace-pre-wrap leading-relaxed">
                            <div className="font-bold mb-2">{lang === 'vi' ? 'LỖI:' : 'ERROR:'}</div>
                            {(error as Error).message}
                        </div>
                    ) : results ? (
                        <div className="space-y-4">
                            <div className="text-green-600 font-bold flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-600" />
                                {lang === 'vi' ? 'TRUY VẤN THỰC THI THÀNH CÔNG.' : 'QUERY EXECUTED SUCCESSFULLY.'}
                            </div>

                            <div className="text-muted-foreground border-l-2 pl-4 space-y-1">
                                <div>{lang === 'vi' ? 'SỐ DÒNG ẢNH HƯỞNG:' : 'ROWS AFFECTED:'} {results.rowCount ?? 0}</div>
                                <div>{lang === 'vi' ? 'SỐ CỘT TRẢ VỀ:' : 'COLUMNS RETURNED:'} {results.columns?.length ?? 0}</div>
                                <div>{lang === 'vi' ? 'THỜI GIAN THỰC THI:' : 'EXECUTION TIME:'} {results.durationMs ?? 0}ms</div>
                                <div>{lang === 'vi' ? 'HOÀN THÀNH LÚC:' : 'COMPLETED AT:'} {dataUpdatedAt > 0 ? new Date(dataUpdatedAt).toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US') : '-'}</div>
                            </div>

                            {executedQuery && (
                                <div className="mt-8 pt-4 border-t">
                                    <div className="text-[10px] text-muted-foreground mb-2">{lang === 'vi' ? 'CÂU LỆNH SQL:' : 'SQL STATEMENT:'}</div>
                                    <pre className="text-xs bg-muted/30 p-3 rounded text-foreground/80 lowercase">
                                        {executedQuery}
                                    </pre>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-muted-foreground italic">{lang === 'vi' ? 'Không có thông báo nào.' : 'No messages to display.'}</div>
                    )}
                </TabsContent>

                {explainPlan && (
                    <TabsContent value="plan" className="m-0 h-full overflow-auto">
                        <QueryPlanVisualizer planData={explainPlan} />
                    </TabsContent>
                )}
            </div>
        </Tabs>
    );
};
