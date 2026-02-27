import type { QueryResult, TableMetadata, TreeNode } from "./entities";

export interface IDatabaseAdapter {
    /**
     * Establishes a connection to the database.
     */
    connect(config?: any): Promise<void>;

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
    executeQuery(sql: string, context?: { database?: string }): Promise<QueryResult>;

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
        pkValue: any;
        updates: Record<string, any>;
    }): Promise<any>;

    /**
     * Performs DDL operations on a table.
     */
    updateSchema(params: {
        database?: string;
        schema: string;
        table: string;
        operations: any[];
    }): Promise<any>;

    /**
     * Gets database metrics for the dashboard.
     */
    getMetrics(database?: string): Promise<any>;

    /**
     * Gets list of database names for the connection.
     */
    getDatabases(): Promise<string[]>;

    /**
     * Gets table relationships (foreign keys) for the database.
     */
    getRelationships(database?: string): Promise<any[]>;

    /**
     * Generates SQL using the AI Assistant
     */
    generateSql?(params: {
        database?: string;
        prompt: string;
        image?: string;
        context?: string;
        model: string;
        mode: string;
    }): Promise<Response>;
}
