import React, { useMemo, useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    useReactTable,
    getCoreRowModel,
    flexRender,
    createColumnHelper,
    getSortedRowModel,
    getFilteredRowModel,
    type SortingState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { connectionService } from '@/core/services/ConnectionService';
import { useAppStore } from '@/core/services/store';
import { Button } from '@/presentation/components/ui/button';
import { RefreshCw, LayoutGrid, BarChart3, Download } from 'lucide-react';
import { FilterPopover } from './FilterPopover';
import { TableDesigner } from './TableDesigner';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    LineChart,
    Line,
    Legend
} from 'recharts';

interface DataGridProps {
    tableId: string;
}

export const DataGrid: React.FC<DataGridProps> = ({ tableId }) => {
    const { activeConnectionId, connections } = useAppStore();
    const activeConnection = connections.find(c => c.id === activeConnectionId);

    const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 100 });
    const [sorting, setSorting] = useState<SortingState>([]);
    const [globalFilter, setGlobalFilter] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'chart' | 'design'>('grid');
    const [chartType, setChartType] = useState<'bar' | 'line'>('bar');

    // Editing State
    const [isEditMode, setIsEditMode] = useState(false);
    const [pendingChanges, setPendingChanges] = useState<Record<string, Record<string, any>>>({});
    const [isSaving, setIsSaving] = useState(false);

    // Parent ref for virtualization
    const tableContainerRef = useRef<HTMLDivElement>(null);

    const isLargeDataset = tableId === 'large_dataset' || tableId === 'tbl-large';

    // Helper to parse table ID
    const parseTableId = (id: string) => {
        let dbName: string | undefined;
        let schema = 'public';
        let table = id;

        if (id.includes('db:')) {
            const parts = id.split('.');
            const dbPart = parts.find(p => p.startsWith('db:'));
            const schemaPart = parts.find(p => p.startsWith('schema:'));
            const tablePart = parts.find(p => p.startsWith('table:') || p.startsWith('view:'));

            if (dbPart) dbName = dbPart.split(':')[1];
            if (schemaPart) schema = schemaPart.split(':')[1];
            if (tablePart) table = tablePart.split(':')[1];
        } else if (id.startsWith('table:') || id.startsWith('view:')) {
            const part = id.split(':')[1];
            if (part.includes('.')) {
                const pieces = part.split('.');
                schema = pieces[0];
                table = pieces[1];
            } else {
                table = part;
            }
        }

        return { dbName, schema, table };
    };

    const { dbName, schema, table: cleanTableName } = parseTableId(tableId);

    // 1. Fetch Metadata
    const { data: metadata, isLoading: isLoadingMeta } = useQuery({
        queryKey: ['metadata', activeConnectionId, tableId],
        queryFn: async () => {
            if (!activeConnection) throw new Error("No active connection");
            const adapter = connectionService.getAdapter(activeConnection.id, activeConnection.type as any);
            return adapter.getMetadata(tableId);
        },
        enabled: !!activeConnectionId
    });

    // 2. Fetch Data
    const { data: queryResult, isLoading: isLoadingData, isFetching: isFetchingData, refetch } = useQuery({
        queryKey: ['data', activeConnectionId, tableId, pagination.pageIndex, isLargeDataset],
        queryFn: async () => {
            if (!activeConnection) throw new Error("No active connection");
            const adapter = connectionService.getAdapter(activeConnection.id, activeConnection.type as any);

            // For large dataset demo, fetch ALL rows
            if (isLargeDataset) {
                return adapter.executeQuery(`SELECT * FROM ${cleanTableName} -- large_dataset`, dbName ? { database: dbName } : undefined);
            }

            // Use fully qualified name if schema is known
            const queryTable = schema ? `"${schema}"."${cleanTableName}"` : `"${cleanTableName}"`;

            return adapter.executeQuery(
                `SELECT * FROM ${queryTable} LIMIT ${pagination.pageSize} OFFSET ${pagination.pageIndex * pagination.pageSize}`,
                dbName ? { database: dbName } : undefined
            );
        },
        enabled: !!activeConnectionId && !!metadata
    });

    // 3. Build Columns
    const tableColumns = useMemo(() => {
        if (!metadata?.columns) return [];
        const helper = createColumnHelper<any>();

        const pkField = metadata.columns.find(c => c.isPrimaryKey)?.name;

        const dataCols = metadata.columns.map(col => helper.accessor(col.name, {
            header: () => (
                <div className="flex flex-col items-start gap-0.5" title={`${col.name} (${col.type})`}>
                    <span className="font-bold flex items-center gap-1">
                        {col.isPrimaryKey && <span className="text-[10px] text-yellow-500 bg-yellow-500/10 px-0.5 rounded border border-yellow-500/20">PK</span>}
                        {col.name}
                    </span>
                    <span className="text-[10px] font-normal text-muted-foreground/80 font-mono tracking-tight">
                        {col.type}
                    </span>
                </div>
            ),
            cell: info => {
                const val = info.getValue();
                const colName = col.name;
                const rowId = pkField ? String(info.row.original[pkField]) : info.row.id;

                // Check if this specific cell is being edited
                const isEdited = pendingChanges[rowId] && colName in pendingChanges[rowId];
                const displayVal = isEdited ? pendingChanges[rowId][colName] : val;

                if (isEditMode && !col.isPrimaryKey) {
                    return (
                        <input
                            className={`w-full bg-transparent border-none outline-none focus:ring-1 focus:ring-primary rounded px-1 -mx-1 py-0.5 h-6 ${isEdited ? 'text-blue-500 font-bold bg-blue-500/5' : ''}`}
                            value={displayVal === null ? '' : String(displayVal)}
                            onChange={(e) => {
                                const newVal = e.target.value;
                                setPendingChanges(prev => ({
                                    ...prev,
                                    [rowId]: {
                                        ...(prev[rowId] || {}),
                                        [colName]: newVal
                                    }
                                }));
                            }}
                        />
                    );
                }

                if (displayVal === null) return <span className="text-muted-foreground/50 italic">NULL</span>;
                if (typeof displayVal === 'boolean') return displayVal ? 'true' : 'false';
                if (typeof displayVal === 'object') return <span className="text-[10px] text-blue-400">JSON</span>;
                return <span className={isEdited ? 'text-blue-500 font-bold' : ''}>{String(displayVal)}</span>;
            },
        }));

        const rowNumCol = helper.display({
            id: '__row_number',
            header: '#',
            cell: info => <span className="text-muted-foreground/70 text-[10px] font-mono">{info.row.index + 1}</span>,
            size: 50,
        });

        return [rowNumCol, ...dataCols];
    }, [metadata, isEditMode, pendingChanges]);

    const table = useReactTable({
        data: queryResult?.rows || [],
        columns: tableColumns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        state: {
            sorting,
            globalFilter,
            pagination,
        },
        onSortingChange: setSorting,
        onGlobalFilterChange: setGlobalFilter,
        onPaginationChange: setPagination,
        manualPagination: !isLargeDataset,
    });

    const { rows } = table.getRowModel();

    // Virtualizer
    const rowVirtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => tableContainerRef.current,
        estimateSize: () => 28,
        overscan: 20,
    });

    // Chart Auto-Config
    const chartConfig = useMemo(() => {
        if (!queryResult?.rows || queryResult.rows.length === 0) return null;

        // Find numeric columns for Y-axis
        const firstRow = queryResult.rows[0];
        const numericKeys = Object.keys(firstRow).filter(k =>
            typeof firstRow[k] === 'number' || (!isNaN(parseFloat(firstRow[k])) && isFinite(firstRow[k]))
        );

        if (numericKeys.length === 0) return null;

        // Find a string column for X-axis (preferably not too long)
        const labelKey = Object.keys(firstRow).find(k =>
            typeof firstRow[k] === 'string' && !numericKeys.includes(k)
        ) || numericKeys[0];

        return { xKey: labelKey, yKeys: numericKeys.slice(0, 3) }; // Show up to 3 numeric series
    }, [queryResult]);

    const handleSaveData = async () => {
        if (!activeConnection) return;
        setIsSaving(true);
        try {
            const pkField = metadata?.columns.find(c => c.isPrimaryKey)?.name;
            if (!pkField) throw new Error("Cannot save changes: Table has no primary key.");

            // For now, we call the backend API directly via a generic helper if available,
            // or we just use the adapter to execute the UPDATE.
            // Since I added a specific PATCH /api/query/row, I should use that or make the adapter handle it.
            // I'll call the API endpoint.

            for (const rowId of Object.keys(pendingChanges)) {
                const updates = pendingChanges[rowId];

                // Construct the payload for our new backend endpoint
                await fetch('http://localhost:3000/api/query/row', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        connectionId: activeConnection.id,
                        database: dbName,
                        schema: schema,
                        table: cleanTableName,
                        pkColumn: pkField,
                        pkValue: isNaN(Number(rowId)) ? rowId : Number(rowId),
                        updates
                    })
                });
            }

            setPendingChanges({});
            setIsEditMode(false);
            refetch();
        } catch (e: any) {
            alert(e.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveSchema = async (operations: any[]) => {
        if (!activeConnection || !metadata) return;
        setIsSaving(true);
        try {
            await fetch('http://localhost:3000/api/query/schema', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    connectionId: activeConnection.id,
                    database: dbName,
                    schema: schema,
                    table: cleanTableName,
                    operations
                })
            });

            setViewMode('grid');
            refetch(); // Refresh both data and metadata (react-query will handle if configured)
        } catch (e: any) {
            alert(e.message);
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoadingMeta) return <div className="p-4 text-xs text-muted-foreground italic flex items-center gap-2">
        <RefreshCw className="w-3 h-3 animate-spin" /> Loading Schema...
    </div>;

    if (viewMode === 'design' && metadata) {
        return (
            <TableDesigner
                tableName={cleanTableName}
                metadata={metadata}
                onSave={handleSaveSchema}
                onCancel={() => setViewMode('grid')}
            />
        );
    }

    return (
        <div className="flex flex-col h-full bg-background relative font-sans">
            {/* Toolbar */}
            <div className="p-1 border-b flex items-center gap-1 bg-muted/20 px-2 h-9">
                <div className="flex bg-muted/50 rounded p-0.5 border">
                    <Button
                        variant={viewMode === 'grid' ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setViewMode('grid')}
                        className="h-6 px-2 text-[11px] gap-1.5 rounded-sm"
                    >
                        <LayoutGrid className="w-3 h-3" /> Grid
                    </Button>
                    <Button
                        variant={viewMode === 'chart' ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setViewMode('chart')}
                        className="h-6 px-2 text-[11px] gap-1.5 rounded-sm"
                        disabled={!chartConfig}
                    >
                        <BarChart3 className="w-3 h-3" /> Visualizer
                    </Button>
                    <Button
                        variant={viewMode === 'design' ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setViewMode('design')}
                        className="h-6 px-2 text-[11px] gap-1.5 rounded-sm"
                    >
                        <LayoutGrid className="w-3 h-3" /> Design
                    </Button>
                </div>

                <div className="h-4 w-[1px] bg-border mx-1" />

                <div className="flex bg-muted/30 rounded p-0.5 border">
                    <Button
                        variant={isEditMode ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => {
                            if (isEditMode) {
                                setPendingChanges({});
                                setIsEditMode(false);
                            } else {
                                setIsEditMode(true);
                            }
                        }}
                        className={`h-6 px-2 text-[11px] gap-1.5 rounded-sm ${isEditMode ? 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' : ''}`}
                    >
                        {isEditMode ? 'Cancel Edit' : 'Edit Data'}
                    </Button>
                </div>

                {Object.keys(pendingChanges).length > 0 && (
                    <Button
                        variant="default"
                        size="sm"
                        onClick={handleSaveData}
                        disabled={isSaving}
                        className="h-6 px-3 text-[11px] bg-green-600 hover:bg-green-700 text-white ml-2"
                    >
                        {isSaving ? <RefreshCw className="w-3 h-3 animate-spin mr-1" /> : null}
                        Save Changes ({Object.keys(pendingChanges).length})
                    </Button>
                )}

                <div className="h-4 w-[1px] bg-border mx-1" />

                <Button variant="ghost" size="sm" onClick={() => refetch()} className="h-7 text-[11px] gap-1 px-2" disabled={isEditMode}>
                    <RefreshCw className="w-3 h-3" /> Refresh
                </Button>

                <Button variant="ghost" size="sm" onClick={() => {
                    if (!rows.length || !metadata?.columns) return;
                    const csvHeaders = metadata.columns.map(c => c.name).join(',');
                    const csvRows = rows.map(row => {
                        return metadata.columns.map(col => {
                            const val = row.getValue(col.name);
                            if (val === null || val === undefined) return '';
                            const str = String(val);
                            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                                return `"${str.replace(/"/g, '""')}"`;
                            }
                            return str;
                        }).join(',');
                    }).join('\n');
                    const blob = new Blob([`${csvHeaders}\n${csvRows}`], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `${cleanTableName}_export.csv`;
                    link.click();
                }} className="h-7 text-[11px] gap-1 px-2">
                    <Download className="w-3 h-3" /> Export
                </Button>

                <div className="h-4 w-[1px] bg-border mx-1" />

                <FilterPopover
                    onFilterChange={setGlobalFilter}
                    currentFilter={globalFilter}
                />

                <div className="text-[10px] text-muted-foreground ml-auto flex items-center gap-3 pr-2 font-mono">
                    <span className="bg-muted px-1.5 rounded border border-border/50">
                        {rows.length.toLocaleString()} ROWS
                    </span>
                    {queryResult?.durationMs && (
                        <span className="opacity-70">
                            {queryResult.durationMs}MS
                        </span>
                    )}
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 relative overflow-hidden bg-background">
                {viewMode === 'grid' ? (
                    <div
                        ref={tableContainerRef}
                        className="h-full overflow-auto relative scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent"
                    >
                        <div style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
                            <table className="w-full text-xs text-left border-collapse">
                                <thead
                                    className="bg-muted sticky top-0 z-10 shadow-sm border-b"
                                >
                                    {table.getHeaderGroups().map(headerGroup => (
                                        <tr key={headerGroup.id}>
                                            {headerGroup.headers.map(header => (
                                                <th
                                                    key={header.id}
                                                    className="px-2 py-1.5 border-r border-b font-semibold text-muted-foreground whitespace-nowrap cursor-pointer hover:bg-accent/50 select-none last:border-r-0 bg-muted/90 backdrop-blur-md"
                                                    onClick={header.column.getToggleSortingHandler()}
                                                    style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                                                >
                                                    <div className="flex items-center gap-1">
                                                        {flexRender(header.column.columnDef.header, header.getContext())}
                                                        {{
                                                            asc: <span className="text-[10px] opacity-70">▲</span>,
                                                            desc: <span className="text-[10px] opacity-70">▼</span>,
                                                        }[header.column.getIsSorted() as string] ?? null}
                                                    </div>
                                                </th>
                                            ))}
                                        </tr>
                                    ))}
                                </thead>
                                <tbody>
                                    {rowVirtualizer.getVirtualItems()[0]?.start > 0 && (
                                        <tr>
                                            <td style={{ height: `${rowVirtualizer.getVirtualItems()[0].start}px` }} colSpan={table.getVisibleFlatColumns().length} />
                                        </tr>
                                    )}
                                    {isLoadingData && rows.length === 0 ? (
                                        <tr><td colSpan={tableColumns.length} className="p-8 text-center text-muted-foreground">Loading Data...</td></tr>
                                    ) : (
                                        rowVirtualizer.getVirtualItems().map(virtualRow => {
                                            const row = rows[virtualRow.index];
                                            if (!row) return null;
                                            return (
                                                <tr
                                                    key={row.id}
                                                    className="hover:bg-blue-500/5 h-[28px] group transition-colors odd:bg-background even:bg-muted/5 border-b border-border/20"
                                                >
                                                    {row.getVisibleCells().map(cell => (
                                                        <td
                                                            key={cell.id}
                                                            className={`px-3 py-0.5 border-r border-border/30 whitespace-nowrap scrollbar-hide last:border-r-0 text-foreground/90 font-mono text-[11px] ${!isEditMode ? 'truncate max-w-[300px]' : ''}`}
                                                            style={{ width: cell.column.getSize() }}
                                                        >
                                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                        </td>
                                                    ))}
                                                </tr>
                                            );
                                        })
                                    )}
                                    {rowVirtualizer.getVirtualItems().length > 0 && (
                                        rowVirtualizer.getTotalSize() - (rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1]?.end || 0) > 0 && (
                                            <tr>
                                                <td
                                                    style={{ height: `${rowVirtualizer.getTotalSize() - (rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1]?.end || 0)}px` }}
                                                    colSpan={table.getVisibleFlatColumns().length}
                                                />
                                            </tr>
                                        )
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="h-full p-6 flex flex-col bg-muted/5">
                        <div className="flex items-center justify-between mb-6">
                            <div className="space-y-1">
                                <h3 className="text-sm font-semibold flex items-center gap-2 uppercase tracking-tight">
                                    <BarChart3 className="w-4 h-4 text-blue-500" />
                                    Data Visualization
                                </h3>
                                <p className="text-[10px] text-muted-foreground">Automatically projecting numeric trends from the current dataset.</p>
                            </div>
                            <div className="flex bg-muted rounded p-0.5 border shadow-sm">
                                <Button size="sm" variant={chartType === 'bar' ? 'secondary' : 'ghost'} className="h-6 px-3 text-[10px]" onClick={() => setChartType('bar')}>Bar</Button>
                                <Button size="sm" variant={chartType === 'line' ? 'secondary' : 'ghost'} className="h-6 px-3 text-[10px]" onClick={() => setChartType('line')}>Line</Button>
                            </div>
                        </div>

                        {chartConfig ? (
                            <div className="flex-1 min-h-0 bg-background rounded-xl border p-6 shadow-sm">
                                <ResponsiveContainer width="100%" height="100%">
                                    {chartType === 'bar' ? (
                                        <BarChart data={queryResult?.rows || []} margin={{ top: 10, right: 30, left: 0, bottom: 30 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                                            <XAxis
                                                dataKey={chartConfig.xKey}
                                                fontSize={10}
                                                tickLine={false}
                                                axisLine={false}
                                                tick={{ fill: 'currentColor', opacity: 0.5 }}
                                            />
                                            <YAxis
                                                fontSize={10}
                                                tickLine={false}
                                                axisLine={false}
                                                tickFormatter={(v) => v.toLocaleString()}
                                                tick={{ fill: 'currentColor', opacity: 0.5 }}
                                            />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: 'var(--background)', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '11px' }}
                                                cursor={{ fill: 'var(--muted)', opacity: 0.1 }}
                                            />
                                            <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }} />
                                            {chartConfig.yKeys.map((key, i) => (
                                                <Bar
                                                    key={key}
                                                    dataKey={key}
                                                    fill={['#3b82f6', '#10b981', '#f59e0b'][i % 3]}
                                                    radius={[4, 4, 0, 0]}
                                                    maxBarSize={40}
                                                />
                                            ))}
                                        </BarChart>
                                    ) : (
                                        <LineChart data={queryResult?.rows || []} margin={{ top: 10, right: 30, left: 0, bottom: 30 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                                            <XAxis dataKey={chartConfig.xKey} fontSize={10} tickLine={false} axisLine={false} />
                                            <YAxis fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => v.toLocaleString()} />
                                            <Tooltip contentStyle={{ backgroundColor: 'var(--background)', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '11px' }} />
                                            <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '10px' }} />
                                            {chartConfig.yKeys.map((key, i) => (
                                                <Line
                                                    key={key}
                                                    type="monotone"
                                                    dataKey={key}
                                                    stroke={['#3b82f6', '#10b981', '#f59e0b'][i % 3]}
                                                    strokeWidth={2}
                                                    dot={{ r: 3 }}
                                                    activeDot={{ r: 5 }}
                                                />
                                            ))}
                                        </LineChart>
                                    )}
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm italic border-2 border-dashed rounded-xl">
                                No numeric data found for visualization.
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Status Bar / Footer */}
            <div className="p-1 border-t text-[10px] text-muted-foreground px-3 flex items-center justify-between bg-muted/20 h-7 uppercase tracking-wider font-medium">
                <div className="flex items-center gap-6">
                    <span className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${isFetchingData ? 'bg-blue-500 animate-pulse' : 'bg-green-500'}`} />
                        {isLargeDataset ? 'VIRTUALIZED (ALL)' : `PAGE ${pagination.pageIndex + 1}`}
                    </span>
                    {!isLargeDataset && (
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-0.5">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-4 w-4 p-0 hover:bg-muted"
                                    disabled={pagination.pageIndex === 0}
                                    onClick={() => setPagination(p => ({ ...p, pageIndex: p.pageIndex - 1 }))}
                                >
                                    ◀
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-4 w-4 p-0 hover:bg-muted"
                                    disabled={rows.length < pagination.pageSize}
                                    onClick={() => setPagination(p => ({ ...p, pageIndex: p.pageIndex + 1 }))}
                                >
                                    ▶
                                </Button>
                            </div>
                            <select
                                className="bg-transparent border-none outline-none cursor-pointer hover:text-foreground text-[9px] font-bold"
                                value={pagination.pageSize}
                                onChange={(e) => setPagination(p => ({ ...p, pageSize: Number(e.target.value), pageIndex: 0 }))}
                            >
                                <option value="50">50/PAGE</option>
                                <option value="100">100/PAGE</option>
                                <option value="500">500/PAGE</option>
                                <option value="1000">1000/PAGE</option>
                            </select>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-4 opacity-60">
                    <span>{cleanTableName}</span>
                    <span>{schema}</span>
                </div>
            </div>
        </div>
    );
};
