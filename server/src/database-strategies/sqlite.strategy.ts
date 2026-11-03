import type {
  IDatabaseStrategy,
  TreeNodeResult,
  ColumnInfo,
  QueryResult,
  UpdateRowParams,
  InsertRowParams,
  DeleteRowsParams,
  FullTableMetadata,
  IndexInfo,
  Relationship,
  DatabaseMetrics,
  ConnectionConfig,
} from './database-strategy.interface';
import { SchemaOperation } from '../query/dto/schema-operations.types';
import { Injectable } from '@nestjs/common';
import Database from 'better-sqlite3';
import { SqlUtil } from '../utils/sql.util';
import { splitSqlStatements } from '../query/query-guard.util';
import { assertAffectedRows, buildRowPredicate } from './row-identity.util';

function losslessSqliteRows(
  rows: Record<string, unknown>[],
): Record<string, unknown>[] {
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([column, value]) => [
        column,
        typeof value === 'bigint'
          ? value >= BigInt(Number.MIN_SAFE_INTEGER) &&
            value <= BigInt(Number.MAX_SAFE_INTEGER)
            ? Number(value)
            : value.toString()
          : value,
      ]),
    ),
  );
}

@Injectable()
export class SqliteStrategy implements IDatabaseStrategy {
  createPool(connectionConfig: ConnectionConfig): Database.Database {
    const path = connectionConfig.database || ':memory:';
    return new Database(path);
  }

  async closePool(pool: Database.Database): Promise<void> {
    pool.close();
  }

  quoteIdentifier(name: string): string {
    return `"${name.replace(/"/g, '""')}"`;
  }

  quoteTable(schema: string | undefined, table: string): string {
    const namespace = !schema || schema === 'public' ? 'main' : schema;
    return `${this.quoteIdentifier(namespace)}.${this.quoteIdentifier(table)}`;
  }

  async executeQuery(
    pool: Database.Database,
    sql: string,
    options?: { limit?: number; offset?: number; readOnly?: boolean },
  ): Promise<QueryResult> {
    if (options?.readOnly) {
      return this.runStatementsInTransaction(pool, [sql], {
        ...options,
        limit: options.limit ?? 50000,
      });
    }
    let safeSql = sql;
    if (options?.limit !== undefined) {
      safeSql =
        options.offset !== undefined
          ? SqlUtil.injectPagination(
              sql,
              options.limit,
              options.offset,
              'sqlite',
            )
          : SqlUtil.injectLimit(sql, options.limit, 'sqlite');
    } else {
      safeSql = SqlUtil.injectLimit(sql, 50000, 'sqlite');
    }

    if (options?.offset !== undefined && options.limit === undefined) {
      safeSql = SqlUtil.injectPagination(sql, 50000, options.offset, 'sqlite');
    }

    const rows = losslessSqliteRows(
      pool.prepare(safeSql).safeIntegers(true).all() as Record<
        string,
        unknown
      >[],
    );

    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    return { rows: rows.slice(0, 50000), columns, rowCount: rows.length };
  }

  async cancelActiveQuery(_execution: unknown): Promise<boolean> {
    // better-sqlite3 is synchronous; queries cannot be cancelled mid-flight.
    return false;
  }

  async runStatementsInTransaction(
    pool: Database.Database,
    statements: string[],
    options?: { limit?: number; offset?: number; readOnly?: boolean },
  ): Promise<QueryResult> {
    let result: QueryResult = { rows: [], columns: [], countStatus: 'skipped' };
    const runAll = pool.transaction(() => {
      for (const statement of statements) {
        const isLast = statement === statements[statements.length - 1];
        const safeSql =
          isLast && options?.offset !== undefined
            ? SqlUtil.injectPagination(
                statement,
                options.limit ?? 50000,
                options.offset,
                'sqlite',
              )
            : SqlUtil.injectLimit(
                statement,
                isLast ? (options?.limit ?? 50000) : 50000,
                'sqlite',
              );
        const stmt = pool.prepare(safeSql);
        if (stmt.reader) {
          // SELECT-like statements return rows via .all().
          const rows = losslessSqliteRows(
            stmt.safeIntegers(true).all() as Record<string, unknown>[],
          );
          if (isLast) {
            const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
            result = {
              rows: rows.slice(0, 50000),
              columns,
              rowCount: rows.length,
            };
          }
        } else {
          // INSERT/UPDATE/DELETE/DDL statements must use .run(); better-sqlite3
          // throws "This statement does not return data" when calling .all().
          const runResult = stmt.run();
          if (isLast) {
            result = {
              rows: [],
              columns: [],
              rowCount: Number(runResult.changes),
            };
          }
        }
      }
    });
    const previousQueryOnly = options?.readOnly
      ? pool.pragma('query_only', { simple: true })
      : undefined;
    try {
      if (options?.readOnly) pool.pragma('query_only = ON');
      // This transaction runs synchronously; no other request can observe the temporary mode.
      runAll();
      return result;
    } finally {
      if (options?.readOnly) {
        pool.pragma(previousQueryOnly ? 'query_only = ON' : 'query_only = OFF');
      }
    }
  }

  async updateRow(
    pool: Database.Database,
    params: UpdateRowParams,
  ): Promise<{ success: boolean; rowCount: number }> {
    const { schema, table, pkColumn, pkValue, updates } = params;
    const cols = Object.keys(updates);
    if (cols.length === 0) return { success: false, rowCount: 0 };

    const setClause = cols
      .map((c) => `${this.quoteIdentifier(c)} = ?`)
      .join(', ');
    const predicate = buildRowPredicate(
      [params.identity ?? [{ column: pkColumn, value: pkValue }]],
      (column) => this.quoteIdentifier(column),
      () => '?',
      cols.length,
    );
    const sql = `UPDATE ${this.quoteTable(schema, table)} SET ${setClause} WHERE ${predicate.sql}`;
    const values = [...cols.map((c) => updates[c]), ...predicate.values];

    return this.runChange(pool, sql, values, 1);
  }

  async insertRow(
    pool: Database.Database,
    params: InsertRowParams,
  ): Promise<{ success: boolean; rowCount: number }> {
    const { table, data } = params;
    const cols = Object.keys(data);
    if (cols.length === 0) return { success: false, rowCount: 0 };

    const placeholders = cols.map(() => '?').join(', ');
    const sql = `INSERT INTO ${this.quoteIdentifier(table)} (${cols.map((c) => this.quoteIdentifier(c)).join(', ')}) VALUES (${placeholders})`;
    return this.runChange(
      pool,
      sql,
      cols.map((c) => data[c]),
    );
  }

  async deleteRows(
    pool: Database.Database,
    params: DeleteRowsParams,
  ): Promise<{ success: boolean; rowCount: number }> {
    const { schema, table, pkColumn, pkValues } = params;
    if (pkValues.length === 0) return { success: true, rowCount: 0 };

    const identities =
      params.identities ??
      pkValues.map((value) => [{ column: pkColumn, value }]);
    const predicate = buildRowPredicate(
      identities,
      (column) => this.quoteIdentifier(column),
      () => '?',
    );
    const sql = `DELETE FROM ${this.quoteTable(schema, table)} WHERE ${predicate.sql}`;
    return this.runChange(pool, sql, predicate.values, identities.length);
  }

  private async runChange(
    pool: Database.Database,
    sql: string,
    values: unknown[],
    expectedRows?: number,
  ): Promise<{ success: boolean; rowCount: number }> {
    const run = () => {
      const result = pool.prepare(sql).run(...values);
      if (expectedRows !== undefined)
        assertAffectedRows(result.changes, expectedRows);
      return { success: true, rowCount: result.changes };
    };
    return expectedRows === undefined ? run() : pool.transaction(run)();
  }

  async importData(
    pool: Database.Database,
    params: { schema: string; table: string; data: Record<string, unknown>[] },
  ): Promise<{ success: boolean; rowCount: number }> {
    const { table, data } = params;
    if (!data || data.length === 0) return { success: true, rowCount: 0 };

    let total = 0;
    for (const row of data) {
      const res = await this.insertRow(pool, { schema: '', table, data: row });
      total += res.rowCount;
    }
    return { success: true, rowCount: total };
  }

  async exportStream(
    pool: Database.Database,
    _schema: string,
    table: string,
  ): Promise<unknown> {
    const sql = `SELECT * FROM ${this.quoteIdentifier(table)}`;
    const iterator = pool.prepare(sql).iterate();
    return {
      [Symbol.asyncIterator]: async function* () {
        for (const row of iterator) yield row;
      },
    };
  }

  buildAlterTableSql(quotedTable: string, op: SchemaOperation): string {
    switch (op.type) {
      case 'add_column':
        return `ALTER TABLE ${quotedTable} ADD COLUMN "${op.name}" ${op.dataType}`;
      case 'drop_column':
        return `ALTER TABLE ${quotedTable} DROP COLUMN "${op.name}"`;
      case 'rename_column':
        return `ALTER TABLE ${quotedTable} RENAME COLUMN "${op.name}" TO "${op.newName}"`;
      default:
        return '';
    }
  }

  async createDatabase(_pool: Database.Database, _name: string): Promise<void> {
    throw new Error('SQLite createDatabase not supported via SQL');
  }

  async dropDatabase(_pool: Database.Database, _name: string): Promise<void> {
    throw new Error('SQLite dropDatabase not supported via SQL');
  }

  async getDatabases(_pool: Database.Database): Promise<TreeNodeResult[]> {
    return [
      {
        id: 'db:main',
        name: 'main',
        type: 'database',
        parentId: 'root',
        hasChildren: true,
      },
    ];
  }

  async getSchemas(
    _pool: Database.Database,
    _dbName?: string,
  ): Promise<TreeNodeResult[]> {
    return [
      {
        id: 'schema:main',
        name: 'main',
        type: 'schema',
        parentId: 'root',
        hasChildren: true,
      },
    ];
  }

  async getTables(
    pool: Database.Database,
    _schema: string,
    _dbName?: string,
  ): Promise<TreeNodeResult[]> {
    const sql = `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`;
    const rows = pool.prepare(sql).all() as { name: string }[];
    return rows.map((r) => ({
      id: `table:${r.name}`,
      name: r.name,
      type: 'table',
      parentId: 'schema:main',
      hasChildren: true,
    }));
  }

  async getViews(
    pool: Database.Database,
    _schema: string,
    _dbName?: string,
  ): Promise<TreeNodeResult[]> {
    const sql = `SELECT name FROM sqlite_master WHERE type='view'`;
    const rows = pool.prepare(sql).all() as { name: string }[];
    return rows.map((r) => ({
      id: `view:${r.name}`,
      name: r.name,
      type: 'view',
      parentId: 'schema:main',
      hasChildren: true,
    }));
  }

  async getFunctions(): Promise<TreeNodeResult[]> {
    return [];
  }

  async getFunctionParameters(): Promise<ColumnInfo[]> {
    return [];
  }

  async getColumns(
    pool: Database.Database,
    _schema: string,
    table: string,
  ): Promise<ColumnInfo[]> {
    const namespace = !_schema || _schema === 'public' ? 'main' : _schema;
    const sql = `PRAGMA ${this.quoteIdentifier(namespace)}.table_info(${this.quoteIdentifier(table)})`;
    const rows = pool.prepare(sql).all() as any[];
    return rows.map((r) => ({
      name: r.name,
      type: r.type,
      isNullable: r.notnull === 0,
      defaultValue: r.dflt_value,
      isPrimaryKey: r.pk > 0,
      pkConstraintName: r.pk > 0 ? 'PRIMARY' : null,
    }));
  }

  async getIndexes(
    pool: Database.Database,
    _schema: string,
    table: string,
  ): Promise<TreeNodeResult[]> {
    const rows = pool
      .prepare(`PRAGMA index_list(${this.quoteIdentifier(table)})`)
      .all() as any[];
    const parentId = `table:${table}.folder:indexes`;
    return rows.map((r) => ({
      id: `${parentId}.index:${r.name}`,
      name: r.name,
      type: 'index',
      parentId,
      hasChildren: false,
      metadata: { unique: r.unique === 1 },
    }));
  }

  async getTriggers(
    pool: Database.Database,
    _schema: string,
    table: string,
  ): Promise<TreeNodeResult[]> {
    const rows = pool
      .prepare(
        `SELECT name FROM sqlite_master WHERE type = 'trigger' AND tbl_name = ?`,
      )
      .all(table) as { name: string }[];
    const parentId = `table:${table}.folder:triggers`;
    return rows.map((r) => ({
      id: `${parentId}.trigger:${r.name}`,
      name: r.name,
      type: 'trigger',
      parentId,
      hasChildren: false,
    }));
  }

  async getConstraints(
    pool: Database.Database,
    _schema: string,
    table: string,
  ): Promise<TreeNodeResult[]> {
    const rows = pool
      .prepare(`PRAGMA foreign_key_list(${this.quoteIdentifier(table)})`)
      .all() as any[];
    const parentId = `table:${table}.folder:constraints`;
    return rows.map((r) => ({
      id: `${parentId}.constraint:fk_${r.id}`,
      name: `FK to ${r.table} (${r.from} -> ${r.to})`,
      type: 'constraint',
      parentId,
      hasChildren: false,
    }));
  }

  async getFullMetadata(
    pool: Database.Database,
    _schema: string,
    table: string,
  ): Promise<FullTableMetadata> {
    const columns = await this.getColumns(pool, '', table);
    const indexSql = `PRAGMA index_list(${this.quoteIdentifier(table)})`;
    const indicesRaw = pool.prepare(indexSql).all() as any[];

    const indices: IndexInfo[] = [];
    for (const idx of indicesRaw) {
      const infoSql = `PRAGMA index_info(${this.quoteIdentifier(idx.name)})`;
      const info = pool.prepare(infoSql).all() as any[];
      indices.push({
        name: idx.name,
        columns: info.map((i) => i.name),
        isUnique: idx.unique === 1,
        isPrimary: idx.origin === 'pk',
      });
    }

    const countSql = `SELECT COUNT(*) as cnt FROM ${this.quoteIdentifier(table)}`;
    const countRow = pool.prepare(countSql).get() as { cnt: number };

    return { columns, indices, rowCount: countRow.cnt };
  }

  async getRelationships(): Promise<Relationship[]> {
    return [];
  }

  async getDatabaseMetrics(pool: Database.Database): Promise<DatabaseMetrics> {
    const tables = await this.getTables(pool, '', '');

    return {
      tableCount: tables.length,
      sizeBytes: 0,
      activeConnections: 1,
      topTables: [],
      tableTypes: [{ type: 'table', count: tables.length }],
    };
  }

  async getHierarchyNodes(
    pool: Database.Database,
    parentId: string | null,
  ): Promise<TreeNodeResult[]> {
    if (!parentId) return this.getSchemas(pool);
    if (parentId === 'schema:main') return this.getTables(pool, '');
    if (parentId.startsWith('schema:main.folder:tables'))
      return this.getTables(pool, '');
    return [];
  }

  async seedData(pool: Database.Database): Promise<QueryResult> {
    const sql = `
      CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT, email TEXT UNIQUE);
      CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY, name TEXT, price REAL, stock INTEGER);
      INSERT OR IGNORE INTO users (name, email) VALUES ('Alice', 'alice@example.com'), ('Bob', 'bob@example.com');
      INSERT OR IGNORE INTO products (name, price, stock) VALUES ('Laptop', 999.99, 10);
    `;
    return this.runStatementsInTransaction(
      pool,
      splitSqlStatements(sql, 'sqlite'),
    );
  }

  async getSampleRows(
    pool: Database.Database,
    schema: string,
    table: string,
    limit: number,
  ): Promise<Record<string, unknown>[]> {
    const sanitizedLimit = SqlUtil.sanitizeLimit(limit);
    const sql = `SELECT * FROM ${this.quoteIdentifier(table)} LIMIT ${sanitizedLimit}`;
    const result = await this.executeQuery(pool, sql);
    return result.rows;
  }
}
