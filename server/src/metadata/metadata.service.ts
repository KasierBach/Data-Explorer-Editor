import { Injectable, NotFoundException } from '@nestjs/common';
import { ConnectionsService } from '../connections/connections.service';

@Injectable()
export class MetadataService {
    constructor(private connectionsService: ConnectionsService) { }

    private parseNodeId(id: string) {
        const parts = id.split('.');
        let dbName: string | undefined;
        let schemaName: string | undefined;
        let tableName: string | undefined;

        for (const part of parts) {
            if (part.startsWith('db:')) dbName = part.split(':')[1];
            if (part.startsWith('schema:')) schemaName = part.split(':')[1];
            if (part.startsWith('table:') || part.startsWith('view:')) tableName = part.split(':')[1];
        }

        return { dbName, schemaName, tableName };
    }

    async getHierarchy(connectionId: string, parentId: string | null) {
        const connection = await this.connectionsService.findOne(connectionId);
        const pool = await this.connectionsService.getPool(connectionId);

        // 1. Root Level
        if (!parentId) {
            if (connection.type === 'postgres') {
                if (connection.showAllDatabases) return this.getPostgresDatabases(pool);
                return this.getPostgresSchemas(pool);
            }
            if (connection.type === 'mysql') return this.getMysqlDatabases(pool);
            return [];
        }

        const parsed = this.parseNodeId(parentId);

        // 2. Folder Level
        if (parentId.includes('.folder:')) {
            const dbPool = await this.connectionsService.getPool(connectionId, parsed.dbName);
            const schema = parsed.schemaName || 'public';

            if (parentId.endsWith('folder:tables')) return this.getTables(dbPool, connection.type, schema, parsed.dbName);
            if (parentId.endsWith('folder:views')) return this.getViews(dbPool, connection.type, schema, parsed.dbName);
            if (parentId.endsWith('folder:functions')) return this.getFunctions(dbPool, connection.type, schema, parsed.dbName);
        }

        // 3. Schema Level -> List Folders
        if (parentId.includes('schema:') && !parentId.includes('.table:') && !parentId.includes('.view:')) {
            return [
                { id: `${parentId}.folder:tables`, name: 'Tables', type: 'folder', parentId, hasChildren: true },
                { id: `${parentId}.folder:views`, name: 'Views', type: 'folder', parentId, hasChildren: true },
                { id: `${parentId}.folder:functions`, name: 'Functions', type: 'folder', parentId, hasChildren: true },
            ];
        }

        if (parentId.startsWith('db:') && !parentId.includes('.schema:')) {
            const dbPool = await this.connectionsService.getPool(connectionId, parsed.dbName);
            if (connection.type === 'postgres') {
                return this.getPostgresSchemas(dbPool, parsed.dbName);
            }
        }

        return [];
    }

    async getDatabases(connectionId: string) {
        const connection = await this.connectionsService.findOne(connectionId);
        const pool = await this.connectionsService.getPool(connectionId);
        if (connection.type === 'postgres') {
            const res = await this.getPostgresDatabases(pool);
            return res.map(r => r.name);
        } else {
            const [rows]: any[] = await pool.query('SHOW DATABASES');
            return rows.map((r: any) => r.Database);
        }
    }

    async getRelationships(connectionId: string, database?: string) {
        const connection = await this.connectionsService.findOne(connectionId);
        const pool = await this.connectionsService.getPool(connectionId, database);

        if (connection.type === 'postgres') {
            const sql = `
                SELECT
                    tc.table_name as source_table, 
                    kcu.column_name as source_column, 
                    ccu.table_name AS target_table,
                    ccu.column_name AS target_column
                FROM 
                    information_schema.table_constraints AS tc 
                    JOIN information_schema.key_column_usage AS kcu
                      ON tc.constraint_name = kcu.constraint_name
                      AND tc.table_schema = kcu.table_schema
                    JOIN information_schema.constraint_column_usage AS ccu
                      ON ccu.constraint_name = tc.constraint_name
                      AND ccu.table_schema = tc.table_schema
                WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
            `;
            const res = await pool.query(sql);
            return res.rows;
        } else {
            const sql = `
                SELECT 
                    TABLE_NAME as source_table, 
                    COLUMN_NAME as source_column, 
                    REFERENCED_TABLE_NAME as target_table, 
                    REFERENCED_COLUMN_NAME as target_column
                FROM 
                    INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
                WHERE 
                    REFERENCED_TABLE_NAME IS NOT NULL
                    AND TABLE_SCHEMA = DATABASE()
            `;
            const [rows]: any[] = await pool.query(sql);
            return rows;
        }
    }

    private async getPostgresDatabases(pool: any) {
        const sql = `
      SELECT datname 
      FROM pg_database 
      WHERE datistemplate = false AND datname != 'postgres'
    `;
        const result = await pool.query(sql);
        return result.rows.map((row: any) => ({
            id: `db:${row.datname}`,
            name: row.datname,
            type: 'database',
            parentId: 'root',
            hasChildren: true,
        }));
    }

    private async getPostgresSchemas(pool: any, dbName?: string) {
        const sql = `
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name NOT IN ('information_schema', 'pg_catalog')
    `;
        const result = await pool.query(sql);
        return result.rows.map((row: any) => ({
            id: dbName ? `db:${dbName}.schema:${row.schema_name}` : `schema:${row.schema_name}`,
            name: row.schema_name,
            type: 'schema',
            parentId: dbName ? `db:${dbName}` : 'root',
            hasChildren: true,
        }));
    }

    private async getMysqlDatabases(pool: any) {
        const [rows]: any[] = await pool.query('SHOW DATABASES');
        return rows.map((row: any) => ({
            id: `schema:${row.Database}`,
            name: row.Database,
            type: 'schema',
            parentId: 'root',
            hasChildren: true,
        }));
    }

    private async getTables(pool: any, type: string, schema: string, dbName?: string) {
        if (type === 'postgres') {
            const sql = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = '${schema}' AND table_type = 'BASE TABLE'
      `;
            const result = await pool.query(sql);
            return result.rows.map((row: any) => ({
                id: dbName ? `db:${dbName}.schema:${schema}.table:${row.table_name}` : `schema:${schema}.table:${row.table_name}`,
                name: row.table_name,
                type: 'table',
                parentId: `schema:${schema}.folder:tables`,
                hasChildren: false,
            }));
        } else {
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
    }

    private async getViews(pool: any, type: string, schema: string, dbName?: string) {
        if (type === 'postgres') {
            const sql = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = '${schema}' AND table_type = 'VIEW'
      `;
            const result = await pool.query(sql);
            return result.rows.map((row: any) => ({
                id: dbName ? `db:${dbName}.schema:${schema}.view:${row.table_name}` : `schema:${schema}.view:${row.table_name}`,
                name: row.table_name,
                type: 'view',
                parentId: `schema:${schema}.folder:views`,
                hasChildren: false,
            }));
        }
        return [];
    }

    private async getFunctions(pool: any, type: string, schema: string, dbName?: string) {
        if (type === 'postgres') {
            const sql = `
        SELECT routine_name
        FROM information_schema.routines
        WHERE routine_schema = '${schema}'
      `;
            const result = await pool.query(sql);
            return result.rows.map((row: any) => ({
                id: dbName ? `db:${dbName}.schema:${schema}.func:${row.routine_name}` : `schema:${schema}.func:${row.routine_name}`,
                name: row.routine_name,
                type: 'function',
                parentId: `schema:${schema}.folder:functions`,
                hasChildren: false,
            }));
        }
        return [];
    }

    async getColumns(connectionId: string, tableId: string) {
        const connection = await this.connectionsService.findOne(connectionId);
        const parsed = this.parseNodeId(tableId);

        const schema = parsed.schemaName || 'public';
        const table = parsed.tableName || tableId;

        const pool = await this.connectionsService.getPool(connectionId, parsed.dbName);

        if (connection.type === 'postgres') {
            const sql = `
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = '${table}' AND table_schema = '${schema}'
        ORDER BY ordinal_position
      `;
            const result = await pool.query(sql);
            return result.rows.map((row: any) => ({
                name: row.column_name,
                type: row.data_type,
                isNullable: row.is_nullable === 'YES',
                defaultValue: row.column_default
            }));
        } else {
            const [rows]: any[] = await pool.query(`DESCRIBE \`${schema}\`.\`${table}\``);
            return rows.map((row: any) => ({
                name: row.Field,
                type: row.Type,
                isNullable: row.Null === 'YES',
                defaultValue: row.Default
            }));
        }
    }

    async getDatabaseMetrics(connectionId: string, database?: string) {
        const connection = await this.connectionsService.findOne(connectionId);
        const pool = await this.connectionsService.getPool(connectionId, database);

        if (connection.type === 'postgres') {
            const statsSql = `
                SELECT 
                    (SELECT count(*) FROM information_schema.tables WHERE table_schema NOT IN ('information_schema', 'pg_catalog')) as table_count,
                    pg_database_size(current_database()) as size_bytes,
                    (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()) as active_connections
            `;

            const tablesSql = `
                SELECT 
                    relname as name, 
                    pg_total_relation_size(relid) as size_bytes
                FROM pg_catalog.pg_statio_user_tables 
                ORDER BY pg_total_relation_size(relid) DESC 
                LIMIT 5
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
                pool.query(typesSql)
            ]);

            const stats = statsRes.rows[0];
            return {
                tableCount: parseInt(stats.table_count),
                sizeBytes: parseInt(stats.size_bytes),
                activeConnections: parseInt(stats.active_connections),
                topTables: tablesRes.rows.map((r: any) => ({
                    name: r.name,
                    sizeBytes: parseInt(r.size_bytes)
                })),
                tableTypes: typesRes.rows.map((r: any) => ({
                    type: r.type,
                    count: parseInt(r.count)
                }))
            };
        } else {
            const statsSql = `
                SELECT 
                    count(*) as table_count,
                    COALESCE(sum(data_length + index_length), 0) as size_bytes,
                    (SELECT count(*) FROM information_schema.processlist) as active_connections
                FROM information_schema.tables 
                WHERE table_schema = DATABASE()
            `;

            const tablesSql = `
                SELECT 
                    table_name as name, 
                    (data_length + index_length) as size_bytes
                FROM information_schema.tables 
                WHERE table_schema = DATABASE()
                ORDER BY (data_length + index_length) DESC 
                LIMIT 5
            `;

            const typesSql = `
                SELECT table_type as type, count(*) as count 
                FROM information_schema.tables 
                WHERE table_schema = DATABASE() 
                GROUP BY table_type
            `;

            const [[statsRows], [tableRows], [typeRows]]: any[] = await Promise.all([
                pool.query(statsSql),
                pool.query(tablesSql),
                pool.query(typesSql)
            ]);

            const stats = statsRows[0];
            return {
                tableCount: parseInt(stats.table_count),
                sizeBytes: parseInt(stats.size_bytes),
                activeConnections: parseInt(stats.active_connections),
                topTables: tableRows.map((r: any) => ({
                    name: r.name,
                    sizeBytes: parseInt(r.size_bytes)
                })),
                tableTypes: typeRows.map((r: any) => ({
                    type: r.type,
                    count: parseInt(r.count)
                }))
            };
        }
    }
}
