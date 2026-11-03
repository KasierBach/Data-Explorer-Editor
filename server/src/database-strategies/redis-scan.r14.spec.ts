import Redis from 'ioredis';
import { RedisStrategy } from './redis.strategy';

const pattern = 'r14:*';

describe('R14 Redis scan boundaries', () => {
  let redis: Redis;
  let strategy: RedisStrategy;
  let scan: jest.SpyInstance;

  beforeEach(() => {
    redis = new Redis({ lazyConnect: true });
    strategy = new RedisStrategy();
    scan = jest.spyOn(redis, 'scan');
    // Contract mock only: native Redis safety spec executes the fixed Lua scripts.
    jest.spyOn(redis, 'eval_ro').mockImplementation(async (...input) => {
      const [script, numberOfKeys, ...args] = input;
      expect(String(script)).toContain('data-explorer:safe-scan');
      expect(numberOfKeys).toBe(0);
      const [cursor, match, count, type, remaining] = args.map(String);
      const reply = await (type
        ? redis.scan(
            cursor,
            'MATCH',
            match,
            'COUNT',
            Number(count),
            'TYPE',
            type,
          )
        : redis.scan(cursor, 'MATCH', match, 'COUNT', Number(count)));
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
    });
  });

  afterEach(() => {
    redis.disconnect();
    jest.restoreAllMocks();
  });

  it('continues after duplicate and empty scan batches and returns an exact count only at the terminal cursor', async () => {
    scan.mockResolvedValueOnce(['5', ['r14:a', 'r14:a']]);
    scan.mockResolvedValueOnce(['7', []]);
    scan.mockResolvedValueOnce(['0', ['r14:b', 'r14:c']]);

    const result = await strategy.executeQuery(
      redis,
      `SCAN 0 MATCH ${pattern}`,
      { limit: 2 },
    );

    expect(scan).toHaveBeenCalledTimes(3);
    expect(scan).toHaveBeenNthCalledWith(
      1,
      '0',
      'MATCH',
      pattern,
      'COUNT',
      100,
    );
    expect(scan).toHaveBeenNthCalledWith(
      2,
      '5',
      'MATCH',
      pattern,
      'COUNT',
      100,
    );
    expect(scan).toHaveBeenNthCalledWith(
      3,
      '7',
      'MATCH',
      pattern,
      'COUNT',
      100,
    );
    expect(result.rows).toEqual([{ key: 'r14:a' }, { key: 'r14:b' }]);
    expect(result.rowCount).toBe(2);
    expect(result.hasNextPage).toBe(true);
    expect(result.totalCount).toBe(3);
  });

  it('stops after a lookahead and does not report a partial scan as an exact total', async () => {
    scan.mockResolvedValueOnce(['5', ['r14:a', 'r14:b', 'r14:c']]);

    const result = await strategy.executeQuery(redis, `KEYS ${pattern}`, {
      limit: 2,
    });

    expect(scan).toHaveBeenCalledTimes(1);
    expect(result.rows).toEqual([{ key: 'r14:a' }, { key: 'r14:b' }]);
    expect(result.hasNextPage).toBe(true);
    expect(result.truncated).toBe(true);
    expect(result.totalCount).toBeUndefined();
    expect(result.countStatus).toBe('unavailable');
  });

  it('uses the supplied cursor and never labels a cursor suffix as the entire keyspace', async () => {
    scan.mockResolvedValueOnce(['0', ['r14:tail']]);

    const result = await strategy.executeQuery(
      redis,
      'SCAN 987654321012345678 MATCH r14:? COUNT 2 TYPE hash',
    );

    expect(scan).toHaveBeenCalledWith(
      '987654321012345678',
      'MATCH',
      'r14:?',
      'COUNT',
      2,
      'TYPE',
      'hash',
    );
    expect(result.rows).toEqual([{ key: 'r14:tail' }]);
    expect(result.totalCount).toBeUndefined();
    expect(result.hasNextPage).toBe(false);
  });

  it('keeps native COUNT hints within the existing scan cap', async () => {
    scan.mockResolvedValueOnce(['0', []]);

    await strategy.executeQuery(redis, 'SCAN 0 COUNT 999999999');

    expect(scan).toHaveBeenCalledWith('0', 'MATCH', '*', 'COUNT', 500);
  });

  it('keeps offset pages non-overlapping while counting unique keys', async () => {
    scan.mockResolvedValueOnce([
      '0',
      ['r14:a', 'r14:b', 'r14:b', 'r14:c', 'r14:d'],
    ]);

    const result = await strategy.executeQuery(redis, `KEYS ${pattern}`, {
      limit: 2,
      offset: 2,
    });

    expect(result.rows).toEqual([{ key: 'r14:c' }, { key: 'r14:d' }]);
    expect(result.rowCount).toBe(2);
    expect(result.totalCount).toBe(4);
    expect(result.hasNextPage).toBe(false);
    expect(result.appliedOffset).toBe(2);
  });

  it('rejects deep offset work before scanning the keyspace', async () => {
    await expect(
      strategy.executeQuery(redis, `KEYS ${pattern}`, {
        limit: 500,
        offset: 1,
      }),
    ).rejects.toThrow('page bounds');
    expect(scan).not.toHaveBeenCalled();
  });

  it('bounds empty/duplicate SCAN work and errors with a continuation cursor instead of fake completeness', async () => {
    for (let index = 0; index < 100; index++)
      scan.mockResolvedValueOnce([String(index + 1), []]);
    scan.mockResolvedValueOnce(['0', ['r14:eventually']]);

    await expect(
      strategy.executeQuery(redis, `SCAN 0 MATCH ${pattern}`),
    ).rejects.toThrow(/budget.*SCAN 100/i);
    expect(scan).toHaveBeenCalledTimes(100);
  });

  it('bounds total processed keys even when duplicate replies do not grow the result', async () => {
    for (let index = 0; index < 11; index++)
      scan.mockResolvedValueOnce([
        String(index + 1),
        Array(500).fill('r14:duplicate'),
      ]);
    scan.mockResolvedValueOnce(['0', []]);

    await expect(
      strategy.executeQuery(redis, `KEYS ${pattern}`),
    ).rejects.toThrow(/budget.*SCAN 10/i);
    expect(scan).toHaveBeenCalledTimes(10);
  });

  it('checks remaining key work budget atomically before accepting an over-budget terminal reply', async () => {
    for (let index = 0; index < 9; index++)
      scan.mockResolvedValueOnce([
        String(index + 1),
        Array(500).fill('r14:duplicate'),
      ]);
    scan.mockResolvedValueOnce(['10', Array(499).fill('r14:duplicate')]);
    scan.mockResolvedValueOnce(['0', ['r14:duplicate', 'r14:new']]);

    await expect(
      strategy.executeQuery(redis, `KEYS ${pattern}`),
    ).rejects.toThrow(/budget/);
    expect(scan).toHaveBeenCalledTimes(11);
  });

  it('rejects an oversized terminal SCAN reply rather than returning a sliced complete result', async () => {
    scan.mockResolvedValueOnce([
      '0',
      Array.from({ length: 5_001 }, (_, index) => `r14:${index}`),
    ]);

    await expect(
      strategy.executeQuery(redis, `KEYS ${pattern}`),
    ).rejects.toThrow(/budget/i);
    expect(scan).toHaveBeenCalledTimes(1);
  });

  it('rejects byte-heavy key names before materializing a client SCAN reply', async () => {
    scan.mockResolvedValueOnce(['0', ['r14:' + '🙂'.repeat(262_145)]]);

    await expect(
      strategy.executeQuery(redis, `KEYS ${pattern}`),
    ).rejects.toThrow(/budget/i);
  });

  it('bounds cumulative key bytes across separately safe scan replies', async () => {
    scan.mockResolvedValueOnce(['5', ['r14:' + 'a'.repeat(600_000)]]);
    scan.mockResolvedValueOnce(['7', ['r14:' + 'b'.repeat(600_000)]]);
    scan.mockResolvedValueOnce(['0', []]);

    await expect(
      strategy.executeQuery(redis, `KEYS ${pattern}`),
    ).rejects.toThrow(/byte budget/i);
    expect(scan).toHaveBeenCalledTimes(2);
  });

  it.each([
    'SCAN',
    'SCAN -1',
    'SCAN 0 MATCH',
    'SCAN 0 COUNT not-a-number',
    'SCAN 0 COUNT 0',
    'SCAN 0 COUNT 1.5',
    'SCAN 0 UNKNOWN value',
    'KEYS',
    'KEYS * extra',
  ])('rejects malformed syntax before calling Redis: %s', async (command) => {
    await expect(strategy.executeQuery(redis, command)).rejects.toThrow();
    expect(scan).not.toHaveBeenCalled();
  });
});
