import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/presentation/components/ui/button';
import { SqlEditor } from '@/presentation/components/code-editor/SqlEditor';
import { Play, Loader2, Eraser, AlignLeft, Info, Table as TableIcon } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { connectionService } from '@/core/services/ConnectionService';
import { useAppStore } from '@/core/services/store';
import { format } from 'sql-formatter';
import {
    useReactTable,
    getCoreRowModel,
    flexRender,
} from '@tanstack/react-table';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger
} from "@/presentation/components/ui/tabs";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/presentation/components/ui/select";
import type { QueryResult } from '@/core/domain/entities';

export const QueryEditor: React.FC<{ tabId: string }> = ({ tabId }) => {
    const { activeConnectionId, connections, tabs } = useAppStore();
    const activeConnection = connections.find(c => c.id === activeConnectionId);

    // Find options for this tab
    const tab = tabs.find(t => t.id === tabId);

    const [query, setQuery] = useState(tab?.initialSql || '');
    const [executedQuery, setExecutedQuery] = useState<string | null>(null);
    const [limit, setLimit] = useState("1000");
    const [activeResultTab, setActiveResultTab] = useState("data");

    const { data: results, isLoading, error, refetch, dataUpdatedAt, isSuccess, isError } = useQuery<QueryResult | null, Error>({
        queryKey: ['query-execution', activeConnectionId, executedQuery, limit],
        queryFn: async () => {
            if (!executedQuery) return null;
            if (!activeConnection) throw new Error("No active connection");

            const adapter = connectionService.getAdapter(activeConnection.id, activeConnection.type as any);
            await adapter.connect(activeConnection);

            return adapter.executeQuery(executedQuery);
        },
        enabled: !!executedQuery && !!activeConnectionId,
        retry: false
    });

    // Handle tab switching after execution
    useEffect(() => {
        if (isSuccess && results) {
            setActiveResultTab("data");
        }
    }, [isSuccess, results]);

    useEffect(() => {
        if (isError) {
            setActiveResultTab("messages");
        }
    }, [isError]);

    const handleRun = () => {
        if (!query.trim()) return;
        setExecutedQuery(query);
        setTimeout(() => refetch(), 0);
    };

    const handleFormat = () => {
        try {
            const formatted = format(query, {
                language: activeConnection?.type === 'mysql' ? 'mysql' : 'postgresql',
                keywordCase: 'upper',
            });
            setQuery(formatted);
        } catch (e) {
            console.error("Formatting failed", e);
        }
    };

    const handleClear = () => setQuery('');

    // Table configuration
    const columns = useMemo(() => {
        if (!results?.columns) return [];
        return results.columns.map((colName: string) => ({
            header: colName,
            accessorKey: colName,
            cell: (info: any) => {
                const val = info.getValue();
                if (val === null) return <span className="text-muted-foreground italic">null</span>;
                if (typeof val === 'object') return JSON.stringify(val);
                return String(val);
            },
        }));
    }, [results]);

    const table = useReactTable({
        data: results?.rows || [],
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

    return (
        <div className="flex flex-col h-full bg-background">
            {/* Toolbar */}
            <div className="p-1 px-2 border-b flex items-center justify-between bg-muted/30">
                <div className="flex items-center gap-1">
                    <Button size="sm" onClick={handleRun} disabled={isLoading} className="h-7 gap-1 px-3 bg-green-600 hover:bg-green-700 text-white border-none shadow-sm">
                        {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                        <span className="font-semibold">Execute</span>
                    </Button>

                    <div className="h-4 w-[1px] bg-border mx-1" />

                    <Button variant="ghost" size="sm" onClick={handleFormat} className="h-7 gap-1 px-2 text-xs">
                        <AlignLeft className="w-3.5 h-3.5" />
                        Format
                    </Button>

                    <Button variant="ghost" size="sm" onClick={handleClear} className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-destructive">
                        <Eraser className="w-3.5 h-3.5" />
                        Clear
                    </Button>

                    <div className="h-4 w-[1px] bg-border mx-1" />

                    <div className="flex items-center gap-2 px-2">
                        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Limit</span>
                        <Select value={limit} onValueChange={setLimit}>
                            <SelectTrigger className="h-6 w-[80px] text-[10px] py-0 border-none bg-transparent hover:bg-muted/50 focus:ring-0">
                                <SelectValue placeholder="Limit" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="100">100</SelectItem>
                                <SelectItem value="500">500</SelectItem>
                                <SelectItem value="1000">1000</SelectItem>
                                <SelectItem value="5000">5000</SelectItem>
                                <SelectItem value="all">No Limit</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {activeConnection && (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-50 dark:bg-blue-950/30 rounded border border-blue-100 dark:border-blue-900/50">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                            <span className="text-[10px] font-medium text-blue-700 dark:text-blue-400">
                                {activeConnection.name}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Editor Area */}
            <div className="flex-1 flex flex-col min-h-[150px] relative">
                <SqlEditor
                    value={query}
                    onChange={(val: string | undefined) => setQuery(val || '')}
                    height="100%"
                />
            </div>

            {/* Result Area with Tabs */}
            <div className="flex-1 flex flex-col min-h-[200px] border-t overflow-hidden">
                <Tabs value={activeResultTab} onValueChange={setActiveResultTab} className="flex-1 flex flex-col">
                    <div className="px-2 border-b bg-muted/10 flex items-center justify-between h-8">
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
                        </TabsList>

                        <div className="text-[10px] text-muted-foreground font-mono flex gap-3">
                            {results?.durationMs !== undefined && (
                                <span>Execution time: {results.durationMs}ms</span>
                            )}
                            {dataUpdatedAt && (
                                <span>Finished: {new Date(dataUpdatedAt).toLocaleTimeString()}</span>
                            )}
                        </div>
                    </div>

                    <div className="flex-1 relative overflow-hidden bg-card">
                        <TabsContent value="data" className="m-0 h-full overflow-auto">
                            {results && results.rows.length > 0 ? (
                                <table className="w-full text-xs text-left border-collapse">
                                    <thead className="bg-muted/50 sticky top-0 z-10 shadow-sm">
                                        {table.getHeaderGroups().map(headerGroup => (
                                            <tr key={headerGroup.id}>
                                                <th className="p-1 px-2 border-b border-r bg-muted/30 text-center text-[9px] w-8">#</th>
                                                {headerGroup.headers.map(header => (
                                                    <th key={header.id} className="p-1.5 px-3 border-b border-r font-semibold text-muted-foreground whitespace-nowrap bg-muted/10">
                                                        {flexRender(header.column.columnDef.header, header.getContext())}
                                                    </th>
                                                ))}
                                            </tr>
                                        ))}
                                    </thead>
                                    <tbody>
                                        {table.getRowModel().rows.map((row, idx) => (
                                            <tr key={row.id} className="hover:bg-blue-50/50 dark:hover:bg-blue-900/10 border-b last:border-0 group">
                                                <td className="p-1 px-2 border-r bg-muted/5 text-center text-[9px] text-muted-foreground group-hover:bg-muted/20">
                                                    {idx + 1}
                                                </td>
                                                {row.getVisibleCells().map(cell => (
                                                    <td key={cell.id} className="p-1.5 px-3 border-r last:border-r-0 whitespace-nowrap truncate max-w-[400px]">
                                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : results ? (
                                <div className="p-8 text-center text-muted-foreground flex flex-col items-center gap-2">
                                    <Info className="w-8 h-8 opacity-20" />
                                    <p>Query returned no rows.</p>
                                </div>
                            ) : isLoading ? (
                                <div className="flex items-center justify-center h-full">
                                    <Loader2 className="w-6 h-6 animate-spin text-primary opacity-50" />
                                </div>
                            ) : (
                                <div className="flex items-center justify-center h-full text-muted-foreground text-sm flex-col gap-2">
                                    <Play className="w-10 h-10 opacity-10" />
                                    <span>Run a query to see results</span>
                                </div>
                            )}
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
                                        <div>COMPLETED AT: {new Date(dataUpdatedAt).toLocaleString()}</div>
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
                    </div>
                </Tabs>
            </div>
        </div>
    );
};
