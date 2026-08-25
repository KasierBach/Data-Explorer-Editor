export function csvCell(value: unknown): string {
    if (value === null || value === undefined) return '';
    const raw = typeof value === 'object' ? JSON.stringify(value) : String(value);
    const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
    return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function csvDocument(columns: string[], rows: unknown[][]): string {
    return [
        columns.map(csvCell).join(','),
        ...rows.map((row) => row.map(csvCell).join(',')),
    ].join('\r\n');
}

export async function parseCsv(data: ArrayBuffer): Promise<Record<string, unknown>[]> {
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(data, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return sheet ? XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' }) : [];
}
