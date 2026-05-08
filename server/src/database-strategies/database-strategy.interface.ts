import { SchemaOperation } from '../query/dto/schema-operations.types';

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
    defaultValue: unknown;
    isPrimaryKey: boolean;
    pkConstraintName: string | null;
    comment?: string | null;
}

export interface IndexInfo {
    name: string;
    columns: string[];
    isUnique: boolean;
    isPrimary: boolean;
}

export interface TriggerInfo {
    name: string;
    event: string;
    timing: string;
    tableName: string;
}

export interface ConstraintInfo {
    name: string;
    type: 'PRIMARY KEY' | 'UNIQUE' | 'CHECK' | 'FOREIGN KEY' | 'EXCLUSION';
    columns: string[];
    definition?: string;
}

export interface FullTableMetadata {
    columns: ColumnInfo[];
    indices: IndexInfo[];
    comment?: string | null;
    rowCount?: number;
}

export interface QueryResult {
    rows: Record<string, unknown>[];
    columns: string[];
    rowCount?: number;
    totalCount?: number;
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
    pkValue: unknown;
    updates: Record<string, unknown>;
}

export interface InsertRowParams {
    schema: string;
    table: string;
    data: Record<string, unknown>;
}

export interface DeleteRowsParams {
    schema: string;
    table: string;
    pkColumn: string;
    pkValues: unknown[];
}

export interface ConnectionConfig {
    host?: string | null;
    port?: number | null;
    username?: string | null;
    password?: string;
    database?: string | null;
    statementTimeout?: number;
    queryTimeout?: number;
}

export interface IDatabaseStrategy {
    createPool(connectionConfig: ConnectionConfig, databaseOverride?: string): Promise<unknown> | unknown;
    closePool(pool: unknown): Promise<void>;

    executeQuery(pool: unknown, sql: string, options?: { limit?: number; offset?: number }): Promise<QueryResult>;
    updateRow(pool: unknown, params: UpdateRowParams): Promise<{ success: boolean; rowCount: number }>;
    insertRow(pool: unknown, params: InsertRowParams): Promise<{ success: boolean; rowCount: number }>;
    deleteRows(pool: unknown, params: DeleteRowsParams): Promise<{ success: boolean; rowCount: number }>;
    buildAlterTableSql(quotedTable: string, op: SchemaOperation): string;

    quoteIdentifier(name: string): string;
    quoteTable(schema: string | undefined, table: string): string;

    createDatabase(pool: unknown, name: string): Promise<void>;
    dropDatabase(pool: unknown, name: string): Promise<void>;

    getDatabases(pool: unknown): Promise<TreeNodeResult[]>;
    getSchemas(pool: unknown, dbName?: string): Promise<TreeNodeResult[]>;
    getTables(pool: unknown, schema: string, dbName?: string): Promise<TreeNodeResult[]>;
    getViews(pool: unknown, schema: string, dbName?: string): Promise<TreeNodeResult[]>;
    getFunctions(pool: unknown, schema: string, dbName?: string): Promise<TreeNodeResult[]>;
    getFunctionParameters(pool: unknown, schema: string, func: string): Promise<ColumnInfo[]>;
    getColumns(pool: unknown, schema: string, table: string, dbName?: string): Promise<ColumnInfo[]>;
    getIndexes(pool: unknown, schema: string, table: string, dbName?: string): Promise<TreeNodeResult[]>;
    getTriggers(pool: unknown, schema: string, table: string, dbName?: string): Promise<TreeNodeResult[]>;
    getConstraints(pool: unknown, schema: string, table: string, dbName?: string): Promise<TreeNodeResult[]>;
    getFullMetadata(pool: unknown, schema: string, table: string, dbName?: string): Promise<FullTableMetadata>;
    getRelationships(pool: unknown, dbName?: string): Promise<Relationship[]>;
    getDatabaseMetrics(pool: unknown): Promise<DatabaseMetrics>;

    importData(pool: unknown, params: { schema: string; table: string; data: Record<string, unknown>[] }): Promise<{ success: boolean; rowCount: number }>;
    exportStream(pool: unknown, schema: string, table: string): Promise<unknown>;
    
    getHierarchyNodes(pool: unknown, parentId: string | null, parsedParams: unknown, connectionInfo: unknown): Promise<TreeNodeResult[]>;
    seedData(pool: unknown): Promise<QueryResult>;
}
