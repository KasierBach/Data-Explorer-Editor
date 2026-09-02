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
import { Injectable, BadRequestException } from '@nestjs/common';
import Redis from 'ioredis';
import { allowInsecureDatabaseTls } from '../common/utils/database-network.util';

// Read-only commands allowed through the generic query endpoint; writes go
// through updateRow/insertRow/deleteRows.
const REDIS_READ_COMMANDS = new Set([
  'GET',
  'MGET',
  'KEYS',
  'SCAN',
  'TYPE',
  'TTL',
  'PTTL',
  'EXISTS',
  'STRLEN',
  'LRANGE',
  'SMEMBERS',
  'HGETALL',
  'HGET',
  'ZRANGE',
  'ZCARD',
  'LLEN',
  'SCARD',
  'HLEN',
  'DBSIZE',
  'INFO',
  'PING',
  'RANDOMKEY',
]);

const MAX_SCAN_COUNT = 500;

@Injectable()
export class RedisStrategy implements IDatabaseStrategy {
  createPool(
    connectionConfig: ConnectionConfig,
    databaseOverride?: string,
  ): Redis {
    const host = connectionConfig.host?.trim();
    if (!host) {
      throw new Error('Host is required for Redis connections.');
    }

    const dbIndex = Number(databaseOverride ?? connectionConfig.database ?? 0);
    return new Redis({
      host,
      port: connectionConfig.port || 6379,
      username: connectionConfig.username || undefined,
      password: connectionConfig.password || undefined,
      db: Number.isInteger(dbIndex) && dbIndex >= 0 ? dbIndex : 0,
      connectTimeout: connectionConfig.statementTimeout ?? 10_000,
      commandTimeout: connectionConfig.queryTimeout ?? 10_000,
      maxRetriesPerRequest: 1,
      tls: connectionConfig.tls
        ? { rejectUnauthorized: !allowInsecureDatabaseTls() }
        : undefined,
      lazyConnect: false,
    });
  }

  async closePool(pool: unknown): Promise<void> {
    const client = pool as Redis;
    if (client && typeof client.disconnect === 'function') {
      client.disconnect();
    }
  }

  quoteIdentifier(name: string): string {
    return name;
  }

  quoteTable(schema: string | undefined, table: string): string {
    return schema ? `${schema}:${table}` : table;
  }

  async executeQuery(
    pool: unknown,
    sql: string,
    options?: { limit?: number; offset?: number },
  ): Promise<QueryResult> {
    const client = pool as Redis;
    const trimmed = sql.trim();
    if (!trimmed) {
      throw new BadRequestException('Empty Redis command.');
    }

    const parts = trimmed.split(/\s+/);
    const command = parts[0].toUpperCase();
    if (!REDIS_READ_COMMANDS.has(command)) {
      throw new BadRequestException(
        `Redis command "${command}" is not allowed. Only read-only commands are supported here; use the grid to edit values.`,
      );
    }

    const args = parts.slice(1);
    const limit = Math.min(options?.limit ?? 100, MAX_SCAN_COUNT);
    const offset = options?.offset ?? 0;

    // SCAN-based browsing with pagination.
    if (command === 'SCAN' || command === 'KEYS') {
      const pattern = args.find((a) => a.includes('*')) ?? '*';
      const keys = await this.scanKeys(client, pattern, limit + offset);
      const page = keys.slice(offset, offset + limit);
      return {
        rows: page.map((key) => ({ key })),
        columns: ['key'],
        rowCount: page.length,
        totalCount: keys.length,
        hasNextPage: offset + limit < keys.length,
        countStatus: 'available',
      };
    }

    if (command === 'INFO') {
      const section = args[0];
      const raw = await client.info(section);
      const rows = raw
        .split('\r\n')
        .filter((line) => line && !line.startsWith('#'))
        .map((line) => {
          const idx = line.indexOf(':');
          return {
            field: line.substring(0, idx),
            value: line.substring(idx + 1),
          };
        });
      return {
        rows: rows.slice(offset, offset + limit),
        columns: ['field', 'value'],
        rowCount: rows.length,
        truncated: rows.length > limit,
      };
    }

    if (command === 'DBSIZE') {
      const count = await client.dbsize();
      return {
        rows: [{ keyCount: count }],
        columns: ['keyCount'],
        rowCount: 1,
      };
    }

    // Generic single-result read commands (GET, TTL, TYPE, ...).
    const result = await client.call(command, ...args);
    const normalized = this.normalizeRedisValue(result);
    return {
      rows: [{ result: normalized }],
      columns: ['result'],
      rowCount: 1,
    };
  }

  async cancelActiveQuery(): Promise<boolean> {
    // Redis commands are atomic and fast; there is no in-flight cancel.
    return false;
  }

  async runStatementsInTransaction(
    pool: unknown,
    statements: string[],
  ): Promise<QueryResult> {
    // Execute each whitelisted command sequentially (no MULTI for safety).
    let last: QueryResult = { rows: [], columns: [], rowCount: 0 };
    for (const statement of statements) {
      last = await this.executeQuery(pool, statement);
    }
    return last;
  }

  async updateRow(
    pool: unknown,
    params: UpdateRowParams,
  ): Promise<{ success: boolean; rowCount: number }> {
    const client = pool as Redis;
    const value = params.updates['value'];
    if (value === undefined) {
      throw new BadRequestException('Redis updates require a "value" field.');
    }
    const key = params.pkValue as string;
    const result = await client.set(key, this.serializeValue(value));
    return { success: result === 'OK', rowCount: 1 };
  }

  async insertRow(
    pool: unknown,
    params: InsertRowParams,
  ): Promise<{ success: boolean; rowCount: number }> {
    const client = pool as Redis;
    const key = params.data['key'];
    const value = params.data['value'];
    if (typeof key !== 'string' || value === undefined) {
      throw new BadRequestException(
        'Redis inserts require "key" and "value" fields.',
      );
    }
    const result = await client.set(key, this.serializeValue(value));
    return { success: result === 'OK', rowCount: 1 };
  }

  async deleteRows(
    pool: unknown,
    params: DeleteRowsParams,
  ): Promise<{ success: boolean; rowCount: number }> {
    const client = pool as Redis;
    if (params.pkValues.length === 0) return { success: true, rowCount: 0 };
    const deleted = await client.del(...(params.pkValues as string[]));
    return { success: true, rowCount: deleted };
  }

  buildAlterTableSql(): string {
    throw new BadRequestException(
      'Schema operations are not supported for Redis.',
    );
  }

  async createDatabase(): Promise<void> {
    throw new BadRequestException(
      'Redis databases are fixed (0-15); use the database selector instead.',
    );
  }

  async dropDatabase(): Promise<void> {
    throw new BadRequestException(
      'Dropping Redis databases is not supported for safety.',
    );
  }

  async getDatabases(pool: unknown): Promise<TreeNodeResult[]> {
    const client = pool as Redis;
    const info = await client.info('keyspace');
    const dbs = new Set<number>([0]);
    for (const line of info.split('\r\n')) {
      const match = line.match(/^db(\d+):/);
      if (match) dbs.add(Number(match[1]));
    }
    return [...dbs]
      .sort((a, b) => a - b)
      .map((db) => ({
        id: String(db),
        name: `db${db}`,
        type: 'database',
        parentId: '',
        hasChildren: true,
      }));
  }

  async getSchemas(): Promise<TreeNodeResult[]> {
    return [];
  }

  async getTables(pool: unknown, schema: string): Promise<TreeNodeResult[]> {
    const client = pool as Redis;
    const keys = await this.scanKeys(client, '*', MAX_SCAN_COUNT);
    return keys.map((key) => ({
      id: `${schema}:${key}`,
      name: key,
      type: 'key',
      parentId: schema,
      hasChildren: false,
    }));
  }

  async getViews(): Promise<TreeNodeResult[]> {
    return [];
  }

  async getFunctions(): Promise<TreeNodeResult[]> {
    return [];
  }

  async getFunctionParameters(): Promise<ColumnInfo[]> {
    return [];
  }

  async getColumns(
    pool: unknown,
    schema: string,
    table: string,
  ): Promise<ColumnInfo[]> {
    const client = pool as Redis;
    const type = await client.type(table);
    const ttl = await client.ttl(table);
    return [
      {
        name: 'key',
        type: 'string',
        isNullable: false,
        defaultValue: null,
        isPrimaryKey: true,
        pkConstraintName: null,
      },
      {
        name: 'type',
        type: 'string',
        isNullable: false,
        defaultValue: type,
        isPrimaryKey: false,
        pkConstraintName: null,
      },
      {
        name: 'ttl',
        type: 'integer',
        isNullable: false,
        defaultValue: ttl,
        isPrimaryKey: false,
        pkConstraintName: null,
      },
      {
        name: 'value',
        type: type === 'string' ? 'string' : 'json',
        isNullable: true,
        defaultValue: null,
        isPrimaryKey: false,
        pkConstraintName: null,
      },
    ];
  }

  async getIndexes(): Promise<TreeNodeResult[]> {
    return [];
  }

  async getTriggers(): Promise<TreeNodeResult[]> {
    return [];
  }

  async getConstraints(): Promise<TreeNodeResult[]> {
    return [];
  }

  async getFullMetadata(
    pool: unknown,
    schema: string,
    table: string,
  ): Promise<FullTableMetadata> {
    const columns = await this.getColumns(pool, schema, table);
    return { columns, indices: [], comment: null };
  }

  async getRelationships(): Promise<Relationship[]> {
    return [];
  }

  async getDatabaseMetrics(pool: unknown): Promise<DatabaseMetrics> {
    const client = pool as Redis;
    const keyCount = await client.dbsize();
    const info = await client.info('memory');
    const usedMatch = info.match(/used_memory:(\d+)/);
    const clientsMatch = (await client.info('clients')).match(
      /connected_clients:(\d+)/,
    );
    return {
      tableCount: keyCount,
      sizeBytes: usedMatch ? Number(usedMatch[1]) : 0,
      activeConnections: clientsMatch ? Number(clientsMatch[1]) : 0,
      topTables: [],
      tableTypes: [{ type: 'keys', count: keyCount }],
    };
  }

  async importData(
    pool: unknown,
    params: { schema: string; table: string; data: Record<string, unknown>[] },
  ): Promise<{ success: boolean; rowCount: number }> {
    const client = pool as Redis;
    let imported = 0;
    for (const row of params.data) {
      const key = row['key'];
      const value = row['value'];
      if (typeof key === 'string' && value !== undefined) {
        await client.set(key, this.serializeValue(value));
        imported++;
      }
    }
    return { success: true, rowCount: imported };
  }

  async exportStream(
    pool: unknown,
    schema: string,
    table: string,
  ): Promise<unknown> {
    const client = pool as Redis;
    const type = await client.type(table);
    const value = await this.readKeyValue(client, table, type);
    return JSON.stringify({ key: table, type, value }, null, 2);
  }

  async getHierarchyNodes(
    pool: unknown,
    parentId: string | null,
  ): Promise<TreeNodeResult[]> {
    if (parentId === null) {
      return this.getDatabases(pool);
    }
    return this.getTables(pool, parentId);
  }

  async seedData(): Promise<QueryResult> {
    return { rows: [], columns: [], rowCount: 0 };
  }

  async getSampleRows(
    pool: unknown,
    schema: string,
    table: string,
    limit: number,
  ): Promise<Record<string, unknown>[]> {
    const client = pool as Redis;
    const type = await client.type(table);
    const value = await this.readKeyValue(client, table, type);
    const ttl = await client.ttl(table);
    return [{ key: table, type, ttl, value }].slice(0, limit);
  }

  /** Serialize a cell value for Redis storage (JSON for structured data). */
  private serializeValue(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      typeof value === 'bigint'
    ) {
      return String(value);
    }
    return JSON.stringify(value);
  }

  /** SCAN a pattern without blocking the server (never use KEYS in prod). */
  private async scanKeys(
    client: Redis,
    pattern: string,
    max: number,
  ): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';
    do {
      const [next, batch] = await client.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100,
      );
      cursor = next;
      keys.push(...batch);
    } while (cursor !== '0' && keys.length < max);
    return keys.slice(0, max);
  }

  private async readKeyValue(
    client: Redis,
    key: string,
    type: string,
  ): Promise<unknown> {
    switch (type) {
      case 'string':
        return client.get(key);
      case 'list':
        return client.lrange(key, 0, -1);
      case 'set':
        return client.smembers(key);
      case 'hash':
        return client.hgetall(key);
      case 'zset':
        return client.zrange(key, 0, -1, 'WITHSCORES');
      default:
        return null;
    }
  }

  private normalizeRedisValue(value: unknown): unknown {
    if (value === null || value === undefined) return null;
    if (Array.isArray(value)) {
      return value.map((v) => this.normalizeRedisValue(v));
    }
    if (value instanceof Buffer) return value.toString('utf8');
    if (typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        out[k] = this.normalizeRedisValue(v);
      }
      return out;
    }
    return value;
  }
}
