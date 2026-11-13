import { SearchIndexRepository } from './search-index.repository';

class FakeRedisClient {
  public readonly sets = new Map<string, Set<string>>();
  public readonly hashes = new Map<string, Map<string, string>>();
  public hscanCalls = 0;

  private ensureSet(key: string) {
    let target = this.sets.get(key);
    if (!target) {
      target = new Set<string>();
      this.sets.set(key, target);
    }
    return target;
  }

  private ensureHash(key: string) {
    let target = this.hashes.get(key);
    if (!target) {
      target = new Map<string, string>();
      this.hashes.set(key, target);
    }
    return target;
  }

  async smembers(key: string) {
    return [...(this.sets.get(key) ?? new Set<string>())];
  }

  async del(...keys: string[]) {
    for (const key of keys) {
      this.sets.delete(key);
      this.hashes.delete(key);
    }
  }

  async hset(key: string, field: string, value: string) {
    this.ensureHash(key).set(field, value);
  }

  async hmget(key: string, ...fields: string[]) {
    const target = this.hashes.get(key) ?? new Map<string, string>();
    return fields.map((field) => target.get(field) ?? null);
  }

  async hscan(
    key: string,
    _cursor: string,
    _countLabel: string,
    _count: number,
  ) {
    this.hscanCalls += 1;
    const target = this.hashes.get(key) ?? new Map<string, string>();
    const chunk: string[] = [];
    for (const [field, value] of target.entries()) {
      chunk.push(field, value);
    }
    return ['0', chunk] as const;
  }

  pipeline() {
    const commands: Array<() => Promise<void>> = [];
    const pipeline = {
      sadd: (key: string, ...values: string[]) => {
        commands.push(async () => {
          const target = this.ensureSet(key);
          for (const value of values) {
            target.add(value);
          }
        });
        return pipeline;
      },
      hset: (key: string, field: string, value: string) => {
        commands.push(async () => {
          this.ensureHash(key).set(field, value);
        });
        return pipeline;
      },
      exec: async () => {
        for (const command of commands) {
          await command();
        }
        return [];
      },
    };
    return pipeline;
  }
}

describe('SearchIndexRepository', () => {
  let client: FakeRedisClient;
  let repository: SearchIndexRepository;

  beforeEach(() => {
    client = new FakeRedisClient();
    repository = new SearchIndexRepository({
      getClient: () => client,
    } as any);
  });

  it('returns substring matches from indexed grams without scanning the item hash', async () => {
    await repository.replaceUserIndex('user-1', [
      {
        id: 'users',
        name: 'users',
        type: 'table',
        connectionId: 'conn-1',
        connectionName: 'Primary',
        database: 'main',
        schema: 'public',
      },
      {
        id: 'movies',
        name: 'embedded_movies',
        type: 'table',
        connectionId: 'conn-1',
        connectionName: 'Primary',
        database: 'main',
        schema: 'public',
      },
    ]);

    client.hscanCalls = 0;
    const results = await repository.search('user-1', 'bed', 10);

    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('embedded_movies');
    expect(client.hscanCalls).toBe(0);
  });

  it('supports short prefix lookups for two-character queries', async () => {
    await repository.replaceUserIndex('user-1', [
      {
        id: 'users',
        name: 'users',
        type: 'table',
        connectionId: 'conn-1',
        connectionName: 'Primary',
        database: 'main',
        schema: 'public',
      },
      {
        id: 'orders',
        name: 'orders',
        type: 'table',
        connectionId: 'conn-1',
        connectionName: 'Primary',
        database: 'main',
        schema: 'sales',
      },
    ]);

    const results = await repository.search('user-1', 'us', 10);

    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('users');
  });

  it('default-denies semantic reads without explicit approved connection/database pairs', async () => {
    await expect(
      repository.getSemanticFallbackNames('user-1'),
    ).resolves.toEqual([]);
    await expect(
      repository.getSemanticFallbackNames('user-1', []),
    ).resolves.toEqual([]);
    await expect(
      repository.getSemanticFallbackNames('user-1', [
        { connectionId: 'conn-1', database: '' },
      ]),
    ).resolves.toEqual([]);
    expect(client.hscanCalls).toBe(0);
  });

  it('filters semantic names and same-name lookups by exact actor/connection/database scope', async () => {
    const approved = { connectionId: 'conn-1', database: 'main' };
    const item = {
      name: 'users',
      type: 'table',
      connectionName: 'Primary',
      schema: 'public',
      ...approved,
    };
    await repository.replaceUserIndex('user-1', [
      { ...item, id: 'approved' },
      {
        ...item,
        id: 'foreign-connection',
        connectionId: 'conn-2',
        name: 'private_users',
      },
      { ...item, id: 'foreign-database', database: 'secret', name: 'secrets' },
      { ...item, id: 'same-name-connection', connectionId: 'conn-2' },
      { ...item, id: 'same-name-database', database: 'secret' },
    ]);
    await repository.replaceUserIndex('other-user', [
      { ...item, id: 'other-actor', name: 'other_private' },
    ]);
    await expect(
      repository.getSemanticFallbackNames('user-1', [approved]),
    ).resolves.toEqual(['users']);
    const matches = await repository.getItemsByNames('user-1', ['users'], 50, [
      approved,
    ]);
    expect(matches.map((entry) => entry.id)).toEqual(['approved']);
    const scans = client.hscanCalls;
    await expect(
      repository.getItemsByNames('user-1', ['users'], 50, []),
    ).resolves.toEqual([]);
    expect(client.hscanCalls).toBe(scans);
  });

  it('can rebuild semantic fallback names and lookup items by suggested names', async () => {
    await repository.replaceUserIndex('user-1', [
      {
        id: 'users',
        name: 'users',
        type: 'table',
        connectionId: 'conn-1',
        connectionName: 'Primary',
        database: 'main',
        schema: 'public',
      },
      {
        id: 'orders',
        name: 'orders',
        type: 'table',
        connectionId: 'conn-1',
        connectionName: 'Primary',
        database: 'main',
        schema: 'sales',
      },
    ]);

    const names = await repository.getSemanticFallbackNames('user-1', [
      { connectionId: 'conn-1', database: 'main' },
    ]);
    const results = await repository.getItemsByNames('user-1', ['orders']);

    expect(names).toEqual(expect.arrayContaining(['users', 'orders']));
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('orders');
    expect(client.hscanCalls).toBeGreaterThan(0);
  });
});
