import { getQuotedIdentifier } from '@/core/utils/id-parser';
import type { Row } from '@tanstack/react-table';
import { toast } from 'sonner';

export interface ExportContext {
    rows: Row<any>[];
    columns: { name: string }[];
    schema: string;
    tableName: string;
    dialect: 'mysql' | 'postgres';
}

function downloadFile(content: string, filename: string, type: string) {
    const blob = new Blob([content], { type: `${type};charset=utf-8;` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

function formatValue(v: any): string {
    if (v === null || v === undefined) return 'NULL';
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    return `'${String(v).replace(/'/g, "''")}'`;
}

export function exportCSV(ctx: ExportContext) {
    if (!ctx.rows.length || !ctx.columns.length) return;
    const csvHeaders = ctx.columns.map(c => c.name).join(',');
    const csvRows = ctx.rows.map(row => {
        return ctx.columns.map(col => {
            const val = row.getValue(col.name);
            if (val === null || val === undefined) return '';
            const str = String(val);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        }).join(',');
    }).join('\n');
    downloadFile(`${csvHeaders}\n${csvRows}`, `${ctx.tableName}_export.csv`, 'text/csv');
}

export function exportJSON(ctx: ExportContext) {
    if (!ctx.rows.length || !ctx.columns.length) return;
    const data = ctx.rows.map(row => {
        const obj: Record<string, any> = {};
        ctx.columns.forEach(col => { obj[col.name] = row.getValue(col.name); });
        return obj;
    });
    downloadFile(JSON.stringify(data, null, 2), `${ctx.tableName}_export.json`, 'application/json');
}

export function exportSQL(ctx: ExportContext) {
    if (!ctx.rows.length || !ctx.columns.length) return;
    const { schema, tableName, dialect, columns, rows } = ctx;
    const qSchema = getQuotedIdentifier(schema, dialect);
    const qTable = getQuotedIdentifier(tableName, dialect);
    const cols = columns.map(c => getQuotedIdentifier(c.name, dialect)).join(', ');
    const inserts = rows.map(row => {
        const vals = columns.map(col => formatValue(row.getValue(col.name))).join(', ');
        return `INSERT INTO ${qSchema}.${qTable} (${cols}) VALUES (${vals});`;
    }).join('\n');
    downloadFile(inserts, `${tableName}_export.sql`, 'text/sql');
}

export function copyRowAsSQL(rowData: any, columns: { name: string }[], schema: string, tableName: string, dialect: 'mysql' | 'postgres') {
    const qSchema = getQuotedIdentifier(schema, dialect);
    const qTable = getQuotedIdentifier(tableName, dialect);
    const cols = columns.map(c => getQuotedIdentifier(c.name, dialect)).join(', ');
    const vals = columns.map(col => formatValue(rowData[col.name])).join(', ');
    const sql = `INSERT INTO ${qSchema}.${qTable} (${cols}) VALUES (${vals});`;
    navigator.clipboard.writeText(sql);
    toast.success('INSERT statement copied');
}
