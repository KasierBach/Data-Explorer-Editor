export type ConnectionType = 'postgres' | 'mysql' | 'sqlite';

export interface Connection {
    id: string;
    name: string;
    type: ConnectionType;
    host?: string;
    port?: number;
    username?: string;
    database?: string; // Default DB
}

export interface TreeNode {
    id: string;
    parentId: string | null;
    name: string;
    type: 'connection' | 'database' | 'schema' | 'table' | 'view' | 'function' | 'column' | 'folder';
    metadata?: Record<string, any>;
    children?: TreeNode[]; // For recursive structures if needed, though we might lazy load
    hasChildren?: boolean;
}

export interface TableColumn {
    name: string;
    type: string;
    isPrimaryKey: boolean;
    isForeignKey: boolean;
    isNullable: boolean;
}

export interface TableMetadata {
    columns: TableColumn[];
    rowCount?: number;
}

export interface QueryResult {
    columns?: string[];
    fields?: { name: string; type: string }[];
    rows: Record<string, any>[];
    rowCount?: number; // Added to support row count in UI
    durationMs?: number;
}
