import type {
    DatabaseConnectionConfig,
    DatabaseMetrics,
    DatabaseRelationship,
    GenerateSqlParams,
    IDatabaseAdapter,
    MutationResult,
    QueryExecutionContext,
    SchemaOperation,
} from '../domain/database-adapter.interface';
import type { DatabaseValue, QueryResult, RowData, TableMetadata, TreeNode } from '../domain/entities';
import { apiService } from '../services/api.service';
import { API_BASE_URL } from '../config/env';
import { useAppStore } from '../services/store';
import { ApiError } from '../services/api.service';
import type { DestructiveQueryAnalysis } from '../services/store/slices/uiSlice';

interface MetadataResponse {
    columns: Array<{
        name: string;
        type: string;
        isPrimaryKey?: boolean;
        isNullable?: boolean;
        isForeignKey?: boolean;
        comment?: string | null;
    }>;
    rowCount?: number;
    comment?: string | null;
    indices?: TableMetadata['indices'];
}

const hasDestructiveAnalysis = (value: unknown): value is { analysis: DestructiveQueryAnalysis } => (
    typeof value === 'object' && value !== null && 'analysis' in value
);

/**
 * Adapter that communicates with the backend API to perform database operations.
 * Standardized to use apiService for most calls, while keeping raw fetch for streams.
 */
export class ApiDatabaseAdapter implements IDatabaseAdapter {
    private connectionId: string | null = null;
    private baseUrl = API_BASE_URL;

    async connect(config?: DatabaseConnectionConfig): Promise<void> {
        if (!config?.id) {
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

    async executeQuery(sql: string, context?: QueryExecutionContext): Promise<QueryResult> {
        if (!this.connectionId) throw new Error('Not connected');

        const body: {
            connectionId: string;
            sql: string;
            database?: string;
            limit?: number;
            offset?: number;
            confirmed?: boolean;
        } = {
            connectionId: this.connectionId,
            sql: sql,
        };

        if (context?.database) body.database = context.database;
        if (context?.limit !== undefined) body.limit = context.limit;
        if (context?.offset !== undefined) body.offset = context.offset;
        if (context?.confirmed) body.confirmed = true;

        try {
            return await apiService.post<QueryResult>('/query', body);
        } catch (error) {
            // Intercept the destructive SQL confirmation flow
            if (error instanceof ApiError && error.reason === 'DESTRUCTIVE_REQUIRES_CONFIRMATION') {
                const analysis = hasDestructiveAnalysis(error.details) ? error.details.analysis : {};
                const userConfirmed = await useAppStore.getState().requestDestructiveConfirm(analysis);

                if (userConfirmed) {
                    return this.executeQuery(sql, { ...context, confirmed: true });
                }

                throw new Error('Query cancelled by user.');
            }
            throw error;
        }
    }

    async getMetadata(tableId: string): Promise<TableMetadata> {
        if (!this.connectionId) throw new Error('Not connected');

        const data = await apiService.get<MetadataResponse>(`/metadata/full?connectionId=${this.connectionId}&tableId=${encodeURIComponent(tableId)}`);
        
        return {
            columns: data.columns.map((col) => ({
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
        pkValue: DatabaseValue;
        updates: RowData;
    }): Promise<MutationResult> {
        if (!this.connectionId) throw new Error('Not connected');

        return await apiService.patch<MutationResult>('/query/row', {
            ...params,
            connectionId: this.connectionId
        });
    }

    async insertRow(params: {
        database?: string;
        schema: string;
        table: string;
        data: RowData;
    }): Promise<MutationResult> {
        if (!this.connectionId) throw new Error('Not connected');

        return await apiService.post<MutationResult>('/query/row', {
            ...params,
            connectionId: this.connectionId
        });
    }

    async deleteRows(params: {
        database?: string;
        schema: string;
        table: string;
        pkColumn: string;
        pkValues: DatabaseValue[];
    }): Promise<MutationResult> {
        if (!this.connectionId) throw new Error('Not connected');

        return await apiService.post<MutationResult>('/query/delete-rows', {
            ...params,
            connectionId: this.connectionId
        });
    }

    async updateSchema(params: {
        database?: string;
        schema: string;
        table: string;
        operations: SchemaOperation[];
    }): Promise<MutationResult> {
        if (!this.connectionId) throw new Error('Not connected');

        return await apiService.post<MutationResult>('/query/schema', {
            ...params,
            connectionId: this.connectionId
        });
    }

    async getMetrics(database?: string): Promise<DatabaseMetrics> {
        if (!this.connectionId) throw new Error('Not connected');

        let url = `/metadata/metrics?connectionId=${this.connectionId}`;
        if (database) url += `&database=${encodeURIComponent(database)}`;

        return await apiService.get<DatabaseMetrics>(url);
    }

    async getDatabases(): Promise<string[]> {
        if (!this.connectionId) throw new Error('Not connected');

        return await apiService.get<string[]>(`/metadata/databases?connectionId=${this.connectionId}`);
    }

    async getRelationships(database?: string): Promise<DatabaseRelationship[]> {
        if (!this.connectionId) throw new Error('Not connected');

        let url = `/metadata/relationships?connectionId=${this.connectionId}`;
        if (database) url += `&database=${encodeURIComponent(database)}`;

        return await apiService.get<DatabaseRelationship[]>(url);
    }

    async generateSql(params: GenerateSqlParams, options?: { signal?: AbortSignal }): Promise<Response> {
        if (!this.connectionId) throw new Error('Not connected');

        return fetch(`${this.baseUrl}/ai/generate-sql`, {
            method: 'POST',
            headers: apiService.getHeaders(),
            body: JSON.stringify({
                ...params,
                connectionId: this.connectionId
            }),
            signal: options?.signal
        });
    }

    async generateSqlStream(params: GenerateSqlParams, options?: { signal?: AbortSignal }): Promise<Response> {
        if (!this.connectionId) throw new Error('Not connected');

        return fetch(`${this.baseUrl}/ai/generate-sql-stream`, {
            method: 'POST',
            headers: apiService.getHeaders(),
            body: JSON.stringify({
                ...params,
                connectionId: this.connectionId
            }),
            signal: options?.signal
        });
    }
}
