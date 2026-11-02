export class Connection {
  id: string;
  userId: string;
  name: string;
  type:
    | 'postgres'
    | 'cockroach'
    | 'mysql'
    | 'mariadb'
    | 'mssql'
    | 'sqlite'
    | 'clickhouse'
    | 'mock'
    | 'mongodb'
    | 'mongodb+srv'
    | 'redis';
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database?: string;
  tls: boolean;
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
  allowedDatabases?: unknown;
  roleQueryModes?: unknown;
  sshHost?: string | null;
  sshPort?: number;
  sshUsername?: string | null;
  sshPrivateKey?: string | null;
  sshPassphrase?: string | null;
  environment?: 'development' | 'staging' | 'production' | 'none' | null;
}
