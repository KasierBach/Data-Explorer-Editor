import type {
    IDatabaseStrategy,
    TreeNodeResult,
    ColumnInfo,
    QueryResult,
    Relationship,
    DatabaseMetrics,
    UpdateRowParams,
} from './database-strategy.interface';
import { Pool } from 'pg';

export class PostgresStrategy implements IDatabaseStrategy {

    // ─── Connection Management ───

    createPool(connectionConfig: any, databaseOverride?: string): any {
        const isLocalhost = connectionConfig.host === 'localhost' || connectionConfig.host === '127.0.0.1';
        return new Pool({
            host: connectionConfig.host,
            port: connectionConfig.port,
            user: connectionConfig.username,
            password: connectionConfig.password || undefined,
            database: databaseOverride || connectionConfig.database,
            ssl: isLocalhost ? false : { rejectUnauthorized: false },
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000,
        });
    }

    async closePool(pool: any): Promise<void> {
        await pool.end();
    }

    // ─── Identifier Quoting ───

    quoteIdentifier(name: string): string {
        return `"${name}"`;
    }

    quoteTable(schema: string | undefined, table: string): string {
        return schema ? `"${schema}"."${table}"` : `"${table}"`;
    }

    // ─── Query Operations ───

    async executeQuery(pool: any, sql: string): Promise<QueryResult> {
        const client = await pool.connect();
        try {
            const result = await client.query(sql);
            const queryResult = Array.isArray(result) ? result[result.length - 1] : result;
            return {
                rows: queryResult.rows || [],
                columns: queryResult.fields ? queryResult.fields.map((f: any) => f.name) : [],
                rowCount: queryResult.rowCount,
            };
        } finally {
            client.release();
        }
    }

    async updateRow(pool: any, params: UpdateRowParams): Promise<{ success: boolean; rowCount: number }> {
        const { schema, table, pkColumn, pkValue, updates } = params;
        const updateCols = Object.keys(updates);
        const quotedTable = this.quoteTable(schema, table);
        const setClause = updateCols.map((col, i) => `"${col}" = $${i + 1}`).join(', ');
        const sql = `UPDATE ${quotedTable} SET ${setClause} WHERE "${pkColumn}" = $${updateCols.length + 1}`;
        const values = [...updateCols.map(c => updates[c]), pkValue];

        const res = await pool.query(sql, values);
        return { success: true, rowCount: res.rowCount };
    }

    buildAlterTableSql(quotedTable: string, op: any): string {
        switch (op.type) {
            case 'add_column':
                return `ALTER TABLE ${quotedTable} ADD COLUMN "${op.name}" ${op.dataType} ${op.isNullable === false ? 'NOT NULL' : ''}`;
            case 'drop_column':
                return `ALTER TABLE ${quotedTable} DROP COLUMN "${op.name}"`;
            case 'alter_column_type':
                return `ALTER TABLE ${quotedTable} ALTER COLUMN "${op.name}" TYPE ${op.newType}`;
            case 'rename_column':
                return `ALTER TABLE ${quotedTable} RENAME COLUMN "${op.name}" TO "${op.newName}"`;
            case 'add_pk': {
                const cols = op.columns.map((c: string) => `"${c}"`).join(', ');
                return `ALTER TABLE ${quotedTable} ADD PRIMARY KEY (${cols})`;
            }
            case 'drop_pk':
                return op.constraintName
                    ? `ALTER TABLE ${quotedTable} DROP CONSTRAINT "${op.constraintName}"`
                    : `ALTER TABLE ${quotedTable} DROP PRIMARY KEY`;
            case 'add_fk': {
                const fkCols = op.columns.map((c: string) => `"${c}"`).join(', ');
                const refCols = op.refColumns.map((c: string) => `"${c}"`).join(', ');
                return `ALTER TABLE ${quotedTable} ADD CONSTRAINT ${op.name} FOREIGN KEY (${fkCols}) REFERENCES "${op.refTable}" (${refCols})`;
            }
            case 'drop_fk':
                return `ALTER TABLE ${quotedTable} DROP CONSTRAINT "${op.name}"`;
            default:
                return '';
        }
    }

    // ─── DDL Operations ───

    async createDatabase(pool: any, name: string): Promise<void> {
        await pool.query(`CREATE DATABASE "${name}"`);
    }

    async dropDatabase(pool: any, name: string): Promise<void> {
        await pool.query(
            `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
            [name],
        );
        await pool.query(`DROP DATABASE "${name}"`);
    }

    // ─── Metadata Operations ───

    async getDatabases(pool: any): Promise<TreeNodeResult[]> {
        const sql = `SELECT datname FROM pg_database WHERE datistemplate = false AND datname != 'postgres'`;
        const result = await pool.query(sql);
        return result.rows.map((row: any) => ({
            id: `db:${row.datname}`,
            name: row.datname,
            type: 'database',
            parentId: 'root',
            hasChildren: true,
        }));
    }

    async getSchemas(pool: any, dbName?: string): Promise<TreeNodeResult[]> {
        const sql = `SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('information_schema', 'pg_catalog') AND schema_name NOT LIKE 'pg_temp_%' AND schema_name NOT LIKE 'pg_toast%'`;
        const result = await pool.query(sql);
        return result.rows.map((row: any) => ({
            id: dbName ? `db:${dbName}.schema:${row.schema_name}` : `schema:${row.schema_name}`,
            name: row.schema_name,
            type: 'schema',
            parentId: dbName ? `db:${dbName}` : 'root',
            hasChildren: true,
        }));
    }

    async getTables(pool: any, schema: string, dbName?: string): Promise<TreeNodeResult[]> {
        const sql = `SELECT table_name FROM information_schema.tables WHERE table_schema = '${schema}' AND table_type = 'BASE TABLE'`;
        const result = await pool.query(sql);
        return result.rows.map((row: any) => ({
            id: dbName ? `db:${dbName}.schema:${schema}.table:${row.table_name}` : `schema:${schema}.table:${row.table_name}`,
            name: row.table_name,
            type: 'table',
            parentId: `schema:${schema}.folder:tables`,
            hasChildren: false,
        }));
    }

    async getViews(pool: any, schema: string, dbName?: string): Promise<TreeNodeResult[]> {
        const sql = `SELECT table_name FROM information_schema.tables WHERE table_schema = '${schema}' AND table_type = 'VIEW'`;
        const result = await pool.query(sql);
        return result.rows.map((row: any) => ({
            id: dbName ? `db:${dbName}.schema:${schema}.view:${row.table_name}` : `schema:${schema}.view:${row.table_name}`,
            name: row.table_name,
            type: 'view',
            parentId: `schema:${schema}.folder:views`,
            hasChildren: false,
        }));
    }

    async getFunctions(pool: any, schema: string, dbName?: string): Promise<TreeNodeResult[]> {
        const sql = `SELECT routine_name FROM information_schema.routines WHERE routine_schema = '${schema}'`;
        const result = await pool.query(sql);
        return result.rows.map((row: any) => ({
            id: dbName ? `db:${dbName}.schema:${schema}.func:${row.routine_name}` : `schema:${schema}.func:${row.routine_name}`,
            name: row.routine_name,
            type: 'function',
            parentId: `schema:${schema}.folder:functions`,
            hasChildren: false,
        }));
    }

    async getColumns(pool: any, schema: string, table: string): Promise<ColumnInfo[]> {
        const sql = `
            SELECT 
                c.column_name, c.data_type, c.is_nullable, c.column_default,
                con.conname as pk_constraint_name
            FROM information_schema.columns c
            JOIN pg_class t ON t.relname = c.table_name
            JOIN pg_namespace s ON s.oid = t.relnamespace AND s.nspname = c.table_schema
            LEFT JOIN pg_attribute a ON a.attrelid = t.oid AND a.attname = c.column_name
            LEFT JOIN pg_constraint con ON con.conrelid = t.oid AND con.contype = 'p' AND a.attnum = ANY(con.conkey)
            WHERE c.table_name = '${table}' AND c.table_schema = '${schema}'
            ORDER BY c.ordinal_position
        `;
        const result = await pool.query(sql);
        return result.rows.map((row: any) => ({
            name: row.column_name,
            type: row.data_type,
            isNullable: row.is_nullable === 'YES',
            defaultValue: row.column_default,
            isPrimaryKey: !!row.pk_constraint_name,
            pkConstraintName: row.pk_constraint_name,
        }));
    }

    async getRelationships(pool: any): Promise<Relationship[]> {
        const sql = `
            SELECT
                tc.constraint_name,
                tc.table_name as source_table, 
                kcu.column_name as source_column, 
                ccu.table_name AS target_table,
                ccu.column_name AS target_column
            FROM 
                information_schema.table_constraints AS tc 
                JOIN information_schema.key_column_usage AS kcu
                  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
                JOIN information_schema.constraint_column_usage AS ccu
                  ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
        `;
        const res = await pool.query(sql);
        return res.rows;
    }

    async getDatabaseMetrics(pool: any): Promise<DatabaseMetrics> {
        const statsSql = `
            SELECT 
                (SELECT count(*) FROM information_schema.tables WHERE table_schema NOT IN ('information_schema', 'pg_catalog')) as table_count,
                pg_database_size(current_database()) as size_bytes,
                (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()) as active_connections
        `;
        const tablesSql = `
            SELECT relname as name, pg_total_relation_size(relid) as size_bytes
            FROM pg_catalog.pg_statio_user_tables 
            ORDER BY pg_total_relation_size(relid) DESC LIMIT 5
        `;
        const typesSql = `
            SELECT table_type as type, count(*) as count 
            FROM information_schema.tables 
            WHERE table_schema NOT IN ('information_schema', 'pg_catalog') 
            GROUP BY table_type
        `;

        const [statsRes, tablesRes, typesRes] = await Promise.all([
            pool.query(statsSql),
            pool.query(tablesSql),
            pool.query(typesSql),
        ]);

        const stats = statsRes.rows[0];
        return {
            tableCount: parseInt(stats.table_count),
            sizeBytes: parseInt(stats.size_bytes),
            activeConnections: parseInt(stats.active_connections),
            topTables: tablesRes.rows.map((r: any) => ({ name: r.name, sizeBytes: parseInt(r.size_bytes) })),
            tableTypes: typesRes.rows.map((r: any) => ({ type: r.type, count: parseInt(r.count) })),
        };
    }
}
