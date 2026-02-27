import React, { useMemo, useState, useRef } from 'react';
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
import { Button } from '@/presentation/components/ui/button';
import { RefreshCw, LayoutGrid, Download, Plus, Trash2, FileJson, FileText, FileCode, Check, X } from 'lucide-react';
import { FilterPopover } from './FilterPopover';
import { TableDesigner } from './TableDesigner';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/presentation/components/ui/dropdown-menu";
import { useDataGridData } from './useDataGridData';
import { useDataGridEditing } from './useDataGridEditing';
import { exportCSV, exportJSON, exportSQL, copyRowAsSQL, type ExportContext } from './DataGridExport';

interface DataGridProps {
    tableId: string;
}

export const DataGrid: React.FC<DataGridProps> = ({ tableId }) => {
    const [sorting, setSorting] = useState<SortingState>([]);
    const [globalFilter, setGlobalFilter] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'design'>('grid');
    const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 100 });
    const tableContainerRef = useRef<HTMLDivElement>(null);

    const isLargeDataset = tableId === 'large_dataset' || tableId === 'tbl-large';

    // Custom hooks — data & editing logic
    const {
        metadata, queryResult, isLoadingMeta, isLoadingData, isFetchingData,
        refetch, dbName, schema, cleanTableName, dialect, pkField,
    } = useDataGridData({ tableId });

    const editing = useDataGridEditing({
        tableId, metadata, dbName, schema, cleanTableName, dialect, pkField, refetch,
    });

    // Build columns
    const tableColumns = useMemo(() => {
        if (!metadata?.columns) return [];
        const helper = createColumnHelper<any>();

        const dataCols = metadata.columns.map(col => helper.accessor(col.name, {
            header: () => (
                <div className="flex flex-col items-start gap-0.5" title={`${col.name} (${col.type})`}>
                    <span className="font-bold flex items-center gap-1">
                        {col.isPrimaryKey && <span className="text-[10px] text-yellow-500 bg-yellow-500/10 px-0.5 rounded border border-yellow-500/20">PK</span>}
                        {col.name}
                    </span>
                    <span className="text-[10px] font-normal text-muted-foreground/80 font-mono tracking-tight">{col.type}</span>
                </div>
            ),
            cell: info => {
                const val = info.getValue();
                const colName = col.name;
                const rowId = pkField ? String(info.row.original[pkField]) : info.row.id;
                const isEdited = editing.pendingChanges[rowId] && colName in editing.pendingChanges[rowId];
                const displayVal = isEdited ? editing.pendingChanges[rowId][colName] : val;

                if (editing.isEditMode && !col.isPrimaryKey) {
                    return (
                        <input
                            className={`w-full bg-transparent border-none outline-none focus:ring-1 focus:ring-primary rounded px-1 -mx-1 py-0.5 h-6 ${isEdited ? 'text-blue-500 font-bold bg-blue-500/5' : ''}`}
                            value={displayVal === null ? '' : String(displayVal)}
                            onChange={(e) => editing.handleCellChange(rowId, colName, e.target.value)}
                        />
                    );
                }

                if (displayVal === null) return <span className="text-muted-foreground/70 italic">NULL</span>;
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
    }, [metadata, editing.isEditMode, editing.pendingChanges, pkField]);

    const table = useReactTable({
        data: queryResult?.rows || [],
        columns: tableColumns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        state: { sorting, globalFilter, pagination },
        onSortingChange: setSorting,
        onGlobalFilterChange: setGlobalFilter,
        onPaginationChange: setPagination,
        manualPagination: !isLargeDataset,
    });

    const { rows } = table.getRowModel();

    const rowVirtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => tableContainerRef.current,
        estimateSize: () => 28,
        overscan: 20,
    });

    // Export context
    const exportCtx: ExportContext = {
        rows,
        columns: metadata?.columns || [],
        schema,
        tableName: cleanTableName || tableId,
        dialect,
    };

    // --- Loading state ---
    if (isLoadingMeta) return (
        <div className="p-4 text-xs text-muted-foreground italic flex items-center gap-2">
            <RefreshCw className="w-3 h-3 animate-spin" /> Loading Schema...
        </div>
    );

    // --- Design mode ---
    if (viewMode === 'design' && metadata) {
        return (
            <TableDesigner
                tableName={cleanTableName || tableId}
                metadata={metadata}
                onSave={editing.handleSaveSchema}
                onCancel={() => setViewMode('grid')}
            />
        );
    }

    return (
        <div className="flex flex-col h-full bg-background relative font-sans">
            {/* Toolbar */}
            <div className="p-1 border-b flex items-center gap-1 bg-muted/20 px-2 h-9">
                {/* View Mode Switches */}
                <div className="flex bg-muted/50 rounded p-0.5 border">
                    <Button variant={viewMode === 'grid' ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode('grid')} className="h-6 px-2 text-[11px] gap-1.5 rounded-sm">
                        <LayoutGrid className="w-3 h-3" /> Grid
                    </Button>
                    <Button variant={viewMode === 'design' ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode('design')} className="h-6 px-2 text-[11px] gap-1.5 rounded-sm">
                        <LayoutGrid className="w-3 h-3" /> Design
                    </Button>
                </div>

                <div className="h-4 w-[1px] bg-border mx-1" />

                {/* Edit Mode */}
                <div className="flex bg-muted/30 rounded p-0.5 border">
                    <Button
                        variant={editing.isEditMode ? "secondary" : "ghost"}
                        size="sm"
                        onClick={editing.toggleEditMode}
                        className={`h-6 px-2 text-[11px] gap-1.5 rounded-sm ${editing.isEditMode ? 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' : ''}`}
                    >
                        {editing.isEditMode ? 'Cancel Edit' : 'Edit Data'}
                    </Button>
                </div>

                {Object.keys(editing.pendingChanges).length > 0 && (
                    <Button variant="default" size="sm" onClick={editing.handleSaveData} disabled={editing.isSaving} className="h-6 px-3 text-[11px] bg-green-600 hover:bg-green-700 text-white ml-2">
                        {editing.isSaving ? <RefreshCw className="w-3 h-3 animate-spin mr-1" /> : null}
                        Save Changes ({Object.keys(editing.pendingChanges).length})
                    </Button>
                )}

                <div className="h-4 w-[1px] bg-border mx-1" />

                <Button variant="ghost" size="sm" onClick={() => refetch()} className="h-7 text-[11px] gap-1 px-2" disabled={editing.isEditMode}>
                    <RefreshCw className="w-3 h-3" /> Refresh
                </Button>

                {/* Export */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1 px-2">
                            <Download className="w-3 h-3" /> Export
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => exportCSV(exportCtx)} className="gap-2 text-xs">
                            <FileText className="w-3 h-3" /> CSV
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => exportJSON(exportCtx)} className="gap-2 text-xs">
                            <FileJson className="w-3 h-3" /> JSON
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => exportSQL(exportCtx)} className="gap-2 text-xs">
                            <FileCode className="w-3 h-3" /> SQL (INSERT)
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                <div className="h-4 w-[1px] bg-border mx-1" />

                <Button variant="ghost" size="sm" onClick={editing.toggleInsertMode} className={`h-7 text-[11px] gap-1 px-2 ${editing.isInserting ? 'text-green-500' : ''}`}>
                    <Plus className="w-3 h-3" /> Insert Row
                </Button>

                {editing.selectedRows.size > 0 && (
                    <Button variant="ghost" size="sm" onClick={editing.handleDeleteRows} disabled={editing.isSaving} className="h-7 text-[11px] gap-1 px-2 text-red-500 hover:text-red-600 hover:bg-red-500/10">
                        <Trash2 className="w-3 h-3" /> Delete ({editing.selectedRows.size})
                    </Button>
                )}

                <div className="h-4 w-[1px] bg-border mx-1" />

                <FilterPopover onFilterChange={setGlobalFilter} currentFilter={globalFilter} />

                <div className="text-[10px] text-muted-foreground ml-auto flex items-center gap-3 pr-2 font-mono">
                    <span className="bg-muted px-1.5 rounded border border-border/50">{rows.length.toLocaleString()} ROWS</span>
                    {queryResult?.durationMs && <span className="opacity-70">{queryResult.durationMs}MS</span>}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 relative overflow-hidden bg-background">
                {viewMode === 'grid' && (
                    <div ref={tableContainerRef} className="h-full overflow-auto relative scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
                        <div style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
                            <table className="w-full text-xs text-left border-collapse">
                                <thead className="bg-muted sticky top-0 z-10 shadow-sm border-b">
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
                                                        {{ asc: <span className="text-[10px] opacity-70">▲</span>, desc: <span className="text-[10px] opacity-70">▼</span> }[header.column.getIsSorted() as string] ?? null}
                                                    </div>
                                                </th>
                                            ))}
                                        </tr>
                                    ))}
                                </thead>
                                <tbody>
                                    {rowVirtualizer.getVirtualItems()[0]?.start > 0 && (
                                        <tr><td style={{ height: `${rowVirtualizer.getVirtualItems()[0].start}px` }} colSpan={table.getVisibleFlatColumns().length} /></tr>
                                    )}
                                    {isLoadingData && rows.length === 0 ? (
                                        <tr><td colSpan={tableColumns.length} className="p-8 text-center text-muted-foreground">Loading Data...</td></tr>
                                    ) : (
                                        rowVirtualizer.getVirtualItems().map(virtualRow => {
                                            const row = rows[virtualRow.index];
                                            if (!row) return null;
                                            const pkValue = pkField ? String(row.original[pkField]) : row.id;
                                            const isSelected = editing.selectedRows.has(pkValue);
                                            return (
                                                <tr
                                                    key={row.id}
                                                    className={`hover:bg-blue-500/5 h-[28px] group transition-colors border-b border-border/20 ${isSelected ? 'bg-blue-500/10' : 'odd:bg-background even:bg-muted/5'}`}
                                                    onContextMenu={(e) => { e.preventDefault(); copyRowAsSQL(row.original, metadata?.columns || [], schema, cleanTableName || tableId, dialect); }}
                                                >
                                                    {row.getVisibleCells().map((cell, cellIdx) => (
                                                        <td
                                                            key={cell.id}
                                                            className={`px-3 py-0.5 border-r border-border/30 whitespace-nowrap scrollbar-hide last:border-r-0 text-foreground/90 font-mono text-[11px] ${!editing.isEditMode ? 'truncate max-w-[300px]' : ''}`}
                                                            style={{ width: cell.column.getSize() }}
                                                            onClick={cellIdx === 0 ? () => editing.toggleRowSelection(pkValue) : undefined}
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
                                    {rowVirtualizer.getVirtualItems().length > 0 &&
                                        rowVirtualizer.getTotalSize() - (rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1]?.end || 0) > 0 && (
                                            <tr><td style={{ height: `${rowVirtualizer.getTotalSize() - (rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1]?.end || 0)}px` }} colSpan={table.getVisibleFlatColumns().length} /></tr>
                                        )}
                                </tbody>
                                {editing.isInserting && metadata?.columns && (
                                    <tfoot className="border-t-2 border-green-500/30">
                                        <tr className="bg-green-500/5">
                                            <td className="px-2 py-1 border-r text-[10px] text-green-500 font-bold">NEW</td>
                                            {metadata.columns.map(col => (
                                                <td key={col.name} className="px-1 py-0.5 border-r">
                                                    <input
                                                        className="w-full bg-transparent border-none outline-none text-xs font-mono px-1 py-0.5 h-6 focus:ring-1 focus:ring-green-500 rounded placeholder:text-muted-foreground/60"
                                                        placeholder={col.isPrimaryKey ? '(auto)' : col.type}
                                                        value={editing.newRowData[col.name] || ''}
                                                        onChange={(e) => editing.setNewRowData(prev => ({ ...prev, [col.name]: e.target.value }))}
                                                        disabled={col.isPrimaryKey}
                                                    />
                                                </td>
                                            ))}
                                        </tr>
                                        <tr>
                                            <td colSpan={metadata.columns.length + 1} className="px-2 py-1">
                                                <div className="flex items-center gap-1">
                                                    <Button size="sm" onClick={editing.handleInsertRow} disabled={editing.isSaving} className="h-6 px-3 text-[10px] bg-green-600 hover:bg-green-700 text-white gap-1">
                                                        <Check className="w-3 h-3" /> Insert
                                                    </Button>
                                                    <Button variant="ghost" size="sm" onClick={editing.toggleInsertMode} className="h-6 px-2 text-[10px] gap-1">
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
                )}
            </div>

            {/* Footer */}
            <div className="p-1 border-t text-[10px] text-muted-foreground px-3 flex items-center justify-between bg-muted/20 h-7 uppercase tracking-wider font-medium">
                <div className="flex items-center gap-6">
                    <span className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${isFetchingData ? 'bg-blue-500 animate-pulse' : 'bg-green-500'}`} />
                        {isLargeDataset ? 'VIRTUALIZED (ALL)' : `PAGE ${pagination.pageIndex + 1}`}
                    </span>
                    {!isLargeDataset && (
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-0.5">
                                <Button variant="ghost" size="sm" className="h-4 w-4 p-0 hover:bg-muted" disabled={pagination.pageIndex === 0} onClick={() => setPagination(p => ({ ...p, pageIndex: p.pageIndex - 1 }))}>◀</Button>
                                <Button variant="ghost" size="sm" className="h-4 w-4 p-0 hover:bg-muted" disabled={rows.length < pagination.pageSize} onClick={() => setPagination(p => ({ ...p, pageIndex: p.pageIndex + 1 }))}>▶</Button>
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
