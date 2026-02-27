/**
 * Defines the contract for all database-specific operations.
 * Each supported DB type (Postgres, MySQL, MSSQL) provides its own implementation.
 * Following OCP: adding a new DB type means adding a new strategy class, not modifying existing code.
 */

export interface TreeNodeResult {
    id: string;
    name: string;
    type: string;
    parentId: string;
    hasChildren: boolean;
}

export interface ColumnInfo {
    name: string;
    type: string;
    isNullable: boolean;
    defaultValue: any;
    isPrimaryKey: boolean;
    pkConstraintName: string | null;
}

export interface QueryResult {
    rows: any[];
    columns: string[];
    rowCount?: number;
}

export interface Relationship {
    constraint_name: string;
    source_table: string;
    source_column: string;
    target_table: string;
    target_column: string;
}

export interface DatabaseMetrics {
    tableCount: number;
    sizeBytes: number;
    activeConnections: number;
    topTables: { name: string; sizeBytes: number }[];
    tableTypes: { type: string; count: number }[];
}

export interface UpdateRowParams {
    schema: string;
    table: string;
    pkColumn: string;
    pkValue: any;
    updates: Record<string, any>;
}

export interface IDatabaseStrategy {
    // ─── Connection Management ───
    createPool(connectionConfig: any, databaseOverride?: string): Promise<any> | any;
    closePool(pool: any): Promise<void>;

    // ─── Query Operations ───
    executeQuery(pool: any, sql: string): Promise<QueryResult>;
    updateRow(pool: any, params: UpdateRowParams): Promise<{ success: boolean; rowCount: number }>;
    buildAlterTableSql(quotedTable: string, op: any): string;

    // ─── Identifier Quoting ───
    quoteIdentifier(name: string): string;
    quoteTable(schema: string | undefined, table: string): string;

    // ─── DDL Operations ───
    createDatabase(pool: any, name: string): Promise<void>;
    dropDatabase(pool: any, name: string): Promise<void>;

    // ─── Metadata Operations ───
    getDatabases(pool: any): Promise<TreeNodeResult[]>;
    getSchemas(pool: any, dbName?: string): Promise<TreeNodeResult[]>;
    getTables(pool: any, schema: string, dbName?: string): Promise<TreeNodeResult[]>;
    getViews(pool: any, schema: string, dbName?: string): Promise<TreeNodeResult[]>;
    getFunctions(pool: any, schema: string, dbName?: string): Promise<TreeNodeResult[]>;
    getColumns(pool: any, schema: string, table: string): Promise<ColumnInfo[]>;
    getRelationships(pool: any): Promise<Relationship[]>;
    getDatabaseMetrics(pool: any): Promise<DatabaseMetrics>;
}
