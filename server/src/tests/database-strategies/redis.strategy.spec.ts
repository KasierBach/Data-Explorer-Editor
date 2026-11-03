import { BadRequestException } from '@nestjs/common';
import { RedisStrategy } from '../../database-strategies/redis.strategy';

interface MockCollection {
  type: 'list' | 'set' | 'hash' | 'zset';
  values: string[];
  memoryBytes?: number;
  encoding?: string;
}

/**
 * In-memory Redis command model, including an atomic EVAL_RO contract mock.
 * This does not execute Lua: the focused native spec verifies the actual scripts.
 * Ordinary count/read methods deliberately remain separate to expose legacy races.
 */
function createMockClient() {
  const store = new Map<string, string>();
  const collections = new Map<string, MockCollection>();
  const materialized: string[] = [];
  const state: { beforeAtomicRead?: () => void } = {};
  const typeOf = (key: string) =>
    collections.get(key)?.type ?? (store.has(key) ? 'string' : 'none');
  const wrongType = () => {
    throw new Error(
      'WRONGTYPE Operation against a key holding the wrong kind of value',
    );
  };
  const collectionCount = (key: string) => {
    const collection = collections.get(key);
    return collection
      ? collection.values.length /
          (['hash', 'zset'].includes(collection.type) ? 2 : 1)
      : 0;
  };
  const read = (
    command: string,
    keys: string[],
    args: string[] = [],
  ): unknown => {
    const key = keys[0];
    const type = typeOf(key);
    const values = collections.get(key)?.values ?? [];
    materialized.push(command);
    switch (command) {
      case 'GET':
        if (type !== 'string' && type !== 'none') wrongType();
        return store.get(key) ?? null;
      case 'MGET':
        return keys.map((name) => store.get(name) ?? null);
      case 'HGET': {
        if (type !== 'hash' && type !== 'none') wrongType();
        const index = values.findIndex(
          (value, index) => index % 2 === 0 && value === args[0],
        );
        return index < 0 ? null : values[index + 1];
      }
      case 'SMEMBERS':
      case 'HGETALL':
        return [...values];
      case 'LRANGE':
        return values.slice(
          Number(args[0]),
          Number(args[1]) < 0 ? undefined : Number(args[1]) + 1,
        );
      case 'ZRANGE': {
        const start = Number(args[0]);
        const stop = Number(args[1]);
        const slice = values.slice(
          start * 2,
          stop < 0 ? undefined : (stop + 1) * 2,
        );
        return args[2] === 'WITHSCORES'
          ? slice
          : slice.filter((_, index) => index % 2 === 0);
      }
      default:
        return null;
    }
  };
  const client = {
    set: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
      collections.delete(key);
      return 'OK';
    }),
    get: jest.fn(async (key: string) => read('GET', [key])),
    del: jest.fn(async (...keys: string[]) => {
      let deleted = 0;
      for (const key of keys) {
        if (store.delete(key) || collections.delete(key)) deleted++;
      }
      return deleted;
    }),
    type: jest.fn(async (key: string): Promise<string> => typeOf(key)),
    ttl: jest.fn(async () => -1),
    scan: jest.fn(
      async (..._args: unknown[]): Promise<[string, string[]]> => [
        '0',
        [...store.keys()],
      ],
    ),
    dbsize: jest.fn(async () => store.size),
    info: jest.fn(async (section?: string) => {
      if (section === 'keyspace') {
        return store.size > 0 ? 'db0:keys=1,expires=0,avg_ttl=0' : '';
      }
      if (section === 'memory') return 'used_memory:1024\r\n';
      if (section === 'clients') return 'connected_clients:2\r\n';
      return '# Server\r\nredis_version:7.0\r\n';
    }),
    ping: jest.fn(async () => 'PONG'),
    call: jest.fn(
      async (command: string, ...args: string[]): Promise<unknown> => {
        if (
          [
            'GET',
            'MGET',
            'HGET',
            'SMEMBERS',
            'HGETALL',
            'LRANGE',
            'ZRANGE',
          ].includes(command)
        ) {
          return read(
            command,
            command === 'MGET' ? args : [args[0]],
            args.slice(1),
          );
        }
        if (command === 'TYPE') return typeOf(args[0]);
        if (command === 'TTL' || command === 'PTTL')
          return typeOf(args[0]) === 'none' ? -2 : -1;
        if (command === 'PING') return args[0] ?? 'PONG';
        if (command === 'EXISTS')
          return args.filter((key) => typeOf(key) !== 'none').length;
        return null;
      },
    ),
    scard: jest.fn(async (key: string) => collectionCount(key)),
    hlen: jest.fn(async (key: string) => collectionCount(key)),
    llen: jest.fn(async (key: string) => collectionCount(key)),
    zcard: jest.fn(async (key: string) => collectionCount(key)),
    lrange: jest.fn(async (key: string, start: number, stop: number) =>
      read('LRANGE', [key], [String(start), String(stop)]),
    ),
    smembers: jest.fn(async (key: string) => read('SMEMBERS', [key])),
    hgetall: jest.fn(async (key: string) => {
      const values = read('HGETALL', [key]) as string[];
      return Object.fromEntries(
        Array.from({ length: values.length / 2 }, (_, index) => [
          values[index * 2],
          values[index * 2 + 1],
        ]),
      );
    }),
    zrange: jest.fn(
      async (key: string, start: number, stop: number, scores?: string) =>
        read('ZRANGE', [key], [String(start), String(stop), scores ?? '']),
    ),
    eval_ro: jest.fn(
      async (
        script: string,
        numberOfKeys: number,
        ...input: string[]
      ): Promise<unknown> => {
        if (script.includes('data-explorer:safe-scan')) {
          const [cursor, pattern, count, type, remaining] = input;
          const scanArgs = [cursor, 'MATCH', pattern, 'COUNT', Number(count)];
          if (type) scanArgs.push('TYPE', type);
          const reply = await (
            client.scan as (...args: unknown[]) => Promise<[string, string[]]>
          )(...scanArgs);
          if (store.size + collections.size > 5_000) {
            throw new Error(
              'DE_REDIS_SAFETY SCAN keyspace exceeds 5000 keys; safe browsing unsupported.',
            );
          }
          if (
            reply[1].length > Number(remaining) ||
            reply[1].reduce(
              (bytes, key) => bytes + Buffer.byteLength(key) + 32,
              0,
            ) >
              1024 * 1024
          ) {
            throw new Error(
              `DE_REDIS_SAFETY SCAN reply budget exceeded; retry SCAN ${cursor} with a smaller COUNT.`,
            );
          }
          return reply;
        }
        if (!script.includes('data-explorer:safe-read'))
          throw new Error('Unexpected internal script');
        state.beforeAtomicRead?.();
        const keys = input.slice(0, numberOfKeys);
        const [mode, ...args] = input.slice(numberOfKeys);
        if (mode === 'INFO') {
          const info = await client.info(args[0]);
          if (Buffer.byteLength(info) > 1024 * 1024)
            throw new Error('DE_REDIS_SAFETY 1 MiB byte budget exceeded.');
          return info;
        }
        const type = typeOf(keys[0]);
        const command =
          mode === 'SNAPSHOT'
            ? (
                {
                  string: 'GET',
                  list: 'LRANGE',
                  set: 'SMEMBERS',
                  hash: 'HGETALL',
                  zset: 'ZRANGE',
                } as Record<string, string>
              )[type]
            : mode;
        const expectedType = (
          {
            GET: 'string',
            HGET: 'hash',
            LRANGE: 'list',
            SMEMBERS: 'set',
            HGETALL: 'hash',
            ZRANGE: 'zset',
          } as Record<string, string>
        )[command];
        if (expectedType && type !== expectedType && type !== 'none')
          wrongType();
        let bytes = mode === 'SNAPSHOT' ? Buffer.byteLength(keys[0]) : 0;
        if (command === 'GET' || command === 'MGET') {
          for (const key of keys)
            bytes += Buffer.byteLength(store.get(key) ?? '');
        } else if (command === 'HGET') {
          const values = collections.get(keys[0])?.values ?? [];
          const index = values.findIndex(
            (value, index) => index % 2 === 0 && value === args[0],
          );
          bytes += Buffer.byteLength(index < 0 ? '' : values[index + 1]);
        } else if (expectedType) {
          const collection = collections.get(keys[0]);
          const count = collectionCount(keys[0]);
          if (count > 500)
            throw new Error(
              'DE_REDIS_SAFETY Collection contains more than 500 items; complete read unavailable.',
            );
          if (collection) {
            const payload = collection.values.reduce(
              (bytes, value) => bytes + Buffer.byteLength(value),
              0,
            );
            if (
              collection.type === 'list' &&
              collection.encoding !== 'listpack'
            ) {
              throw new Error(
                'DE_REDIS_SAFETY List encoding cannot prove an uncompressed byte bound.',
              );
            }
            const memory = collection.memoryBytes ?? payload + 64;
            bytes += memory + collection.values.length * 32;
          }
        }
        if (bytes > 1024 * 1024)
          throw new Error(
            'DE_REDIS_SAFETY 1 MiB byte budget exceeded; complete read unavailable.',
          );
        if (mode === 'SNAPSHOT') {
          if (type === 'none') return ['none', -2, null];
          const stop = collectionCount(keys[0]) - 1;
          const value = read(command, keys, ['0', String(stop), 'WITHSCORES']);
          return [type, await client.ttl(), value];
        }
        if (mode === 'RANDOMKEY') return store.keys().next().value ?? null;
        return read(command, keys, args);
      },
    ),
    disconnect: jest.fn(),
  };
  return { client, store, collections, materialized, state };
}

describe('RedisStrategy', () => {
  let strategy: RedisStrategy;

  beforeEach(() => {
    strategy = new RedisStrategy();
  });

  describe('executeQuery command whitelist', () => {
    it('allows read-only commands like GET', async () => {
      const { client } = createMockClient();
      await client.set('greeting', 'hello');

      const result = await strategy.executeQuery(client, 'GET greeting');
      expect(result.rows[0]).toEqual({ result: 'hello' });
      expect(result.columns).toEqual(['result']);
    });

    it('rejects collection commands that cannot prove a complete bounded result', async () => {
      const { client, collections, materialized } = createMockClient();
      collections.set('large-set', {
        type: 'set',
        values: Array(501).fill('member'),
      });
      collections.set('large-hash', {
        type: 'hash',
        values: Array(501).fill(['field', 'value']).flat(),
      });

      await expect(
        strategy.executeQuery(client, 'SMEMBERS large-set'),
      ).rejects.toThrow('500');
      await expect(
        strategy.executeQuery(client, 'HGETALL large-hash'),
      ).rejects.toThrow('500');
      expect(materialized).toEqual([]);
    });

    it('rejects unbounded ranges and oversized MGET before calling Redis', async () => {
      const { client } = createMockClient();
      const keys = Array.from({ length: 501 }, (_, index) => `key-${index}`);

      await expect(
        strategy.executeQuery(client, 'LRANGE queue 0 -1'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        strategy.executeQuery(client, 'ZRANGE scores 0 -1'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        strategy.executeQuery(client, `MGET ${keys.join(' ')}`),
      ).rejects.toThrow(BadRequestException);
      expect(client.call).not.toHaveBeenCalled();
    });

    it('allows complete collection reads within the safety budget', async () => {
      const { client, collections } = createMockClient();
      collections.set('small-set', { type: 'set', values: ['a', 'b'] });

      const result = await strategy.executeQuery(client, 'SMEMBERS small-set');

      expect(result.rows).toEqual([{ result: ['a', 'b'] }]);
      expect(client.eval_ro).toHaveBeenCalledTimes(1);
      expect(client.scard).not.toHaveBeenCalled();
      expect(client.call).not.toHaveBeenCalled();
    });

    it('rejects dangerous commands like FLUSHALL', async () => {
      const { client } = createMockClient();
      await expect(strategy.executeQuery(client, 'FLUSHALL')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects write commands like SET through the query endpoint', async () => {
      const { client } = createMockClient();
      await expect(
        strategy.executeQuery(client, 'SET key value'),
      ).rejects.toThrow(BadRequestException);
    });

    it.each([
      'CONFIG SET maxmemory 1mb',
      'CLIENT KILL TYPE normal',
      'MEMORY PURGE',
    ])('rejects mutating subcommands: %s', async (command) => {
      const { client } = createMockClient();
      await expect(strategy.executeQuery(client, command)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects empty commands', async () => {
      const { client } = createMockClient();
      await expect(strategy.executeQuery(client, '   ')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('parses INFO output into rows', async () => {
      const { client } = createMockClient();
      const result = await strategy.executeQuery(client, 'INFO');
      const rows = result.rows as { field: string; value: string }[];
      expect(rows.some((r) => r.field === 'redis_version')).toBe(true);
    });

    it('returns the key count for DBSIZE', async () => {
      const { client } = createMockClient();
      await client.set('a', '1');
      await client.set('b', '2');
      const result = await strategy.executeQuery(client, 'DBSIZE');
      expect(result.rows[0]).toEqual({ keyCount: 2 });
    });
  });

  describe('bounded sampling and export', () => {
    it('rejects oversized complete collection samples and exports', async () => {
      const { client, collections } = createMockClient();
      collections.set('large-list', {
        type: 'list',
        values: Array(501).fill('item'),
        encoding: 'listpack',
      });

      await expect(
        strategy.getSampleRows(client, '0', 'large-list', 1),
      ).rejects.toThrow('500');
      await expect(
        strategy.exportStream(client, '0', 'large-list'),
      ).rejects.toThrow('500');
      expect(client.lrange).not.toHaveBeenCalled();
    });
  });

  describe('atomic safety follow-up RED controls', () => {
    it.each(['set', 'hash'] as const)(
      'rejects %s growth after the old cardinality preflight, before materializing it',
      async (type) => {
        const { client, collections, materialized } = createMockClient();
        const values = Array.from({ length: 501 }, (_, index) => String(index));
        collections.set('racy', {
          type,
          values:
            type === 'hash'
              ? values.flatMap((value) => [value, value])
              : values,
        });
        client.scard.mockResolvedValue(1);
        client.hlen.mockResolvedValue(1);

        await expect(
          strategy.executeQuery(
            client,
            `${type === 'set' ? 'SMEMBERS' : 'HGETALL'} racy`,
          ),
        ).rejects.toThrow('500');
        expect(materialized).toEqual([]);
        expect(client.scard).not.toHaveBeenCalled();
        expect(client.hlen).not.toHaveBeenCalled();
      },
    );

    it.each(['list', 'zset'] as const)(
      'never reads 0,-1 when a missing %s is concurrently created',
      async (type) => {
        const { client, collections, materialized } = createMockClient();
        client.type.mockResolvedValue(type);
        client.llen.mockResolvedValue(0);
        client.zcard.mockResolvedValue(0);
        const values = Array.from({ length: 501 }, (_, index) => String(index));
        collections.set('created', {
          type,
          encoding: 'listpack',
          values:
            type === 'zset' ? values.flatMap((value) => [value, '1']) : values,
        });

        await expect(
          strategy.getSampleRows(client, '0', 'created', 1),
        ).rejects.toThrow('500');
        await expect(
          strategy.exportStream(client, '0', 'created'),
        ).rejects.toThrow('500');
        expect(materialized).toEqual([]);
        expect(client.lrange).not.toHaveBeenCalled();
        expect(client.zrange).not.toHaveBeenCalled();
      },
    );

    it('returns a coherent type, value and TTL instead of silently dropping a type-changed value', async () => {
      const { client, collections } = createMockClient();
      client.type.mockResolvedValue('none');
      collections.set('changed', {
        type: 'hash',
        values: ['field', 'Tiếng Việt'],
      });

      expect(await strategy.getSampleRows(client, '0', 'changed', 1)).toEqual([
        {
          key: 'changed',
          type: 'hash',
          ttl: -1,
          value: { field: 'Tiếng Việt' },
        },
      ]);
      expect(
        JSON.parse(
          (await strategy.exportStream(client, '0', 'changed')) as string,
        ),
      ).toEqual({
        key: 'changed',
        type: 'hash',
        value: { field: 'Tiếng Việt' },
      });
      expect(client.type).not.toHaveBeenCalled();
    });

    it.each([
      'GET heavy',
      'MGET heavy other',
      'HGET hash field',
      'SMEMBERS set',
      'HGETALL hash',
      'LRANGE list 0 0',
      'ZRANGE zset 0 0',
    ])(
      'rejects byte-heavy reads before value materialization: %s',
      async (command) => {
        const { client, store, collections, materialized } = createMockClient();
        const heavy = '🙂'.repeat(262_145);
        store.set('heavy', heavy);
        store.set('other', 'safe');
        collections.set('hash', { type: 'hash', values: ['field', heavy] });
        collections.set('set', { type: 'set', values: [heavy] });
        collections.set('list', {
          type: 'list',
          encoding: 'listpack',
          values: [heavy],
        });
        collections.set('zset', { type: 'zset', values: [heavy, '1'] });

        await expect(strategy.executeQuery(client, command)).rejects.toThrow(
          '1 MiB',
        );
        expect(materialized).toEqual([]);
      },
    );

    it('checks aggregate MGET bytes rather than just each individual value', async () => {
      const { client, store, materialized } = createMockClient();
      store.set('a', 'a'.repeat(600_000));
      store.set('b', 'b'.repeat(600_000));
      await expect(strategy.executeQuery(client, 'MGET a b')).rejects.toThrow(
        '1 MiB',
      );
      expect(materialized).toEqual([]);
    });

    it('rejects compressed/ambiguous quicklist memory estimates instead of promising a byte bound', async () => {
      const { client, collections, materialized } = createMockClient();
      collections.set('compressed', {
        type: 'list',
        encoding: 'quicklist',
        memoryBytes: 128,
        values: ['a'.repeat(2_000_000)],
      });
      await expect(
        strategy.executeQuery(client, 'LRANGE compressed 0 0'),
      ).rejects.toThrow('encoding');
      expect(materialized).toEqual([]);
    });

    it('rejects finite ranges over a backing collection too large to budget safely', async () => {
      const { client, collections, materialized } = createMockClient();
      collections.set('large', {
        type: 'zset',
        values: Array(501).fill(['member', '1']).flat(),
      });
      await expect(
        strategy.executeQuery(client, 'ZRANGE large 0 0'),
      ).rejects.toThrow('500');
      expect(materialized).toEqual([]);
    });

    it.each([
      'GET',
      'GET a b',
      'HGET hash',
      'HGET hash field extra',
      'TYPE',
      'TTL a extra',
      'DBSIZE extra',
      'PING a b',
      'INFO memory extra',
      'EXISTS',
    ])(
      'rejects malformed generic args before Redis work: %s',
      async (command) => {
        const { client } = createMockClient();
        await expect(strategy.executeQuery(client, command)).rejects.toThrow(
          BadRequestException,
        );
        expect(client.call).not.toHaveBeenCalled();
        expect(client.eval_ro).not.toHaveBeenCalled();
        expect(client.info).not.toHaveBeenCalled();
        expect(client.dbsize).not.toHaveBeenCalled();
      },
    );

    it.each([
      'EVAL return 0',
      'EVAL_RO return 0',
      'EVALSHA abc 0',
      'FCALL_RO function 0',
    ])('never admits caller-supplied scripts: %s', async (command) => {
      const { client } = createMockClient();
      await expect(strategy.executeQuery(client, command)).rejects.toThrow(
        BadRequestException,
      );
      expect(client.eval_ro).not.toHaveBeenCalled();
    });

    it('fails closed when Redis7 read-only scripting or the required ACL is unavailable', async () => {
      const { client } = createMockClient();
      client.eval_ro.mockRejectedValue(
        new Error("ERR unknown command 'eval_ro'"),
      );
      await expect(strategy.executeQuery(client, 'GET key')).rejects.toThrow(
        /Redis 7.*EVAL_RO/,
      );
      expect(client.call).not.toHaveBeenCalled();
    });
  });

  describe('row editing', () => {
    it('inserts a key via insertRow', async () => {
      const { client, store } = createMockClient();
      const result = await strategy.insertRow(client, {
        schema: '0',
        table: '',
        data: { key: 'session:1', value: 'abc' },
      });
      expect(result).toEqual({ success: true, rowCount: 1 });
      expect(store.get('session:1')).toBe('abc');
    });

    it('updates a key value via updateRow', async () => {
      const { client, store } = createMockClient();
      await client.set('session:1', 'old');
      const result = await strategy.updateRow(client, {
        schema: '0',
        table: '',
        pkColumn: 'key',
        pkValue: 'session:1',
        updates: { value: 'new' },
      });
      expect(result).toEqual({ success: true, rowCount: 1 });
      expect(store.get('session:1')).toBe('new');
    });

    it('deletes keys via deleteRows', async () => {
      const { client, store } = createMockClient();
      await client.set('k1', 'a');
      await client.set('k2', 'b');
      const result = await strategy.deleteRows(client, {
        schema: '0',
        table: '',
        pkColumn: 'key',
        pkValues: ['k1', 'k2'],
      });
      expect(result).toEqual({ success: true, rowCount: 2 });
      expect(store.size).toBe(0);
    });

    it('requires a value field for updates', async () => {
      const { client } = createMockClient();
      await expect(
        strategy.updateRow(client, {
          schema: '0',
          table: '',
          pkColumn: 'key',
          pkValue: 'k',
          updates: {},
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('tree browsing', () => {
    it('lists databases from keyspace info (always includes db0)', async () => {
      const { client } = createMockClient();
      await client.set('x', '1');
      const dbs = await strategy.getDatabases(client);
      expect(dbs[0]).toMatchObject({ name: 'db0', type: 'database' });
    });

    it('lists keys as tree nodes', async () => {
      const { client } = createMockClient();
      await client.set('user:1', 'a');
      await client.set('user:2', 'b');
      const tables = await strategy.getTables(client, '0');
      expect(tables).toHaveLength(2);
      expect(tables[0]).toMatchObject({ type: 'key', parentId: '0' });
    });

    it('describes a key with type and ttl columns', async () => {
      const { client } = createMockClient();
      await client.set('user:1', 'a');
      const columns = await strategy.getColumns(client, '0', 'user:1');
      const names = columns.map((c) => c.name);
      expect(names).toEqual(['key', 'type', 'ttl', 'value']);
    });
  });

  describe('unsupported operations', () => {
    it('rejects schema operations', () => {
      expect(() => strategy.buildAlterTableSql()).toThrow(BadRequestException);
    });

    it('rejects createDatabase', async () => {
      await expect(strategy.createDatabase()).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects dropDatabase', async () => {
      await expect(strategy.dropDatabase()).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('metrics', () => {
    it('reports key count, memory, and clients', async () => {
      const { client } = createMockClient();
      await client.set('a', '1');
      const metrics = await strategy.getDatabaseMetrics(client);
      expect(metrics.tableCount).toBe(1);
      expect(metrics.sizeBytes).toBe(1024);
      expect(metrics.activeConnections).toBe(2);
    });
  });
});
