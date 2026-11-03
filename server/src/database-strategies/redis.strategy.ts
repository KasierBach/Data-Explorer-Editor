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
export const REDIS_READ_COMMANDS = new Set([
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
const MAX_COLLECTION_ITEMS = 500;
const MAX_SCAN_ITERATIONS = 100;
const MAX_SCAN_WORK_KEYS = 5_000;
// Runtime-result safety default, NOT a product quota or a JSON/heap-size limit.
// Scalars use exact UTF-8 byte lengths; collections use full Redis memory usage
// plus 32 bytes per returned string for integer/score expansion. No sampling.
const MAX_RESULT_BYTES = 1024 * 1024;

// Fixed internal source only. EVAL_RO (Redis 7+) atomically checks before reads;
// there is deliberately no EVAL fallback and no caller-supplied Lua entrypoint.
const SAFE_READ_SCRIPT = `#!lua flags=no-writes
-- data-explorer:safe-read
local operation = ARGV[1]
local bytes = 0
local function fail(message)
  error('DE_REDIS_SAFETY ' .. message, 0)
end
local function reserve(size)
  bytes = bytes + size
  if bytes > ${MAX_RESULT_BYTES} then
    fail('1 MiB runtime-result byte budget exceeded; complete read unavailable. Read smaller values with a bounded external Redis client.')
  end
end
local function scalar(key, field)
  if field then
    reserve(redis.call('HSTRLEN', key, field) + 32)
    return redis.call('HGET', key, field)
  end
  reserve(redis.call('STRLEN', key) + 32)
  return redis.call('GET', key)
end
local countCommands = {list='LLEN', set='SCARD', hash='HLEN', zset='ZCARD'}
local encodings = {
  list={listpack=true},
  set={intset=true, listpack=true, hashtable=true},
  hash={listpack=true, hashtable=true},
  zset={listpack=true, skiplist=true}
}
local function collection(key, kind, start, stop, scores)
  local count = redis.call(countCommands[kind], key)
  if count > ${MAX_COLLECTION_ITEMS} then
    fail('Redis ' .. kind .. ' contains more than ${MAX_COLLECTION_ITEMS} items; complete reads and finite ranges over larger backing collections are unsupported. Use a bounded external Redis client.')
  end
  -- Missing keys/empty collections must never turn into a 0,-1 read.
  if count == 0 then return {} end
  local encoding = redis.call('OBJECT', 'ENCODING', key)
  if not encodings[kind][encoding] then
    -- MEMORY USAGE can count compressed quicklist storage, not expanded values.
    -- Reject it rather than inventing an expansion factor or fetching to measure.
    fail('Redis ' .. kind .. ' encoding ' .. tostring(encoding) .. ' cannot prove an uncompressed byte bound; only supported uncompressed encodings can be read/exported.')
  end
  local memory = redis.call('MEMORY', 'USAGE', key, 'SAMPLES', 0)
  if type(memory) ~= 'number' then fail('Redis memory accounting unavailable; complete read refused.') end
  local strings = count * ((kind == 'hash' or kind == 'zset') and 2 or 1)
  reserve(memory + strings * 32)
  if kind == 'set' then return redis.call('SMEMBERS', key) end
  if kind == 'hash' then return redis.call('HGETALL', key) end
  local first = start or 0
  local last = stop or (count - 1)
  if first < 0 or last < first or last - first + 1 > ${MAX_COLLECTION_ITEMS} then
    fail('Range must be finite and contain at most ${MAX_COLLECTION_ITEMS} items.')
  end
  if kind == 'list' then return redis.call('LRANGE', key, first, last) end
  if scores then return redis.call('ZRANGE', key, first, last, 'WITHSCORES') end
  return redis.call('ZRANGE', key, first, last)
end
if operation == 'INFO' then
  local info
  if ARGV[2] then info = redis.call('INFO', ARGV[2]) else info = redis.call('INFO') end
  reserve(#info)
  return info
end
if operation == 'RANDOMKEY' then
  local key = redis.call('RANDOMKEY')
  if key then reserve(#key) end
  return key
end
if operation == 'MGET' then
  if #KEYS < 1 or #KEYS > ${MAX_COLLECTION_ITEMS} then fail('MGET supports 1 to ${MAX_COLLECTION_ITEMS} keys.') end
  for _, key in ipairs(KEYS) do
    -- MGET returns nil for non-strings rather than WRONGTYPE.
    if redis.call('TYPE', key).ok == 'string' then reserve(redis.call('STRLEN', key)) end
    reserve(32)
  end
  return redis.call('MGET', unpack(KEYS))
end
local key = KEYS[1]
if operation == 'GET' then return scalar(key) end
if operation == 'HGET' then return scalar(key, ARGV[2]) end
if operation == 'SMEMBERS' then return collection(key, 'set') end
if operation == 'HGETALL' then return collection(key, 'hash') end
if operation == 'LRANGE' then return collection(key, 'list', tonumber(ARGV[2]), tonumber(ARGV[3])) end
if operation == 'ZRANGE' then return collection(key, 'zset', tonumber(ARGV[2]), tonumber(ARGV[3])) end
if operation == 'SNAPSHOT' then
  reserve(#key + 256)
  local kind = redis.call('TYPE', key).ok
  local value = false
  if kind == 'string' then value = scalar(key)
  elseif countCommands[kind] then value = collection(key, kind, nil, nil, true)
  elseif kind ~= 'none' then fail('Unsupported Redis type ' .. kind .. '; complete sample/export unavailable.') end
  return {kind, redis.call('TTL', key), value}
end
fail('Unsupported internal read operation.')
`;

const SAFE_SCAN_SCRIPT = `#!lua flags=no-writes
-- data-explorer:safe-scan
local function fail(message)
  error('DE_REDIS_SAFETY ' .. message, 0)
end
-- COUNT is only a hint. Limit the entire backing keyspace before SCAN so a
-- collision-heavy terminal reply cannot cause unbounded server traversal.
if redis.call('DBSIZE') > ${MAX_SCAN_WORK_KEYS} then
  fail('SCAN keyspace exceeds ${MAX_SCAN_WORK_KEYS} keys; safe browsing unsupported. Use an external cursor-based Redis client.')
end
local reply
if ARGV[4] ~= '' then
  reply = redis.call('SCAN', ARGV[1], 'MATCH', ARGV[2], 'COUNT', ARGV[3], 'TYPE', ARGV[4])
else
  reply = redis.call('SCAN', ARGV[1], 'MATCH', ARGV[2], 'COUNT', ARGV[3])
end
local bytes = 0
for _, key in ipairs(reply[2]) do
  bytes = bytes + #key + 32
end
if #reply[2] > tonumber(ARGV[5]) or bytes > ${MAX_RESULT_BYTES} then
  fail('SCAN reply exceeds the remaining ${MAX_SCAN_WORK_KEYS}-key work / 1 MiB byte budget; retry SCAN ' .. ARGV[1] .. ' with a smaller COUNT. No partial page returned.')
end
return reply
`;

function parseInteger(value: string): number | undefined {
  if (!/^-?\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

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
    if (
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      !Number.isSafeInteger(offset) ||
      offset < 0
    ) {
      throw new BadRequestException('Invalid Redis result page bounds.');
    }
    if (Buffer.byteLength(trimmed, 'utf8') > MAX_RESULT_BYTES) {
      throw new BadRequestException(
        'Redis command exceeds the 1 MiB runtime safety byte budget.',
      );
    }
    this.assertBoundedRead(command, args);

    // SCAN-based browsing with pagination.
    if (command === 'SCAN' || command === 'KEYS') {
      if (
        !Number.isSafeInteger(limit) ||
        limit < 1 ||
        !Number.isSafeInteger(offset) ||
        offset < 0 ||
        !Number.isSafeInteger(limit + offset + 1) ||
        limit + offset > MAX_SCAN_COUNT
      ) {
        throw new BadRequestException('Invalid Redis key page bounds.');
      }
      const scan = this.parseKeyScan(command, args);
      const { keys, totalCount } = await this.scanKeys(
        client,
        scan.pattern,
        limit + offset + 1,
        scan,
      );
      const page = keys.slice(offset, offset + limit);
      const hasNextPage = keys.length > offset + limit;
      return {
        rows: page.map((key) => ({ key })),
        columns: ['key'],
        rowCount: page.length,
        ...(totalCount !== undefined ? { totalCount } : {}),
        hasNextPage,
        truncated: hasNextPage || undefined,
        countStatus: totalCount !== undefined ? 'available' : 'unavailable',
        appliedLimit: limit,
        appliedOffset: offset,
        limitSource:
          options?.limit !== undefined ? 'requested' : 'protective_default',
      };
    }

    if (command === 'INFO') {
      const raw = (await this.runReadOnlyScript(
        client,
        SAFE_READ_SCRIPT,
        [],
        ['INFO', ...args],
      )) as string;
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

    // Fixed scripts cover all commands that can return stored strings/arrays.
    // Numeric/type replies remain direct, preserving Redis WRONGTYPE behavior.
    const storedValueReads = [
      'GET',
      'MGET',
      'HGET',
      'SMEMBERS',
      'HGETALL',
      'LRANGE',
      'ZRANGE',
      'RANDOMKEY',
    ];
    const keys =
      command === 'MGET'
        ? args
        : command === 'RANDOMKEY'
          ? []
          : args.slice(0, 1);
    const result = storedValueReads.includes(command)
      ? await this.runReadOnlyScript(client, SAFE_READ_SCRIPT, keys, [
          command,
          ...(command === 'MGET' || command === 'RANDOMKEY'
            ? []
            : args.slice(1)),
        ])
      : await client.call(command, ...args);
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
    const { keys } = await this.scanKeys(client, '*', MAX_SCAN_COUNT);
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
    const { type, value } = await this.readKeyValue(client, table);
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
    if (!Number.isSafeInteger(limit) || limit < 0) {
      throw new BadRequestException('Invalid Redis sample row limit.');
    }
    if (limit === 0) return [];
    const client = pool as Redis;
    const { type, ttl, value } = await this.readKeyValue(client, table);
    return [{ key: table, type, ttl, value }];
  }

  private assertBoundedRead(command: string, args: string[]): void {
    if (command === 'SCAN' || command === 'KEYS') return;
    const singleKey = [
      'GET',
      'TYPE',
      'TTL',
      'PTTL',
      'STRLEN',
      'SMEMBERS',
      'HGETALL',
      'ZCARD',
      'LLEN',
      'SCARD',
      'HLEN',
    ];
    const arity = singleKey.includes(command)
      ? 1
      : command === 'HGET'
        ? 2
        : undefined;
    if (arity !== undefined && args.length !== arity) {
      throw new BadRequestException(
        `${command} requires exactly ${arity} argument${arity === 1 ? '' : 's'}.`,
      );
    }
    if (['DBSIZE', 'RANDOMKEY'].includes(command) && args.length !== 0) {
      throw new BadRequestException(`${command} does not accept arguments.`);
    }
    if (['PING', 'INFO'].includes(command) && args.length > 1) {
      throw new BadRequestException(`${command} accepts at most one argument.`);
    }
    if (command === 'MGET' || command === 'EXISTS') {
      if (args.length < 1 || args.length > MAX_COLLECTION_ITEMS) {
        throw new BadRequestException(
          `${command} supports between 1 and ${MAX_COLLECTION_ITEMS} keys.`,
        );
      }
      return;
    }
    if (command === 'LRANGE' || command === 'ZRANGE') {
      if (args.length !== 3) {
        throw new BadRequestException(
          `${command} requires a key, start and stop.`,
        );
      }
      const start = parseInteger(args[1]);
      const stop = parseInteger(args[2]);
      if (
        start === undefined ||
        stop === undefined ||
        start < 0 ||
        stop < start ||
        stop - start + 1 > MAX_COLLECTION_ITEMS
      ) {
        throw new BadRequestException(
          `${command} must request a finite range of at most ${MAX_COLLECTION_ITEMS} items.`,
        );
      }
    }
  }

  private async runReadOnlyScript(
    client: Redis,
    script: string,
    keys: string[],
    args: string[],
  ): Promise<unknown> {
    try {
      return await client.eval_ro(script, keys.length, ...keys, ...args);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const safety = message.match(/DE_REDIS_SAFETY ([^\r\n]*)/);
      if (safety) throw new BadRequestException(safety[1]);
      if (
        /unknown command.*eval_ro|NOPERM|not allowed.*script|cannot be called from.*script/i.test(
          message,
        )
      ) {
        throw new BadRequestException(
          'Safe Redis reads require Redis 7+ EVAL_RO and ACL access to the internal read-only length/cardinality, OBJECT ENCODING and MEMORY USAGE checks. No unsafe fallback was used.',
        );
      }
      // Keep native WRONGTYPE/timeouts/connectivity failures intact for the caller.
      throw error;
    }
  }

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

  private parseKeyScan(command: string, args: string[]) {
    if (command === 'KEYS') {
      if (args.length !== 1) {
        throw new BadRequestException('KEYS requires exactly one pattern.');
      }
      return { pattern: args[0], cursor: '0', count: 100, type: undefined };
    }
    const cursor = args[0];
    if (!cursor || !/^\d+$/.test(cursor) || (args.length - 1) % 2 !== 0) {
      throw new BadRequestException(
        'SCAN requires a cursor and valid option pairs.',
      );
    }
    let pattern = '*';
    let count = 100;
    let type: string | undefined;
    for (let index = 1; index < args.length; index += 2) {
      const option = args[index].toUpperCase();
      const value = args[index + 1];
      if (option === 'MATCH') {
        pattern = value;
      } else if (
        option === 'COUNT' &&
        /^\d+$/.test(value) &&
        Number.isSafeInteger(Number(value)) &&
        Number(value) > 0
      ) {
        count = Math.min(Number(value), MAX_SCAN_COUNT);
      } else if (option === 'TYPE') {
        type = value;
      } else {
        throw new BadRequestException(
          'Invalid SCAN option; use MATCH, positive COUNT or TYPE.',
        );
      }
    }
    return { pattern, cursor, count, type };
  }

  /** SCAN a pattern without blocking the server (never use KEYS in prod). */
  private async scanKeys(
    client: Redis,
    pattern: string,
    max: number,
    options: { cursor?: string; count?: number; type?: string } = {},
  ): Promise<{ keys: string[]; totalCount?: number }> {
    const keys = new Set<string>();
    let cursor = options.cursor ?? '0';
    const fromStart = /^0+$/.test(cursor);
    let iterations = 0;
    let workKeys = 0;
    let keyBytes = 0;
    do {
      if (iterations >= MAX_SCAN_ITERATIONS || workKeys >= MAX_SCAN_WORK_KEYS) {
        throw new BadRequestException(
          `Redis SCAN work budget exhausted (${MAX_SCAN_ITERATIONS} iterations / ${MAX_SCAN_WORK_KEYS} processed keys). Retry SCAN ${cursor} MATCH ${pattern} with a smaller COUNT; no complete page or exact count was returned.`,
        );
      }
      const [next, batch] = (await this.runReadOnlyScript(
        client,
        SAFE_SCAN_SCRIPT,
        [],
        [
          cursor,
          pattern,
          String(options.count ?? 100),
          options.type ?? '',
          String(MAX_SCAN_WORK_KEYS - workKeys),
        ],
      )) as [string, string[]];
      iterations++;
      cursor = next;
      workKeys += batch.length;
      for (const key of batch) {
        if (!keys.has(key)) {
          keyBytes += Buffer.byteLength(key, 'utf8') + 32;
          if (keyBytes > MAX_RESULT_BYTES) {
            throw new BadRequestException(
              `Redis SCAN 1 MiB cumulative key byte budget exceeded; use a smaller page/COUNT or an external cursor-based client. No complete result was returned.`,
            );
          }
          keys.add(key);
        }
      }
    } while (cursor !== '0' && keys.size < max);
    return {
      keys: [...keys].slice(0, max),
      ...(fromStart && cursor === '0' ? { totalCount: keys.size } : {}),
    };
  }

  private async readKeyValue(
    client: Redis,
    key: string,
  ): Promise<{ type: string; ttl: number; value: unknown }> {
    if (Buffer.byteLength(key, 'utf8') + 256 > MAX_RESULT_BYTES) {
      throw new BadRequestException(
        'Redis key exceeds the 1 MiB runtime-result safety byte budget.',
      );
    }
    const [type, ttl, raw] = (await this.runReadOnlyScript(
      client,
      SAFE_READ_SCRIPT,
      [key],
      ['SNAPSHOT'],
    )) as [string, number, unknown];
    const value =
      type === 'hash'
        ? Object.fromEntries(
            Array.from({ length: (raw as string[]).length / 2 }, (_, index) => [
              (raw as string[])[index * 2],
              (raw as string[])[index * 2 + 1],
            ]),
          )
        : this.normalizeRedisValue(raw);
    return { type, ttl, value };
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
