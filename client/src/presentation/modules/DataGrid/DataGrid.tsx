import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    useReactTable,
    getCoreRowModel,
    flexRender,
    createColumnHelper,
    getSortedRowModel,
    getFilteredRowModel,
    type ColumnSizingState,
    type SortingState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import {
    RefreshCw, LayoutGrid, Download, Plus, Trash2,
    FileJson, FileText, FileCode, Check, X, Upload, ArrowRightLeft, MoreHorizontal, PencilLine, GripVertical
} from 'lucide-react';
import { FilterPopover } from './FilterPopover';
import { TableDesigner } from './TableDesigner';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/presentation/components/ui/dropdown-menu";
import { useAppStore } from '@/core/services/store';
import { type Tab } from '@/core/services/store/slices/tabSlice';
import { useDataGridData } from './useDataGridData';
import { useDataGridEditing } from './useDataGridEditing';
import { exportCSV, exportJSON, exportSQL, copyRowAsSQL, type ExportContext } from './DataGridExport';
import { BulkImportDialog } from './BulkImportDialog';
import { BulkReplaceDialog } from './BulkReplaceDialog';
import { MigrationHubDialog } from '../Migration/MigrationHubDialog';
import { useResponsiveLayoutMode } from '@/presentation/hooks/useResponsiveLayoutMode';
import { cn } from '@/lib/utils';
import type { DatabaseValue, RowData } from '@/core/domain/entities';
import { CellValueDialog } from './CellValueDialog';
import { toast } from 'sonner';
import {
    advanceMomentumScroll,
    buildColumnOrderStorageKey,
    buildColumnSizingStorageKey,
    getAutoFitColumnWidth,
    getInitialColumnWidth,
    normalizeMomentumWheelDelta,
    normalizeColumnOrder,
    previewDatabaseValue,
    reorderColumnIds,
    shouldUseMomentumWheel,
    type SelectedCellState,
} from './dataGridUtils';
import type { BulkReplaceTargetRow, BulkSearchMatch } from './bulkReplaceUtils';
import { getDataGridText } from './dataGridI18n';

interface DataGridProps {
    tableId: string;
}

interface ActiveGridSearch {
    matches: BulkSearchMatch[];
    activeIndex: number;
}

import type { Row } from '@tanstack/react-table';
import type { TableColumn, TableMetadata } from '@/core/domain/entities';

interface DataGridRowProps {
    row: Row<RowData>;
    editing: ReturnType<typeof useDataGridEditing>;
    lang: 'vi' | 'en';
    pkField: string | null | undefined;
    metadata: TableMetadata | undefined;
    handleOpenCellInspector: (val: DatabaseValue, col: string, type: string, rowId: string) => void;
    copyRowAsSQL: (row: RowData, cols: TableColumn[], schema: string, table: string, dialect: 'postgres' | 'mysql') => void;
    schema: string;
    tableName: string;
    dialect: 'postgres' | 'mysql';
    matchedCellKeys: Set<string>;
    activeCellKey: string | null;
}

const DataGridRow = React.memo(({
    row,
    editing,
    lang,
    pkField,
    metadata,
    handleOpenCellInspector,
    copyRowAsSQL,
    schema,
    tableName,
    dialect,
    matchedCellKeys,
    activeCellKey,
}: DataGridRowProps) => {
    const pkValue = pkField ? String(row.original[pkField]) : row.id;
    const isSelected = editing.selectedRows.has(pkValue);

    return (
        <tr
            className={cn(
                "h-[36px] group border-b border-border/20",
                isSelected ? 'bg-blue-500/10' : 'odd:bg-background even:bg-muted/5',
                "hover:bg-blue-500/5"
            )}
            onContextMenu={(e) => {
                e.preventDefault();
                copyRowAsSQL(row.original, metadata?.columns || [], schema, tableName, dialect);
            }}
        >
            {row.getVisibleCells().map((cell, cellIdx: number) => (
                (() => {
                    const cellKey = `${pkValue}::${cell.column.id}`;
                    const isMatchedCell = cellIdx > 0 && matchedCellKeys.has(cellKey);
                    const isActiveCell = cellIdx > 0 && activeCellKey === cellKey;

                    return (
                <td
                    key={cell.id}
                    className={cn(
                        "px-3 py-0.5 border-r border-border/30 whitespace-nowrap overflow-hidden text-ellipsis last:border-r-0 text-foreground/90 font-mono text-[11px]",
                        !editing.isEditMode && cellIdx > 0 && "cursor-pointer",
                        isMatchedCell && "bg-amber-500/12",
                        isActiveCell && "bg-amber-500/20 ring-1 ring-inset ring-amber-400/60",
                    )}
                    data-cell-key={cellKey}
                    style={{ width: cell.column.getSize() }}
                    onClick={
                        cellIdx === 0
                            ? () => editing.toggleRowSelection(pkValue)
                            : undefined
                    }
                    onDoubleClick={
                        cellIdx > 0 && !editing.isEditMode
                            ? () => handleOpenCellInspector(
                                row.original[cell.column.id],
                                cell.column.id,
                                metadata?.columns.find((item: TableColumn) => item.name === cell.column.id)?.type || 'unknown',
                                `row ${pkValue}`,
                            )
                            : undefined
                    }
                    title={cellIdx > 0 ? (lang === 'vi' ? 'Nhấn đúp để xem đầy đủ giá trị' : 'Double-click to inspect full value') : undefined}
                >
                    {cellIdx === 0 ? (
                        <span className={`cursor-pointer ${isSelected ? 'text-blue-500 font-bold' : ''}`}>
                            {isSelected ? '☑' : ''} {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </span>
                    ) : (
                        <div className="overflow-hidden text-ellipsis w-full">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </div>
                    )}
                </td>
                    );
                })()
            ))}
        </tr>
    );
});

export const DataGrid: React.FC<DataGridProps> = ({ tableId }) => {
    const [sorting, setSorting] = useState<SortingState>([]);
    const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
    const [columnOrder, setColumnOrder] = useState<string[]>([]);
    const [globalFilter, setGlobalFilter] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'design'>('grid');
    const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
    const [isBulkReplaceOpen, setIsBulkReplaceOpen] = useState(false);
    const [isMigrationDialogOpen, setIsMigrationDialogOpen] = useState(false);
    const [activeSearch, setActiveSearch] = useState<ActiveGridSearch | null>(null);
    const [selectedCell, setSelectedCell] = useState<SelectedCellState | null>(null);
    const [draggingColumnId, setDraggingColumnId] = useState<string | null>(null);
    const [dropTargetColumnId, setDropTargetColumnId] = useState<string | null>(null);
    const [pageJumpValue, setPageJumpValue] = useState('1');
    const tableContainerRef = useRef<HTMLDivElement>(null);
    const wheelMomentumFrameRef = useRef<number | null>(null);
    const wheelMomentumVelocityRef = useRef(0);
    const wheelMomentumLastTsRef = useRef<number | null>(null);

    const { tabs, activeTabId, setTabPagination, connections, activeConnectionId, lang } = useAppStore();
    const activeTab = tabs.find((t: Tab) => t.id === activeTabId);
    const activeConnection = connections.find((connection) => connection.id === activeConnectionId);
    const { isCompactMobileLayout, isSmallMobile } = useResponsiveLayoutMode();
    const readOnlyConnection = activeConnection?.readOnly === true;
    const queryExecutionDisabled = activeConnection?.allowQueryExecution === false;
    const schemaChangesDisabled = activeConnection?.allowSchemaChanges === false || readOnlyConnection;
    const importExportDisabled = activeConnection?.allowImportExport === false || readOnlyConnection;
    const dataEditsDisabled = queryExecutionDisabled || readOnlyConnection;

    // Sync local table pagination with store metadata
    const pageIndex = (activeTab?.metadata?.page || 1) - 1;
    const pageSize = activeTab?.metadata?.pageSize || 100;

    const pagination = useMemo(() => ({ pageIndex, pageSize }), [pageIndex, pageSize]);

    // Custom hooks — data & editing logic
    const {
        metadata, queryResult, isLoadingMeta, isLoadingData, isFetchingData,
        refetch, dbName, schema, cleanTableName, dialect, pkField,
    } = useDataGridData({ tableId });
    const tableName = cleanTableName || tableId;
    const effectiveTotalCount = queryResult?.totalCount;
    const totalPages = effectiveTotalCount
        ? Math.max(1, Math.ceil(effectiveTotalCount / pagination.pageSize))
        : null;
    const rowOverscan = isCompactMobileLayout
        ? 6
        : Math.min(16, Math.max(8, Math.ceil(pagination.pageSize / 100)));

    const editing = useDataGridEditing({
        tableId, metadata, dbName, schema, cleanTableName, pkField, refetch,
    });
    const { handleCellChange, isEditMode, pendingChanges } = editing;
    const defaultColumnOrder = useMemo(
        () => ['__row_number', ...(metadata?.columns?.map((column) => column.name) ?? [])],
        [metadata?.columns],
    );
    const columnOrderStorageKey = useMemo(
        () => buildColumnOrderStorageKey(activeConnectionId, schema, tableName),
        [activeConnectionId, schema, tableName],
    );
    const columnSizingStorageKey = useMemo(
        () => buildColumnSizingStorageKey(activeConnectionId, schema, tableName),
        [activeConnectionId, schema, tableName],
    );

    useEffect(() => {
        if (defaultColumnOrder.length === 0) {
            setColumnOrder([]);
            return;
        }

        const fallbackOrder = normalizeColumnOrder([], defaultColumnOrder);

        if (!columnOrderStorageKey || typeof window === 'undefined') {
            setColumnOrder(fallbackOrder);
            return;
        }

        try {
            const raw = window.localStorage.getItem(columnOrderStorageKey);
            const storedOrder = raw ? JSON.parse(raw) as string[] : [];
            setColumnOrder(normalizeColumnOrder(storedOrder, defaultColumnOrder));
        } catch {
            setColumnOrder(fallbackOrder);
        }
    }, [columnOrderStorageKey, defaultColumnOrder]);

    useEffect(() => {
        if (!columnOrderStorageKey || typeof window === 'undefined' || defaultColumnOrder.length === 0) return;

        const normalizedOrder = normalizeColumnOrder(columnOrder, defaultColumnOrder);

        if (
            normalizedOrder.length === defaultColumnOrder.length &&
            normalizedOrder.every((columnId, index) => columnId === defaultColumnOrder[index])
        ) {
            window.localStorage.removeItem(columnOrderStorageKey);
            return;
        }

        window.localStorage.setItem(columnOrderStorageKey, JSON.stringify(normalizedOrder));
    }, [columnOrder, columnOrderStorageKey, defaultColumnOrder]);

    useEffect(() => {
        if (!columnSizingStorageKey || typeof window === 'undefined') return;

        try {
            const raw = window.localStorage.getItem(columnSizingStorageKey);
            setColumnSizing(raw ? JSON.parse(raw) as ColumnSizingState : {});
        } catch {
            setColumnSizing({});
        }
    }, [columnSizingStorageKey]);

    useEffect(() => {
        if (!columnSizingStorageKey || typeof window === 'undefined') return;

        if (Object.keys(columnSizing).length === 0) {
            window.localStorage.removeItem(columnSizingStorageKey);
            return;
        }

        window.localStorage.setItem(
            columnSizingStorageKey,
            JSON.stringify(columnSizing),
        );
    }, [columnSizing, columnSizingStorageKey]);

    useEffect(() => {
        setPageJumpValue(String(pagination.pageIndex + 1));
    }, [pagination.pageIndex]);

    useEffect(() => () => {
        if (wheelMomentumFrameRef.current !== null) {
            window.cancelAnimationFrame(wheelMomentumFrameRef.current);
        }
        wheelMomentumVelocityRef.current = 0;
        wheelMomentumLastTsRef.current = null;
    }, []);

    const handleOpenCellInspector = (
        value: DatabaseValue,
        columnName: string,
        columnType: string,
        rowKey: string,
    ) => {
        setSelectedCell({ value, columnName, columnType, rowKey });
    };

    const handleColumnDrop = (targetColumnId: string) => {
        if (!draggingColumnId || draggingColumnId === targetColumnId) return;

        setColumnOrder((currentOrder) =>
            reorderColumnIds(
                normalizeColumnOrder(currentOrder, defaultColumnOrder),
                draggingColumnId,
                targetColumnId,
            ),
        );
        setDraggingColumnId(null);
        setDropTargetColumnId(null);
    };

    const commitPageJump = () => {
        const parsedPage = Number.parseInt(pageJumpValue, 10);

        if (!Number.isFinite(parsedPage)) {
            setPageJumpValue(String(pagination.pageIndex + 1));
            return;
        }

        const normalizedPage = Math.max(
            1,
            totalPages ? Math.min(parsedPage, totalPages) : parsedPage,
        );

        setTabPagination(tableId, normalizedPage, pagination.pageSize);
        setPageJumpValue(String(normalizedPage));
    };

    const stopMomentumScroll = useCallback(() => {
        if (wheelMomentumFrameRef.current !== null) {
            window.cancelAnimationFrame(wheelMomentumFrameRef.current);
            wheelMomentumFrameRef.current = null;
        }
        wheelMomentumVelocityRef.current = 0;
        wheelMomentumLastTsRef.current = null;
    }, []);

    const stepMomentumScroll = useCallback((timestamp: number) => {
        const container = tableContainerRef.current;
        if (!container) {
            stopMomentumScroll();
            return;
        }

        const previousTimestamp = wheelMomentumLastTsRef.current;
        const frameRatio = previousTimestamp === null
            ? 1
            : Math.min(1.6, Math.max(0.75, (timestamp - previousTimestamp) / 16.67));
        wheelMomentumLastTsRef.current = timestamp;

        const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
        const step = advanceMomentumScroll(
            container.scrollTop,
            wheelMomentumVelocityRef.current,
            maxScrollTop,
            frameRatio,
        );

        container.scrollTop = step.nextScrollTop;
        wheelMomentumVelocityRef.current = step.nextVelocity;

        if (step.done) {
            stopMomentumScroll();
            return;
        }

        wheelMomentumFrameRef.current = window.requestAnimationFrame(stepMomentumScroll);
    }, [stopMomentumScroll]);

    const handleMomentumWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
        const container = tableContainerRef.current;
        if (!container) return;

        if (
            event.ctrlKey ||
            event.shiftKey ||
            !shouldUseMomentumWheel(event.deltaX, event.deltaY, event.deltaMode)
        ) {
            return;
        }

        event.preventDefault();

        const normalizedDelta = normalizeMomentumWheelDelta(
            event.deltaY,
            event.deltaMode,
            container.clientHeight,
        );
        const velocityBoost = normalizedDelta / 8;

        wheelMomentumVelocityRef.current = Math.max(
            -56,
            Math.min(56, wheelMomentumVelocityRef.current + velocityBoost),
        );

        if (wheelMomentumFrameRef.current === null) {
            wheelMomentumLastTsRef.current = null;
            wheelMomentumFrameRef.current = window.requestAnimationFrame(stepMomentumScroll);
        }
    }, [stepMomentumScroll]);

    const handleGridScroll = useCallback(() => {
        if (wheelMomentumFrameRef.current !== null) return;
        wheelMomentumVelocityRef.current = 0;
        wheelMomentumLastTsRef.current = null;
    }, []);

    // Build columns
    const tableColumns = useMemo(() => {
        if (!metadata?.columns) return [];
        const helper = createColumnHelper<RowData>();

        const dataCols = metadata.columns.map(col => helper.accessor(col.name, {
            header: () => (
                <div className="flex flex-col items-start gap-0.5" title={`${col.name} (${col.type})`}>
                    <span className="font-bold flex items-center gap-1">
                        {col.isPrimaryKey && <span className="text-[10px] text-yellow-500 bg-yellow-500/10 px-0.5 rounded border border-yellow-500/20 shadow-sm" title="Primary Key">PK</span>}
                        {col.isForeignKey && <span className="text-[10px] text-blue-500 bg-blue-500/10 px-0.5 rounded border border-blue-500/20 shadow-sm" title="Foreign Key">FK</span>}
                        {col.name}
                    </span>
                    <span className="text-[10px] font-normal text-muted-foreground/80 font-mono tracking-tight">{col.type}</span>
                </div>
            ),
            cell: info => {
                const val = info.getValue();
                const colName = col.name;
                const rowId = pkField ? String(info.row.original[pkField]) : info.row.id;
                const isEdited = pendingChanges[rowId] && colName in pendingChanges[rowId];
                const displayVal = isEdited ? pendingChanges[rowId][colName] : val;

                if (isEditMode && !col.isPrimaryKey) {
                    return (
                        <input
                            className={`w-full bg-transparent border-none outline-none focus:ring-1 focus:ring-primary rounded px-1 -mx-1 py-0.5 h-6 ${isEdited ? 'text-blue-500 font-bold bg-blue-500/5' : ''}`}
                            value={displayVal === null ? '' : String(displayVal)}
                            onChange={(e) => handleCellChange(rowId, colName, e.target.value)}
                        />
                    );
                }

                const preview = previewDatabaseValue(displayVal as DatabaseValue);

                if (displayVal === null) return <span className="text-muted-foreground/70 italic">NULL</span>;
                if (typeof displayVal === 'boolean') return displayVal ? 'true' : 'false';
                if (typeof displayVal === 'object') {
                    return (
                        <span className="text-[10px] text-blue-400" title={preview}>
                            {preview}
                        </span>
                    );
                }
                return (
                    <span className={isEdited ? 'text-blue-500 font-bold' : ''} title={preview}>
                        {preview}
                    </span>
                );
            },
            size: getInitialColumnWidth(col),
        }));

        const rowNumCol = helper.display({
            id: '__row_number',
            header: '#',
            cell: info => <span className="text-muted-foreground/70 text-[10px] font-mono">{info.row.index + 1}</span>,
            size: 50,
            enableResizing: false,
        });

        return [rowNumCol, ...dataCols];
    }, [metadata, handleCellChange, isEditMode, pendingChanges, pkField]);
    const orderedMetadataColumns = useMemo(() => {
        if (!metadata?.columns) return [];

        const orderMap = new Map(
            normalizeColumnOrder(columnOrder, defaultColumnOrder).map((columnId, index) => [columnId, index]),
        );

        return [...metadata.columns].sort((left, right) => {
            const leftOrder = orderMap.get(left.name) ?? Number.MAX_SAFE_INTEGER;
            const rightOrder = orderMap.get(right.name) ?? Number.MAX_SAFE_INTEGER;
            return leftOrder - rightOrder;
        });
    }, [columnOrder, defaultColumnOrder, metadata?.columns]);

    const table = useReactTable({
        data: queryResult?.rows || [],
        columns: tableColumns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        defaultColumn: {
            size: 180,
            minSize: 96,
            maxSize: 2000,
        },
        columnResizeMode: 'onChange',
        enableColumnResizing: true,
        state: { sorting, globalFilter, pagination, columnSizing, columnOrder },
        onSortingChange: setSorting,
        onGlobalFilterChange: setGlobalFilter,
        onColumnSizingChange: setColumnSizing,
        onColumnOrderChange: setColumnOrder,
        onPaginationChange: (updater) => {
            if (typeof updater === 'function') {
                const next = updater(pagination);
                setTabPagination(tableId, next.pageIndex + 1, next.pageSize);
            }
        },
        manualPagination: true, // Always manual now because we paginate server-side
        pageCount: effectiveTotalCount ? Math.ceil(effectiveTotalCount / pageSize) : -1,
    });

    const { rows } = table.getRowModel();

    const rowVirtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => tableContainerRef.current,
        estimateSize: () => 36,
        overscan: rowOverscan,
    });
    const virtualRows = rowVirtualizer.getVirtualItems();
    const topSpacerHeight = virtualRows[0]?.start ?? 0;
    const bottomSpacerHeight = virtualRows.length > 0
        ? rowVirtualizer.getTotalSize() - (virtualRows[virtualRows.length - 1]?.end ?? 0)
        : 0;
    const totalRowsLabel = (effectiveTotalCount ?? rows.length).toLocaleString();
    const text = useMemo(() => getDataGridText(lang), [lang]);
    const bulkSearchButtonLabel = editing.isEditMode ? text.findReplace : text.find;
    const pageReplaceTargets = useMemo<BulkReplaceTargetRow[]>(
        () => rows.map((row, rowIndex) => ({
            rowId: pkField ? String(row.original[pkField]) : row.id,
            rowIndex,
            values: row.original,
        })),
        [pkField, rows],
    );
    const filteredReplaceTargets = useMemo<BulkReplaceTargetRow[]>(
        () => table.getFilteredRowModel().rows.map((row, rowIndex) => ({
            rowId: pkField ? String(row.original[pkField]) : row.id,
            rowIndex,
            values: row.original,
        })),
        [table, pkField],
    );
    const selectedReplaceTargets = useMemo<BulkReplaceTargetRow[]>(
        () => pageReplaceTargets.filter((row) => editing.selectedRows.has(row.rowId)),
        [editing.selectedRows, pageReplaceTargets],
    );
    const matchedCellKeys = useMemo(
        () => new Set(activeSearch?.matches.map((match) => match.cellKey) ?? []),
        [activeSearch],
    );
    const activeSearchMatch = activeSearch?.matches.length
        ? activeSearch.matches[Math.min(activeSearch.activeIndex, activeSearch.matches.length - 1)]
        : null;
    const activeSearchCellKey = activeSearchMatch?.cellKey ?? null;

    const clearSearchResults = useCallback(() => {
        setActiveSearch(null);
    }, []);

    const handleApplyBulkReplace = (updatesByRow: Record<string, RowData>, summary: { matchedRows: number; matchedCells: number }) => {
        clearSearchResults();
        editing.applyPendingChangesBatch(updatesByRow);
        toast.success(text.stagedReplacements(summary.matchedCells, summary.matchedRows));
    };
    const handleApplySearch = (matches: BulkSearchMatch[], summary: { matchedRows: number; matchedCells: number }) => {
        if (matches.length === 0) {
            setActiveSearch(null);
            toast.info(text.noMatchesFound);
            return;
        }

        setActiveSearch({
            matches,
            activeIndex: 0,
        });
        toast.success(text.findResults(summary.matchedCells, summary.matchedRows));
    };
    const goToSearchMatch = useCallback((direction: -1 | 1) => {
        setActiveSearch((current) => {
            if (!current || current.matches.length === 0) return current;

            const nextIndex = (current.activeIndex + direction + current.matches.length) % current.matches.length;
            return {
                ...current,
                activeIndex: nextIndex,
            };
        });
    }, []);

    useEffect(() => {
        if (!activeSearchMatch) return;

        rowVirtualizer.scrollToIndex(activeSearchMatch.rowIndex, { align: 'center' });

        const revealCell = () => {
            const cellElement = tableContainerRef.current?.querySelector<HTMLElement>(
                `[data-cell-key="${activeSearchMatch.cellKey}"]`,
            );

            if (cellElement) {
                cellElement.scrollIntoView({ block: 'nearest', inline: 'center' });
                return;
            }

            window.requestAnimationFrame(() => {
                const deferredCellElement = tableContainerRef.current?.querySelector<HTMLElement>(
                    `[data-cell-key="${activeSearchMatch.cellKey}"]`,
                );
                deferredCellElement?.scrollIntoView({ block: 'nearest', inline: 'center' });
            });
        };

        window.requestAnimationFrame(revealCell);
    }, [activeSearchMatch, rowVirtualizer]);

    useEffect(() => {
        setActiveSearch(null);
        stopMomentumScroll();
    }, [globalFilter, pageIndex, pageSize, queryResult?.rows, stopMomentumScroll, tableId]);

    useEffect(() => {
        if (!editing.isEditMode) {
            setIsBulkReplaceOpen(false);
            setActiveSearch(null);
        }
    }, [editing.isEditMode]);

    // Export context
    const exportCtx: ExportContext = {
        rows,
        columns: metadata?.columns || [],
        schema,
        tableName: cleanTableName || tableId,
        dialect,
    };

    const mobileActionLabel = editing.selectedRows.size > 0
        ? text.delete(editing.selectedRows.size)
        : text.actions;

    // --- Loading state ---
    if (isLoadingMeta) return (
        <div className="p-4 text-xs text-muted-foreground italic flex items-center gap-2">
            <RefreshCw className="w-3 h-3 animate-spin" /> {text.loadingSchema}
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
                lang={lang}
                isReadOnly={readOnlyConnection}
                schemaChangesAllowed={!schemaChangesDisabled}
            />
        );
    }

    return (
        <div className="flex flex-col h-full bg-background relative font-sans">
            {/* Toolbar */}
            <div className={cn(
                "border-b bg-muted/20 px-2",
                isCompactMobileLayout ? "py-2 space-y-2" : "p-1 h-9 flex items-center gap-1"
            )}>
                {isCompactMobileLayout ? (
                    <>
                        <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
                            <div className="flex bg-muted/50 rounded p-0.5 border shrink-0">
                                <Button variant={viewMode === 'grid' ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode('grid')} className="h-7 px-2 text-[11px] gap-1 rounded-sm">
                                    <LayoutGrid className="w-3 h-3" />
                                    {!isSmallMobile && 'Grid'}
                                </Button>
                                <Button variant={viewMode === 'design' ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode('design')} className="h-7 px-2 text-[11px] gap-1 rounded-sm">
                                    <PencilLine className="w-3 h-3" />
                                    {!isSmallMobile && 'Design'}
                                </Button>
                            </div>

                            <Button
                                variant={editing.isEditMode ? "secondary" : "ghost"}
                                size="sm"
                                onClick={editing.toggleEditMode}
                                disabled={dataEditsDisabled}
                                className={cn(
                                    "h-7 px-2 text-[11px] gap-1.5 shrink-0",
                                    editing.isEditMode && "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
                                )}
                            >
                                <PencilLine className="w-3 h-3" />
                                {editing.isEditMode ? text.cancel : text.edit}
                            </Button>

                            {editing.isEditMode && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setIsBulkReplaceOpen(true)}
                                    className="h-7 px-2 text-[11px] gap-1.5 shrink-0"
                                >
                                    <ArrowRightLeft className="w-3 h-3" />
                                    {isSmallMobile ? text.find : bulkSearchButtonLabel}
                                </Button>
                            )}

                            {Object.keys(editing.pendingChanges).length > 0 && (
                                <Button
                                    variant="default"
                                    size="sm"
                                    onClick={editing.handleSaveData}
                                    disabled={editing.isSaving || dataEditsDisabled}
                                    className="h-7 px-3 text-[11px] bg-green-600 hover:bg-green-700 text-white shrink-0"
                                >
                                    {editing.isSaving ? <RefreshCw className="w-3 h-3 animate-spin mr-1" /> : null}
                                    {text.save} ({Object.keys(editing.pendingChanges).length})
                                </Button>
                            )}
                        </div>

                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                                <Button variant="ghost" size="sm" onClick={() => refetch()} className="h-8 px-2 text-[11px] gap-1 shrink-0" disabled={editing.isEditMode}>
                                    <RefreshCw className="w-3.5 h-3.5" />
                                    {!isSmallMobile && text.refresh}
                                </Button>

                                <FilterPopover lang={lang} onFilterChange={setGlobalFilter} currentFilter={globalFilter} />

                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="sm" className="h-8 px-2 text-[11px] gap-1 shrink-0">
                                            <MoreHorizontal className="w-3.5 h-3.5" />
                                            {!isSmallMobile && mobileActionLabel}
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-52">
                                        <DropdownMenuItem onClick={() => exportCSV(exportCtx)} className="gap-2 text-xs">
                                            <FileText className="w-3 h-3" /> CSV
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => exportJSON(exportCtx)} className="gap-2 text-xs">
                                            <FileJson className="w-3 h-3" /> JSON
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => exportSQL(exportCtx)} className="gap-2 text-xs">
                                            <FileCode className="w-3 h-3" /> {lang === 'vi' ? 'SQL (THEM)' : 'SQL (INSERT)'}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={editing.toggleInsertMode} disabled={dataEditsDisabled} className="gap-2 text-xs">
                                            <Plus className="w-3 h-3" /> {editing.isInserting ? text.cancelInsert : text.insertRow}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => setIsImportDialogOpen(true)} disabled={importExportDisabled} className="gap-2 text-xs">
                                            <Upload className="w-3 h-3" /> {text.import}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => setIsMigrationDialogOpen(true)} disabled={queryExecutionDisabled} className="gap-2 text-xs">
                                            <ArrowRightLeft className="w-3 h-3" /> {text.transfer}
                                        </DropdownMenuItem>
                                        {editing.selectedRows.size > 0 && (
                                            <DropdownMenuItem onClick={editing.handleDeleteRows} disabled={editing.isSaving || dataEditsDisabled} className="gap-2 text-xs text-red-500 focus:text-red-500">
                                                <Trash2 className="w-3 h-3" /> {text.delete(editing.selectedRows.size)}
                                            </DropdownMenuItem>
                                        )}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono uppercase shrink-0">
                                <span className="bg-muted px-1.5 py-1 rounded border border-border/50">
                                    {totalRowsLabel} rows
                                </span>
                                {queryResult?.durationMs && <span className="opacity-70">{queryResult.durationMs}ms</span>}
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="flex bg-muted/50 rounded p-0.5 border">
                            <Button variant={viewMode === 'grid' ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode('grid')} className="h-6 px-2 text-[11px] gap-1.5 rounded-sm">
                                <LayoutGrid className="w-3 h-3" /> Grid
                            </Button>
                            <Button variant={viewMode === 'design' ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode('design')} className="h-6 px-2 text-[11px] gap-1.5 rounded-sm">
                                <LayoutGrid className="w-3 h-3" /> Design
                            </Button>
                        </div>

                        <div className="h-4 w-[1px] bg-border mx-1" />

                        <div className="flex bg-muted/30 rounded p-0.5 border">
                            <Button
                                variant={editing.isEditMode ? "secondary" : "ghost"}
                                size="sm"
                                onClick={editing.toggleEditMode}
                                disabled={dataEditsDisabled}
                                className={`h-6 px-2 text-[11px] gap-1.5 rounded-sm ${editing.isEditMode ? 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' : ''}`}
                            >
                                {editing.isEditMode ? text.cancelEdit : text.editData}
                            </Button>
                        </div>

                        {editing.isEditMode && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setIsBulkReplaceOpen(true)}
                                className="h-7 text-[11px] gap-1 px-2"
                            >
                                <ArrowRightLeft className="w-3 h-3" /> {bulkSearchButtonLabel}
                            </Button>
                        )}

                        {Object.keys(editing.pendingChanges).length > 0 && (
                            <Button variant="default" size="sm" onClick={editing.handleSaveData} disabled={editing.isSaving || dataEditsDisabled} className="h-6 px-3 text-[11px] bg-green-600 hover:bg-green-700 text-white ml-2">
                                {editing.isSaving ? <RefreshCw className="w-3 h-3 animate-spin mr-1" /> : null}
                                {text.saveChanges} ({Object.keys(editing.pendingChanges).length})
                            </Button>
                        )}

                        <div className="h-4 w-[1px] bg-border mx-1" />

                        <Button variant="ghost" size="sm" onClick={() => refetch()} className="h-7 text-[11px] gap-1 px-2" disabled={editing.isEditMode}>
                            <RefreshCw className="w-3 h-3" /> {text.refresh}
                        </Button>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1 px-2">
                                    <Download className="w-3 h-3" /> {text.export}
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
                                    <FileCode className="w-3 h-3" /> {lang === 'vi' ? 'SQL (THEM)' : 'SQL (INSERT)'}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <div className="h-4 w-[1px] bg-border mx-1" />

                        <Button variant="ghost" size="sm" onClick={editing.toggleInsertMode} disabled={dataEditsDisabled} className={`h-7 text-[11px] gap-1 px-2 ${editing.isInserting ? 'text-green-500' : ''}`}>
                            <Plus className="w-3 h-3" /> {text.insertRow}
                        </Button>

                        <Button variant="ghost" size="sm" onClick={() => setIsImportDialogOpen(true)} disabled={importExportDisabled} className="h-7 text-[11px] gap-1 px-2 text-blue-500 hover:text-blue-600">
                            <Upload className="w-3 h-3" /> {text.import}
                        </Button>

                        <Button variant="ghost" size="sm" onClick={() => setIsMigrationDialogOpen(true)} disabled={queryExecutionDisabled} className="h-7 text-[11px] gap-1 px-2 text-purple-500 hover:text-purple-600">
                            <ArrowRightLeft className="w-3 h-3" /> {text.transfer}
                        </Button>

                        {editing.selectedRows.size > 0 && (
                            <Button variant="ghost" size="sm" onClick={editing.handleDeleteRows} disabled={editing.isSaving || dataEditsDisabled} className="h-7 text-[11px] gap-1 px-2 text-red-500 hover:text-red-600 hover:bg-red-500/10">
                                <Trash2 className="w-3 h-3" /> {text.delete(editing.selectedRows.size)}
                            </Button>
                        )}

                        <div className="h-4 w-[1px] bg-border mx-1" />

                        <FilterPopover lang={lang} onFilterChange={setGlobalFilter} currentFilter={globalFilter} />

                        <div className="text-[10px] text-muted-foreground ml-auto flex items-center gap-3 pr-2 font-mono uppercase">
                            <span className="bg-muted px-1.5 rounded border border-border/50">
                                {totalRowsLabel} {text.totalRows}
                            </span>
                            {queryResult?.durationMs && <span className="opacity-70">{queryResult.durationMs}MS</span>}
                        </div>
                    </>
                )}
            </div>

            {activeSearchMatch && activeSearch && (
                <div className={cn(
                    "border-b border-amber-500/20 bg-amber-500/5 px-3 py-2",
                    "flex items-center justify-between gap-3",
                    isCompactMobileLayout && "flex-col items-start"
                )}>
                    <div className="min-w-0 flex items-center gap-3 text-xs text-foreground">
                        <span className="rounded border border-amber-500/20 bg-amber-500/10 px-2 py-1 font-semibold uppercase tracking-wide text-[10px] text-amber-300">
                            {text.find}
                        </span>
                        <span className="font-medium">
                            {activeSearch.activeIndex + 1} / {activeSearch.matches.length}
                        </span>
                        <span className="truncate text-muted-foreground">
                            {activeSearchMatch.columnId}: {activeSearchMatch.preview}
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-[11px]"
                            onClick={() => goToSearchMatch(-1)}
                        >
                            {text.prev}
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-[11px]"
                            onClick={() => goToSearchMatch(1)}
                        >
                            {text.next}
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-[11px] text-amber-300 hover:text-amber-200"
                            onClick={clearSearchResults}
                        >
                            {text.clear}
                        </Button>
                    </div>
                </div>
            )}

            {activeConnection && (readOnlyConnection || queryExecutionDisabled || schemaChangesDisabled || importExportDisabled) && (
                <div className="mx-2 mt-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
                    {readOnlyConnection
                        ? text.readOnlyLocked
                        : queryExecutionDisabled
                            ? text.queryExecutionDisabled
                            : text.restrictedConnection([
                                schemaChangesDisabled ? text.schemaChangesDisabled : null,
                                importExportDisabled ? text.importExportDisabled : null,
                            ].filter((value): value is string => Boolean(value)))}
                </div>
            )}

            {/* Main Content */}
            <div className="flex-1 relative overflow-hidden bg-background">
                {viewMode === 'grid' && (
                    <div
                        ref={tableContainerRef}
                        onWheel={handleMomentumWheel}
                        onScroll={handleGridScroll}
                        className="h-full overflow-auto relative scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent"
                    >
                        <div style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
                            <table className="table-fixed text-xs text-left border-collapse" style={{ width: table.getTotalSize() }}>
                                <thead className="bg-muted sticky top-0 z-20 shadow-sm border-b">
                                    {table.getHeaderGroups().map(headerGroup => (
                                        <tr key={headerGroup.id}>
                                            {headerGroup.headers.map(header => (
                                                <th
                                                    key={header.id}
                                                    className={cn(
                                                        "relative px-2 py-1.5 border-r border-b font-semibold text-muted-foreground whitespace-nowrap cursor-pointer hover:bg-accent/50 select-none last:border-r-0 bg-muted/90 backdrop-blur-md transition-colors",
                                                        draggingColumnId === header.column.id && "opacity-70",
                                                        dropTargetColumnId === header.column.id && "bg-blue-500/10 ring-1 ring-inset ring-blue-500/40",
                                                    )}
                                                    onClick={header.column.getToggleSortingHandler()}
                                                    onDragOver={(event) => {
                                                        if (
                                                            !draggingColumnId ||
                                                            draggingColumnId === header.column.id ||
                                                            header.column.id === '__row_number'
                                                        ) {
                                                            return;
                                                        }

                                                        event.preventDefault();
                                                        if (dropTargetColumnId !== header.column.id) {
                                                            setDropTargetColumnId(header.column.id);
                                                        }
                                                    }}
                                                    onDragLeave={() => {
                                                        if (dropTargetColumnId === header.column.id) {
                                                            setDropTargetColumnId(null);
                                                        }
                                                    }}
                                                    onDrop={(event) => {
                                                        event.preventDefault();
                                                        handleColumnDrop(header.column.id);
                                                    }}
                                                    style={{ width: header.getSize() }}
                                                >
                                                    <div className="flex items-start gap-1.5">
                                                        {header.column.id !== '__row_number' && (
                                                            <button
                                                                type="button"
                                                                draggable
                                                                className="mt-0.5 flex h-5 w-5 shrink-0 cursor-grab items-center justify-center rounded border border-transparent text-muted-foreground/55 transition-colors hover:border-border/60 hover:bg-background/60 hover:text-foreground/80 active:cursor-grabbing"
                                                                onClick={(event) => event.stopPropagation()}
                                                                onDragStart={(event) => {
                                                                    event.stopPropagation();
                                                                    event.dataTransfer.effectAllowed = 'move';
                                                                    event.dataTransfer.setData('text/plain', header.column.id);
                                                                    setDraggingColumnId(header.column.id);
                                                                    setDropTargetColumnId(null);
                                                                }}
                                                                onDragEnd={(event) => {
                                                                    event.stopPropagation();
                                                                    setDraggingColumnId(null);
                                                                    setDropTargetColumnId(null);
                                                                }}
                                                                title={lang === 'vi' ? 'Kéo để đổi thứ tự cột' : 'Drag to reorder column'}
                                                            >
                                                                <GripVertical className="h-3 w-3" />
                                                            </button>
                                                        )}
                                                        <div className="flex items-center gap-1">
                                                            {flexRender(header.column.columnDef.header, header.getContext())}
                                                            <span className="hidden">
                                                                {{ asc: <span className="text-[10px] opacity-70">▲</span>, desc: <span className="text-[10px] opacity-70">▼</span> }[header.column.getIsSorted() as string] ?? null}
                                                            </span>
                                                            <span className="text-[10px] opacity-70">
                                                                {header.column.getIsSorted() === 'asc'
                                                                    ? 'ASC'
                                                                    : header.column.getIsSorted() === 'desc'
                                                                        ? 'DESC'
                                                                        : ''}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    {header.column.getCanResize() && (
                                                        <div
                                                            className={cn(
                                                                "absolute right-0 top-0 h-full w-2 cursor-col-resize touch-none select-none transition-colors",
                                                                header.column.getIsResizing()
                                                                    ? "bg-blue-500/40"
                                                                    : "hover:bg-blue-500/15",
                                                            )}
                                                            onClick={(event) => event.stopPropagation()}
                                                            onDoubleClick={(event) => {
                                                                event.stopPropagation();
                                                                const column = metadata?.columns.find(
                                                                    (item) => item.name === header.column.id,
                                                                );
                                                                if (!column || !queryResult?.rows) return;
                                                                setColumnSizing((current) => ({
                                                                    ...current,
                                                                    [header.column.id]: getAutoFitColumnWidth(
                                                                        column,
                                                                        queryResult.rows,
                                                                    ),
                                                                }));
                                                            }}
                                                            onMouseDown={(event) => {
                                                                event.stopPropagation();
                                                                header.getResizeHandler()(event);
                                                            }}
                                                            onTouchStart={(event) => {
                                                                event.stopPropagation();
                                                                header.getResizeHandler()(event);
                                                            }}
                                                            title={lang === 'vi' ? 'Kéo để đổi độ rộng. Nhấn đúp để vừa nội dung.' : 'Drag to resize. Double-click to auto-fit.'}
                                                        />
                                                    )}
                                                </th>
                                            ))}
                                        </tr>
                                    ))}
                                </thead>
                                <tbody>
                                    {topSpacerHeight > 0 && (
                                        <tr><td style={{ height: `${topSpacerHeight}px` }} colSpan={table.getVisibleFlatColumns().length} /></tr>
                                    )}
                                    {isLoadingData && rows.length === 0 ? (
                                        <tr><td colSpan={tableColumns.length} className="p-8 text-center text-muted-foreground">{text.loadingData}</td></tr>
                                    ) : (
                                        virtualRows.map(virtualRow => {
                                            const row = rows[virtualRow.index];
                                            if (!row) return null;
                                            return (
                                                <DataGridRow
                                                    key={row.id}
                                                    row={row}
                                                    editing={editing}
                                                    lang={lang}
                                                    pkField={pkField}
                                                    metadata={metadata}
                                                    handleOpenCellInspector={handleOpenCellInspector}
                                                    copyRowAsSQL={copyRowAsSQL}
                                                    schema={schema}
                                                    tableName={cleanTableName || tableId}
                                                    dialect={dialect}
                                                    matchedCellKeys={matchedCellKeys}
                                                    activeCellKey={activeSearchCellKey}
                                                />
                                            );
                                        })
                                    )}
                                    {bottomSpacerHeight > 0 && (
                                        <tr><td style={{ height: `${bottomSpacerHeight}px` }} colSpan={table.getVisibleFlatColumns().length} /></tr>
                                    )}
                                </tbody>
                                {editing.isInserting && metadata?.columns && (
                                    <tfoot className="border-t-2 border-green-500/30">
                                        <tr className="bg-green-500/5">
                                            <td className="px-2 py-1 border-r text-[10px] text-green-500 font-bold">NEW</td>
                                            {orderedMetadataColumns.map(col => (
                                                <td key={col.name} className="px-1 py-0.5 border-r">
                                                    <input
                                                        className="w-full bg-transparent border-none outline-none text-xs font-mono px-1 py-0.5 h-6 focus:ring-1 focus:ring-green-500 rounded placeholder:text-muted-foreground/60"
                                                        placeholder={col.isPrimaryKey ? '(auto)' : col.type}
                                                        value={editing.newRowData[col.name] || ''}
                                                        onChange={(e) => editing.setNewRowData(prev => ({ ...prev, [col.name]: e.target.value }))}
                                                        disabled={col.isPrimaryKey || dataEditsDisabled}
                                                    />
                                                </td>
                                            ))}
                                        </tr>
                                        <tr>
                                            <td colSpan={metadata.columns.length + 1} className="px-2 py-1">
                                                <div className="flex items-center gap-1">
                                                    <Button size="sm" onClick={editing.handleInsertRow} disabled={editing.isSaving || dataEditsDisabled} className="h-6 px-3 text-[10px] bg-green-600 hover:bg-green-700 text-white gap-1">
                                                        <Check className="w-3 h-3" /> {text.insert}
                                                    </Button>
                                                    <Button variant="ghost" size="sm" onClick={editing.toggleInsertMode} className="h-6 px-2 text-[10px] gap-1">
                                                        <X className="w-3 h-3" /> {text.cancel}
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
                        {text.pageLabel(pagination.pageIndex + 1)}
                    </span>
                    <div className="flex items-center gap-3 ml-2">
                        <div className="flex items-center gap-1">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 w-5 p-0 hover:bg-muted"
                                disabled={pagination.pageIndex === 0}
                                onClick={() => setTabPagination(tableId, pagination.pageIndex, pagination.pageSize)}
                            >
                                ◀
                            </Button>
                            <div className="flex items-center gap-1">
                                <Input
                                    value={pageJumpValue}
                                    onChange={(e) => {
                                        const nextValue = e.target.value.replace(/\D/g, '');
                                        setPageJumpValue(nextValue);
                                    }}
                                    onBlur={commitPageJump}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            commitPageJump();
                                        }
                                        if (e.key === 'Escape') {
                                            setPageJumpValue(String(pagination.pageIndex + 1));
                                        }
                                    }}
                                    inputMode="numeric"
                                    aria-label={text.jumpToPage}
                                    className="h-5 w-12 border-border/40 bg-transparent px-1 text-center text-[10px] font-semibold tracking-normal"
                                />
                                <span className="min-w-[38px] text-center">
                                    / {totalPages ?? '?'}
                                </span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-5 px-1.5 text-[9px] font-bold hover:bg-muted"
                                    onClick={commitPageJump}
                                >
                                    {text.go}
                                </Button>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 w-5 p-0 hover:bg-muted"
                                disabled={effectiveTotalCount ? (pagination.pageIndex + 1) * pagination.pageSize >= effectiveTotalCount : rows.length < pagination.pageSize}
                                onClick={() => setTabPagination(tableId, pagination.pageIndex + 2, pagination.pageSize)}
                            >
                                ▶
                            </Button>
                        </div>
                        <span className="text-[9px] opacity-70">{lang === 'vi' ? 'TRANG' : 'PAGE'}</span>
                        <div className="h-3 w-[1px] bg-border mx-1" />
                        <select
                            className="bg-transparent border-none outline-none cursor-pointer hover:text-foreground text-[9px] font-bold py-0 h-4"
                            value={pagination.pageSize}
                            onChange={(e) => setTabPagination(tableId, 1, Number(e.target.value))}
                        >
                            <option value="50">50 / {lang === 'vi' ? 'TRANG' : 'PAGE'}</option>
                            <option value="100">100 / {lang === 'vi' ? 'TRANG' : 'PAGE'}</option>
                            <option value="500">500 / {lang === 'vi' ? 'TRANG' : 'PAGE'}</option>
                            <option value="1000">1000 / {lang === 'vi' ? 'TRANG' : 'PAGE'}</option>
                        </select>
                    </div>
                </div>
                <div className="flex items-center gap-4 opacity-60">
                    <span>{cleanTableName || tableId}</span>
                    <span>{schema}</span>
                </div>
            </div>

            <BulkReplaceDialog
                open={isBulkReplaceOpen}
                onOpenChange={setIsBulkReplaceOpen}
                allowReplace={editing.isEditMode && !dataEditsDisabled}
                columns={metadata?.columns || []}
                pageTargets={pageReplaceTargets}
                filteredTargets={filteredReplaceTargets}
                selectedTargets={selectedReplaceTargets}
                pendingChanges={editing.pendingChanges}
                onApply={handleApplyBulkReplace}
                onSearch={handleApplySearch}
                onClearSearch={clearSearchResults}
                hasSearchResults={Boolean(activeSearch?.matches.length)}
                lang={lang}
            />

            <BulkImportDialog
                open={isImportDialogOpen}
                onOpenChange={setIsImportDialogOpen}
                tableId={cleanTableName || tableId}
                schema={schema}
                onSuccess={() => refetch()}
                importAllowed={!importExportDisabled}
                readOnly={readOnlyConnection}
            />

            <MigrationHubDialog
                isOpen={isMigrationDialogOpen}
                onClose={() => setIsMigrationDialogOpen(false)}
                sourceConnectionId={activeTab?.metadata?.connectionId || useAppStore.getState().activeConnectionId || ''}
                sourceSchema={schema}
                sourceTable={cleanTableName || tableId}
            />

            <CellValueDialog
                cell={selectedCell}
                onOpenChange={(open) => {
                    if (!open) setSelectedCell(null);
                }}
                lang={lang}
            />
        </div>
    );
};
