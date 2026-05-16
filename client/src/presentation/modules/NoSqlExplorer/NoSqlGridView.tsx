import React, { useMemo } from 'react';
import {
    useReactTable,
    getCoreRowModel,
    flexRender,
    type CellContext,
} from '@tanstack/react-table';
import { Info } from 'lucide-react';
import { flattenDocuments } from '@/core/utils/flattenJson';

interface NoSqlGridViewProps {
    data: unknown[] | null;
}

/**
 * Grid View for NoSQL data. 
 * Automatically flattens nested JSON documents into a flat tabular format.
 */
export const NoSqlGridView: React.FC<NoSqlGridViewProps> = ({ data }) => {
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
                if (val === null) return <span className="text-muted-foreground italic">null</span>;
                if (typeof val === 'object') return JSON.stringify(val);
                return String(val);
            },
        }));
    }, [columns]);

    // eslint-disable-next-line react-hooks/incompatible-library
    const table = useReactTable({
        data: rows,
        columns: tableColumns,
        getCoreRowModel: getCoreRowModel(),
    });

    if (!data || data.length === 0) {
        return (
            <div className="p-8 text-center text-muted-foreground flex flex-col items-center gap-2">
                <Info className="w-8 h-8 opacity-20" />
                <p>No data to display in grid.</p>
            </div>
        );
    }

    return (
        <div className="w-full h-full overflow-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 bg-background/50">
            <table className="w-full text-[11px] text-left border-collapse min-w-full font-mono">
                <thead className="bg-muted/80 sticky top-0 z-10 shadow-sm">
                    {table.getHeaderGroups().map(headerGroup => (
                        <tr key={headerGroup.id}>
                            <th className="p-1 px-2 border-b border-r bg-muted/30 text-center text-[9px] w-10 text-muted-foreground font-normal">#</th>
                            {headerGroup.headers.map(header => (
                                <th key={header.id} className="p-2 px-3 border-b border-r font-semibold text-muted-foreground whitespace-nowrap bg-muted/10 min-w-[120px]">
                                    {flexRender(header.column.columnDef.header, header.getContext())}
                                </th>
                            ))}
                        </tr>
                    ))}
                </thead>
                <tbody>
                    {table.getRowModel().rows.map((row, idx) => (
                        <tr key={row.id} className="hover:bg-blue-50/40 dark:hover:bg-emerald-900/5 border-b last:border-0 group transition-colors">
                            <td className="p-1 px-2 border-r bg-muted/5 text-center text-[9px] text-muted-foreground group-hover:bg-muted/20">
                                {idx + 1}
                            </td>
                            {row.getVisibleCells().map(cell => (
                                <td key={cell.id} className="p-2 px-3 border-r last:border-r-0 whitespace-nowrap truncate max-w-[300px] text-foreground/80">
                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
