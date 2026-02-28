import type {
    IDatabaseStrategy,
    TreeNodeResult,
    ColumnInfo,
    QueryResult,
    Relationship,
    DatabaseMetrics,
    UpdateRowParams,
} from './database-strategy.interface';
import * as mssql from 'mssql';

export class MssqlStrategy implements IDatabaseStrategy {

    // ─── Connection Management ───

    async createPool(connectionConfig: any, databaseOverride?: string): Promise<any> {
        const config: mssql.config = {
            server: connectionConfig.host || 'localhost',
            port: connectionConfig.port || 1433,
            user: connectionConfig.username,
            password: connectionConfig.password || undefined,
            database: databaseOverride || connectionConfig.database,
            options: {
                encrypt: false,
                trustServerCertificate: true,
            },
            pool: {
                max: 20,
                min: 0,
                idleTimeoutMillis: 30000,
            },
        };
        return await new mssql.ConnectionPool(config).connect();
    }

    async closePool(pool: any): Promise<void> {
        await pool.close();
    }

    // ─── Identifier Quoting ───

    quoteIdentifier(name: string): string {
        return `[${name}]`;
    }

    quoteTable(schema: string | undefined, table: string): string {
        return schema ? `[${schema}].[${table}]` : `[${table}]`;
    }

    // ─── Query Operations ───

    async executeQuery(pool: any, sql: string): Promise<QueryResult> {
        const result = await pool.request().query(sql);
        return {
            rows: result.recordset || [],
            columns: result.recordset?.columns ? Object.keys(result.recordset.columns) : [],
            rowCount: result.rowsAffected?.[0] ?? 0,
        };
    }

    async updateRow(pool: any, params: UpdateRowParams): Promise<{ success: boolean; rowCount: number }> {
        const { schema, table, pkColumn, pkValue, updates } = params;
        const updateCols = Object.keys(updates);
        const quotedTable = this.quoteTable(schema, table);
        const setClause = updateCols.map((col, i) => `[${col}] = @p${i}`).join(', ');
        const sql = `UPDATE ${quotedTable} SET ${setClause} WHERE [${pkColumn}] = @pk`;

        const request = pool.request();
        updateCols.forEach((col, i) => request.input(`p${i}`, updates[col]));
        request.input('pk', pkValue);

        const result = await request.query(sql);
        return { success: true, rowCount: result.rowsAffected?.[0] ?? 0 };
    }

    buildAlterTableSql(quotedTable: string, op: any): string {
        switch (op.type) {
            case 'add_column':
                return `ALTER TABLE ${quotedTable} ADD [${op.name}] ${op.dataType} ${op.isNullable === false ? 'NOT NULL' : ''}`;
            case 'drop_column':
                return `ALTER TABLE ${quotedTable} DROP COLUMN [${op.name}]`;
            case 'alter_column_type':
                return `ALTER TABLE ${quotedTable} ALTER COLUMN [${op.name}] ${op.newType}`;
            case 'rename_column':
                // MSSQL uses sp_rename for column renames
                return `EXEC sp_rename '${quotedTable}.${op.name}', '${op.newName}', 'COLUMN'`;
            case 'add_pk': {
                const cols = op.columns.map((c: string) => `[${c}]`).join(', ');
                return `ALTER TABLE ${quotedTable} ADD PRIMARY KEY (${cols})`;
            }
            case 'drop_pk':
                return op.constraintName
                    ? `ALTER TABLE ${quotedTable} DROP CONSTRAINT [${op.constraintName}]`
                    : `ALTER TABLE ${quotedTable} DROP PRIMARY KEY`;
            case 'add_fk': {
                const fkCols = op.columns.map((c: string) => `[${c}]`).join(', ');
                const refCols = op.refColumns.map((c: string) => `[${c}]`).join(', ');
                return `ALTER TABLE ${quotedTable} ADD CONSTRAINT ${op.name} FOREIGN KEY (${fkCols}) REFERENCES [${op.refTable}] (${refCols})`;
            }
            case 'drop_fk':
                return `ALTER TABLE ${quotedTable} DROP CONSTRAINT [${op.name}]`;
            default:
                return '';
        }
    }

    // ─── DDL Operations ───

    async createDatabase(pool: any, name: string): Promise<void> {
        await pool.request().query(`CREATE DATABASE [${name}]`);
    }

    async dropDatabase(pool: any, name: string): Promise<void> {
        await pool.request().query(`ALTER DATABASE [${name}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE`);
        await pool.request().query(`DROP DATABASE [${name}]`);
    }

    // ─── Metadata Operations ───

    async getDatabases(pool: any): Promise<TreeNodeResult[]> {
        const result = await pool.request().query(
            `SELECT name FROM sys.databases WHERE name NOT IN ('master','tempdb','model','msdb') ORDER BY name`,
        );
        return result.recordset.map((row: any) => ({
            id: `db:${row.name}`,
            name: row.name,
            type: 'database',
            parentId: 'root',
            hasChildren: true,
        }));
    }

    async getSchemas(pool: any, dbName?: string): Promise<TreeNodeResult[]> {
        const result = await pool.request().query(
            `SELECT name FROM sys.schemas WHERE name NOT IN ('sys','INFORMATION_SCHEMA','guest','db_owner','db_accessadmin','db_securityadmin','db_ddladmin','db_backupoperator','db_datareader','db_datawriter','db_denydatareader','db_denydatawriter') ORDER BY name`,
        );
        return result.recordset.map((row: any) => ({
            id: dbName ? `db:${dbName}.schema:${row.name}` : `schema:${row.name}`,
            name: row.name,
            type: 'schema',
            parentId: dbName ? `db:${dbName}` : 'root',
            hasChildren: true,
        }));
    }

    async getTables(pool: any, schema: string, dbName?: string): Promise<TreeNodeResult[]> {
        const result = await pool.request().query(
            `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = '${schema}' AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME`,
        );
        return result.recordset.map((row: any) => ({
            id: dbName ? `db:${dbName}.schema:${schema}.table:${row.TABLE_NAME}` : `schema:${schema}.table:${row.TABLE_NAME}`,
            name: row.TABLE_NAME,
            type: 'table',
            parentId: dbName ? `db:${dbName}.schema:${schema}.folder:tables` : `schema:${schema}.folder:tables`,
            hasChildren: true,
        }));
    }

    async getViews(pool: any, schema: string, dbName?: string): Promise<TreeNodeResult[]> {
        const result = await pool.request().query(
            `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_SCHEMA = '${schema}' ORDER BY TABLE_NAME`,
        );
        return result.recordset.map((row: any) => ({
            id: dbName ? `db:${dbName}.schema:${schema}.view:${row.TABLE_NAME}` : `schema:${schema}.view:${row.TABLE_NAME}`,
            name: row.TABLE_NAME,
            type: 'view',
            parentId: dbName ? `db:${dbName}.schema:${schema}.folder:views` : `schema:${schema}.folder:views`,
            hasChildren: true,
        }));
    }

    async getFunctions(pool: any, schema: string, dbName?: string): Promise<TreeNodeResult[]> {
        const result = await pool.request().query(
            `SELECT name, type_desc FROM sys.objects WHERE schema_id = SCHEMA_ID('${schema}') AND type IN ('FN','IF','TF','P') ORDER BY name`,
        );
        return result.recordset.map((row: any) => ({
            id: dbName ? `db:${dbName}.schema:${schema}.func:${row.name}` : `schema:${schema}.func:${row.name}`,
            name: row.name,
            type: 'function',
            parentId: dbName ? `db:${dbName}.schema:${schema}.folder:functions` : `schema:${schema}.folder:functions`,
            hasChildren: false,
        }));
    }

    async getFunctionParameters(_pool: any, _schema: string, _func: string): Promise<ColumnInfo[]> {
        return [];
    }

    async getColumns(pool: any, schema: string, table: string): Promise<ColumnInfo[]> {
        const sql = `
            SELECT 
                c.COLUMN_NAME, c.DATA_TYPE, c.IS_NULLABLE, c.COLUMN_DEFAULT,
                kc.name as pk_constraint_name
            FROM INFORMATION_SCHEMA.COLUMNS c
            LEFT JOIN sys.tables t ON t.name = c.TABLE_NAME AND SCHEMA_NAME(t.schema_id) = c.TABLE_SCHEMA
            LEFT JOIN sys.indexes i ON i.object_id = t.object_id AND i.is_primary_key = 1
            LEFT JOIN sys.index_columns ic ON ic.object_id = t.object_id AND ic.index_id = i.index_id
            LEFT JOIN sys.columns sc ON sc.object_id = t.object_id AND sc.column_id = ic.column_id AND sc.name = c.COLUMN_NAME
            LEFT JOIN sys.key_constraints kc ON kc.parent_object_id = t.object_id AND kc.unique_index_id = i.index_id AND kc.type = 'PK'
            WHERE c.TABLE_NAME = '${table}' AND c.TABLE_SCHEMA = '${schema}'
            ORDER BY c.ORDINAL_POSITION
        `;
        const result = await pool.request().query(sql);
        return result.recordset.map((row: any) => ({
            name: row.COLUMN_NAME,
            type: row.DATA_TYPE,
            isNullable: row.IS_NULLABLE === 'YES',
            defaultValue: row.COLUMN_DEFAULT,
            isPrimaryKey: !!row.pk_constraint_name,
            pkConstraintName: row.pk_constraint_name,
        }));
    }

    async getRelationships(pool: any): Promise<Relationship[]> {
        const sql = `
            SELECT 
                fk.name AS constraint_name,
                tp.name AS source_table,
                cp.name AS source_column,
                tr.name AS target_table,
                cr.name AS target_column
            FROM sys.foreign_keys fk
            JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
            JOIN sys.tables tp ON fkc.parent_object_id = tp.object_id
            JOIN sys.columns cp ON fkc.parent_object_id = cp.object_id AND fkc.parent_column_id = cp.column_id
            JOIN sys.tables tr ON fkc.referenced_object_id = tr.object_id
            JOIN sys.columns cr ON fkc.referenced_object_id = cr.object_id AND fkc.referenced_column_id = cr.column_id
        `;
        const result = await pool.request().query(sql);
        return result.recordset;
    }

    async getDatabaseMetrics(pool: any): Promise<DatabaseMetrics> {
        const statsSql = `
            SELECT 
                (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE') as table_count,
                (SELECT SUM(size) * 8 * 1024 FROM sys.database_files) as size_bytes,
                (SELECT COUNT(*) FROM sys.dm_exec_sessions WHERE database_id = DB_ID()) as active_connections
        `;
        const tablesSql = `
            SELECT TOP 5 t.name, SUM(a.total_pages) * 8 * 1024 as size_bytes
            FROM sys.tables t
            JOIN sys.indexes i ON t.object_id = i.object_id
            JOIN sys.partitions p ON i.object_id = p.object_id AND i.index_id = p.index_id
            JOIN sys.allocation_units a ON p.partition_id = a.container_id
            GROUP BY t.name ORDER BY SUM(a.total_pages) DESC
        `;
        const typesSql = `
            SELECT TABLE_TYPE as type, COUNT(*) as count
            FROM INFORMATION_SCHEMA.TABLES GROUP BY TABLE_TYPE
        `;

        const [statsRes, tablesRes, typesRes] = await Promise.all([
            pool.request().query(statsSql),
            pool.request().query(tablesSql),
            pool.request().query(typesSql),
        ]);

        const stats = statsRes.recordset[0];
        return {
            tableCount: parseInt(stats.table_count),
            sizeBytes: parseInt(stats.size_bytes) || 0,
            activeConnections: parseInt(stats.active_connections),
            topTables: tablesRes.recordset.map((r: any) => ({ name: r.name, sizeBytes: parseInt(r.size_bytes) })),
            tableTypes: typesRes.recordset.map((r: any) => ({ type: r.type, count: parseInt(r.count) })),
        };
    }
}
