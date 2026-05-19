import React, { useMemo, useRef } from 'react';
import {
    useReactTable,
    getCoreRowModel,
    flexRender,
    type CellContext,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Info } from 'lucide-react';
import { flattenDocuments } from '@/core/utils/flattenJson';

interface NoSqlGridViewProps {
    data: unknown[] | null;
}

/**
 * High-performance Grid View for NoSQL data. 
 * Uses virtualization to handle thousands of documents smoothly.
 * Automatically flattens nested JSON documents into a flat tabular format.
 */
export const NoSqlGridView: React.FC<NoSqlGridViewProps> = ({ data }) => {
    const parentRef = useRef<HTMLDivElement>(null);

    const { columns, rows } = useMemo(() => {
        if (!data || !Array.isArray(data) || data.length === 0) {
            return { columns: [], rows: [] };
        }
        return flattenDocuments(data);
    }, [data]);

    const tableColumns = useMemo(() => {
        return columns.map((colName) => ({
            header: colName,
            accessorKey: colName,
            cell: (info: CellContext<Record<string, unknown>, unknown>) => {
                const val = info.getValue();
                if (val === null) return <span className="text-muted-foreground/60 italic">null</span>;
                if (typeof val === 'object') return (
                    <span className="text-blue-400 font-mono" title={JSON.stringify(val, null, 2)}>
                        {JSON.stringify(val)}
                    </span>
                );
                if (typeof val === 'boolean') return <span className="text-purple-400">{String(val)}</span>;
                return <span className="text-foreground/80">{String(val)}</span>;
            },
            size: 200, // Default column size
        }));
    }, [columns]);

    const table = useReactTable({
        data: rows,
        columns: tableColumns,
        getCoreRowModel: getCoreRowModel(),
    });

    const { rows: tableRows } = table.getRowModel();

    // Virtualization setup
    const rowVirtualizer = useVirtualizer({
        count: tableRows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 36,
        overscan: 10,
    });

    if (!data || data.length === 0) {
        return (
            <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-3 bg-muted/5 rounded-2xl border-2 border-dashed border-border/40 m-4">
                <div className="p-3 bg-muted/20 rounded-full">
                    <Info className="w-8 h-8 opacity-40" />
                </div>
                <div className="space-y-1">
                    <p className="font-bold text-sm tracking-tight">Empty Result Set</p>
                    <p className="text-[11px] opacity-60 italic">No documents found for this query.</p>
                </div>
            </div>
        );
    }

    return (
        <div 
            ref={parentRef}
            className="w-full h-full overflow-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 bg-background relative"
        >
            <table className="w-full text-[11px] text-left border-collapse font-mono table-fixed">
                <thead className="bg-muted/90 backdrop-blur-md sticky top-0 z-20 shadow-sm ring-1 ring-black/5">
                    {table.getHeaderGroups().map(headerGroup => (
                        <tr key={headerGroup.id}>
                            <th className="p-2 border-b border-r border-border/50 text-center text-[9px] w-12 text-muted-foreground/50 font-black tracking-tighter">#</th>
                            {headerGroup.headers.map(header => (
                                <th 
                                    key={header.id} 
                                    style={{ width: header.getSize() }}
                                    className="p-3 px-4 border-b border-r border-border/50 font-bold text-muted-foreground/70 whitespace-nowrap bg-muted/10 uppercase tracking-wider overflow-hidden truncate"
                                >
                                    {flexRender(header.column.columnDef.header, header.getContext())}
                                </th>
                            ))}
                        </tr>
                    ))}
                </thead>
                <tbody style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative', display: 'block' }}>
                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                        const row = tableRows[virtualRow.index];
                        return (
                            <tr 
                                key={row.id} 
                                className="hover:bg-blue-500/[0.04] transition-colors group border-b border-border/30 flex items-center"
                                style={{
                                    height: `${virtualRow.size}px`,
                                    transform: `translateY(${virtualRow.start}px)`,
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                }}
                            >
                                <td className="w-12 h-full flex items-center justify-center border-r border-border/30 bg-muted/5 text-[9px] text-muted-foreground/40 group-hover:text-muted-foreground group-hover:bg-muted/10 transition-colors">
                                    {virtualRow.index + 1}
                                </td>
                                {row.getVisibleCells().map(cell => (
                                    <td 
                                        key={cell.id} 
                                        style={{ width: cell.column.getSize() }}
                                        className="h-full flex items-center px-4 border-r border-border/30 last:border-r-0 truncate text-foreground/90 font-medium"
                                    >
                                        <div className="truncate w-full">
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </div>
                                    </td>
                                ))}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};
