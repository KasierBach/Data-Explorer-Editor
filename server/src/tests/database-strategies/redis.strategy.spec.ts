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
    type: jest.fn(async (key: string) => (store.has(key) ? 'string' : 'none')),
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
    call: jest.fn(async (command: string, ...args: string[]) => {
      if (command === 'GET') return store.get(args[0]) ?? null;
      if (command === 'TTL') return -1;
      if (command === 'EXISTS') return store.has(args[0]) ? 1 : 0;
      return null;
    }),
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
