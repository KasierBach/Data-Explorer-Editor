import { BadRequestException } from '@nestjs/common';
import { RedisStrategy } from '../../database-strategies/redis.strategy';

/**
 * Unit tests for the Redis strategy using a mocked ioredis client.
 * The mock implements only the surface the strategy touches.
 */
function createMockClient() {
  const store = new Map<string, string>();
  const client = {
    set: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
      return 'OK';
    }),
    get: jest.fn(async (key: string) => store.get(key) ?? null),
    del: jest.fn(async (...keys: string[]) => {
      let deleted = 0;
      for (const key of keys) {
        if (store.delete(key)) deleted++;
      }
      return deleted;
    }),
    type: jest.fn(async (key: string): Promise<string> =>
      store.has(key) ? 'string' : 'none',
    ),
    ttl: jest.fn(async () => -1),
    scan: jest.fn(async () => ['0', [...store.keys()]]),
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
        if (command === 'GET') return store.get(args[0]) ?? null;
        if (command === 'TTL') return -1;
        if (command === 'EXISTS') return store.has(args[0]) ? 1 : 0;
        return null;
      },
    ),
    scard: jest.fn(async () => 0),
    hlen: jest.fn(async () => 0),
    llen: jest.fn(async () => 0),
    zcard: jest.fn(async () => 0),
    lrange: jest.fn(async () => []),
    smembers: jest.fn(async () => []),
    hgetall: jest.fn(async () => ({})),
    zrange: jest.fn(async () => []),
    disconnect: jest.fn(),
  };
  return { client, store };
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
      const { client } = createMockClient();
      client.scard.mockResolvedValue(501);
      client.hlen.mockResolvedValue(501);

      await expect(
        strategy.executeQuery(client, 'SMEMBERS large-set'),
      ).rejects.toThrow('500');
      await expect(
        strategy.executeQuery(client, 'HGETALL large-hash'),
      ).rejects.toThrow('500');
      expect(client.call).not.toHaveBeenCalledWith('SMEMBERS', 'large-set');
      expect(client.call).not.toHaveBeenCalledWith('HGETALL', 'large-hash');
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
      const { client } = createMockClient();
      client.scard.mockResolvedValue(2);
      client.call.mockResolvedValue(['a', 'b']);

      const result = await strategy.executeQuery(client, 'SMEMBERS small-set');

      expect(result.rows).toEqual([{ result: ['a', 'b'] }]);
      expect(client.scard).toHaveBeenCalledWith('small-set');
      expect(client.call).toHaveBeenCalledWith('SMEMBERS', 'small-set');
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
      const { client } = createMockClient();
      client.type.mockResolvedValue('list');
      client.llen.mockResolvedValue(501);

      await expect(
        strategy.getSampleRows(client, '0', 'large-list', 1),
      ).rejects.toThrow('500');
      await expect(
        strategy.exportStream(client, '0', 'large-list'),
      ).rejects.toThrow('500');
      expect(client.lrange).not.toHaveBeenCalled();
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
