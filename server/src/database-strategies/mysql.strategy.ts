import type {
    IDatabaseStrategy,
    TreeNodeResult,
    ColumnInfo,
    QueryResult,
    Relationship,
    DatabaseMetrics,
    UpdateRowParams,
} from './database-strategy.interface';
import * as mysql from 'mysql2/promise';
import { SqlUtil } from '../utils/sql.util';

export class MysqlStrategy implements IDatabaseStrategy {

    // ─── Connection Management ───

    createPool(connectionConfig: any, databaseOverride?: string): any {
        return mysql.createPool({
            host: connectionConfig.host,
            port: connectionConfig.port,
            user: connectionConfig.username,
            password: connectionConfig.password || undefined,
            database: databaseOverride || connectionConfig.database,
            waitForConnections: true,
            connectionLimit: 20,
            queueLimit: 0,
            multipleStatements: true,
            connectTimeout: 10000, // 10 seconds connection timeout
        });
    }

    async closePool(pool: any): Promise<void> {
        await pool.end();
    }

    // ─── Identifier Quoting ───

    quoteIdentifier(name: string): string {
        return `\`${name}\``;
    }

    quoteTable(schema: string | undefined, table: string): string {
        return `\`${table}\``;
    }

    // ─── Query Operations ───

    async executeQuery(pool: any, sql: string, options?: { limit?: number; offset?: number }): Promise<QueryResult> {
        let safeSql = sql;
        if (options?.limit !== undefined && options?.offset !== undefined) {
            safeSql = SqlUtil.injectPagination(sql, options.limit, options.offset, 'mysql');
        } else {
            safeSql = SqlUtil.injectLimit(sql, 50000);
        }

        // Execute using query option object to enforce application-level timeout
        const [result, fields] = await pool.query({
            sql: safeSql,
            timeout: 30000 // 30 seconds query timeout
        });

        // If multiple statements, result is an array of results. We usually return the last valid result or handle gracefully
        const rows = Array.isArray(result) && Array.isArray(result[0]) ? result[result.length - 1] : result;
        const actualFields = Array.isArray(fields) && Array.isArray(fields[0]) ? fields[fields.length - 1] : fields;

        return {
            rows: Array.isArray(rows) ? rows.slice(0, 50000) : [], // Secondary array slice guard
            columns: actualFields ? (actualFields as any[]).map(f => f.name) : [],
            rowCount: !Array.isArray(rows) && (rows as any).affectedRows !== undefined ? (rows as any).affectedRows : undefined,
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

    async insertRow(pool: any, params: any): Promise<{ success: boolean; rowCount: number }> {
        const { schema, table, data } = params;
        const columns = Object.keys(data);
        if (columns.length === 0) return { success: false, rowCount: 0 };

        const quotedTable = this.quoteTable(schema, table);
        const colNames = columns.map(c => `\`${c}\``).join(', ');
        const placeholders = columns.map(() => `?`).join(', ');
        const sql = `INSERT INTO ${quotedTable} (${colNames}) VALUES (${placeholders})`;
        const values = columns.map(c => data[c]);

        const [result] = await pool.execute(sql, values);
        return { success: true, rowCount: (result as any).affectedRows };
    }

    async deleteRows(pool: any, params: any): Promise<{ success: boolean; rowCount: number }> {
        const { schema, table, pkColumn, pkValues } = params;
        if (pkValues.length === 0) return { success: true, rowCount: 0 };

        const quotedTable = this.quoteTable(schema, table);
        const placeholders = pkValues.map(() => `?`).join(', ');
        const sql = `DELETE FROM ${quotedTable} WHERE \`${pkColumn}\` IN (${placeholders})`;

        const [result] = await pool.execute(sql, pkValues);
        return { success: true, rowCount: (result as any).affectedRows };
    }

    async importData(pool: any, params: { schema: string; table: string; data: any[] }): Promise<{ success: boolean; rowCount: number }> {
        const { schema, table, data } = params;
        if (!data || data.length === 0) return { success: true, rowCount: 0 };

        const columns = Object.keys(data[0]);
        const quotedTable = this.quoteTable(schema, table);
        const colNames = columns.map(c => `\`${c}\``).join(', ');

        const valuePlaceholders: string[] = [];
        const flatValues: any[] = [];

        data.forEach((row) => {
            const rowPlaceholders = columns.map((col) => {
                flatValues.push(row[col]);
                return `?`;
            });
            valuePlaceholders.push(`(${rowPlaceholders.join(', ')})`);
        });

        const sql = `INSERT INTO ${quotedTable} (${colNames}) VALUES ${valuePlaceholders.join(', ')}`;
        
        const [result] = await pool.execute(sql, flatValues);
        return { success: true, rowCount: (result as any).affectedRows };
    }

    async exportStream(pool: any, schema: string, table: string): Promise<any> {
        const quotedTable = this.quoteTable(schema, table);
        const sql = `SELECT * FROM ${quotedTable}`;
        
        // pool is from mysql2/promise. We need the raw connection for streaming
        const connection = await pool.getConnection();
        
        // .connection accesses the underlying non-promise mysql2 connection
        const stream = connection.connection.query(sql).stream();
        
        stream.on('end', () => connection.release());
        stream.on('error', () => connection.release());
        stream.on('close', () => connection.release());

        return stream;
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

    async getTables(pool: any, schema: string, dbName?: string): Promise<TreeNodeResult[]> {
        const sql = `SELECT TABLE_NAME FROM information_schema.tables WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'`;
        const [rows]: any[] = await pool.query(sql, [schema]);
        return rows.map((row: any) => {
            const tableName = row.TABLE_NAME;
            return {
                id: dbName ? `db:${dbName}.schema:${schema}.table:${tableName}` : `schema:${schema}.table:${tableName}`,
                name: tableName,
                type: 'table',
                parentId: dbName ? `db:${dbName}.schema:${schema}.folder:tables` : `schema:${schema}.folder:tables`,
                hasChildren: true,
            };
        });
    }

    async getViews(_pool: any, _schema: string, _dbName?: string): Promise<TreeNodeResult[]> {
        return [];
    }

    async getFunctions(_pool: any, _schema: string, _dbName?: string): Promise<TreeNodeResult[]> {
        return [];
    }

    async getFunctionParameters(_pool: any, _schema: string, _func: string): Promise<ColumnInfo[]> {
        return [];
    }

    async getColumns(pool: any, schema: string, table: string): Promise<ColumnInfo[]> {
        const sql = `
            SELECT COLUMN_NAME as Field, COLUMN_TYPE as Type, IS_NULLABLE as \`Null\`, 
                   COLUMN_DEFAULT as \`Default\`, COLUMN_KEY as \`Key\` 
            FROM information_schema.columns 
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
            ORDER BY ORDINAL_POSITION
        `;
        const [rows]: any[] = await pool.query(sql, [schema, table]);
        return rows.map((row: any) => ({
            isPrimaryKey: row.Key === 'PRI',
            pkConstraintName: row.Key === 'PRI' ? 'PRIMARY' : null,
        }));
    }

    async getFullMetadata(pool: any, schema: string, table: string): Promise<any> {
        const columns = await this.getColumns(pool, schema, table);
        return {
            columns,
            indices: [],
            comment: null,
            rowCount: 0
        };
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

    // ─── Polymorphic Tree & Seed ───

    async getHierarchyNodes(pool: any, parentId: string | null, parsedParams: any, connectionInfo: any): Promise<TreeNodeResult[]> {
        if (!parentId) {
            return this.getDatabases(pool);
        }
        return [];
    }

    async seedData(pool: any): Promise<QueryResult> {
        const sql = `
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100),
                email VARCHAR(100) UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS products (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100),
                price DECIMAL(10, 2),
                stock INT
            );
            CREATE TABLE IF NOT EXISTS orders (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT,
                total DECIMAL(10, 2),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );
            INSERT IGNORE INTO users (name, email) VALUES 
            ('Alice Johnson', 'alice@example.com'),
            ('Bob Smith', 'bob@example.com'),
            ('Charlie Brown', 'charlie@example.com');
            INSERT IGNORE INTO products (name, price, stock) VALUES 
            ('Laptop', 999.99, 10),
            ('Mouse', 25.50, 100),
            ('Keyboard', 50.00, 50);
            INSERT IGNORE INTO orders (user_id, total) VALUES 
            (1, 1025.49),
            (2, 25.50);
        `;
        return this.executeQuery(pool, sql);
    }
}
