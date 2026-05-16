import type {
  IDatabaseStrategy,
  TreeNodeResult,
  ColumnInfo,
  QueryResult,
  Relationship,
  DatabaseMetrics,
  UpdateRowParams,
  InsertRowParams,
  DeleteRowsParams,
  ConnectionConfig,
  FullTableMetadata,
} from './database-strategy.interface';
import { SchemaOperation } from '../query/dto/schema-operations.types';
import { Injectable, Logger } from '@nestjs/common';
import * as mssql from 'mssql';
import { SqlUtil } from '../utils/sql.util';

@Injectable()
export class MssqlStrategy implements IDatabaseStrategy {
  private readonly logger = new Logger(MssqlStrategy.name);

  async createPool(
    connectionConfig: ConnectionConfig,
    databaseOverride?: string,
  ): Promise<mssql.ConnectionPool> {
    const host = connectionConfig.host?.trim();
    if (!host) {
      throw new Error('Host is required for SQL Server connections.');
    }

    // Migration override: connectionConfig.statementTimeout/queryTimeout will be 0
    const reqTimeout = connectionConfig.statementTimeout ?? 30000;

    const config: mssql.config = {
      server: host,
      port: connectionConfig.port || 1433,
      user: connectionConfig.username,
      password: connectionConfig.password || undefined,
      database: databaseOverride || connectionConfig.database,
      requestTimeout: reqTimeout, // Overridable timeout
      options: {
        encrypt: false,
        trustServerCertificate: true,
      },
      pool: {
        max: 20,
        min: 0,
        idleTimeoutMillis: 30000,
      },
    };
    return await new mssql.ConnectionPool(config).connect();
  }

  async closePool(pool: mssql.ConnectionPool): Promise<void> {
    await pool.close();
  }

  // ─── Identifier Quoting ───

  quoteIdentifier(name: string): string {
    return `[${name}]`;
  }

  quoteTable(schema: string | undefined, table: string): string {
    return schema ? `[${schema}].[${table}]` : `[${table}]`;
  }

  // ─── Query Operations ───

  async executeQuery(
    pool: mssql.ConnectionPool,
    sql: string,
    options?: { limit?: number; offset?: number },
  ): Promise<QueryResult> {
    let safeSql = sql;
    if (options?.limit !== undefined && options?.offset !== undefined) {
      safeSql = SqlUtil.injectPagination(
        sql,
        options.limit,
        options.offset,
        'mssql',
      );
    } else {
      safeSql = SqlUtil.injectTop(sql, 50000);
    }

    const result = await pool.request().query(safeSql);
    return {
      rows: result.recordset ? result.recordset.slice(0, 50000) : [],
      columns: result.recordset?.columns
        ? Object.keys(result.recordset.columns)
        : [],
      rowCount: result.rowsAffected?.[0] ?? 0,
    };
  }

  async updateRow(
    pool: mssql.ConnectionPool,
    params: UpdateRowParams,
  ): Promise<{ success: boolean; rowCount: number }> {
    const { schema, table, pkColumn, pkValue, updates } = params;
    const updateCols = Object.keys(updates);
    const quotedTable = this.quoteTable(schema, table);
    const setClause = updateCols
      .map((col, i) => `[${col}] = @p${i}`)
      .join(', ');
    const sql = `UPDATE ${quotedTable} SET ${setClause} WHERE [${pkColumn}] = @pk`;

    const request = pool.request();
    updateCols.forEach((col, i) => request.input(`p${i}`, updates[col]));
    request.input('pk', pkValue);

    const result = await request.query(sql);
    return { success: true, rowCount: result.rowsAffected?.[0] ?? 0 };
  }

  async insertRow(
    pool: mssql.ConnectionPool,
    params: InsertRowParams,
  ): Promise<{ success: boolean; rowCount: number }> {
    const { schema, table, data } = params;
    const columns = Object.keys(data);
    if (columns.length === 0) return { success: false, rowCount: 0 };

    const quotedTable = this.quoteTable(schema, table);
    const colNames = columns.map((c) => `[${c}]`).join(', ');
    const placeholders = columns.map((_, i) => `@p${i}`).join(', ');
    const sql = `INSERT INTO ${quotedTable} (${colNames}) VALUES (${placeholders})`;

    const request = pool.request();
    columns.forEach((col, i) => request.input(`p${i}`, data[col]));

    const result = await request.query(sql);
    return { success: true, rowCount: result.rowsAffected?.[0] ?? 0 };
  }

  async deleteRows(
    pool: mssql.ConnectionPool,
    params: DeleteRowsParams,
  ): Promise<{ success: boolean; rowCount: number }> {
    const { schema, table, pkColumn, pkValues } = params;
    if (pkValues.length === 0) return { success: true, rowCount: 0 };

    const quotedTable = this.quoteTable(schema, table);
    const placeholders = pkValues.map((_, i) => `@pk${i}`).join(', ');
    const sql = `DELETE FROM ${quotedTable} WHERE [${pkColumn}] IN (${placeholders})`;

    const request = pool.request();
    pkValues.forEach((v, i) => request.input(`pk${i}`, v));

    const result = await request.query(sql);
    return { success: true, rowCount: result.rowsAffected?.[0] ?? 0 };
  }

  async importData(
    pool: mssql.ConnectionPool,
    params: { schema: string; table: string; data: Record<string, unknown>[] },
  ): Promise<{ success: boolean; rowCount: number }> {
    const { schema, table, data } = params;
    if (!data || data.length === 0) return { success: true, rowCount: 0 };

    let totalAffected = 0;
    // For MSSQL, we'll use a simple loop for now.
    // For production, we'd use a Table-Valued Parameter or Bulk Copy (bcp).
    for (const row of data) {
      const res = await this.insertRow(pool, { schema, table, data: row });
      if (res.success) totalAffected += res.rowCount;
    }

    return { success: true, rowCount: totalAffected };
  }

  async exportStream(
    pool: mssql.ConnectionPool,
    schema: string,
    table: string,
  ): Promise<unknown> {
    const quotedTable = this.quoteTable(schema, table);
    const sql = `SELECT * FROM ${quotedTable}`;

    const request = pool.request();
    request.stream = true;

    // Wrap the mssql event emitter in a standard Node Readable stream for consistency
    const { PassThrough } = await import('stream');
    const pt = new PassThrough({ objectMode: true });

    request.on('row', (row: Record<string, unknown>) => pt.write(row));
    request.on('done', () => pt.end());
    request.on('error', (err: unknown) =>
      pt.destroy(err instanceof Error ? err : new Error(String(err))),
    );

    // Start the query
    request.query(sql);

    return pt;
  }

  buildAlterTableSql(quotedTable: string, op: SchemaOperation): string {
    switch (op.type) {
      case 'add_column':
        return `ALTER TABLE ${quotedTable} ADD [${op.name}] ${op.dataType} ${op.isNullable === false ? 'NOT NULL' : ''}`;
      case 'drop_column':
        return `ALTER TABLE ${quotedTable} DROP COLUMN [${op.name}]`;
      case 'alter_column_type':
        return `ALTER TABLE ${quotedTable} ALTER COLUMN [${op.name}] ${op.newType}`;
      case 'rename_column':
        // MSSQL uses sp_rename for column renames
        return `EXEC sp_rename '${quotedTable}.${op.name}', '${op.newName}', 'COLUMN'`;
      case 'add_pk': {
        const cols = op.columns.map((c: string) => `[${c}]`).join(', ');
        return `ALTER TABLE ${quotedTable} ADD PRIMARY KEY (${cols})`;
      }
      case 'drop_pk':
        return op.constraintName
          ? `ALTER TABLE ${quotedTable} DROP CONSTRAINT [${op.constraintName}]`
          : `ALTER TABLE ${quotedTable} DROP PRIMARY KEY`;
      case 'add_fk': {
        const fkCols = op.columns.map((c: string) => `[${c}]`).join(', ');
        const refCols = op.refColumns.map((c: string) => `[${c}]`).join(', ');
        return `ALTER TABLE ${quotedTable} ADD CONSTRAINT ${op.name} FOREIGN KEY (${fkCols}) REFERENCES [${op.refTable}] (${refCols})`;
      }
      case 'drop_fk':
        return `ALTER TABLE ${quotedTable} DROP CONSTRAINT [${op.name}]`;
      default:
        return '';
    }
  }

  // ─── DDL Operations ───

  async createDatabase(
    pool: mssql.ConnectionPool,
    name: string,
  ): Promise<void> {
    await pool.request().query(`CREATE DATABASE [${name}]`);
  }

  async dropDatabase(pool: mssql.ConnectionPool, name: string): Promise<void> {
    await pool
      .request()
      .query(
        `ALTER DATABASE [${name}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE`,
      );
    await pool.request().query(`DROP DATABASE [${name}]`);
  }

  // ─── Metadata Operations ───

  async getDatabases(pool: mssql.ConnectionPool): Promise<TreeNodeResult[]> {
    const result = await pool
      .request()
      .query(
        `SELECT name FROM sys.databases WHERE name NOT IN ('master','tempdb','model','msdb') ORDER BY name`,
      );
    return result.recordset.map((row: { name: string }) => ({
      id: `db:${row.name}`,
      name: row.name,
      type: 'database',
      parentId: 'root',
      hasChildren: true,
    }));
  }

  async getSchemas(
    pool: mssql.ConnectionPool,
    dbName?: string,
  ): Promise<TreeNodeResult[]> {
    const result = await pool
      .request()
      .query(
        `SELECT name FROM sys.schemas WHERE name NOT IN ('sys','INFORMATION_SCHEMA','guest','db_owner','db_accessadmin','db_securityadmin','db_ddladmin','db_backupoperator','db_datareader','db_datawriter','db_denydatareader','db_denydatawriter') ORDER BY name`,
      );
    return result.recordset.map((row: { name: string }) => ({
      id: dbName ? `db:${dbName}.schema:${row.name}` : `schema:${row.name}`,
      name: row.name,
      type: 'schema',
      parentId: dbName ? `db:${dbName}` : 'root',
      hasChildren: true,
    }));
  }

  async getTables(
    pool: mssql.ConnectionPool,
    schema: string,
    dbName?: string,
  ): Promise<TreeNodeResult[]> {
    const result = await pool
      .request()
      .input('schema', mssql.NVarChar, schema)
      .query(
        `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = @schema AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME`,
      );
    return result.recordset.map((row: { TABLE_NAME: string }) => ({
      id: dbName
        ? `db:${dbName}.schema:${schema}.table:${row.TABLE_NAME}`
        : `schema:${schema}.table:${row.TABLE_NAME}`,
      name: row.TABLE_NAME,
      type: 'table',
      parentId: dbName
        ? `db:${dbName}.schema:${schema}.folder:tables`
        : `schema:${schema}.folder:tables`,
      hasChildren: true,
    }));
  }

  async getViews(
    pool: mssql.ConnectionPool,
    schema: string,
    dbName?: string,
  ): Promise<TreeNodeResult[]> {
    const result = await pool
      .request()
      .input('schema', mssql.NVarChar, schema)
      .query(
        `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_SCHEMA = @schema ORDER BY TABLE_NAME`,
      );
    return result.recordset.map((row: { TABLE_NAME: string }) => ({
      id: dbName
        ? `db:${dbName}.schema:${schema}.view:${row.TABLE_NAME}`
        : `schema:${schema}.view:${row.TABLE_NAME}`,
      name: row.TABLE_NAME,
      type: 'view',
      parentId: dbName
        ? `db:${dbName}.schema:${schema}.folder:views`
        : `schema:${schema}.folder:views`,
      hasChildren: true,
    }));
  }

  async getFunctions(
    pool: mssql.ConnectionPool,
    schema: string,
    dbName?: string,
  ): Promise<TreeNodeResult[]> {
    const result = await pool
      .request()
      .input('schema', mssql.NVarChar, schema)
      .query(
        `SELECT name, type_desc FROM sys.objects WHERE schema_id = SCHEMA_ID(@schema) AND type IN ('FN','IF','TF','P') ORDER BY name`,
      );
    return result.recordset.map((row: { name: string }) => ({
      id: dbName
        ? `db:${dbName}.schema:${schema}.func:${row.name}`
        : `schema:${schema}.func:${row.name}`,
      name: row.name,
      type: 'function',
      parentId: dbName
        ? `db:${dbName}.schema:${schema}.folder:functions`
        : `schema:${schema}.folder:functions`,
      hasChildren: false,
    }));
  }

  async getFunctionParameters(
    _pool: mssql.ConnectionPool,
    _schema: string,
    _func: string,
  ): Promise<ColumnInfo[]> {
    return [];
  }

  async getColumns(
    pool: mssql.ConnectionPool,
    schema: string,
    table: string,
  ): Promise<ColumnInfo[]> {
    const sql = `
            SELECT 
                c.COLUMN_NAME, c.DATA_TYPE, c.IS_NULLABLE, c.COLUMN_DEFAULT,
                kc.name as pk_constraint_name
            FROM INFORMATION_SCHEMA.COLUMNS c
            LEFT JOIN sys.tables t ON t.name = c.TABLE_NAME AND SCHEMA_NAME(t.schema_id) = c.TABLE_SCHEMA
            LEFT JOIN sys.indexes i ON i.object_id = t.object_id AND i.is_primary_key = 1
            LEFT JOIN sys.index_columns ic ON ic.object_id = t.object_id AND ic.index_id = i.index_id
            LEFT JOIN sys.columns sc ON sc.object_id = t.object_id AND sc.column_id = ic.column_id AND sc.name = c.COLUMN_NAME
            LEFT JOIN sys.key_constraints kc ON kc.parent_object_id = t.object_id AND kc.unique_index_id = i.index_id AND kc.type = 'PK'
            WHERE c.TABLE_NAME = @table AND c.TABLE_SCHEMA = @schema
            ORDER BY c.ORDINAL_POSITION
        `;
    const result = await pool
      .request()
      .input('table', mssql.NVarChar, table)
      .input('schema', mssql.NVarChar, schema)
      .query(sql);
    return result.recordset.map(
      (row: {
        COLUMN_NAME: string;
        DATA_TYPE: string;
        IS_NULLABLE: string;
        COLUMN_DEFAULT: unknown;
        pk_constraint_name: string | null;
      }) => ({
        name: row.COLUMN_NAME,
        type: row.DATA_TYPE,
        isNullable: row.IS_NULLABLE === 'YES',
        defaultValue: row.COLUMN_DEFAULT,
        isPrimaryKey: !!row.pk_constraint_name,
        pkConstraintName: row.pk_constraint_name,
      }),
    );
  }

  async getIndexes(
    pool: mssql.ConnectionPool,
    schema: string,
    table: string,
    dbName?: string,
  ): Promise<TreeNodeResult[]> {
    const sql = `
            SELECT i.name, i.is_unique, i.is_primary_key
            FROM sys.indexes i
            JOIN sys.tables t ON i.object_id = t.object_id
            JOIN sys.schemas s ON t.schema_id = s.schema_id
            WHERE t.name = @table AND s.name = @schema
            AND i.name IS NOT NULL
        `;
    const result = await pool
      .request()
      .input('table', mssql.NVarChar, table)
      .input('schema', mssql.NVarChar, schema)
      .query(sql);

    const parentId = dbName
      ? `db:${dbName}.schema:${schema}.table:${table}.folder:indexes`
      : `schema:${schema}.table:${table}.folder:indexes`;
    return result.recordset.map((row: any) => ({
      id: `${parentId}.index:${row.name}`,
      name: row.name,
      type: 'index',
      parentId,
      hasChildren: false,
      metadata: { unique: row.is_unique, isPrimary: row.is_primary_key },
    }));
  }

  async getTriggers(
    pool: mssql.ConnectionPool,
    schema: string,
    table: string,
    dbName?: string,
  ): Promise<TreeNodeResult[]> {
    const sql = `
            SELECT tr.name
            FROM sys.triggers tr
            JOIN sys.tables t ON tr.parent_id = t.object_id
            JOIN sys.schemas s ON t.schema_id = s.schema_id
            WHERE t.name = @table AND s.name = @schema
        `;
    const result = await pool
      .request()
      .input('table', mssql.NVarChar, table)
      .input('schema', mssql.NVarChar, schema)
      .query(sql);

    const parentId = dbName
      ? `db:${dbName}.schema:${schema}.table:${table}.folder:triggers`
      : `schema:${schema}.table:${table}.folder:triggers`;
    return result.recordset.map((row: any) => ({
      id: `${parentId}.trigger:${row.name}`,
      name: row.name,
      type: 'trigger',
      parentId,
      hasChildren: false,
    }));
  }

  async getConstraints(
    pool: mssql.ConnectionPool,
    schema: string,
    table: string,
    dbName?: string,
  ): Promise<TreeNodeResult[]> {
    const sql = `
            SELECT name, 'CHECK' as type, definition FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID(@quotedTable)
            UNION
            SELECT name, 'FOREIGN KEY' as type, '' as definition FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(@quotedTable)
        `;
    const quotedTable = this.quoteTable(schema, table);
    const result = await pool
      .request()
      .input('quotedTable', mssql.NVarChar, quotedTable)
      .query(sql);

    const parentId = dbName
      ? `db:${dbName}.schema:${schema}.table:${table}.folder:constraints`
      : `schema:${schema}.table:${table}.folder:constraints`;
    return result.recordset.map((row: any) => ({
      id: `${parentId}.constraint:${row.name}`,
      name: `${row.name} (${row.type}) ${row.definition || ''}`,
      type: 'constraint',
      parentId,
      hasChildren: false,
    }));
  }

  async getFullMetadata(
    pool: mssql.ConnectionPool,
    schema: string,
    table: string,
  ): Promise<FullTableMetadata> {
    const columns = await this.getColumns(pool, schema, table);
    return {
      columns,
      indices: [],
      comment: null,
      rowCount: 0,
    };
  }

  async getRelationships(pool: mssql.ConnectionPool): Promise<Relationship[]> {
    const sql = `
            SELECT 
                fk.name AS constraint_name,
                tp.name AS source_table,
                cp.name AS source_column,
                tr.name AS target_table,
                cr.name AS target_column
            FROM sys.foreign_keys fk
            JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
            JOIN sys.tables tp ON fkc.parent_object_id = tp.object_id
            JOIN sys.columns cp ON fkc.parent_object_id = cp.object_id AND fkc.parent_column_id = cp.column_id
            JOIN sys.tables tr ON fkc.referenced_object_id = tr.object_id
            JOIN sys.columns cr ON fkc.referenced_object_id = cr.object_id AND fkc.referenced_column_id = cr.column_id
        `;
    const result = await pool.request().query(sql);
    return result.recordset as Relationship[];
  }

  async getDatabaseMetrics(
    pool: mssql.ConnectionPool,
  ): Promise<DatabaseMetrics> {
    const statsSql = `
            SELECT 
                (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE') as table_count,
                (SELECT SUM(size) * 8 * 1024 FROM sys.database_files) as size_bytes,
                (SELECT COUNT(*) FROM sys.dm_exec_sessions WHERE database_id = DB_ID()) as active_connections
        `;
    const tablesSql = `
            SELECT TOP 5 t.name, SUM(a.total_pages) * 8 * 1024 as size_bytes
            FROM sys.tables t
            JOIN sys.indexes i ON t.object_id = i.object_id
            JOIN sys.partitions p ON i.object_id = p.object_id AND i.index_id = p.index_id
            JOIN sys.allocation_units a ON p.partition_id = a.container_id
            GROUP BY t.name ORDER BY SUM(a.total_pages) DESC
        `;
    const typesSql = `
            SELECT TABLE_TYPE as type, COUNT(*) as count
            FROM INFORMATION_SCHEMA.TABLES GROUP BY TABLE_TYPE
        `;

    const [statsRes, tablesRes, typesRes] = await Promise.all([
      pool.request().query(statsSql),
      pool.request().query(tablesSql),
      pool.request().query(typesSql),
    ]);

    const stats = statsRes.recordset[0] as {
      table_count: string;
      size_bytes: string;
      active_connections: string;
    };
    return {
      tableCount: parseInt(stats.table_count),
      sizeBytes: parseInt(stats.size_bytes) || 0,
      activeConnections: parseInt(stats.active_connections),
      topTables: tablesRes.recordset.map(
        (r: { name: string; size_bytes: string }) => ({
          name: r.name,
          sizeBytes: parseInt(r.size_bytes),
        }),
      ),
      tableTypes: typesRes.recordset.map(
        (r: { type: string; count: string }) => ({
          type: r.type,
          count: parseInt(r.count),
        }),
      ),
    };
  }

  // ─── Polymorphic Tree & Seed ───

  async getHierarchyNodes(
    pool: mssql.ConnectionPool,
    parentId: string | null,
    parsedParams: unknown,
    connectionInfo: unknown,
  ): Promise<TreeNodeResult[]> {
    if (!parentId) {
      if ((connectionInfo as { showAllDatabases?: boolean }).showAllDatabases)
        return this.getDatabases(pool);
      return this.getSchemas(pool);
    }
    return [];
  }

  async seedData(pool: mssql.ConnectionPool): Promise<QueryResult> {
    const sql = `
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='users' AND xtype='U')
            CREATE TABLE users (
                id INT IDENTITY(1,1) PRIMARY KEY,
                name NVARCHAR(100),
                email NVARCHAR(100) UNIQUE,
                created_at DATETIME DEFAULT GETDATE()
            );
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='products' AND xtype='U')
            CREATE TABLE products (
                id INT IDENTITY(1,1) PRIMARY KEY,
                name NVARCHAR(100),
                price DECIMAL(10, 2),
                stock INT
            );
        `;
    return this.executeQuery(pool, sql);
  }
}
