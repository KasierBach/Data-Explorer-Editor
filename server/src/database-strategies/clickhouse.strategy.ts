import type {
  IDatabaseStrategy, TreeNodeResult, ColumnInfo, QueryResult,
  UpdateRowParams, InsertRowParams, DeleteRowsParams,
  FullTableMetadata, IndexInfo, Relationship, DatabaseMetrics,
  ConnectionConfig,
} from './database-strategy.interface';
import { SchemaOperation } from '../query/dto/schema-operations.types';
import { Injectable } from '@nestjs/common';
import { createClient, ClickHouseClient } from '@clickhouse/client';

@Injectable()
export class ClickHouseStrategy implements IDatabaseStrategy {
  createPool(connectionConfig: ConnectionConfig): ClickHouseClient {
    return createClient({
      host: `http://${connectionConfig.host}:${connectionConfig.port || 8123}`,
      username: connectionConfig.username || 'default',
      password: connectionConfig.password || '',
      database: connectionConfig.database || 'default',
      request_timeout: 30000,
    });
  }

  async closePool(pool: ClickHouseClient): Promise<void> {
    await pool.close();
  }

  quoteIdentifier(name: string): string {
    return `\`${name.replace(/`/g, '``')}\``;
  }

  quoteTable(schema: string | undefined, table: string): string {
    return schema ? `${this.quoteIdentifier(schema)}.${this.quoteIdentifier(table)}` : this.quoteIdentifier(table);
  }

  async executeQuery(pool: ClickHouseClient, sql: string, options?: { limit?: number; offset?: number }): Promise<QueryResult> {
    let safeSql = sql;
    if (!/LIMIT\s+\d+/i.test(safeSql)) {
      safeSql += ' LIMIT 50000';
    }
    if (options?.offset !== undefined) {
      safeSql += ` OFFSET ${options.offset}`;
    }

    const resultSet = await pool.query({ query: safeSql, format: 'JSONEachRow' });
    const rows = (await resultSet.json()) as Record<string, unknown>[];
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    return { rows: rows.slice(0, 50000), columns, rowCount: rows.length };
  }

  async updateRow(pool: ClickHouseClient, params: UpdateRowParams): Promise<{ success: boolean; rowCount: number }> {
    const { schema, table, pkColumn, pkValue, updates } = params;
    const cols = Object.keys(updates);
    if (cols.length === 0) return { success: false, rowCount: 0 };

    const setClause = cols.map((c) => `${this.quoteIdentifier(c)} = {${c}:String}`).join(', ');
    const sql = `ALTER TABLE ${this.quoteTable(schema, table)} UPDATE ${setClause} WHERE ${this.quoteIdentifier(pkColumn)} = {pk:String}`;
    const values: Record<string, unknown> = { ...updates, pk: pkValue };

    await pool.exec({ query: sql, query_params: values });
    return { success: true, rowCount: 1 };
  }

  async insertRow(pool: ClickHouseClient, params: InsertRowParams): Promise<{ success: boolean; rowCount: number }> {
    const { schema, table, data } = params;
    const cols = Object.keys(data);
    if (cols.length === 0) return { success: false, rowCount: 0 };

    const sql = `INSERT INTO ${this.quoteTable(schema, table)} (${cols.map((c) => this.quoteIdentifier(c)).join(', ')}) VALUES (${cols.map((c) => `{${c}:String}`).join(', ')})`;
    await pool.exec({ query: sql, query_params: data });
    return { success: true, rowCount: 1 };
  }

  async deleteRows(pool: ClickHouseClient, params: DeleteRowsParams): Promise<{ success: boolean; rowCount: number }> {
    const { schema, table, pkColumn, pkValues } = params;
    if (pkValues.length === 0) return { success: true, rowCount: 0 };

    const placeholders = pkValues.map((_v, i) => `{pk${i}:String}`).join(', ');
    const sql = `ALTER TABLE ${this.quoteTable(schema, table)} DELETE WHERE ${this.quoteIdentifier(pkColumn)} IN (${placeholders})`;
    const values: Record<string, unknown> = {};
    pkValues.forEach((v, i) => (values[`pk${i}`] = v));

    await pool.exec({ query: sql, query_params: values });
    return { success: true, rowCount: pkValues.length };
  }

  async importData(pool: ClickHouseClient, params: { schema: string; table: string; data: Record<string, unknown>[] }): Promise<{ success: boolean; rowCount: number }> {
    const { schema, table, data } = params;
    if (!data || data.length === 0) return { success: true, rowCount: 0 };

    await pool.insert({
      table: this.quoteTable(schema, table),
      values: data,
      format: 'JSONEachRow',
    });
    return { success: true, rowCount: data.length };
  }

  async exportStream(pool: ClickHouseClient, schema: string, table: string): Promise<unknown> {
    const resultSet = await pool.query({
      query: `SELECT * FROM ${this.quoteTable(schema, table)}`,
      format: 'JSONEachRow',
    });
    return resultSet.stream();
  }

  buildAlterTableSql(quotedTable: string, op: SchemaOperation): string {
    switch (op.type) {
      case 'add_column':
        return `ALTER TABLE ${quotedTable} ADD COLUMN "${op.name}" ${op.dataType}`;
      case 'drop_column':
        return `ALTER TABLE ${quotedTable} DROP COLUMN "${op.name}"`;
      case 'alter_column_type':
        return `ALTER TABLE ${quotedTable} MODIFY COLUMN "${op.name}" ${op.newType}`;
      case 'rename_column':
        return `ALTER TABLE ${quotedTable} RENAME COLUMN "${op.name}" TO "${op.newName}"`;
      default:
        return '';
    }
  }

  async createDatabase(pool: ClickHouseClient, name: string): Promise<void> {
    await pool.exec({ query: `CREATE DATABASE IF NOT EXISTS ${this.quoteIdentifier(name)}` });
  }

  async dropDatabase(pool: ClickHouseClient, name: string): Promise<void> {
    await pool.exec({ query: `DROP DATABASE IF EXISTS ${this.quoteIdentifier(name)}` });
  }

  async getDatabases(pool: ClickHouseClient): Promise<TreeNodeResult[]> {
    const resultSet = await pool.query({ query: 'SHOW DATABASES', format: 'JSONEachRow' });
    const rows = (await resultSet.json()) as { name: string }[];
    return rows.map((r) => ({ id: `db:${r.name}`, name: r.name, type: 'database', parentId: 'root', hasChildren: true }));
  }

  async getSchemas(): Promise<TreeNodeResult[]> {
    return [{ id: 'schema:default', name: 'default', type: 'schema', parentId: 'root', hasChildren: true }];
  }

  async getTables(pool: ClickHouseClient, schema: string): Promise<TreeNodeResult[]> {
    const resultSet = await pool.query({ query: `SHOW TABLES FROM ${this.quoteIdentifier(schema)}`, format: 'JSONEachRow' });
    const rows = (await resultSet.json()) as { name: string }[];
    return rows.map((r) => ({ id: `schema:${schema}.table:${r.name}`, name: r.name, type: 'table', parentId: `schema:${schema}`, hasChildren: true }));
  }

  async getViews(pool: ClickHouseClient, schema: string): Promise<TreeNodeResult[]> {
    const resultSet = await pool.query({
      query: `SELECT name FROM system.tables WHERE database = {db:String} AND engine = 'View'`,
      query_params: { db: schema },
      format: 'JSONEachRow',
    });
    const rows = (await resultSet.json()) as { name: string }[];
    return rows.map((r) => ({ id: `schema:${schema}.view:${r.name}`, name: r.name, type: 'view', parentId: `schema:${schema}`, hasChildren: true }));
  }

  async getFunctions(): Promise<TreeNodeResult[]> {
    return [];
  }

  async getFunctionParameters(): Promise<ColumnInfo[]> {
    return [];
  }

  async getColumns(pool: ClickHouseClient, schema: string, table: string): Promise<ColumnInfo[]> {
    const resultSet = await pool.query({
      query: `DESCRIBE TABLE ${this.quoteTable(schema, table)}`,
      format: 'JSONEachRow',
    });
    const rows = (await resultSet.json()) as { name: string; type: string; default_expression: string }[];
    return rows.map((r) => ({
      name: r.name,
      type: r.type,
      isNullable: !r.type.includes('NotNull') && !r.type.includes('NOT NULL'),
      defaultValue: r.default_expression || null,
      isPrimaryKey: false,
      pkConstraintName: null,
    }));
  }

  async getFullMetadata(pool: ClickHouseClient, schema: string, table: string): Promise<FullTableMetadata> {
    const columns = await this.getColumns(pool, schema, table);
    const resultSet = await pool.query({
      query: `SELECT total_rows FROM system.tables WHERE database = {db:String} AND name = {tbl:String}`,
      query_params: { db: schema, tbl: table },
      format: 'JSONEachRow',
    });
    const rows = (await resultSet.json()) as { total_rows: number }[];
    return { columns, indices: [], rowCount: rows[0]?.total_rows || 0 };
  }

  async getRelationships(): Promise<Relationship[]> {
    return [];
  }

  async getDatabaseMetrics(pool: ClickHouseClient): Promise<DatabaseMetrics> {
    const resultSet = await pool.query({ query: 'SHOW TABLES', format: 'JSONEachRow' });
    const rows = (await resultSet.json()) as unknown[];
    return {
      tableCount: rows.length,
      sizeBytes: 0,
      activeConnections: 1,
      topTables: [],
      tableTypes: [{ type: 'table', count: rows.length }],
    };
  }

  async getHierarchyNodes(pool: ClickHouseClient, parentId: string | null, _parsedParams: unknown, connectionInfo: unknown): Promise<TreeNodeResult[]> {
    if (!parentId) {
      if ((connectionInfo as { showAllDatabases?: boolean }).showAllDatabases) return this.getDatabases(pool);
      return this.getSchemas();
    }
    return [];
  }

  async seedData(pool: ClickHouseClient): Promise<QueryResult> {
    await pool.exec({ query: `CREATE TABLE IF NOT EXISTS users (id UInt32, name String, email String) ENGINE = MergeTree() ORDER BY id` });
    await pool.exec({ query: `INSERT INTO users VALUES (1, 'Alice', 'alice@example.com'), (2, 'Bob', 'bob@example.com')` });
    return { rows: [], columns: [], rowCount: 0 };
  }
}
