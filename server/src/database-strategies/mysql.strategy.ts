import type {
    IDatabaseStrategy,
    TreeNodeResult,
    ColumnInfo,
    QueryResult,
    Relationship,
    DatabaseMetrics,
    UpdateRowParams,
} from './database-strategy.interface';

export class MysqlStrategy implements IDatabaseStrategy {

    // ─── Identifier Quoting ───

    quoteIdentifier(name: string): string {
        return `\`${name}\``;
    }

    quoteTable(schema: string | undefined, table: string): string {
        return `\`${table}\``;
    }

    // ─── Query Operations ───

    async executeQuery(pool: any, sql: string): Promise<QueryResult> {
        const [rows, fields] = await pool.execute(sql);
        return {
            rows,
            columns: (fields as any[]).map(f => f.name),
        };
    }

    async updateRow(pool: any, params: UpdateRowParams): Promise<{ success: boolean; rowCount: number }> {
        const { table, pkColumn, pkValue, updates } = params;
        const updateCols = Object.keys(updates);
        const setClause = updateCols.map(col => `\`${col}\` = ?`).join(', ');
        const sql = `UPDATE \`${table}\` SET ${setClause} WHERE \`${pkColumn}\` = ?`;
        const values = [...updateCols.map(c => updates[c]), pkValue];

        const [result] = await pool.execute(sql, values);
        return { success: true, rowCount: (result as any).affectedRows };
    }

    buildAlterTableSql(quotedTable: string, op: any): string {
        switch (op.type) {
            case 'add_column':
                return `ALTER TABLE ${quotedTable} ADD COLUMN \`${op.name}\` ${op.dataType} ${op.isNullable === false ? 'NOT NULL' : ''}`;
            case 'drop_column':
                return `ALTER TABLE ${quotedTable} DROP COLUMN \`${op.name}\``;
            case 'alter_column_type':
                return `ALTER TABLE ${quotedTable} MODIFY COLUMN \`${op.name}\` ${op.newType}`;
            case 'rename_column':
                return `ALTER TABLE ${quotedTable} RENAME COLUMN \`${op.name}\` TO \`${op.newName}\``;
            case 'add_pk': {
                const cols = op.columns.map((c: string) => `\`${c}\``).join(', ');
                return `ALTER TABLE ${quotedTable} ADD PRIMARY KEY (${cols})`;
            }
            case 'drop_pk':
                return `ALTER TABLE ${quotedTable} DROP PRIMARY KEY`;
            case 'add_fk': {
                const fkCols = op.columns.map((c: string) => `\`${c}\``).join(', ');
                const refCols = op.refColumns.map((c: string) => `\`${c}\``).join(', ');
                return `ALTER TABLE ${quotedTable} ADD CONSTRAINT ${op.name} FOREIGN KEY (${fkCols}) REFERENCES \`${op.refTable}\` (${refCols})`;
            }
            case 'drop_fk':
                return `ALTER TABLE ${quotedTable} DROP FOREIGN KEY \`${op.name}\``;
            default:
                return '';
        }
    }

    // ─── DDL Operations ───

    async createDatabase(pool: any, name: string): Promise<void> {
        await pool.execute(`CREATE DATABASE \`${name}\``);
    }

    async dropDatabase(pool: any, name: string): Promise<void> {
        await pool.execute(`DROP DATABASE \`${name}\``);
    }

    // ─── Metadata Operations ───

    async getDatabases(pool: any): Promise<TreeNodeResult[]> {
        const [rows]: any[] = await pool.query('SHOW DATABASES');
        return rows.map((row: any) => ({
            id: `schema:${row.Database}`,
            name: row.Database,
            type: 'schema',
            parentId: 'root',
            hasChildren: true,
        }));
    }

    async getSchemas(_pool: any, _dbName?: string): Promise<TreeNodeResult[]> {
        // MySQL uses databases as schemas, so this is a no-op
        return [];
    }

    async getTables(pool: any, schema: string, _dbName?: string): Promise<TreeNodeResult[]> {
        const [rows]: any[] = await pool.query(`SHOW TABLES FROM \`${schema}\``);
        return rows.map((row: any) => {
            const tableName = Object.values(row)[0] as string;
            return {
                id: `schema:${schema}.table:${tableName}`,
                name: tableName,
                type: 'table',
                parentId: `schema:${schema}.folder:tables`,
                hasChildren: false,
            };
        });
    }

    async getViews(_pool: any, _schema: string, _dbName?: string): Promise<TreeNodeResult[]> {
        return [];
    }

    async getFunctions(_pool: any, _schema: string, _dbName?: string): Promise<TreeNodeResult[]> {
        return [];
    }

    async getColumns(pool: any, schema: string, table: string): Promise<ColumnInfo[]> {
        const [rows]: any[] = await pool.query(`DESCRIBE \`${schema}\`.\`${table}\``);
        return rows.map((row: any) => ({
            name: row.Field,
            type: row.Type,
            isNullable: row.Null === 'YES',
            defaultValue: row.Default,
            isPrimaryKey: row.Key === 'PRI',
            pkConstraintName: row.Key === 'PRI' ? 'PRIMARY' : null,
        }));
    }

    async getRelationships(pool: any): Promise<Relationship[]> {
        const sql = `
            SELECT 
                CONSTRAINT_NAME as constraint_name,
                TABLE_NAME as source_table, 
                COLUMN_NAME as source_column, 
                REFERENCED_TABLE_NAME as target_table, 
                REFERENCED_COLUMN_NAME as target_column
            FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
            WHERE REFERENCED_TABLE_NAME IS NOT NULL AND TABLE_SCHEMA = DATABASE()
        `;
        const [rows]: any[] = await pool.query(sql);
        return rows;
    }

    async getDatabaseMetrics(pool: any): Promise<DatabaseMetrics> {
        const statsSql = `
            SELECT 
                count(*) as table_count,
                COALESCE(sum(data_length + index_length), 0) as size_bytes,
                (SELECT count(*) FROM information_schema.processlist) as active_connections
            FROM information_schema.tables WHERE table_schema = DATABASE()
        `;
        const tablesSql = `
            SELECT table_name as name, (data_length + index_length) as size_bytes
            FROM information_schema.tables WHERE table_schema = DATABASE()
            ORDER BY (data_length + index_length) DESC LIMIT 5
        `;
        const typesSql = `
            SELECT table_type as type, count(*) as count 
            FROM information_schema.tables WHERE table_schema = DATABASE() GROUP BY table_type
        `;

        const [[statsRows], [tableRows], [typeRows]]: any[] = await Promise.all([
            pool.query(statsSql),
            pool.query(tablesSql),
            pool.query(typesSql),
        ]);

        const stats = statsRows[0];
        return {
            tableCount: parseInt(stats.table_count),
            sizeBytes: parseInt(stats.size_bytes),
            activeConnections: parseInt(stats.active_connections),
            topTables: tableRows.map((r: any) => ({ name: r.name, sizeBytes: parseInt(r.size_bytes) })),
            tableTypes: typeRows.map((r: any) => ({ type: r.type, count: parseInt(r.count) })),
        };
    }
}
