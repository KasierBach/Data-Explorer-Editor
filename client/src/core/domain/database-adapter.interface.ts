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
}
