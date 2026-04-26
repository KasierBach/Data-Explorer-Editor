import type {
  IDatabaseStrategy, TreeNodeResult, ColumnInfo, QueryResult,
  UpdateRowParams, InsertRowParams, DeleteRowsParams,
  FullTableMetadata, IndexInfo, Relationship, DatabaseMetrics,
  ConnectionConfig,
} from './database-strategy.interface';
import { SchemaOperation } from '../query/dto/schema-operations.types';
import { Injectable } from '@nestjs/common';
import { Database } from 'sqlite3';

@Injectable()
export class SqliteStrategy implements IDatabaseStrategy {
  createPool(connectionConfig: ConnectionConfig): Database {
    const path = connectionConfig.database || ':memory:';
    return new Database(path);
  }

  async closePool(pool: Database): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      pool.close((err) => (err ? reject(err) : resolve()));
    });
  }

  quoteIdentifier(name: string): string {
    return `"${name.replace(/"/g, '""')}"`;
  }

  quoteTable(_schema: string | undefined, table: string): string {
    return this.quoteIdentifier(table);
  }

  async executeQuery(pool: Database, sql: string, options?: { limit?: number; offset?: number }): Promise<QueryResult> {
    let safeSql = sql;
    if (options?.limit !== undefined) {
      safeSql += ` LIMIT ${options.limit}`;
      if (options.offset !== undefined) safeSql += ` OFFSET ${options.offset}`;
    } else {
      safeSql += ' LIMIT 50000';
    }

    const rows = await new Promise<Record<string, unknown>[]>((resolve, reject) => {
      pool.all(safeSql, (err, r) => (err ? reject(err) : resolve(r as Record<string, unknown>[])));
    });

    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    return { rows: rows.slice(0, 50000), columns, rowCount: rows.length };
  }

  async updateRow(pool: Database, params: UpdateRowParams): Promise<{ success: boolean; rowCount: number }> {
    const { table, pkColumn, pkValue, updates } = params;
    const cols = Object.keys(updates);
    if (cols.length === 0) return { success: false, rowCount: 0 };

    const setClause = cols.map((c) => `${this.quoteIdentifier(c)} = ?`).join(', ');
    const sql = `UPDATE ${this.quoteIdentifier(table)} SET ${setClause} WHERE ${this.quoteIdentifier(pkColumn)} = ?`;
    const values = [...cols.map((c) => updates[c]), pkValue];

    return this.runChange(pool, sql, values);
  }

  async insertRow(pool: Database, params: InsertRowParams): Promise<{ success: boolean; rowCount: number }> {
    const { table, data } = params;
    const cols = Object.keys(data);
    if (cols.length === 0) return { success: false, rowCount: 0 };

    const placeholders = cols.map(() => '?').join(', ');
    const sql = `INSERT INTO ${this.quoteIdentifier(table)} (${cols.map((c) => this.quoteIdentifier(c)).join(', ')}) VALUES (${placeholders})`;
    return this.runChange(pool, sql, cols.map((c) => data[c]));
  }

  async deleteRows(pool: Database, params: DeleteRowsParams): Promise<{ success: boolean; rowCount: number }> {
    const { table, pkColumn, pkValues } = params;
    if (pkValues.length === 0) return { success: true, rowCount: 0 };

    const placeholders = pkValues.map(() => '?').join(', ');
    const sql = `DELETE FROM ${this.quoteIdentifier(table)} WHERE ${this.quoteIdentifier(pkColumn)} IN (${placeholders})`;
    return this.runChange(pool, sql, pkValues);
  }

  private async runChange(pool: Database, sql: string, values: unknown[]): Promise<{ success: boolean; rowCount: number }> {
    return new Promise((resolve, reject) => {
      pool.run(sql, values, function (err) {
        if (err) return reject(err);
        resolve({ success: true, rowCount: this.changes });
      });
    });
  }

  async importData(pool: Database, params: { schema: string; table: string; data: Record<string, unknown>[] }): Promise<{ success: boolean; rowCount: number }> {
    const { table, data } = params;
    if (!data || data.length === 0) return { success: true, rowCount: 0 };

    let total = 0;
    for (const row of data) {
      const res = await this.insertRow(pool, { schema: '', table, data: row });
      total += res.rowCount;
    }
    return { success: true, rowCount: total };
  }

  async exportStream(pool: Database, _schema: string, table: string): Promise<unknown> {
    const sql = `SELECT * FROM ${this.quoteIdentifier(table)}`;
    const rows = await new Promise<unknown[]>((resolve, reject) => {
      pool.all(sql, (err, r) => (err ? reject(err) : resolve(r as unknown[])));
    });
    return { [Symbol.asyncIterator]: async function* () { for (const row of rows) yield row; } };
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

  async createDatabase(_pool: Database, _name: string): Promise<void> {
    throw new Error('SQLite createDatabase not supported via SQL');
  }

  async dropDatabase(_pool: Database, _name: string): Promise<void> {
    throw new Error('SQLite dropDatabase not supported via SQL');
  }

  async getDatabases(_pool: Database): Promise<TreeNodeResult[]> {
    return [{ id: 'db:main', name: 'main', type: 'database', parentId: 'root', hasChildren: true }];
  }

  async getSchemas(_pool: Database, _dbName?: string): Promise<TreeNodeResult[]> {
    return [{ id: 'schema:main', name: 'main', type: 'schema', parentId: 'root', hasChildren: true }];
  }

  async getTables(pool: Database, _schema: string, _dbName?: string): Promise<TreeNodeResult[]> {
    const sql = `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`;
    const rows = await new Promise<{ name: string }[]>((resolve, reject) => {
      pool.all(sql, (err, r) => (err ? reject(err) : resolve(r as { name: string }[])));
    });
    return rows.map((r) => ({ id: `table:${r.name}`, name: r.name, type: 'table', parentId: 'schema:main', hasChildren: true }));
  }

  async getViews(pool: Database, _schema: string, _dbName?: string): Promise<TreeNodeResult[]> {
    const sql = `SELECT name FROM sqlite_master WHERE type='view'`;
    const rows = await new Promise<{ name: string }[]>((resolve, reject) => {
      pool.all(sql, (err, r) => (err ? reject(err) : resolve(r as { name: string }[])));
    });
    return rows.map((r) => ({ id: `view:${r.name}`, name: r.name, type: 'view', parentId: 'schema:main', hasChildren: true }));
  }

  async getFunctions(): Promise<TreeNodeResult[]> {
    return [];
  }

  async getFunctionParameters(): Promise<ColumnInfo[]> {
    return [];
  }

  async getColumns(pool: Database, _schema: string, table: string): Promise<ColumnInfo[]> {
    const sql = `PRAGMA table_info(${this.quoteIdentifier(table)})`;
    const rows = await new Promise<{ name: string; type: string; notnull: number; dflt_value: unknown; pk: number }[]>((resolve, reject) => {
      pool.all(sql, (err, r) => (err ? reject(err) : resolve(r as any[])));
    });
    return rows.map((r) => ({
      name: r.name,
      type: r.type,
      isNullable: r.notnull === 0,
      defaultValue: r.dflt_value,
      isPrimaryKey: r.pk === 1,
      pkConstraintName: r.pk === 1 ? 'PRIMARY' : null,
    }));
  }

  async getFullMetadata(pool: Database, _schema: string, table: string): Promise<FullTableMetadata> {
    const columns = await this.getColumns(pool, '', table);
    const indexSql = `PRAGMA index_list(${this.quoteIdentifier(table)})`;
    const indicesRaw = await new Promise<{ name: string; unique: number; origin: string }[]>((resolve, reject) => {
      pool.all(indexSql, (err, r) => (err ? reject(err) : resolve(r as any[])));
    });

    const indices: IndexInfo[] = [];
    for (const idx of indicesRaw) {
      const infoSql = `PRAGMA index_info(${this.quoteIdentifier(idx.name)})`;
      const info = await new Promise<{ name: string }[]>((resolve, reject) => {
        pool.all(infoSql, (err, r) => (err ? reject(err) : resolve(r as any[])));
      });
      indices.push({
        name: idx.name,
        columns: info.map((i) => i.name),
        isUnique: idx.unique === 1,
        isPrimary: idx.origin === 'pk',
      });
    }

    const countSql = `SELECT COUNT(*) as cnt FROM ${this.quoteIdentifier(table)}`;
    const countRow = await new Promise<{ cnt: number }>((resolve, reject) => {
      pool.get(countSql, (err, r) => (err ? reject(err) : resolve(r as { cnt: number })));
    });

    return { columns, indices, rowCount: countRow.cnt };
  }

  async getRelationships(): Promise<Relationship[]> {
    return [];
  }

  async getDatabaseMetrics(pool: Database): Promise<DatabaseMetrics> {
    const tables = await this.getTables(pool, '', '');
    return {
      tableCount: tables.length,
      sizeBytes: 0,
      activeConnections: 1,
      topTables: [],
      tableTypes: [{ type: 'table', count: tables.length }],
    };
  }

  async getHierarchyNodes(pool: Database, parentId: string | null): Promise<TreeNodeResult[]> {
    if (!parentId) return this.getSchemas(pool);
    if (parentId === 'schema:main') return this.getTables(pool, '');
    if (parentId.startsWith('schema:main.folder:tables')) return this.getTables(pool, '');
    return [];
  }

  async seedData(pool: Database): Promise<QueryResult> {
    const sql = `
      CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT, email TEXT UNIQUE);
      CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY, name TEXT, price REAL, stock INTEGER);
      INSERT OR IGNORE INTO users (name, email) VALUES ('Alice', 'alice@example.com'), ('Bob', 'bob@example.com');
      INSERT OR IGNORE INTO products (name, price, stock) VALUES ('Laptop', 999.99, 10);
    `;
    return this.executeQuery(pool, sql);
  }
}
