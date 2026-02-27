import type { IDatabaseAdapter } from '../domain/database-adapter.interface';
import type { TableMetadata, TreeNode, QueryResult } from '../domain/entities';
import { useAppStore } from '../services/store';

export class ApiDatabaseAdapter implements IDatabaseAdapter {
    private connectionId: string | null = null;
    private baseUrl = 'http://localhost:3000/api';

    async connect(config: any): Promise<void> {
        // Register the connection with the backend
        const { id, ...connectionConfig } = config;

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

        // Sync: if backend returned a different UUID, update the store
        if (id && connection.id !== id) {
            const store = useAppStore.getState();
            // Replace the old connection entry with updated ID
            const oldConn = store.connections.find(c => c.id === id);
            if (oldConn) {
                store.updateConnection(id, { ...oldConn, id: connection.id } as any);
                if (store.activeConnectionId === id) {
                    store.setActiveConnectionId(connection.id);
                }
            }
        }
    }

    async disconnect(): Promise<void> {
        this.connectionId = null;
    }

    async getHierarchy(parentId: string | null): Promise<TreeNode[]> {
        if (!this.connectionId) throw new Error('Not connected');

        const response = await fetch(`${this.baseUrl}/metadata/hierarchy`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
                connectionId: this.connectionId,
                parentId: parentId
            }),
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch hierarchy: ${response.statusText}`);
        }

        return await response.json();
    }

    private getHeaders() {
        // Read token from Zustand store (persisted in 'data-explorer-storage')
        const token = useAppStore.getState().accessToken;
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

        const response = await fetch(`${this.baseUrl}/metadata/columns?connectionId=${this.connectionId}&tableId=${encodeURIComponent(tableId)}`, {
            headers: this.getHeaders(),
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch metadata: ${response.statusText}`);
        }

        const data = await response.json();
        const columns = Array.isArray(data) ? data : (data.columns || []);

        return {
            columns: columns.map((col: any) => ({
                name: col.name,
                type: col.type,
                isPrimaryKey: col.isPrimaryKey || false,
                isNullable: col.isNullable !== undefined ? col.isNullable : true,
                isForeignKey: col.isForeignKey || false
            })),
            rowCount: data.rowCount || 0
        };
    }

    async updateRow(params: {
        database?: string;
        schema: string;
        table: string;
        pkColumn: string;
        pkValue: any;
        updates: Record<string, any>;
    }): Promise<any> {
        if (!this.connectionId) throw new Error('Not connected');

        const response = await fetch(`${this.baseUrl}/query/row`, {
            method: 'PATCH',
            headers: this.getHeaders(),
            body: JSON.stringify({
                ...params,
                connectionId: this.connectionId
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || `Failed to update row: ${response.statusText}`);
        }

        return await response.json();
    }

    async updateSchema(params: {
        database?: string;
        schema: string;
        table: string;
        operations: any[];
    }): Promise<any> {
        if (!this.connectionId) throw new Error('Not connected');

        const response = await fetch(`${this.baseUrl}/query/schema`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
                ...params,
                connectionId: this.connectionId
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || `Failed to update schema: ${response.statusText}`);
        }

        return await response.json();
    }

    async getMetrics(database?: string): Promise<any> {
        if (!this.connectionId) throw new Error('Not connected');

        const url = new URL(`${this.baseUrl}/metadata/metrics`);
        url.searchParams.append('connectionId', this.connectionId);
        if (database) url.searchParams.append('database', database);

        const response = await fetch(url.toString(), {
            headers: this.getHeaders(),
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch metrics: ${response.statusText}`);
        }

        return await response.json();
    }

    async getDatabases(): Promise<string[]> {
        if (!this.connectionId) throw new Error('Not connected');

        const response = await fetch(`${this.baseUrl}/metadata/databases?connectionId=${this.connectionId}`, {
            headers: this.getHeaders(),
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch databases: ${response.statusText}`);
        }

        return await response.json();
    }

    async getRelationships(database?: string): Promise<any[]> {
        if (!this.connectionId) throw new Error('Not connected');

        const url = new URL(`${this.baseUrl}/metadata/relationships`);
        url.searchParams.append('connectionId', this.connectionId);
        if (database) url.searchParams.append('database', database);

        const response = await fetch(url.toString(), {
            headers: this.getHeaders(),
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch relationships: ${response.statusText}`);
        }

        return await response.json();
    }

    async generateSql(params: {
        database?: string;
        prompt: string;
        image?: string;
        context?: string;
        model: string;
        mode: string;
    }): Promise<Response> {
        if (!this.connectionId) throw new Error('Not connected');

        return fetch(`${this.baseUrl}/ai/generate-sql`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
                ...params,
                connectionId: this.connectionId
            }),
        });
    }
}
