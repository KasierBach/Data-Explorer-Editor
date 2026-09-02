import type {
  IDatabaseStrategy,
  TreeNodeResult,
  ColumnInfo,
  QueryResult,
  Relationship,
  DatabaseMetrics,
  UpdateRowParams,
  DeleteRowsParams,
  ConnectionConfig,
  InsertRowParams,
  FullTableMetadata,
} from './database-strategy.interface';
import { SchemaOperation } from '../query/dto/schema-operations.types';
import { Injectable, Logger } from '@nestjs/common';
import * as mysql from 'mysql2/promise';
import { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { SqlUtil } from '../utils/sql.util';
import {
  allowInsecureDatabaseTls,
  isLocalDatabaseHost,
} from '../common/utils/database-network.util';

@Injectable()
export class MysqlStrategy implements IDatabaseStrategy {
  private readonly logger = new Logger(MysqlStrategy.name);

  createPool(
    connectionConfig: ConnectionConfig,
    databaseOverride?: string,
  ): Pool {
    const host = connectionConfig.host?.trim();
    if (!host) {
      throw new Error('Host is required for MySQL connections.');
    }

    const timeoutMs =
      connectionConfig.statementTimeout !== undefined
        ? connectionConfig.statementTimeout
        : 10000;
    const isLocalhost = isLocalDatabaseHost(host);

    const pool = mysql.createPool({
      host,
      port: connectionConfig.port || 3306,
      user: connectionConfig.username || undefined,
      password: connectionConfig.password || undefined,
      database: databaseOverride || connectionConfig.database || undefined,
      waitForConnections: true,
      connectionLimit: 20,
      queueLimit: 0,
      multipleStatements: false,
      connectTimeout: timeoutMs,
      ssl: isLocalhost
        ? undefined
        : connectionConfig.tls === false
          ? undefined
          : { rejectUnauthorized: !allowInsecureDatabaseTls() },
    });
    // Carry the configured statement timeout so executeQuery can apply it as
    // the per-query timeout (mysql2 pools have no query-timeout config option).
    (pool as Pool & { __statementTimeout?: number }).__statementTimeout =
      timeoutMs;
    return pool;
  }

  async closePool(pool: Pool): Promise<void> {
    await pool.end();
  }

  quoteIdentifier(name: string): string {
    return `\`${name.replace(/`/g, '``')}\``;
  }

  quoteTable(schema: string | undefined, table: string): string {
    return schema
      ? `${this.quoteIdentifier(schema)}.${this.quoteIdentifier(table)}`
      : this.quoteIdentifier(table);
  }

  async executeQuery(
    pool: Pool,
    sql: string,
    options?: { limit?: number; offset?: number },
  ): Promise<QueryResult> {
    let safeSql = sql;
    if (options?.limit !== undefined) {
      if (options?.offset !== undefined) {
        safeSql = SqlUtil.injectPagination(
          sql,
          options.limit,
          options.offset,
          'mysql',
        );
      } else {
        safeSql = SqlUtil.injectLimit(sql, options.limit);
      }
    } else {
      safeSql = SqlUtil.injectLimit(sql, 50000);
    }

    const queryTimeout =
      (pool as Pool & { __statementTimeout?: number }).__statementTimeout ??
      30000;
    const [result, fields] = await pool.query({
      sql: safeSql,
      timeout: queryTimeout,
    });

    const rows: Record<string, unknown>[] = Array.isArray(result)
      ? (result as RowDataPacket[]).map((r) => r as Record<string, unknown>)
      : [];
    const actualFields = Array.isArray(fields) ? fields : [];

    return {
      rows: rows.slice(0, 50000),
      columns: actualFields.map((f) => f.name),
      rowCount:
        !Array.isArray(result) &&
        (result as ResultSetHeader).affectedRows !== undefined
          ? (result as ResultSetHeader).affectedRows
          : undefined,
    };
  }

  async cancelActiveQuery(execution: unknown): Promise<boolean> {
    // MySQL: kill the query running on the given connection thread.
    const connection = execution as {
      threadId?: number;
      query?: (opts: { sql: string }) => Promise<unknown>;
    } | null;
    if (
      !connection ||
      typeof connection.threadId !== 'number' ||
      typeof connection.query !== 'function'
    ) {
      return false;
    }
    await connection.query({
      sql: `KILL QUERY ${connection.threadId}`,
    });
    return true;
  }

  async runStatementsInTransaction(
    pool: Pool,
    statements: string[],
    options?: { limit?: number; offset?: number },
  ): Promise<QueryResult> {
    const queryTimeout =
      (pool as Pool & { __statementTimeout?: number }).__statementTimeout ??
      30000;
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      let result: QueryResult = {
        rows: [],
        columns: [],
        countStatus: 'skipped',
      };
      for (const statement of statements) {
        const isLast = statement === statements[statements.length - 1];
        let safeSql = statement;
        if (isLast && options?.limit !== undefined) {
          safeSql =
            options.offset !== undefined
              ? SqlUtil.injectPagination(
                  statement,
                  options.limit,
                  options.offset,
                  'mysql',
                )
              : SqlUtil.injectLimit(statement, options.limit);
        }
        const [rows, fields] = await connection.query({
          sql: safeSql,
          timeout: queryTimeout,
        });
        if (isLast) {
          const rowList: Record<string, unknown>[] = Array.isArray(rows)
            ? (rows as RowDataPacket[]).map((r) => r as Record<string, unknown>)
            : [];
          const actualFields = Array.isArray(fields) ? fields : [];
          result = {
            rows: rowList.slice(0, 50000),
            columns: actualFields.map((f) => f.name),
            rowCount:
              !Array.isArray(rows) &&
              (rows as ResultSetHeader).affectedRows !== undefined
                ? (rows as ResultSetHeader).affectedRows
                : undefined,
          };
        }
      }
      await connection.commit();
      return result;
    } catch (error) {
      try {
        await connection.rollback();
      } catch {
        // Connection will be discarded by the pool on release if broken.
      }
      throw error;
    } finally {
      connection.release();
    }
  }

  async updateRow(
    pool: Pool,
    params: UpdateRowParams,
  ): Promise<{ success: boolean; rowCount: number }> {
    const { schema, table, pkColumn, pkValue, updates } = params;
    const updateCols = Object.keys(updates);
    if (updateCols.length === 0) {
      return { success: false, rowCount: 0 };
    }
    const setClause = updateCols
      .map((col) => `${this.quoteIdentifier(col)} = ?`)
      .join(', ');
    const sql = `UPDATE ${this.quoteTable(schema, table)} SET ${setClause} WHERE ${this.quoteIdentifier(pkColumn)} = ?`;
    const values = [...updateCols.map((c) => updates[c]), pkValue];

    const [result] = await pool.execute<ResultSetHeader>(
      sql,
      values as never[],
    );
    return { success: true, rowCount: result.affectedRows };
  }

  async insertRow(
    pool: Pool,
    params: InsertRowParams,
  ): Promise<{ success: boolean; rowCount: number }> {
    const { schema, table, data } = params;
    const columns = Object.keys(data);
    if (columns.length === 0) return { success: false, rowCount: 0 };

    const quotedTable = this.quoteTable(schema, table);
    const colNames = columns.map((c) => this.quoteIdentifier(c)).join(', ');
    const placeholders = columns.map(() => `?`).join(', ');
    const sql = `INSERT INTO ${quotedTable} (${colNames}) VALUES (${placeholders})`;
    const values = columns.map((c) => data[c]);

    const [result] = await pool.execute<ResultSetHeader>(
      sql,
      values as never[],
    );
    return { success: true, rowCount: result.affectedRows };
  }

  async deleteRows(
    pool: Pool,
    params: DeleteRowsParams,
  ): Promise<{ success: boolean; rowCount: number }> {
    const { schema, table, pkColumn, pkValues } = params;
    if (pkValues.length === 0) return { success: true, rowCount: 0 };

    const quotedTable = this.quoteTable(schema, table);
    const placeholders = pkValues.map(() => `?`).join(', ');
    const sql = `DELETE FROM ${quotedTable} WHERE ${this.quoteIdentifier(pkColumn)} IN (${placeholders})`;

    const [result] = await pool.execute<ResultSetHeader>(
      sql,
      pkValues as never[],
    );
    return { success: true, rowCount: result.affectedRows };
  }

  async importData(
    pool: Pool,
    params: { schema: string; table: string; data: Record<string, unknown>[] },
  ): Promise<{ success: boolean; rowCount: number }> {
    const { schema, table, data } = params;
    if (!data || data.length === 0) return { success: true, rowCount: 0 };

    const columns = Object.keys(data[0]);
    const quotedTable = this.quoteTable(schema, table);
    const colNames = columns.map((c) => this.quoteIdentifier(c)).join(', ');

    const valuePlaceholders: string[] = [];
    const flatValues: unknown[] = [];

    data.forEach((row) => {
      const rowPlaceholders = columns.map((col) => {
        flatValues.push(row[col]);
        return `?`;
      });
      valuePlaceholders.push(`(${rowPlaceholders.join(', ')})`);
    });

    const sql = `INSERT INTO ${quotedTable} (${colNames}) VALUES ${valuePlaceholders.join(', ')}`;

    const [result] = await pool.execute<ResultSetHeader>(
      sql,
      flatValues as never[],
    );
    return { success: true, rowCount: result.affectedRows };
  }

  async exportStream(
    pool: Pool,
    schema: string,
    table: string,
  ): Promise<unknown> {
    const quotedTable = this.quoteTable(schema, table);
    const sql = `SELECT * FROM ${quotedTable}`;

    // pool is from mysql2/promise. We need the raw connection for streaming
    const connection = await pool.getConnection();
    let released = false;
    const safeRelease = () => {
      if (!released) {
        released = true;
        connection.release();
      }
    };

    try {
      // .connection accesses the underlying non-promise mysql2 connection.
      const stream = (connection as any).connection.query(sql).stream();
      stream.on('end', safeRelease);
      stream.on('error', safeRelease);
      stream.on('close', safeRelease);
      return stream;
    } catch (error) {
      safeRelease();
      throw error;
    }
  }

  buildAlterTableSql(quotedTable: string, op: SchemaOperation): string {
    switch (op.type) {
      case 'add_column':
        return `ALTER TABLE ${quotedTable} ADD COLUMN ${this.quoteIdentifier(op.name)} ${op.dataType} ${op.isNullable === false ? 'NOT NULL' : ''}`;
      case 'drop_column':
        return `ALTER TABLE ${quotedTable} DROP COLUMN ${this.quoteIdentifier(op.name)}`;
      case 'alter_column_type':
        return `ALTER TABLE ${quotedTable} MODIFY COLUMN ${this.quoteIdentifier(op.name)} ${op.newType}`;
      case 'rename_column':
        return `ALTER TABLE ${quotedTable} RENAME COLUMN ${this.quoteIdentifier(op.name)} TO ${this.quoteIdentifier(op.newName)}`;
      case 'add_pk': {
        const cols = op.columns.map((c) => this.quoteIdentifier(c)).join(', ');
        return `ALTER TABLE ${quotedTable} ADD PRIMARY KEY (${cols})`;
      }
      case 'drop_pk':
        return `ALTER TABLE ${quotedTable} DROP PRIMARY KEY`;
      case 'add_fk': {
        const fkCols = op.columns
          .map((c) => this.quoteIdentifier(c))
          .join(', ');
        const refCols = op.refColumns
          .map((c) => this.quoteIdentifier(c))
          .join(', ');
        return `ALTER TABLE ${quotedTable} ADD CONSTRAINT ${this.quoteIdentifier(op.name)} FOREIGN KEY (${fkCols}) REFERENCES ${this.quoteIdentifier(op.refTable)} (${refCols})`;
      }
      case 'drop_fk':
        return `ALTER TABLE ${quotedTable} DROP FOREIGN KEY ${this.quoteIdentifier(op.name)}`;
      default:
        return '';
    }
  }

  async createDatabase(pool: Pool, name: string): Promise<void> {
    await pool.execute(`CREATE DATABASE ${this.quoteIdentifier(name)}`);
  }

  async dropDatabase(pool: Pool, name: string): Promise<void> {
    await pool.execute(`DROP DATABASE ${this.quoteIdentifier(name)}`);
  }

  async getDatabases(pool: Pool): Promise<TreeNodeResult[]> {
    const [rows] = await pool.query('SHOW DATABASES');
    return (rows as Array<{ Database: string }>).map((row) => ({
      id: `schema:${row.Database}`,
      name: row.Database,
      type: 'schema',
      parentId: 'root',
      hasChildren: true,
    }));
  }

  async getSchemas(_pool: Pool, _dbName?: string): Promise<TreeNodeResult[]> {
    // MySQL uses databases as schemas, so this is a no-op
    return [];
  }

  async getTables(
    pool: Pool,
    schema: string,
    dbName?: string,
  ): Promise<TreeNodeResult[]> {
    const sql = `SELECT TABLE_NAME FROM information_schema.tables WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'`;
    const [rows] = await pool.query(sql, [schema]);
    return (rows as Array<{ TABLE_NAME: string }>).map((row) => {
      const tableName = row.TABLE_NAME;
      return {
        id: dbName
          ? `db:${dbName}.schema:${schema}.table:${tableName}`
          : `schema:${schema}.table:${tableName}`,
        name: tableName,
        type: 'table',
        parentId: dbName
          ? `db:${dbName}.schema:${schema}.folder:tables`
          : `schema:${schema}.folder:tables`,
        hasChildren: true,
      };
    });
  }

  async getViews(
    pool: Pool,
    schema: string,
    dbName?: string,
  ): Promise<TreeNodeResult[]> {
    const sql = `SELECT TABLE_NAME FROM information_schema.tables WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'VIEW'`;
    const [rows] = await pool.query(sql, [schema]);
    return (rows as Array<{ TABLE_NAME: string }>).map((row) => ({
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
    pool: Pool,
    schema: string,
    dbName?: string,
  ): Promise<TreeNodeResult[]> {
    const sql = `SELECT routine_name FROM information_schema.routines WHERE routine_schema = ?`;
    const [rows] = await pool.query(sql, [schema]);
    return (rows as Array<{ routine_name: string }>).map((row) => ({
      id: dbName
        ? `db:${dbName}.schema:${schema}.func:${row.routine_name}`
        : `schema:${schema}.func:${row.routine_name}`,
      name: row.routine_name,
      type: 'function',
      parentId: dbName
        ? `db:${dbName}.schema:${schema}.folder:functions`
        : `schema:${schema}.folder:functions`,
      hasChildren: true,
    }));
  }

  async getFunctionParameters(
    pool: Pool,
    schema: string,
    func: string,
  ): Promise<ColumnInfo[]> {
    const sql = `
            SELECT PARAMETER_NAME, DTD_IDENTIFIER, PARAMETER_MODE
            FROM information_schema.parameters
            WHERE SPECIFIC_SCHEMA = ? AND SPECIFIC_NAME = ?
            ORDER BY ORDINAL_POSITION
        `;
    const [rows] = await pool.query(sql, [schema, func]);
    return (
      rows as Array<{
        PARAMETER_NAME: string | null;
        DTD_IDENTIFIER: string | null;
        PARAMETER_MODE: string | null;
      }>
    ).map((row) => ({
      name: row.PARAMETER_NAME || '(unnamed)',
      type: `${row.PARAMETER_MODE || 'IN'} ${row.DTD_IDENTIFIER || ''}`.trim(),
      isNullable: true,
      defaultValue: null,
      isPrimaryKey: false,
      pkConstraintName: null,
    }));
  }

  async getColumns(
    pool: Pool,
    schema: string,
    table: string,
  ): Promise<ColumnInfo[]> {
    const sql = `
            SELECT COLUMN_NAME as Field, COLUMN_TYPE as Type, IS_NULLABLE as \`Null\`, 
                   COLUMN_DEFAULT as \`Default\`, COLUMN_KEY as \`Key\` 
            FROM information_schema.columns 
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
            ORDER BY ORDINAL_POSITION
        `;
    const [rows] = await pool.query(sql, [schema, table]);
    return (
      rows as Array<{
        Field: string;
        Type: string;
        Null: string;
        Default: unknown;
        Key: string;
      }>
    ).map((row) => ({
      name: row.Field,
      type: row.Type,
      isNullable: row.Null === 'YES',
      defaultValue: row.Default,
      isPrimaryKey: row.Key === 'PRI',
      pkConstraintName: row.Key === 'PRI' ? 'PRIMARY' : null,
    }));
  }

  async getIndexes(
    pool: Pool,
    schema: string,
    table: string,
    dbName?: string,
  ): Promise<TreeNodeResult[]> {
    const [rows] = await pool.query(
      `SHOW INDEX FROM ${this.quoteIdentifier(table)} IN ${this.quoteIdentifier(schema)}`,
    );
    const parentId = dbName
      ? `db:${dbName}.schema:${schema}.table:${table}.folder:indexes`
      : `schema:${schema}.table:${table}.folder:indexes`;

    // Group by index name
    const indexes = new Map<string, any>();
    (rows as any[]).forEach((row) => {
      if (!indexes.has(row.Key_name)) {
        indexes.set(row.Key_name, {
          name: row.Key_name,
          unique: row.Non_unique === 0,
        });
      }
    });

    return Array.from(indexes.values()).map((idx) => ({
      id: `${parentId}.index:${idx.name}`,
      name: idx.name,
      type: 'index',
      parentId,
      hasChildren: false,
      metadata: { unique: idx.unique },
    }));
  }

  async getTriggers(
    pool: Pool,
    schema: string,
    table: string,
    dbName?: string,
  ): Promise<TreeNodeResult[]> {
    const [rows] = await pool.query('SHOW TRIGGERS WHERE `Table` = ?', [table]);
    const parentId = dbName
      ? `db:${dbName}.schema:${schema}.table:${table}.folder:triggers`
      : `schema:${schema}.table:${table}.folder:triggers`;

    return (rows as any[]).map((r) => ({
      id: `${parentId}.trigger:${r.Trigger}`,
      name: r.Trigger,
      type: 'trigger',
      parentId,
      hasChildren: false,
      metadata: { event: r.Event, timing: r.Timing },
    }));
  }

  async getConstraints(
    pool: Pool,
    schema: string,
    table: string,
    dbName?: string,
  ): Promise<TreeNodeResult[]> {
    const sql = `
            SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
            FROM information_schema.KEY_COLUMN_USAGE
            WHERE TABLE_NAME = ? AND TABLE_SCHEMA = ?
            AND REFERENCED_TABLE_NAME IS NOT NULL
        `;
    const [rows] = await pool.query(sql, [table, schema]);
    const parentId = dbName
      ? `db:${dbName}.schema:${schema}.table:${table}.folder:constraints`
      : `schema:${schema}.table:${table}.folder:constraints`;

    return (rows as any[]).map((r) => ({
      id: `${parentId}.constraint:${r.CONSTRAINT_NAME}`,
      name: `${r.CONSTRAINT_NAME} (FK ${r.COLUMN_NAME} -> ${r.REFERENCED_TABLE_NAME}.${r.REFERENCED_COLUMN_NAME})`,
      type: 'constraint',
      parentId,
      hasChildren: false,
    }));
  }

  async getFullMetadata(
    pool: Pool,
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

  async getRelationships(pool: Pool): Promise<Relationship[]> {
    const sql = `
            SELECT 
                CONSTRAINT_NAME as constraint_name,
                TABLE_NAME as source_table, 
                COLUMN_NAME as source_column, 
                REFERENCED_TABLE_NAME as target_table, 
                REFERENCED_COLUMN_NAME as target_column
            FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
            WHERE REFERENCED_TABLE_NAME IS NOT NULL AND TABLE_SCHEMA = DATABASE()
        `;
    const [rows] = await pool.query(sql);
    return rows as Relationship[];
  }

  async getDatabaseMetrics(pool: Pool): Promise<DatabaseMetrics> {
    const statsSql = `
            SELECT 
                count(*) as table_count,
                COALESCE(sum(data_length + index_length), 0) as size_bytes,
                (SELECT count(*) FROM information_schema.processlist) as active_connections
            FROM information_schema.tables WHERE table_schema = DATABASE()
        `;
    const tablesSql = `
            SELECT table_name as name, (data_length + index_length) as size_bytes
            FROM information_schema.tables WHERE table_schema = DATABASE()
            ORDER BY (data_length + index_length) DESC LIMIT 5
        `;
    const typesSql = `
            SELECT table_type as type, count(*) as count 
            FROM information_schema.tables WHERE table_schema = DATABASE() GROUP BY table_type
        `;

    const [[statsRows], [tableRows], [typeRows]] = await Promise.all([
      pool.query(statsSql),
      pool.query(tablesSql),
      pool.query(typesSql),
    ]);

    const stats = statsRows[0] as {
      table_count: string;
      size_bytes: string;
      active_connections: string;
    };
    return {
      tableCount: parseInt(stats.table_count),
      sizeBytes: parseInt(stats.size_bytes),
      activeConnections: parseInt(stats.active_connections),
      topTables: (tableRows as Array<{ name: string; size_bytes: string }>).map(
        (r) => ({ name: r.name, sizeBytes: parseInt(r.size_bytes) }),
      ),
      tableTypes: (typeRows as Array<{ type: string; count: string }>).map(
        (r) => ({ type: r.type, count: parseInt(r.count) }),
      ),
    };
  }

  // ─── Polymorphic Tree & Seed ───

  async getHierarchyNodes(
    pool: Pool,
    parentId: string | null,
    parsedParams: unknown,
    connectionInfo: unknown,
  ): Promise<TreeNodeResult[]> {
    if (!parentId) {
      return this.getDatabases(pool);
    }
    return [];
  }

  async seedData(pool: Pool): Promise<QueryResult> {
    const sql = `
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100),
                email VARCHAR(100) UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS products (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100),
                price DECIMAL(10, 2),
                stock INT
            );
            CREATE TABLE IF NOT EXISTS orders (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT,
                total DECIMAL(10, 2),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );
            INSERT IGNORE INTO users (name, email) VALUES 
            ('Alice Johnson', 'alice@example.com'),
            ('Bob Smith', 'bob@example.com'),
            ('Charlie Brown', 'charlie@example.com');
            INSERT IGNORE INTO products (name, price, stock) VALUES 
            ('Laptop', 999.99, 10),
            ('Mouse', 25.50, 100),
            ('Keyboard', 50.00, 50);
            INSERT IGNORE INTO orders (user_id, total) VALUES 
            (1, 1025.49),
            (2, 25.50);
        `;
    return this.executeQuery(pool, sql);
  }

  async getSampleRows(
    pool: Pool,
    schema: string,
    table: string,
    limit: number,
  ): Promise<Record<string, unknown>[]> {
    const sanitizedLimit = SqlUtil.sanitizeLimit(limit);
    const quotedTable = this.quoteTable(schema, table);
    const result = await this.executeQuery(
      pool,
      `SELECT * FROM ${quotedTable} LIMIT ${sanitizedLimit}`,
    );
    return result.rows;
  }
}
