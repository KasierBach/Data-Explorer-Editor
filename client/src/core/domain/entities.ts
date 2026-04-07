export type ConnectionType = 'postgres' | 'mysql' | 'mssql' | 'mongodb' | 'mongodb+srv' | 'redis';

export interface Connection {
    id: string;
    name: string;
    type: ConnectionType;
    host?: string;
    port?: number;
    username?: string;
    database?: string; // Default DB
    readOnly?: boolean;
    allowSchemaChanges?: boolean;
    allowImportExport?: boolean;
    allowQueryExecution?: boolean;
    lastHealthCheckAt?: string;
    lastHealthStatus?: 'healthy' | 'error';
    lastHealthError?: string | null;
    lastConnectedAt?: string;
    lastConnectionLatencyMs?: number | null;
}

export interface TreeNode {
    id: string;
    parentId: string | null;
    name: string;
    type: 'connection' | 'database' | 'schema' | 'table' | 'view' | 'function' | 'column' | 'folder' | 'collection';
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
    comment?: string | null;
}

export interface TableMetadata {
    columns: TableColumn[];
    rowCount?: number;
    comment?: string | null;
    indices?: { name: string; columns: string[]; isUnique: boolean; isPrimary: boolean }[];
}

export interface QueryResult {
    columns?: string[];
    fields?: { name: string; type: string }[];
    rows: Record<string, any>[];
    rowCount?: number; // Added to support row count in UI
    totalCount?: number; // Total rows in table for pagination
    durationMs?: number;
}

export interface DashboardWidget {
    id: string;
    title: string;
    chartType: string;
    queryText?: string | null;
    connectionId?: string | null;
    database?: string | null;
    columns: string[];
    xAxis?: string | null;
    yAxis: string[];
    orderIndex: number;
    config?: Record<string, any> | null;
    dataSnapshot: Record<string, any>[];
    createdAt: string;
    updatedAt: string;
}

export interface DashboardEntity {
    id: string;
    name: string;
    description?: string | null;
    visibility: 'private' | 'team' | 'workspace';
    connectionId?: string | null;
    database?: string | null;
    createdAt: string;
    updatedAt: string;
    owner: {
        id: string;
        email: string;
        firstName?: string | null;
        lastName?: string | null;
    };
    isOwner: boolean;
    widgets: DashboardWidget[];
}

export interface ErdWorkspaceEntity {
    id: string;
    name: string;
    notes?: string | null;
    connectionId?: string | null;
    database?: string | null;
    layout: Record<string, any>;
    createdAt: string;
    updatedAt: string;
    owner: {
        id: string;
        email: string;
        firstName?: string | null;
        lastName?: string | null;
    };
    isOwner: boolean;
}
