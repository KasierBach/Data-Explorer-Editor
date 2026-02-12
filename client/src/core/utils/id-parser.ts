export interface ParsedId {
    dbName?: string;
    schema: string;
    table?: string;
    type: 'database' | 'schema' | 'table' | 'view' | 'function' | 'folder' | 'unknown';
}

/**
 * Parses structured IDs like "db:mydb.schema:public.table:users" 
 * into database, schema and table names.
 */
export const parseNodeId = (id: string): ParsedId => {
    let dbName: string | undefined;
    let schema = 'public';
    let table: string | undefined;
    let type: ParsedId['type'] = 'unknown';

    // 1. Handle full structured IDs (dotted segments with prefixes)
    if (id.includes('db:') || id.includes('schema:') || id.includes('table:') || id.includes('view:') || id.includes('func:')) {
        const parts = id.split('.');

        const dbPart = parts.find(p => p.startsWith('db:'));
        const schemaPart = parts.find(p => p.startsWith('schema:'));
        const tablePart = parts.find(p => p.startsWith('table:') || p.startsWith('view:') || p.startsWith('func:'));

        if (dbPart) dbName = dbPart.split(':')[1];
        if (schemaPart) schema = schemaPart.split(':')[1];

        if (tablePart) {
            const [tType, tName] = tablePart.split(':');
            table = tName;
            if (tType === 'table') type = 'table';
            else if (tType === 'view') type = 'view';
            else if (tType === 'func') type = 'function';
        } else if (schemaPart) {
            type = 'schema';
        } else if (dbPart) {
            type = 'database';
        }

        if (id.includes('.folder:')) type = 'folder';

        return { dbName, schema, table, type };
    }

    // 2. Handle simple composite IDs (deprecated, but for safety: public.users)
    if (id.includes('.')) {
        const parts = id.split('.');
        return { schema: parts[0], table: parts[1], type: 'table' };
    }

    // 3. Absolute fallback (treat ID as table name in default schema)
    return { schema: 'public', table: id, type: 'table' };
};

/**
 * Generates a quoted identifier for SQL queries based on the dialect.
 */
export const getQuotedIdentifier = (name: string, type: 'postgres' | 'mysql' | 'mssql'): string => {
    if (type === 'mssql') return `[${name}]`;
    return type === 'postgres' ? `"${name}"` : `\`${name}\``;
};

/**
 * Generates a fully qualified table name.
 */
export const getFullyQualifiedTable = (id: string, dialect: 'postgres' | 'mysql' | 'mssql'): string => {
    const { schema, table } = parseNodeId(id);
    if (!table) return id;

    const qSchema = getQuotedIdentifier(schema, dialect);
    const qTable = getQuotedIdentifier(table, dialect);

    return `${qSchema}.${qTable}`;
};
