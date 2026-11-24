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
  QueryExecutionOptions,
} from './database-strategy.interface';
import { SchemaOperation } from '../query/dto/schema-operations.types';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as mysql from 'mysql2/promise';
import { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import type { Connection as NativeMysqlConnection, FieldPacket } from 'mysql2';
import { SqlUtil } from '../utils/sql.util';
import { getErrorMessage } from '../common/utils/error.util';
import {
  isSqlAllowedOnReadOnly,
  splitSqlStatements,
} from '../query/query-guard.util';
import { assertAffectedRows, buildRowPredicate } from './row-identity.util';
import {
  allowInsecureDatabaseTls,
  isLocalDatabaseHost,
} from '../common/utils/database-network.util';
import {
  createQueryExecution,
  cancelQueryExecution,
} from './query-execution.util';
import {
  assertResultByteBudget,
  QueryResultByteBudget,
  ResultByteBudgetError,
  validateResultByteBudget,
} from './query-result-budget.util';

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
      supportBigNumbers: true,
      bigNumberStrings: true,
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

  private async openQueryExecution(
    pool: Pool,
    options?: QueryExecutionOptions,
  ) {
    const connection = await pool.getConnection();
    let released = false;
    let broken = false;
    const handleError = () => {
      broken = true;
    };
    connection.on('error', handleError);
    const release = (discard = false) => {
      if (released) return;
      released = true;
      connection.removeListener('error', handleError);
      if (discard || broken) connection.destroy();
      else connection.release();
    };
    const execution = createQueryExecution(async (isActive) => {
      let control: mysql.Connection | undefined;
      try {
        const {
          host,
          port,
          user,
          password,
          database,
          ssl,
          connectTimeout,
          socketPath,
        } = connection.config;
        control = await mysql.createConnection({
          host,
          port,
          user,
          password,
          database,
          ssl,
          connectTimeout,
          socketPath,
        });
        if (!isActive()) return false;
        if (
          !Number.isSafeInteger(connection.threadId) ||
          connection.threadId <= 0
        )
          throw new Error('Invalid MySQL execution thread.');
        await control.query(`KILL QUERY ${connection.threadId}`);
        return true;
      } catch {
        return false;
      } finally {
        await control?.end();
      }
    });
    try {
      options?.onExecution?.(execution);
      return { connection, execution, release };
    } catch (error) {
      await execution.finish();
      release();
      throw error;
    }
  }

  /** Native rows arrive without mysql2's promise-wrapper result array allocation. */
  private collectQueryResult(
    connection: mysql.PoolConnection,
    queryOptions: { sql: string; timeout: number },
    maxResultBytes: number,
    onDispatch: () => void,
    onNativeInterruption?: (error: Error) => void,
  ): Promise<[unknown, unknown]> {
    const native = connection.connection as unknown as NativeMysqlConnection;
    if (!native || typeof native.query !== 'function') {
      throw new Error(
        'Native MySQL streaming is required for a budgeted query.',
      );
    }
    const budget = new QueryResultByteBudget(maxResultBytes);
    onDispatch();
    const command = native.query(queryOptions);
    // Register before stream() installs its forwarding listener. Retain the
    // native error's identity, and keep a safe listener through wire drainage.
    let nativeCommandError: unknown;
    command.on('error', (error: unknown) => {
      nativeCommandError ??= error;
    });
    const stream = command.stream({ highWaterMark: 1 });
    return new Promise((resolve, reject) => {
      type ResultGroup = {
        rows: Record<string, unknown>[];
        fields?: FieldPacket[];
        header?: unknown;
      };
      const groups: ResultGroup[] = [];
      let current: ResultGroup | undefined;
      let settled = false;
      const stopCollecting = () => {
        command.removeListener('fields', fields);
        stream.removeListener('data', data);
      };
      const fail = (error: unknown) => {
        if (settled) return;
        settled = true;
        stopCollecting();
        for (const group of groups) {
          group.rows.length = 0;
          group.header = undefined;
        }
        groups.length = 0;
        current = undefined;
        // Stop retaining rows now. This is NOT wire completion: the caller
        // must cancel/drain before either reusing or discarding the source.
        stream.destroy();
        reject(
          error instanceof Error
            ? error
            : Object.assign(
                new Error(getErrorMessage(error)),
                error !== null && typeof error === 'object' ? error : {},
              ),
        );
      };
      const fields = (packets?: FieldPacket[]) => {
        try {
          if (groups.length > 0) budget.nextResultSet();
          current = { rows: [], fields: packets };
          groups.push(current);
          budget.setColumns(packets?.map((field) => field.name) ?? []);
        } catch (error) {
          fail(error);
        }
      };
      const data = (row: Record<string, unknown>) => {
        if (settled) return;
        try {
          current ??= { rows: [] };
          if (groups.length === 0) groups.push(current);
          if (current.fields !== undefined) {
            // A decoded single row can itself be huge; streaming bounds
            // accumulated payload, not mysql2's decoding of that one row.
            budget.addRow(row);
            if (current.rows.length < 50000) current.rows.push(row);
          } else {
            budget.retainHeader(row);
            budget.setRowCount(
              (row as unknown as ResultSetHeader).affectedRows,
            );
            current.header = row;
          }
        } catch (error) {
          fail(error);
        }
      };
      command.on('fields', fields);
      stream.on('data', data);
      stream.once('error', (error: Error) => {
        if (settled) return;
        // Only a terminal native SERVER ERR interruption can qualify for reuse.
        // Local collector/guard errors (even with this code) remain discard-only.
        const native = error as Error & { code?: string; fatal?: boolean };
        if (
          error === nativeCommandError &&
          native.code === 'ER_QUERY_INTERRUPTED' &&
          native.fatal !== true
        )
          onNativeInterruption?.(error);
        fail(error);
      });
      stream.once('end', () => {
        if (settled) return; // mysql2 also emits end after an early stream close.
        settled = true;
        stopCollecting();
        if (groups.length <= 1) {
          const group = groups[0];
          resolve([group?.header ?? group?.rows ?? [], group?.fields]);
        } else {
          // Preserve mysql2's multiple-result tuple shape (e.g. stored routines).
          resolve([
            groups.map((group) => group.header ?? group.rows),
            groups.map((group) => group.fields),
          ]);
        }
      });
    });
  }

  async executeQuery(
    pool: Pool,
    sql: string,
    options?: QueryExecutionOptions,
  ): Promise<QueryResult> {
    const maxResultBytes = validateResultByteBudget(options?.maxResultBytes);
    if (options?.readOnly) {
      return this.runStatementsInTransaction(pool, [sql], {
        ...options,
        limit: options.limit ?? 50000,
      });
    }
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
        safeSql = SqlUtil.injectLimit(sql, options.limit, 'mysql');
      }
    } else {
      safeSql = SqlUtil.injectLimit(sql, 50000, 'mysql');
    }

    if (options?.offset !== undefined && options.limit === undefined) {
      safeSql = SqlUtil.injectPagination(sql, 50000, options.offset, 'mysql');
    }

    const queryTimeout =
      (pool as Pool & { __statementTimeout?: number }).__statementTimeout ??
      30000;
    const { connection, execution, release } = await this.openQueryExecution(
      pool,
      options,
    );
    let dispatched = false;
    let discard = false;
    let nativeInterruption: Error | undefined;
    const assertWork = () => {
      execution.assertRunning();
      options?.beforeDispatch?.();
    };
    try {
      assertWork();
      const [result, fields] =
        maxResultBytes !== undefined
          ? await this.collectQueryResult(
              connection,
              { sql: safeSql, timeout: queryTimeout },
              maxResultBytes,
              () => {
                assertWork();
                dispatched = true;
              },
              (error) => {
                nativeInterruption = error;
              },
            )
          : await connection.query({ sql: safeSql, timeout: queryTimeout });

      const rows: Record<string, unknown>[] = Array.isArray(result)
        ? (result as RowDataPacket[]).map((r) => r as Record<string, unknown>)
        : [];
      const actualFields = Array.isArray(fields) ? fields : [];
      const queryResult: QueryResult = {
        rows: rows.slice(0, 50000),
        columns: actualFields.map((f) => f.name),
        rowCount:
          !Array.isArray(result) &&
          (result as ResultSetHeader).affectedRows !== undefined
            ? (result as ResultSetHeader).affectedRows
            : undefined,
      };
      if (maxResultBytes !== undefined)
        assertResultByteBudget(queryResult, maxResultBytes);
      return queryResult;
    } catch (error) {
      const nativeTimeout =
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'PROTOCOL_SEQUENCE_TIMEOUT';
      if ((maxResultBytes !== undefined && dispatched) || nativeTimeout) {
        await execution.cancel().catch(() => false);
        // Stream close and inactivity timeout both precede wire completion.
        // A push can report backpressure after destruction's initial resume;
        // unpause only this leased source after cancellation, then drain it.
        if (maxResultBytes !== undefined && dispatched) connection.resume();
        const drained = await connection.ping().then(
          () => true,
          () => false,
        );
        const fatal =
          error !== null &&
          typeof error === 'object' &&
          'fatal' in error &&
          error.fatal === true;
        // A normal terminal server interruption leaves session state intact.
        // Reuse is allowed only after proven drainage; all other errors discard.
        discard =
          nativeInterruption !== error ||
          nativeTimeout === true ||
          fatal ||
          !drained;
      }
      if (error instanceof ResultByteBudgetError) discard = true;
      if (
        error instanceof ResultByteBudgetError &&
        dispatched &&
        !isSqlAllowedOnReadOnly(sql, 'mysql')
      ) {
        try {
          await options?.onMutation?.();
        } catch {
          this.logger.error(
            'Cache refresh failed after an uncertain MySQL write.',
          );
        }
      }
      throw error;
    } finally {
      await execution.finish();
      release(discard);
    }
  }

  async cancelActiveQuery(execution: unknown): Promise<boolean> {
    return cancelQueryExecution(execution);
  }

  async runStatementsInTransaction(
    pool: Pool,
    statements: string[],
    options?: QueryExecutionOptions,
  ): Promise<QueryResult> {
    const maxResultBytes = validateResultByteBudget(options?.maxResultBytes);
    const queryTimeout =
      (pool as Pool & { __statementTimeout?: number }).__statementTimeout ??
      30000;
    const { connection, execution, release } = await this.openQueryExecution(
      pool,
      options,
    );
    let completedWrite = false;
    let attemptedBudgetWrite = false;
    let streamingDispatched = false;
    let discard = false;
    let nativeInterruption: Error | undefined;
    const assertWork = () => {
      execution.assertRunning();
      options?.beforeDispatch?.();
    };
    try {
      assertWork();
      if (options?.readOnly) {
        await connection.query('START TRANSACTION READ ONLY');
      } else {
        await connection.beginTransaction();
      }
      let result: QueryResult = {
        rows: [],
        columns: [],
        countStatus: 'skipped',
      };
      for (const [index, statement] of statements.entries()) {
        assertWork();
        const isLast = index === statements.length - 1;
        const safeSql =
          isLast && options?.offset !== undefined
            ? SqlUtil.injectPagination(
                statement,
                options.limit ?? 50000,
                options.offset,
                'mysql',
              )
            : SqlUtil.injectLimit(
                statement,
                isLast ? (options?.limit ?? 50000) : 50000,
                'mysql',
              );
        const canWrite = !isSqlAllowedOnReadOnly(statement, 'mysql');
        streamingDispatched = false;
        nativeInterruption = undefined;
        assertWork();
        const [rows, fields] =
          maxResultBytes !== undefined
            ? await this.collectQueryResult(
                connection,
                { sql: safeSql, timeout: queryTimeout },
                maxResultBytes,
                () => {
                  assertWork();
                  streamingDispatched = true;
                  // A RETURNING/routine/header budget failure can happen before
                  // the await resumes and before completedWrite can be set.
                  attemptedBudgetWrite ||= canWrite;
                },
                (error) => {
                  nativeInterruption = error;
                },
              )
            : await connection.query({ sql: safeSql, timeout: queryTimeout });
        if (canWrite) completedWrite = true;
        if (
          completedWrite &&
          !Array.isArray(rows) &&
          ((rows as ResultSetHeader).serverStatus & 1) === 0
        ) {
          await options?.onMutation?.();
        }
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
      if (maxResultBytes !== undefined)
        assertResultByteBudget(result, maxResultBytes);
      assertWork();
      await connection.commit();
      return result;
    } catch (error) {
      const nativeTimeout =
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'PROTOCOL_SEQUENCE_TIMEOUT';
      if (
        (maxResultBytes !== undefined && streamingDispatched) ||
        nativeTimeout
      ) {
        await execution.cancel().catch(() => false);
        if (maxResultBytes !== undefined && streamingDispatched)
          connection.resume();
        const drained = await connection.ping().then(
          () => true,
          () => false,
        );
        const fatal =
          error !== null &&
          typeof error === 'object' &&
          'fatal' in error &&
          error.fatal === true;
        // Rollback and the source error listener can still veto reuse below.
        discard =
          nativeInterruption !== error ||
          nativeTimeout === true ||
          fatal ||
          !drained;
      }
      await execution.finish();
      if (!nativeTimeout) {
        try {
          // Rollback must queue after source drainage, never concurrently with
          // the cancelled command. DDL/nontransactional writes can survive it.
          await connection.rollback();
        } catch {
          discard = true;
        }
      }
      if (error instanceof ResultByteBudgetError) discard = true;
      // A failed DDL may already have committed earlier writes. A budget failure
      // during a mutating statement is uncertain even without completedWrite.
      if (
        completedWrite ||
        (error instanceof ResultByteBudgetError && attemptedBudgetWrite)
      ) {
        try {
          await options?.onMutation?.();
        } catch {
          this.logger.error(
            'Cache refresh failed after a partial MySQL batch.',
          );
        }
      }
      throw error;
    } finally {
      await execution.finish();
      release(discard);
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
    const predicate = buildRowPredicate(
      [params.identity ?? [{ column: pkColumn, value: pkValue }]],
      (column) => this.quoteIdentifier(column),
      () => '?',
      updateCols.length,
    );
    const sql = `UPDATE ${this.quoteTable(schema, table)} SET ${setClause} WHERE ${predicate.sql}`;
    return this.runRowMutation(
      pool,
      schema,
      table,
      sql,
      [...updateCols.map((c) => updates[c]), ...predicate.values],
      1,
    );
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
    const identities =
      params.identities ??
      pkValues.map((value) => [{ column: pkColumn, value }]);
    const predicate = buildRowPredicate(
      identities,
      (column) => this.quoteIdentifier(column),
      () => '?',
    );
    return this.runRowMutation(
      pool,
      schema,
      table,
      `DELETE FROM ${quotedTable} WHERE ${predicate.sql}`,
      predicate.values,
      identities.length,
    );
  }

  private async runRowMutation(
    pool: Pool,
    schema: string,
    table: string,
    sql: string,
    values: unknown[],
    expectedRows: number,
  ): Promise<{ success: boolean; rowCount: number }> {
    const connection = await pool.getConnection();
    let rollbackFailed = false;
    try {
      await connection.beginTransaction();
      // Hold the target's metadata lock so its engine cannot change before the write.
      await connection.query(
        `SELECT 1 FROM ${this.quoteTable(schema, table)} LIMIT 0`,
      );
      const [engines] = await connection.query<RowDataPacket[]>(
        "SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = COALESCE(NULLIF(?, ''), DATABASE()) AND TABLE_NAME = ?",
        [schema, table],
      );
      if (
        engines.length !== 1 ||
        engines[0].ENGINE?.toLowerCase() !== 'innodb'
      ) {
        throw new BadRequestException(
          'Row editing requires an InnoDB table with rollback support.',
        );
      }
      const [result] = await connection.execute<ResultSetHeader>(
        sql,
        values as never[],
      );
      assertAffectedRows(result.affectedRows, expectedRows);
      await connection.commit();
      return { success: true, rowCount: expectedRows };
    } catch (error) {
      try {
        await connection.rollback();
      } catch {
        rollbackFailed = true;
      }
      throw error;
    } finally {
      if (rollbackFailed) connection.destroy();
      else connection.release();
    }
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
        const actions = [
          op.onDelete ? `ON DELETE ${op.onDelete}` : '',
          op.onUpdate ? `ON UPDATE ${op.onUpdate}` : '',
        ]
          .filter(Boolean)
          .join(' ');
        return `ALTER TABLE ${quotedTable} ADD CONSTRAINT ${this.quoteIdentifier(op.name)} FOREIGN KEY (${fkCols}) REFERENCES ${this.quoteIdentifier(op.refTable)} (${refCols})${actions ? ` ${actions}` : ''}`;
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

  async seedData(
    pool: Pool,
    options?: QueryExecutionOptions,
  ): Promise<QueryResult> {
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
    return this.runStatementsInTransaction(
      pool,
      splitSqlStatements(sql, 'mysql'),
      options,
    );
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
