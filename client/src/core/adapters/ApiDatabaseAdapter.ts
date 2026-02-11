import type { IDatabaseAdapter } from '../domain/database-adapter.interface';
import type { TableMetadata, TreeNode, QueryResult } from '../domain/entities';
import { useAppStore } from '../services/store';

export class ApiDatabaseAdapter implements IDatabaseAdapter {
    private connectionId: string | null = null;
    private baseUrl = 'http://localhost:3000/api';

    private config: any = null;

    async connect(config: any): Promise<void> {
        this.config = config;
        // Register the connection with the backend
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, showAllDatabases, ...connectionConfig } = config;

        const response = await fetch(`${this.baseUrl}/connections`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(connectionConfig),
        });

        if (!response.ok) {
            throw new Error(`Failed to connect: ${response.statusText}`);
        }

        const connection = await response.json();
        this.connectionId = connection.id;
    }

    async disconnect(): Promise<void> {
        this.connectionId = null;
    }

    async getHierarchy(parentId: string | null): Promise<TreeNode[]> {
        if (!this.connectionId) throw new Error('Not connected');

        // Check if we need to show all databases (we need access to the config, but config is only passed in connect)
        // We can check if "showAllDatabases" was part of the config in connect, and store it.
        // For now, let's assume we store it in a private property.
        // TODO: This requires storing the config in connect().

        // Root Level
        if (!parentId) {
            const hasShowAll = this.config?.showAllDatabases;

            if (hasShowAll) {
                const sql = `SELECT datname FROM pg_database WHERE datistemplate = false;`; // Postgres specific
                // For MySQL it's SHOW DATABASES;
                // We need to know the type... stored in config too.
                const result = await this.executeQuery(sql);
                return result.rows.map((row: any) => ({
                    id: `db:${row.datname || row.Database}`,
                    name: row.datname || row.Database,
                    type: 'database',
                    parentId: 'root',
                    hasChildren: true
                }));
            }

            // Default: List Schemas
            return this.getSchemas();
        }

        // Parent is Folder -> List Items
        if (parentId.includes('.folder:')) {
            // ID: db:mydb.schema:public.folder:tables
            let dbName: string | undefined;
            let schemaName = 'public';

            // Extract DB and Schema
            if (parentId.includes('db:')) {
                const part = parentId.split('.').find(p => p.startsWith('db:'));
                if (part) dbName = part.split(':')[1];
            }
            if (parentId.includes('schema:')) {
                const part = parentId.split('.').find(p => p.startsWith('schema:'));
                if (part) schemaName = part.split(':')[1];
            }

            if (parentId.endsWith('folder:tables')) {
                const sql = `
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = '${schemaName}' AND table_type = 'BASE TABLE'
                `;
                const result = await this.executeQuery(sql, dbName ? { database: dbName } : undefined);
                return result.rows.map((row: any) => ({
                    id: dbName ? `db:${dbName}.schema:${schemaName}.table:${row.table_name}` : `table:${schemaName}.${row.table_name}`,
                    name: row.table_name,
                    type: 'table',
                    parentId: parentId,
                    hasChildren: false,
                }));
            }

            if (parentId.endsWith('folder:views')) {
                const sql = `
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = '${schemaName}' AND table_type = 'VIEW'
                `;
                const result = await this.executeQuery(sql, dbName ? { database: dbName } : undefined);
                return result.rows.map((row: any) => ({
                    id: dbName ? `db:${dbName}.schema:${schemaName}.view:${row.table_name}` : `view:${schemaName}.${row.table_name}`,
                    name: row.table_name,
                    type: 'view',
                    parentId: parentId,
                    hasChildren: false,
                }));
            }

            if (parentId.endsWith('folder:functions')) {
                const sql = `
                    SELECT routine_name
                    FROM information_schema.routines
                    WHERE routine_schema = '${schemaName}'
                `;
                const result = await this.executeQuery(sql, dbName ? { database: dbName } : undefined);
                return result.rows.map((row: any) => ({
                    id: dbName ? `db:${dbName}.schema:${schemaName}.func:${row.routine_name}` : `func:${schemaName}.${row.routine_name}`,
                    name: row.routine_name,
                    type: 'function',
                    parentId: parentId,
                    hasChildren: false,
                }));
            }
        }

        // Parent is Schema -> Return Group Folders (Tables, Views, Functions)
        if (parentId.includes('schema:') && !parentId.includes('.folder:')) {
            return [
                { id: `${parentId}.folder:tables`, name: 'Tables', type: 'folder', parentId, hasChildren: true },
                { id: `${parentId}.folder:views`, name: 'Views', type: 'folder', parentId, hasChildren: true },
                { id: `${parentId}.folder:functions`, name: 'Functions', type: 'folder', parentId, hasChildren: true },
            ];
        }

        // Parent is Database -> List Schemas within that DB
        // Check this LAST because other IDs might start with db: but refer to deeper nodes
        if (parentId.startsWith('db:') && !parentId.includes('schema:')) {
            const dbName = parentId.split(':')[1];
            return this.getSchemas(dbName);
        }

        // Parent is Folder -> List Items
        if (parentId.includes('.folder:')) {
            // ID: db:mydb.schema:public.folder:tables
            let dbName: string | undefined;
            let schemaName = 'public';

            // Extract DB and Schema
            if (parentId.includes('db:')) {
                const part = parentId.split('.').find(p => p.startsWith('db:'));
                if (part) dbName = part.split(':')[1];
            }
            if (parentId.includes('schema:')) {
                const part = parentId.split('.').find(p => p.startsWith('schema:'));
                if (part) schemaName = part.split(':')[1];
            }

            if (parentId.endsWith('folder:tables')) {
                const sql = `
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = '${schemaName}' AND table_type = 'BASE TABLE'
                `;
                const result = await this.executeQuery(sql, dbName ? { database: dbName } : undefined);
                return result.rows.map((row: any) => ({
                    id: dbName ? `db:${dbName}.schema:${schemaName}.table:${row.table_name}` : `table:${schemaName}.${row.table_name}`,
                    name: row.table_name,
                    type: 'table',
                    parentId: parentId,
                    hasChildren: false,
                }));
            }

            if (parentId.endsWith('folder:views')) {
                const sql = `
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = '${schemaName}' AND table_type = 'VIEW'
                `;
                const result = await this.executeQuery(sql, dbName ? { database: dbName } : undefined);
                return result.rows.map((row: any) => ({
                    id: dbName ? `db:${dbName}.schema:${schemaName}.view:${row.table_name}` : `view:${schemaName}.${row.table_name}`,
                    name: row.table_name,
                    type: 'view',
                    parentId: parentId,
                    hasChildren: false,
                }));
            }

            if (parentId.endsWith('folder:functions')) {
                const sql = `
                    SELECT routine_name
                    FROM information_schema.routines
                    WHERE routine_schema = '${schemaName}'
                `;
                const result = await this.executeQuery(sql, dbName ? { database: dbName } : undefined);
                return result.rows.map((row: any) => ({
                    id: dbName ? `db:${dbName}.schema:${schemaName}.func:${row.routine_name}` : `func:${schemaName}.${row.routine_name}`,
                    name: row.routine_name,
                    type: 'function',
                    parentId: parentId,
                    hasChildren: false,
                }));
            }
        }

        /* Legacy/Fallback: If parentId is Schema but logic fell through (shouldn't happen with above check) */

        return [];
    }

    private async getSchemas(dbName?: string): Promise<TreeNode[]> {
        const sql = `
            SELECT schema_name 
            FROM information_schema.schemata 
            WHERE schema_name NOT IN ('information_schema', 'pg_catalog')
          `;
        const result = await this.executeQuery(sql, dbName ? { database: dbName } : undefined);

        return result.rows.map((row: any) => ({
            id: dbName ? `db:${dbName}.schema:${row.schema_name}` : `schema:${row.schema_name}`,
            name: row.schema_name,
            type: 'schema',
            parentId: dbName ? `db:${dbName}` : 'root',
            hasChildren: true,
        }));
    }

    private getHeaders() {
        const token = localStorage.getItem('accessToken');
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        return headers;
    }

    async executeQuery(sql: string, context?: { database?: string }): Promise<QueryResult> {
        if (!this.connectionId) throw new Error('Not connected');

        const body: any = {
            connectionId: this.connectionId,
            sql: sql,
        };

        if (context?.database) {
            body.database = context.database;
        }

        const response = await fetch(`${this.baseUrl}/query`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            if (response.status === 401) {
                // Clear state on unauthorized using store logic
                useAppStore.getState().logout();
                window.location.reload();
                throw new Error('Session expired. Please login again.');
            }
            const errorText = await response.text();
            console.error('❌ API Error:', errorText);
            try {
                const errorJson = JSON.parse(errorText);
                throw new Error(errorJson.message || 'Query execution failed');
            } catch (e) {
                throw new Error(`Query failed: ${response.status} ${response.statusText} - ${errorText}`);
            }
        }

        return await response.json();
    }

    async getMetadata(tableId: string): Promise<TableMetadata> {
        if (!this.connectionId) throw new Error('Not connected');

        let dbName: string | undefined;
        let schema = 'public';
        let table = tableId;

        // Structured ID parsing: db:mydb.schema:public.table:users
        if (tableId.includes('db:')) {
            const parts = tableId.split('.');
            const dbPart = parts.find(p => p.startsWith('db:'));
            const schemaPart = parts.find(p => p.startsWith('schema:'));
            const tablePart = parts.find(p => p.startsWith('table:') || p.startsWith('view:'));

            if (dbPart) dbName = dbPart.split(':')[1];
            if (schemaPart) schema = schemaPart.split(':')[1];
            if (tablePart) table = tablePart.split(':')[1];
        } else if (tableId.startsWith('table:') || tableId.startsWith('view:')) {
            // Simple table:name format or table:schema.name
            const part = tableId.trim().split(':')[1];
            if (part.includes('.')) {
                const pieces = part.split('.');
                schema = pieces[0];
                table = pieces[1];
            } else {
                table = part;
            }
        } else if (tableId.includes('.')) {
            // Legacy/Simple schema.table format (fallback for strict strings without prefix)
            const parts = tableId.split('.');
            schema = parts[0];
            table = parts[1];
        }

        const sql = `
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = '${table}' AND table_schema = '${schema}'
            ORDER BY ordinal_position
        `;

        const result = await this.executeQuery(sql, dbName ? { database: dbName } : undefined);

        const columns = result.rows.map((row: any) => ({
            name: row.column_name,
            type: row.data_type,
            isPrimaryKey: false, // TODO: Query constraints for PK
            isNullable: row.is_nullable === 'YES',
            isForeignKey: false // TODO: Query constraints for FK
        }));

        return {
            columns,
            rowCount: 0 // Optional, or query count(*) if needed
        };
    }
}
