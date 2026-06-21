import type { DatabaseValue, QueryResult, RowData, TableMetadata, TreeNode } from './entities';

export interface DatabaseConnectionConfig {
    id: string;
    type?: string;
}

export interface QueryExecutionContext {
    database?: string;
    limit?: number;
    offset?: number;
    confirmed?: boolean;
    includeTotalCount?: boolean;
}

export interface TableWindowRequest {
    database?: string;
    schema?: string;
    table: string;
    limit?: number;
    offset?: number;
    includeTotalCount?: boolean;
}

export interface SchemaOperation {
    type: string;
    [key: string]: unknown;
}

export interface MutationResult {
    success?: boolean;
    rowCount?: number;
    [key: string]: unknown;
}

export interface DatabaseMetrics {
    tableCount: number;
    sizeBytes: number;
    activeConnections: number;
    topTables: Array<{ name: string; sizeBytes: number }>;
    tableTypes: Array<{ type: string; count: number }>;
}

export interface DatabaseRelationship {
    constraint_name?: string;
    source_table: string;
    source_column: string;
    target_table: string;
    target_column: string;
}

export interface AiHistoryMessage {
    role?: string;
    content?: unknown;
    [key: string]: unknown;
}

export interface AiProviderOverrideConfig {
    type: 'openai-compatible';
    name: string;
    baseUrl: string;
    apiKey: string;
    model: string;
}

export interface GenerateSqlParams {
    database?: string;
    prompt: string;
    image?: string;
    context?: string;
    model: string;
    mode: string;
    routingMode?: string;
    history?: AiHistoryMessage[];
    providerOverride?: AiProviderOverrideConfig;
}

export interface IDatabaseAdapter {
    connect(config?: DatabaseConnectionConfig): Promise<void>;
    disconnect(): Promise<void>;
    getHierarchy(parentId: string | null): Promise<TreeNode[]>;
    executeQuery(sql: string, context?: QueryExecutionContext): Promise<QueryResult>;
    fetchTableWindow(params: TableWindowRequest): Promise<QueryResult>;
    getMetadata(tableId: string): Promise<TableMetadata>;
    updateRow(params: {
        database?: string;
        schema: string;
        table: string;
        pkColumn: string;
        pkValue: DatabaseValue;
        updates: RowData;
    }): Promise<MutationResult>;
    insertRow(params: {
        database?: string;
        schema: string;
        table: string;
        data: RowData;
    }): Promise<MutationResult>;
    deleteRows(params: {
        database?: string;
        schema: string;
        table: string;
        pkColumn: string;
        pkValues: DatabaseValue[];
    }): Promise<MutationResult>;
    updateSchema(params: {
        database?: string;
        schema: string;
        table: string;
        operations: SchemaOperation[];
    }): Promise<MutationResult>;
    getMetrics(database?: string): Promise<DatabaseMetrics>;
    getDatabases(): Promise<string[]>;
    getRelationships(database?: string): Promise<DatabaseRelationship[]>;
    generateSql?(params: GenerateSqlParams, options?: { signal?: AbortSignal }): Promise<Response>;
    generateSqlStream?(params: GenerateSqlParams, options?: { signal?: AbortSignal }): Promise<Response>;
}
