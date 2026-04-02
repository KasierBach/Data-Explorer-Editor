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
import { SqlUtil } from '../utils/sql.util';

export class PostgresStrategy implements IDatabaseStrategy {

    // ─── Connection Management ───

    createPool(connectionConfig: any, databaseOverride?: string): any {
        const isLocalhost = connectionConfig.host === 'localhost' || connectionConfig.host === '127.0.0.1';

        // Support timeout overrides for migration pools (default: 30s for normal queries)
        const stmtTimeout = connectionConfig.statementTimeout ?? 30000;
        const qryTimeout = connectionConfig.queryTimeout ?? 30000;

        const pool = new Pool({
            host: connectionConfig.host,
            port: connectionConfig.port,
            user: connectionConfig.username,
            password: connectionConfig.password || undefined,
            database: databaseOverride || connectionConfig.database,
            ssl: isLocalhost ? false : { rejectUnauthorized: false },
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000,
            statement_timeout: stmtTimeout,
            query_timeout: qryTimeout,
        });
        
        // Prevent background connection errors from crashing the whole Node.js process
        pool.on('error', (err: Error) => {
            console.error('Unexpected error on idle Postgres client:', err.message);
        });
        
        return pool;
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

    async executeQuery(pool: any, sql: string, options?: { limit?: number; offset?: number }): Promise<QueryResult> {
        let safeSql = sql;
        if (options?.limit !== undefined && options?.offset !== undefined) {
            safeSql = SqlUtil.injectPagination(sql, options.limit, options.offset, 'postgres');
        } else {
            safeSql = SqlUtil.injectLimit(sql, 50000);
        }

        const client = await pool.connect();
        try {
            const result = await client.query(safeSql);
            const queryResult = Array.isArray(result) ? result[result.length - 1] : result;
            return {
                rows: queryResult.rows ? queryResult.rows.slice(0, 50000) : [],
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

    async insertRow(pool: any, params: any): Promise<{ success: boolean; rowCount: number }> {
        const { schema, table, data } = params;
        const columns = Object.keys(data);
        if (columns.length === 0) return { success: false, rowCount: 0 };

        const quotedTable = this.quoteTable(schema, table);
        const colNames = columns.map(c => `"${c}"`).join(', ');
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        const sql = `INSERT INTO ${quotedTable} (${colNames}) VALUES (${placeholders})`;
        const values = columns.map(c => data[c]);

        const res = await pool.query(sql, values);
        return { success: true, rowCount: res.rowCount };
    }

    async deleteRows(pool: any, params: any): Promise<{ success: boolean; rowCount: number }> {
        const { schema, table, pkColumn, pkValues } = params;
        if (pkValues.length === 0) return { success: true, rowCount: 0 };

        const quotedTable = this.quoteTable(schema, table);
        const placeholders = pkValues.map((_, i) => `$${i + 1}`).join(', ');
        const sql = `DELETE FROM ${quotedTable} WHERE "${pkColumn}" IN (${placeholders})`;

        const res = await pool.query(sql, pkValues);
        return { success: true, rowCount: res.rowCount };
    }

    async importData(pool: any, params: { schema: string; table: string; data: any[] }): Promise<{ success: boolean; rowCount: number }> {
        const { schema, table, data } = params;
        if (!data || data.length === 0) return { success: true, rowCount: 0 };

        const columns = Object.keys(data[0]);
        const quotedTable = this.quoteTable(schema, table);
        const colNames = columns.map(c => `"${c}"`).join(', ');

        const valuePlaceholders: string[] = [];
        const flatValues: any[] = [];

        data.forEach((row, rowIndex) => {
            const rowPlaceholders = columns.map((col, colIndex) => {
                flatValues.push(row[col]);
                return `$${rowIndex * columns.length + colIndex + 1}`;
            });
            valuePlaceholders.push(`(${rowPlaceholders.join(', ')})`);
        });

        const sql = `INSERT INTO ${quotedTable} (${colNames}) VALUES ${valuePlaceholders.join(', ')}`;
        
        const res = await pool.query(sql, flatValues);
        return { success: true, rowCount: res.rowCount };
    }

    async exportStream(pool: any, schema: string, table: string): Promise<any> {
        // Dynamic import because pg-query-stream might only be used here
        const QueryStream = (await import('pg-query-stream')).default || (await import('pg-query-stream'));
        
        const quotedTable = this.quoteTable(schema, table);
        const query = new QueryStream(`SELECT * FROM ${quotedTable}`, undefined, {
            batchSize: 2000,
        });
        
        const client = await pool.connect();

        // Disable statement_timeout for this client so long-running migration
        // streams are not killed by the pool's default 30s timeout.
        await client.query('SET statement_timeout = 0');

        const stream = client.query(query);
        
        // Guard: ensure client.release() is called exactly once
        let released = false;
        const safeRelease = () => {
            if (!released) {
                released = true;
                client.release();
            }
        };

        stream.on('end', safeRelease);
        stream.on('error', safeRelease);
        stream.on('close', safeRelease);

        return stream;
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
        const sql = `SELECT datname FROM pg_database WHERE datistemplate = false`;
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
        const sql = `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_type = 'BASE TABLE'`;
        const result = await pool.query(sql, [schema]);
        return result.rows.map((row: any) => ({
            id: dbName ? `db:${dbName}.schema:${schema}.table:${row.table_name}` : `schema:${schema}.table:${row.table_name}`,
            name: row.table_name,
            type: 'table',
            parentId: dbName ? `db:${dbName}.schema:${schema}.folder:tables` : `schema:${schema}.folder:tables`,
            hasChildren: true,
        }));
    }

    async getViews(pool: any, schema: string, dbName?: string): Promise<TreeNodeResult[]> {
        const sql = `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_type = 'VIEW'`;
        const result = await pool.query(sql, [schema]);
        return result.rows.map((row: any) => ({
            id: dbName ? `db:${dbName}.schema:${schema}.view:${row.table_name}` : `schema:${schema}.view:${row.table_name}`,
            name: row.table_name,
            type: 'view',
            parentId: dbName ? `db:${dbName}.schema:${schema}.folder:views` : `schema:${schema}.folder:views`,
            hasChildren: true,
        }));
    }

    async getFunctions(pool: any, schema: string, dbName?: string): Promise<TreeNodeResult[]> {
        const sql = `SELECT routine_name FROM information_schema.routines WHERE routine_schema = $1`;
        const result = await pool.query(sql, [schema]);
        return result.rows.map((row: any) => ({
            id: dbName ? `db:${dbName}.schema:${schema}.func:${row.routine_name}` : `schema:${schema}.func:${row.routine_name}`,
            name: row.routine_name,
            type: 'function',
            parentId: dbName ? `db:${dbName}.schema:${schema}.folder:functions` : `schema:${schema}.folder:functions`,
            hasChildren: true,
        }));
    }

    async getFunctionParameters(pool: any, schema: string, func: string): Promise<ColumnInfo[]> {
        const sql = `
            SELECT p.parameter_name, p.data_type, p.parameter_mode 
            FROM information_schema.parameters p
            JOIN information_schema.routines r ON p.specific_name = r.specific_name
            WHERE r.routine_schema = $1 AND r.routine_name = $2
            ORDER BY p.ordinal_position
        `;
        const result = await pool.query(sql, [schema, func]);
        return result.rows.map((row: any) => ({
            name: row.parameter_name || '(unnamed)',
            type: `${row.parameter_mode || 'IN'} ${row.data_type}`,
            isNullable: true,
            defaultValue: null,
            isPrimaryKey: false,
            pkConstraintName: null,
        }));
    }

    async getColumns(pool: any, schema: string, table: string): Promise<ColumnInfo[]> {
        const sql = `
            SELECT 
                c.column_name, c.data_type, c.is_nullable, c.column_default,
                con.conname as pk_constraint_name,
                pd.description as comment
            FROM information_schema.columns c
            JOIN pg_class t ON t.relname = c.table_name
            JOIN pg_namespace s ON s.oid = t.relnamespace AND s.nspname = c.table_schema
            LEFT JOIN pg_attribute a ON a.attrelid = t.oid AND a.attname = c.column_name
            LEFT JOIN pg_description pd ON pd.objoid = t.oid AND pd.objsubid = a.attnum
            LEFT JOIN pg_constraint con ON con.conrelid = t.oid AND con.contype = 'p' AND a.attnum = ANY(con.conkey)
            WHERE c.table_name = $1 AND c.table_schema = $2
            ORDER BY c.ordinal_position
        `;
        const result = await pool.query(sql, [table, schema]);
        return result.rows.map((row: any) => ({
            name: row.column_name,
            type: row.data_type,
            isNullable: row.is_nullable === 'YES',
            defaultValue: row.column_default,
            isPrimaryKey: !!row.pk_constraint_name,
            pkConstraintName: row.pk_constraint_name,
            comment: row.comment,
        }));
    }

    async getFullMetadata(pool: any, schema: string, table: string): Promise<any> {
        const columns = await this.getColumns(pool, schema, table);
        
        // Fetch indices
        const indicesSql = `
            SELECT
                i.relname as index_name,
                a.attname as column_name,
                ix.indisunique as is_unique,
                ix.indisprimary as is_primary
            FROM pg_class t
            JOIN pg_index ix ON t.oid = ix.indrelid
            JOIN pg_class i ON i.oid = ix.indexrelid
            JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
            JOIN pg_namespace n ON n.oid = t.relnamespace
            WHERE t.relname = $1 AND n.nspname = $2
        `;
        
        const indicesRes = await pool.query(indicesSql, [table, schema]);
        const indexMap = new Map<string, any>();
        indicesRes.rows.forEach((row: any) => {
            if (!indexMap.has(row.index_name)) {
                indexMap.set(row.index_name, {
                    name: row.index_name,
                    columns: [],
                    isUnique: row.is_unique,
                    isPrimary: row.is_primary
                });
            }
            indexMap.get(row.index_name).columns.push(row.column_name);
        });

        // Fetch table comment
        const commentSql = `
            SELECT obj_description(t.oid) as comment
            FROM pg_class t
            JOIN pg_namespace n ON n.nspname = $2 AND t.relnamespace = n.oid
            WHERE t.relname = $1
        `;
        const commentRes = await pool.query(commentSql, [table, schema]);
        
        // Fetch row count estimate
        const countSql = `SELECT reltuples as count FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = $1 AND n.nspname = $2`;
        const countRes = await pool.query(countSql, [table, schema]);

        return {
            columns,
            indices: Array.from(indexMap.values()),
            comment: commentRes.rows[0]?.comment,
            rowCount: Math.floor(countRes.rows[0]?.count || 0)
        };
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

    // ─── Polymorphic Tree & Seed ───

    async getHierarchyNodes(pool: any, parentId: string | null, parsedParams: any, connectionInfo: any): Promise<TreeNodeResult[]> {
        if (!parentId) {
            if (connectionInfo.showAllDatabases) return this.getDatabases(pool);
            return this.getSchemas(pool);
        }
        return [];
    }

    async seedData(pool: any): Promise<QueryResult> {
        const sql = `
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100),
                email VARCHAR(100) UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS products (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100),
                price DECIMAL(10, 2),
                stock INT
            );
            CREATE TABLE IF NOT EXISTS orders (
                id SERIAL PRIMARY KEY,
                user_id INT REFERENCES users(id),
                total DECIMAL(10, 2),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            INSERT INTO users (name, email) VALUES 
            ('Alice Johnson', 'alice@example.com'),
            ('Bob Smith', 'bob@example.com'),
            ('Charlie Brown', 'charlie@example.com')
            ON CONFLICT DO NOTHING;
            INSERT INTO products (name, price, stock) VALUES 
            ('Laptop', 999.99, 10),
            ('Mouse', 25.50, 100),
            ('Keyboard', 50.00, 50)
            ON CONFLICT DO NOTHING;
            INSERT INTO orders (user_id, total) VALUES 
            (1, 1025.49),
            (2, 25.50)
            ON CONFLICT DO NOTHING;
        `;
        return this.executeQuery(pool, sql);
    }
}
