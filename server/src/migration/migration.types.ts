/**
 * Shared types for the Migration module.
 * Extracted from migration.service.ts for SRP and reusability.
 */

export type ConnectionType =
  | 'postgres'
  | 'mysql'
  | 'mssql'
  | 'sqlite'
  | 'clickhouse'
  | 'mock'
  | 'mongodb'
  | 'mongodb+srv';

export interface MigrationConnection {
  id: string;
  name: string;
  type: ConnectionType;
  host?: string | null;
  port?: number | null;
  username?: string | null;
  password?: string;
  database?: string | null;
}

export type MigrationStage =
  | 'queued'
  | 'validating'
  | 'connecting'
  | 'preflight'
  | 'streaming'
  | 'completed'
  | 'failed';

export interface MigrationJob {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  stage: MigrationStage;
  processedRows: number;
  batchesProcessed: number;
  error?: string;
}

export interface StoredMigrationJob extends MigrationJob {
  ownerId: string;
}

export interface MigrationProgress {
  processedRows: number;
  batchesProcessed: number;
  stage: MigrationStage;
}

export interface MigrationStream extends AsyncIterable<
  Record<string, unknown>
> {
  on(
    event: 'data' | 'row' | 'end' | 'error' | 'close',
    listener: (...args: unknown[]) => void,
  ): this;
  pause(): void;
  resume(): void;
  emit(event: string, ...args: unknown[]): boolean;
}

export interface ResolvedMigrationContext {
  sourceConn: MigrationConnection;
  targetConn: MigrationConnection;
  sourceStrategy: import('../database-strategies').IDatabaseStrategy;
  targetStrategy: import('../database-strategies').IDatabaseStrategy;
  sourcePool: unknown;
  targetPool: unknown;
  sourceMetadata: import('../database-strategies').FullTableMetadata;
  targetMetadata: import('../database-strategies').FullTableMetadata;
}

export interface MigrationColumnDiff {
  name: string;
  status: 'added' | 'removed' | 'changed' | 'unchanged';
  changes: string[];
  source: import('../database-strategies').ColumnInfo | null;
  target: import('../database-strategies').ColumnInfo | null;
}

export interface MigrationIndexDiff {
  name: string;
  status: 'added' | 'removed' | 'changed' | 'unchanged';
  changes: string[];
  source: import('../database-strategies').IndexInfo | null;
  target: import('../database-strategies').IndexInfo | null;
}

export interface MigrationReviewSummary {
  canProceed: boolean;
  blockers: string[];
  warnings: string[];
  rollbackCaveats: string[];
  estimatedImpact: {
    addedColumns: number;
    removedColumns: number;
    changedColumns: number;
    addedIndices: number;
    removedIndices: number;
    changedIndices: number;
  };
  source: {
    connectionId: string;
    connectionName: string;
    schema: string;
    table: string;
    rowCount: number | null;
    columnCount: number;
    indexCount: number;
  };
  target: {
    connectionId: string;
    connectionName: string;
    schema: string;
    table: string;
    rowCount: number | null;
    columnCount: number;
    indexCount: number;
  };
  columnDiffs: MigrationColumnDiff[];
  indexDiffs: MigrationIndexDiff[];
}
