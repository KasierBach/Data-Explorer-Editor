export class Connection {
  id: string;
  name: string;
  type:
    | 'postgres'
    | 'mysql'
    | 'mssql'
    | 'sqlite'
    | 'clickhouse'
    | 'mock'
    | 'mongodb'
    | 'mongodb+srv';
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database?: string;
  showAllDatabases: boolean;
  readOnly: boolean;
  allowSchemaChanges: boolean;
  allowImportExport: boolean;
  allowQueryExecution: boolean;
  lastHealthCheckAt?: Date;
  lastHealthStatus?: 'healthy' | 'error';
  lastHealthError?: string | null;
  lastConnectedAt?: Date;
  lastConnectionLatencyMs?: number | null;
  createdAt: Date;
  organizationId?: string | null;
}
