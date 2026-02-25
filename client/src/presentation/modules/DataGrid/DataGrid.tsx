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
import { RefreshCw, LayoutGrid, BarChart3, Download, Plus, Trash2, FileJson, FileText, FileCode, Check, X } from 'lucide-react';
import { FilterPopover } from './FilterPopover';
import { TableDesigner } from './TableDesigner';
import { ResultVisualizer } from './ResultVisualizer';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/presentation/components/ui/dropdown-menu";
import { toast } from 'sonner';

interface DataGridProps {
    tableId: string;
}

import { parseNodeId, getQuotedIdentifier } from '@/core/utils/id-parser';

export const DataGrid: React.FC<DataGridProps> = ({ tableId }) => {
    const { activeConnectionId, connections } = useAppStore();
    const activeConnection = connections.find(c => c.id === activeConnectionId);

    const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 100 });
    const [sorting, setSorting] = useState<SortingState>([]);
    const [globalFilter, setGlobalFilter] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'chart' | 'design'>('grid');

    // Editing State
    const [isEditMode, setIsEditMode] = useState(false);
    const [pendingChanges, setPendingChanges] = useState<Record<string, Record<string, any>>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    const [isInserting, setIsInserting] = useState(false);
    const [newRowData, setNewRowData] = useState<Record<string, string>>({});

    // Parent ref for virtualization
    const tableContainerRef = useRef<HTMLDivElement>(null);

    const isLargeDataset = tableId === 'large_dataset' || tableId === 'tbl-large';

    const { dbName, schema, table: cleanTableName } = parseNodeId(tableId);
    const dialect = activeConnection?.type === 'mysql' ? 'mysql' : 'postgres';

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
                return adapter.executeQuery(`SELECT * FROM ${getQuotedIdentifier(cleanTableName || tableId, dialect)} -- large_dataset`, dbName ? { database: dbName } : undefined);
            }

            // Use fully qualified name if schema is known
            const qSchema = getQuotedIdentifier(schema, dialect);
            const qTable = getQuotedIdentifier(cleanTableName || tableId, dialect);
            const queryTable = `${qSchema}.${qTable}`;

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

    const handleSaveData = async () => {
        if (!activeConnection) return;
        setIsSaving(true);
        try {
            const pkField = metadata?.columns.find(c => c.isPrimaryKey)?.name;
            if (!pkField) throw new Error("Cannot save changes: Table has no primary key.");

            const adapter = connectionService.getAdapter(activeConnection.id, activeConnection.type as any);

            for (const rowId of Object.keys(pendingChanges)) {
                const updates = pendingChanges[rowId];

                await adapter.updateRow({
                    database: dbName,
                    schema: schema,
                    table: cleanTableName || tableId,
                    pkColumn: pkField,
                    pkValue: isNaN(Number(rowId)) ? rowId : Number(rowId),
                    updates
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
            const adapter = connectionService.getAdapter(activeConnection.id, activeConnection.type as any);

            await adapter.updateSchema({
                database: dbName,
                schema: schema,
                table: cleanTableName || tableId,
                operations
            });

            setViewMode('grid');
            refetch();
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setIsSaving(false);
        }
    };

    // ─── Delete selected rows ───
    const handleDeleteRows = async () => {
        if (!activeConnection || !metadata || selectedRows.size === 0) return;
        const pkField = metadata.columns.find(c => c.isPrimaryKey)?.name;
        if (!pkField) { toast.error('Cannot delete: table has no primary key'); return; }

        if (!confirm(`Delete ${selectedRows.size} row(s)? This cannot be undone.`)) return;

        setIsSaving(true);
        try {
            const adapter = connectionService.getAdapter(activeConnection.id, activeConnection.type as any);
            const qSchema = getQuotedIdentifier(schema, dialect);
            const qTable = getQuotedIdentifier(cleanTableName || tableId, dialect);
            const qPk = getQuotedIdentifier(pkField, dialect);

            const pkValues = [...selectedRows].map(v => isNaN(Number(v)) ? `'${v}'` : v).join(', ');
            const sql = `DELETE FROM ${qSchema}.${qTable} WHERE ${qPk} IN (${pkValues});`;

            await adapter.executeQuery(sql, dbName ? { database: dbName } : undefined);
            setSelectedRows(new Set());
            toast.success(`${selectedRows.size} row(s) deleted`);
            refetch();
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setIsSaving(false);
        }
    };

    // ─── Insert new row ───
    const handleInsertRow = async () => {
        if (!activeConnection || !metadata) return;
        const nonEmptyCols = Object.entries(newRowData).filter(([, v]) => v.trim() !== '');
        if (nonEmptyCols.length === 0) { toast.error('Enter at least one value'); return; }

        setIsSaving(true);
        try {
            const adapter = connectionService.getAdapter(activeConnection.id, activeConnection.type as any);
            const qSchema = getQuotedIdentifier(schema, dialect);
            const qTable = getQuotedIdentifier(cleanTableName || tableId, dialect);
            const colNames = nonEmptyCols.map(([col]) => getQuotedIdentifier(col, dialect)).join(', ');
            const values = nonEmptyCols.map(([, v]) => {
                if (v.toLowerCase() === 'null') return 'NULL';
                if (v.toLowerCase() === 'true') return 'TRUE';
                if (v.toLowerCase() === 'false') return 'FALSE';
                if (!isNaN(Number(v))) return v;
                return `'${v.replace(/'/g, "''")}'`;
            }).join(', ');

            const sql = `INSERT INTO ${qSchema}.${qTable} (${colNames}) VALUES (${values});`;
            await adapter.executeQuery(sql, dbName ? { database: dbName } : undefined);

            setNewRowData({});
            setIsInserting(false);
            toast.success('Row inserted successfully');
            refetch();
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setIsSaving(false);
        }
    };

    // ─── Export helpers ───
    const exportCSV = () => {
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
        downloadFile(`${csvHeaders}\n${csvRows}`, `${cleanTableName}_export.csv`, 'text/csv');
    };

    const exportJSON = () => {
        if (!rows.length || !metadata?.columns) return;
        const data = rows.map(row => {
            const obj: Record<string, any> = {};
            metadata.columns.forEach(col => { obj[col.name] = row.getValue(col.name); });
            return obj;
        });
        downloadFile(JSON.stringify(data, null, 2), `${cleanTableName}_export.json`, 'application/json');
    };

    const exportSQL = () => {
        if (!rows.length || !metadata?.columns) return;
        const qSchema = getQuotedIdentifier(schema, dialect);
        const qTable = getQuotedIdentifier(cleanTableName || tableId, dialect);
        const cols = metadata.columns.map(c => getQuotedIdentifier(c.name, dialect)).join(', ');
        const inserts = rows.map(row => {
            const vals = metadata.columns.map(col => {
                const v = row.getValue(col.name);
                if (v === null || v === undefined) return 'NULL';
                if (typeof v === 'number' || typeof v === 'boolean') return String(v);
                return `'${String(v).replace(/'/g, "''")}'`;
            }).join(', ');
            return `INSERT INTO ${qSchema}.${qTable} (${cols}) VALUES (${vals});`;
        }).join('\n');
        downloadFile(inserts, `${cleanTableName}_export.sql`, 'text/sql');
    };

    const downloadFile = (content: string, filename: string, type: string) => {
        const blob = new Blob([content], { type: `${type};charset=utf-8;` });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    };

    const copyRowAsSQL = (rowData: any) => {
        if (!metadata?.columns) return;
        const qSchema = getQuotedIdentifier(schema, dialect);
        const qTable = getQuotedIdentifier(cleanTableName || tableId, dialect);
        const cols = metadata.columns.map(c => getQuotedIdentifier(c.name, dialect)).join(', ');
        const vals = metadata.columns.map(col => {
            const v = rowData[col.name];
            if (v === null || v === undefined) return 'NULL';
            if (typeof v === 'number' || typeof v === 'boolean') return String(v);
            return `'${String(v).replace(/'/g, "''")}'`;
        }).join(', ');
        const sql = `INSERT INTO ${qSchema}.${qTable} (${cols}) VALUES (${vals});`;
        navigator.clipboard.writeText(sql);
        toast.success('INSERT statement copied');
    };

    if (isLoadingMeta) return <div className="p-4 text-xs text-muted-foreground italic flex items-center gap-2">
        <RefreshCw className="w-3 h-3 animate-spin" /> Loading Schema...
    </div>;

    if (viewMode === 'design' && metadata) {
        return (
            <TableDesigner
                tableName={cleanTableName || tableId}
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

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1 px-2">
                            <Download className="w-3 h-3" /> Export
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <DropdownMenuItem onClick={exportCSV} className="gap-2 text-xs">
                            <FileText className="w-3 h-3" /> CSV
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={exportJSON} className="gap-2 text-xs">
                            <FileJson className="w-3 h-3" /> JSON
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={exportSQL} className="gap-2 text-xs">
                            <FileCode className="w-3 h-3" /> SQL (INSERT)
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                <div className="h-4 w-[1px] bg-border mx-1" />

                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setIsInserting(!isInserting); setNewRowData({}); }}
                    className={`h-7 text-[11px] gap-1 px-2 ${isInserting ? 'text-green-500' : ''}`}
                >
                    <Plus className="w-3 h-3" /> Insert Row
                </Button>

                {selectedRows.size > 0 && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleDeleteRows}
                        disabled={isSaving}
                        className="h-7 text-[11px] gap-1 px-2 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                    >
                        <Trash2 className="w-3 h-3" /> Delete ({selectedRows.size})
                    </Button>
                )}

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
                                            const pkField = metadata?.columns.find(c => c.isPrimaryKey)?.name;
                                            const pkValue = pkField ? String(row.original[pkField]) : row.id;
                                            const isSelected = selectedRows.has(pkValue);
                                            return (
                                                <tr
                                                    key={row.id}
                                                    className={`hover:bg-blue-500/5 h-[28px] group transition-colors border-b border-border/20 ${isSelected ? 'bg-blue-500/10' : 'odd:bg-background even:bg-muted/5'}`}
                                                    onContextMenu={(e) => {
                                                        e.preventDefault();
                                                        copyRowAsSQL(row.original);
                                                    }}
                                                >
                                                    {row.getVisibleCells().map((cell, cellIdx) => (
                                                        <td
                                                            key={cell.id}
                                                            className={`px-3 py-0.5 border-r border-border/30 whitespace-nowrap scrollbar-hide last:border-r-0 text-foreground/90 font-mono text-[11px] ${!isEditMode ? 'truncate max-w-[300px]' : ''}`}
                                                            style={{ width: cell.column.getSize() }}
                                                            onClick={cellIdx === 0 ? () => {
                                                                setSelectedRows(prev => {
                                                                    const next = new Set(prev);
                                                                    if (next.has(pkValue)) next.delete(pkValue);
                                                                    else next.add(pkValue);
                                                                    return next;
                                                                });
                                                            } : undefined}
                                                        >
                                                            {cellIdx === 0 ? (
                                                                <span className={`cursor-pointer ${isSelected ? 'text-blue-500 font-bold' : ''}`}>
                                                                    {isSelected ? '☑' : ''} {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                                </span>
                                                            ) : flexRender(cell.column.columnDef.cell, cell.getContext())}
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
                                {isInserting && metadata?.columns && (
                                    <tfoot className="border-t-2 border-green-500/30">
                                        <tr className="bg-green-500/5">
                                            <td className="px-2 py-1 border-r text-[10px] text-green-500 font-bold">NEW</td>
                                            {metadata.columns.map(col => (
                                                <td key={col.name} className="px-1 py-0.5 border-r">
                                                    <input
                                                        className="w-full bg-transparent border-none outline-none text-xs font-mono px-1 py-0.5 h-6 focus:ring-1 focus:ring-green-500 rounded placeholder:text-muted-foreground/30"
                                                        placeholder={col.isPrimaryKey ? '(auto)' : col.type}
                                                        value={newRowData[col.name] || ''}
                                                        onChange={(e) => setNewRowData(prev => ({ ...prev, [col.name]: e.target.value }))}
                                                        disabled={col.isPrimaryKey}
                                                    />
                                                </td>
                                            ))}
                                        </tr>
                                        <tr>
                                            <td colSpan={metadata.columns.length + 1} className="px-2 py-1">
                                                <div className="flex items-center gap-1">
                                                    <Button size="sm" onClick={handleInsertRow} disabled={isSaving} className="h-6 px-3 text-[10px] bg-green-600 hover:bg-green-700 text-white gap-1">
                                                        <Check className="w-3 h-3" /> Insert
                                                    </Button>
                                                    <Button variant="ghost" size="sm" onClick={() => { setIsInserting(false); setNewRowData({}); }} className="h-6 px-2 text-[10px] gap-1">
                                                        <X className="w-3 h-3" /> Cancel
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 min-h-0 bg-card overflow-hidden">
                        <ResultVisualizer data={queryResult?.rows || []} />
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
                    <span>{cleanTableName || tableId}</span>
                    <span>{schema}</span>
                </div>
            </div>
        </div>
    );
};
