import type { IDatabaseAdapter } from '../domain/database-adapter.interface';
import type { TableMetadata, TreeNode, QueryResult } from '../domain/entities';
import { apiService } from '../services/api.service';
import { API_BASE_URL } from '../config/env';

/**
 * Adapter that communicates with the backend API to perform database operations.
 * Standardized to use apiService for most calls, while keeping raw fetch for streams.
 */
export class ApiDatabaseAdapter implements IDatabaseAdapter {
    private connectionId: string | null = null;
    private baseUrl = API_BASE_URL;

    async connect(config: any): Promise<void> {
        if (!config.id) {
            throw new Error('Connection configuration is missing an ID');
        }
        this.connectionId = config.id;
    }

    async disconnect(): Promise<void> {
        this.connectionId = null;
    }

    async getHierarchy(parentId: string | null): Promise<TreeNode[]> {
        if (!this.connectionId) throw new Error('Not connected');

        return await apiService.post<TreeNode[]>('/metadata/hierarchy', {
            connectionId: this.connectionId,
            parentId: parentId
        });
    }

    async executeQuery(sql: string, context?: { database?: string, limit?: number, offset?: number }): Promise<QueryResult> {
        if (!this.connectionId) throw new Error('Not connected');

        const body: any = {
            connectionId: this.connectionId,
            sql: sql,
        };

        if (context?.database) body.database = context.database;
        if (context?.limit !== undefined) body.limit = context.limit;
        if (context?.offset !== undefined) body.offset = context.offset;

        return await apiService.post<QueryResult>('/query', body);
    }

    async getMetadata(tableId: string): Promise<TableMetadata> {
        if (!this.connectionId) throw new Error('Not connected');

        const data = await apiService.get<any>(`/metadata/full?connectionId=${this.connectionId}&tableId=${encodeURIComponent(tableId)}`);
        
        return {
            columns: data.columns.map((col: any) => ({
                name: col.name,
                type: col.type,
                isPrimaryKey: col.isPrimaryKey || false,
                isNullable: col.isNullable !== undefined ? col.isNullable : true,
                isForeignKey: col.isForeignKey || false,
                comment: col.comment
            })),
            rowCount: data.rowCount || 0,
            comment: data.comment,
            indices: data.indices
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

        return await apiService.patch<any>('/query/row', {
            ...params,
            connectionId: this.connectionId
        });
    }

    async insertRow(params: {
        database?: string;
        schema: string;
        table: string;
        data: Record<string, any>;
    }): Promise<any> {
        if (!this.connectionId) throw new Error('Not connected');

        return await apiService.post<any>('/query/row', {
            ...params,
            connectionId: this.connectionId
        });
    }

    async deleteRows(params: {
        database?: string;
        schema: string;
        table: string;
        pkColumn: string;
        pkValues: any[];
    }): Promise<any> {
        if (!this.connectionId) throw new Error('Not connected');

        return await apiService.post<any>('/query/delete-rows', {
            ...params,
            connectionId: this.connectionId
        });
    }

    async updateSchema(params: {
        database?: string;
        schema: string;
        table: string;
        operations: any[];
    }): Promise<any> {
        if (!this.connectionId) throw new Error('Not connected');

        return await apiService.post<any>('/query/schema', {
            ...params,
            connectionId: this.connectionId
        });
    }

    async getMetrics(database?: string): Promise<any> {
        if (!this.connectionId) throw new Error('Not connected');

        let url = `/metadata/metrics?connectionId=${this.connectionId}`;
        if (database) url += `&database=${encodeURIComponent(database)}`;

        return await apiService.get<any>(url);
    }

    async getDatabases(): Promise<string[]> {
        if (!this.connectionId) throw new Error('Not connected');

        return await apiService.get<string[]>(`/metadata/databases?connectionId=${this.connectionId}`);
    }

    async getRelationships(database?: string): Promise<any[]> {
        if (!this.connectionId) throw new Error('Not connected');

        let url = `/metadata/relationships?connectionId=${this.connectionId}`;
        if (database) url += `&database=${encodeURIComponent(database)}`;

        return await apiService.get<any[]>(url);
    }

    async generateSql(params: {
        database?: string;
        prompt: string;
        image?: string;
        context?: string;
        model: string;
        mode: string;
        routingMode?: string;
    }): Promise<Response> {
        if (!this.connectionId) throw new Error('Not connected');

        // Note: For generateSql we keep raw fetch because it might be used directly as a Response object
        // although usually we want the stream. apiService consumes the stream.
        return fetch(`${this.baseUrl}/ai/generate-sql`, {
            method: 'POST',
            headers: apiService.getHeaders(),
            body: JSON.stringify({
                ...params,
                connectionId: this.connectionId
            }),
        });
    }

    async generateSqlStream(params: {
        database?: string;
        prompt: string;
        image?: string;
        context?: string;
        model: string;
        mode: string;
        routingMode?: string;
    }): Promise<Response> {
        if (!this.connectionId) throw new Error('Not connected');

        return fetch(`${this.baseUrl}/ai/generate-sql-stream`, {
            method: 'POST',
            headers: apiService.getHeaders(),
            body: JSON.stringify({
                ...params,
                connectionId: this.connectionId
            }),
        });
    }
}
