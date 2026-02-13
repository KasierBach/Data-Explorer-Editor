import React, { useMemo } from 'react';
import {
    useReactTable,
    getCoreRowModel,
    flexRender,
} from '@tanstack/react-table';
import type { QueryResult } from '@/core/domain/entities';
import { Info } from 'lucide-react';

interface ResultTableProps {
    results: QueryResult | null;
}

export const ResultTable: React.FC<ResultTableProps> = ({ results }) => {
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

    if (!results || results.rows.length === 0) {
        return (
            <div className="p-8 text-center text-muted-foreground flex flex-col items-center gap-2">
                <Info className="w-8 h-8 opacity-20" />
                <p>Query returned no rows.</p>
            </div>
        );
    }

    return (
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
    );
};
