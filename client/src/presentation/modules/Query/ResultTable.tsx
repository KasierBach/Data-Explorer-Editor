import React, { useEffect, useMemo, useState } from 'react';
import {
    useReactTable,
    getCoreRowModel,
    flexRender,
    type CellContext,
} from '@tanstack/react-table';
import type { QueryResult, RowData } from '@/core/domain/entities';
import { Info } from 'lucide-react';
import { useResponsiveLayoutMode } from '@/presentation/hooks/useResponsiveLayoutMode';
import { cn } from '@/lib/utils';
import { Button } from '@/presentation/components/ui/button';
import { Input } from '@/presentation/components/ui/input';
import { useAppStore } from '@/core/services/store';

const DEFAULT_PAGE_SIZE = 100;
const PAGE_SIZE_OPTIONS = [50, 100, 500, 1000] as const;

interface ResultTableProps {
    results: QueryResult | null;
    pageIndex: number;
    pageSize: number;
    totalCount?: number;
    isFetching?: boolean;
    onPaginationChange: (pageIndex: number, pageSize: number) => void;
}

export const ResultTable: React.FC<ResultTableProps> = ({
    results,
    pageIndex,
    pageSize,
    totalCount,
    isFetching = false,
    onPaginationChange,
}) => {
    const { lang } = useAppStore();
    const { isCompactMobileLayout } = useResponsiveLayoutMode();
    const normalizedPageSize = pageSize || DEFAULT_PAGE_SIZE;
    const data = useMemo(() => results?.rows || [], [results]);
    const offset = pageIndex * normalizedPageSize;
    const resolvedTotal = typeof totalCount === 'number'
        ? totalCount
        : data.length < normalizedPageSize
            ? offset + data.length
            : undefined;
    const totalPages = resolvedTotal !== undefined
        ? Math.max(1, Math.ceil(resolvedTotal / normalizedPageSize))
        : undefined;
    const hasNextPage = resolvedTotal !== undefined
        ? offset + data.length < resolvedTotal
        : data.length === normalizedPageSize;
    const [pageJumpValue, setPageJumpValue] = useState(String(pageIndex + 1));

    const columns = useMemo(() => {
        if (!results?.columns) return [];
        return results.columns.map((colName: string) => ({
            header: colName,
            accessorKey: colName,
            cell: (info: CellContext<RowData, unknown>) => {
                const val = info.getValue();
                if (val === null) return <span className="text-muted-foreground italic">null</span>;
                if (typeof val === 'object') return JSON.stringify(val);
                return String(val);
            },
        }));
    }, [results]);

    // eslint-disable-next-line react-hooks/incompatible-library
    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

    const copy = lang === 'vi'
        ? {
            rows: 'dòng',
            perPage: 'trang',
            loading: 'Đang tải…',
            empty: 'Truy vấn không trả về dòng nào.',
            previous: 'Trang trước',
            next: 'Trang sau',
            page: (value: number) => `Trang ${value}`,
            jump: 'Đi tới trang',
            go: 'Đi',
            result: 'Kết quả truy vấn',
        }
        : {
            rows: 'rows',
            perPage: 'page',
            loading: 'Loading…',
            empty: 'Query returned no rows.',
            previous: 'Previous page',
            next: 'Next page',
            page: (value: number) => `Page ${value}`,
            jump: 'Jump to page',
            go: 'Go',
            result: 'Query result',
        };

    useEffect(() => {
        setPageJumpValue(String(pageIndex + 1));
    }, [pageIndex]);

    useEffect(() => {
        if (totalPages !== undefined && pageIndex >= totalPages) {
            onPaginationChange(Math.max(0, totalPages - 1), normalizedPageSize);
        }
    }, [normalizedPageSize, onPaginationChange, pageIndex, totalPages]);

    const commitPageJump = () => {
        if (totalPages === undefined) return;
        const parsed = Number.parseInt(pageJumpValue, 10);
        const nextPage = Number.isFinite(parsed)
            ? Math.min(totalPages, Math.max(1, parsed))
            : pageIndex + 1;
        setPageJumpValue(String(nextPage));
        onPaginationChange(nextPage - 1, normalizedPageSize);
    };

    if (!results || (data.length === 0 && pageIndex === 0 && !isFetching)) {
        return (
            <div className="p-8 text-center text-muted-foreground flex flex-col items-center gap-2">
                <Info className="w-8 h-8 opacity-20" />
                <p>{copy.empty}</p>
            </div>
        );
    }

    const startRow = data.length > 0 ? offset + 1 : offset;
    const endRow = offset + data.length;
    const totalLabel = resolvedTotal !== undefined
        ? resolvedTotal.toLocaleString()
        : `${endRow.toLocaleString()}+`;

    return (
        <div className="w-full h-full flex flex-col overflow-hidden bg-background">
            <div className="flex-1 w-full overflow-auto scrollbar-thin scrollbar-thumb-muted-foreground/20">
                <table className="w-full text-xs text-left border-collapse min-w-full">
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
                                    {offset + idx + 1}
                                </td>
                                {row.getVisibleCells().map(cell => (
                                    <td key={cell.id} className={cn(
                                        'p-1.5 px-3 border-r last:border-r-0 whitespace-nowrap truncate',
                                        isCompactMobileLayout ? 'max-w-[200px]' : 'max-w-[400px]',
                                    )}>
                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="min-h-7 px-3 py-1 border-t bg-muted/20 flex items-center justify-between gap-3 shrink-0 overflow-x-auto text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                <div className="flex shrink-0 items-center gap-4">
                    <span className="flex items-center gap-1.5 whitespace-nowrap">
                        <span className={cn(
                            'h-1.5 w-1.5 rounded-full',
                            isFetching ? 'bg-blue-500 animate-pulse' : 'bg-green-500',
                        )} />
                        {isFetching ? copy.loading : `${data.length} ${copy.rows}`}
                    </span>

                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0 hover:bg-muted"
                            disabled={pageIndex === 0 || isFetching}
                            onClick={() => onPaginationChange(pageIndex - 1, normalizedPageSize)}
                            title={copy.previous}
                        >
                            ◀
                        </Button>

                        {totalPages !== undefined ? (
                            <div className="flex items-center gap-1">
                                <Input
                                    value={pageJumpValue}
                                    onChange={(event) => setPageJumpValue(event.target.value.replace(/\D/g, ''))}
                                    onBlur={commitPageJump}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter') {
                                            event.preventDefault();
                                            commitPageJump();
                                        }
                                        if (event.key === 'Escape') {
                                            setPageJumpValue(String(pageIndex + 1));
                                        }
                                    }}
                                    inputMode="numeric"
                                    aria-label={copy.jump}
                                    className="h-5 w-12 border-border/40 bg-transparent px-1 text-center text-[10px] font-semibold tracking-normal"
                                />
                                <span className="min-w-[38px] text-center">/ {totalPages}</span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-5 px-1.5 text-[9px] font-bold hover:bg-muted"
                                    onClick={commitPageJump}
                                >
                                    {copy.go}
                                </Button>
                            </div>
                        ) : (
                            <span className="min-w-[56px] text-center tabular-nums">{copy.page(pageIndex + 1)}</span>
                        )}

                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0 hover:bg-muted"
                            disabled={!hasNextPage || isFetching}
                            onClick={() => onPaginationChange(pageIndex + 1, normalizedPageSize)}
                            title={copy.next}
                        >
                            ▶
                        </Button>
                    </div>

                    <span className="h-3 w-px bg-border" />

                    <select
                        aria-label={lang === 'vi' ? 'Dòng mỗi trang' : 'Rows per page'}
                        className="h-4 cursor-pointer border-none bg-transparent py-0 text-[9px] font-bold outline-none hover:text-foreground"
                        value={normalizedPageSize}
                        onChange={(event) => onPaginationChange(0, Number(event.target.value))}
                        disabled={isFetching}
                    >
                        {PAGE_SIZE_OPTIONS.map(size => (
                            <option key={size} value={size}>{size} / {copy.perPage}</option>
                        ))}
                    </select>
                </div>

                <div className="hidden shrink-0 items-center gap-4 opacity-70 sm:flex">
                    <span className="tabular-nums whitespace-nowrap">
                        {startRow.toLocaleString()}–{endRow.toLocaleString()} / {totalLabel}
                    </span>
                    <span className="hidden sm:inline">{copy.result}</span>
                </div>
            </div>
        </div>
    );
};