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
    // Determine content based on state
    const renderDataContent = () => {
        if (isError) {
            return (
                <div className="p-8 text-center flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                        <Info className="w-6 h-6 text-red-500" />
                    </div>
                    <div className="text-red-500 font-bold text-sm">QUERY FAILED</div>
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
                    <span>Run a query to see results</span>
                </div>
            );
        }

        return <ResultTable results={results} />;
    };

    const isError = !!error;

    return (
        <Tabs value={activeTab} onValueChange={onTabChange} className="h-full flex flex-col">
            <div className="px-2 border-b bg-muted/10 flex items-center justify-between h-8 flex-shrink-0">
                <TabsList className="h-7 bg-transparent p-0 gap-4">
                    <TabsTrigger
                        value="data"
                        className="h-7 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent shadow-none px-1 text-[11px] flex gap-1.5"
                    >
                        <TableIcon className="w-3 h-3" />
                        Data Output
                    </TabsTrigger>
                    <TabsTrigger
                        value="messages"
                        className="h-7 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent shadow-none px-1 text-[11px] flex gap-1.5"
                    >
                        <Info className="w-3 h-3" />
                        Messages
                    </TabsTrigger>
                    {explainPlan && (
                        <TabsTrigger
                            value="plan"
                            className="h-7 rounded-none border-b-2 border-transparent data-[state=active]:border-orange-500 data-[state=active]:bg-transparent shadow-none px-1 text-[11px] flex gap-1.5 text-orange-500"
                        >
                            <GitBranch className="w-3 h-3" />
                            Query Plan
                        </TabsTrigger>
                    )}
                </TabsList>

                <div className="text-[10px] text-muted-foreground font-mono flex gap-3">
                    {results?.durationMs !== undefined && (
                        <span>Execution time: {results.durationMs}ms</span>
                    )}
                    {dataUpdatedAt > 0 && (
                        <span>Finished: {new Date(dataUpdatedAt).toLocaleTimeString()}</span>
                    )}
                </div>
            </div>

            <div className="flex-1 relative overflow-hidden bg-card">
                <TabsContent value="data" className="m-0 h-full overflow-auto">
                    {renderDataContent()}
                </TabsContent>

                <TabsContent value="messages" className="m-0 h-full p-4 font-mono text-[13px] overflow-auto select-text uppercase">
                    {error ? (
                        <div className="text-red-500 whitespace-pre-wrap leading-relaxed">
                            <div className="font-bold mb-2">ERROR:</div>
                            {(error as Error).message}
                        </div>
                    ) : results ? (
                        <div className="space-y-4">
                            <div className="text-green-600 font-bold flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-600" />
                                QUERY EXECUTED SUCCESSFULLY.
                            </div>

                            <div className="text-muted-foreground border-l-2 pl-4 space-y-1">
                                <div>ROWS AFFECTED: {results.rowCount ?? 0}</div>
                                <div>COLUMNS RETURNED: {results.columns?.length ?? 0}</div>
                                <div>EXECUTION TIME: {results.durationMs ?? 0}ms</div>
                                <div>COMPLETED AT: {dataUpdatedAt > 0 ? new Date(dataUpdatedAt).toLocaleString() : '-'}</div>
                            </div>

                            {executedQuery && (
                                <div className="mt-8 pt-4 border-t">
                                    <div className="text-[10px] text-muted-foreground mb-2">SQL STATEMENT:</div>
                                    <pre className="text-xs bg-muted/30 p-3 rounded text-foreground/80 lowercase">
                                        {executedQuery}
                                    </pre>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-muted-foreground italic">No messages to display.</div>
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
