import { FreshnessService } from './freshness.service';

describe('R08 cache identity and generation ownership', () => {
  const setup = () => {
    const values = new Map<string, unknown>();
    const cache = {
      get: jest.fn(async (key: string) => values.get(key)),
      set: jest.fn(async (key: string, value: unknown) => {
        values.set(key, value);
      }),
    };
    return { cache, service: new FreshnessService(cache as never) };
  };

  it.each([
    [["SELECT 'ABC'"], ["SELECT 'abc'"]],
    [['SELECT * FROM "Orders"'], ['SELECT * FROM "orders"']],
    [[' value '], ['value']],
    [
      ['a|b', 'c'],
      ['a', 'b|c'],
    ],
    [
      ['a', '', 'b'],
      ['a', 'b'],
    ],
    [[1], ['1']],
  ])('preserves semantic cache parts %j versus %j', async (a, b) => {
    const { service } = setup();
    const key = await service.buildKey('query', ['conn', 'Main'], a);
    expect(await service.buildKey('query', ['conn', 'Main'], b)).not.toBe(key);
    expect(await service.buildKey('query', ['conn', 'Main'], a)).toBe(key);
  });

  it('keeps case, boundaries and absent positions in connection/database scopes', async () => {
    const { service } = setup();
    const scopes = [
      ['conn', 'Main'],
      ['conn', 'main'],
      ['con|n', 'main'],
      ['con', 'n|main'],
      ['conn', '', 'main'],
    ];
    const keys = await Promise.all(
      scopes.map((scope) => service.buildKey('query', scope, ['sql'])),
    );
    expect(new Set(keys).size).toBe(scopes.length);
  });

  it('never reuses a generation when two service instances invalidate concurrently', async () => {
    const { cache, service } = setup();
    const other = new FreshnessService(cache as never);
    const generations = await Promise.all([
      service.bump('query', ['conn']),
      other.bump('query', ['conn']),
    ]);
    expect(new Set(generations).size).toBe(2);
  });
});
