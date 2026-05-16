import type { DatabaseValue, QueryResult, RowData, TableMetadata, TreeNode } from "./entities";

export interface DatabaseConnectionConfig {
    id: string;
    type?: string;
}

export interface QueryExecutionContext {
    database?: string;
    limit?: number;
    offset?: number;
    confirmed?: boolean;
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

export interface GenerateSqlParams {
    database?: string;
    prompt: string;
    image?: string;
    context?: string;
    model: string;
    mode: string;
    routingMode?: string;
    history?: AiHistoryMessage[];
}

export interface IDatabaseAdapter {
    /**
     * Establishes a connection to the database.
     */
    connect(config?: DatabaseConnectionConfig): Promise<void>;

    /**
     * Disconnects from the database.
     */
    disconnect(): Promise<void>;

    /**
     * Retrieves the hierarchy nodes (Databases, Schemas, Tables) for a given parent.
     * If parentId is null, returns the root level (e.g. Databases).
     */
    getHierarchy(parentId: string | null): Promise<TreeNode[]>;

    /**
     * Executes a raw SQL query and returns the results.
     */
    executeQuery(sql: string, context?: QueryExecutionContext): Promise<QueryResult>;

    /**
     * Retrieves metadata (columns, constraints) for a specific table.
     */
    getMetadata(tableId: string): Promise<TableMetadata>;

    /**
     * Updates a single row in a table.
     */
    updateRow(params: {
        database?: string;
        schema: string;
        table: string;
        pkColumn: string;
        pkValue: DatabaseValue;
        updates: RowData;
    }): Promise<MutationResult>;

    /**
     * Inserts a new row into a table.
     */
    insertRow(params: {
        database?: string;
        schema: string;
        table: string;
        data: RowData;
    }): Promise<MutationResult>;

    /**
     * Deletes one or more rows from a table.
     */
    deleteRows(params: {
        database?: string;
        schema: string;
        table: string;
        pkColumn: string;
        pkValues: DatabaseValue[];
    }): Promise<MutationResult>;

    /**
     * Performs DDL operations on a table.
     */
    updateSchema(params: {
        database?: string;
        schema: string;
        table: string;
        operations: SchemaOperation[];
    }): Promise<MutationResult>;

    /**
     * Gets database metrics for the dashboard.
     */
    getMetrics(database?: string): Promise<DatabaseMetrics>;

    /**
     * Gets list of database names for the connection.
     */
    getDatabases(): Promise<string[]>;

    /**
     * Gets table relationships (foreign keys) for the database.
     */
    getRelationships(database?: string): Promise<DatabaseRelationship[]>;

    /**
     * Generates SQL using the AI Assistant
     */
    generateSql?(params: GenerateSqlParams, options?: { signal?: AbortSignal }): Promise<Response>;

    /**
     * Streams SQL generation using the AI Assistant
     */
    generateSqlStream?(params: GenerateSqlParams, options?: { signal?: AbortSignal }): Promise<Response>;
}
