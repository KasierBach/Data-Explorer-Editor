import { randomUUID } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import Redis from 'ioredis';
import { RedisStrategy } from '../src/database-strategies/redis.strategy';

/**
 * Native Redis 7 fixture only; never starts Redis/Docker or changes server config.
 * Parent runs this with the maintained E2E Redis fixture at 127.0.0.1:16379.
 * The 1 MiB limit is a conservative runtime payload reserve, not a JSON/product
 * quota. Quicklist/unknown encodings and >500 backing collections fail closed.
 */
describe('R14 native Redis atomic read safety', () => {
  const prefix = `r14-safety:${randomUUID()}`;
  const keys = new Set<string>();
  const strategy = new RedisStrategy();
  let redis: Redis;
  let writer: Redis;
  const key = (name: string) => {
    const value = `${prefix}:${name}`;
    keys.add(value);
    return value;
  };
  const expire = async (name: string) => {
    await redis.pexpire(name, 120_000);
  };

  beforeAll(async () => {
    redis = new Redis({
      host: '127.0.0.1',
      port: 16379,
      db: 12,
      lazyConnect: true,
      connectTimeout: 2_000,
      maxRetriesPerRequest: 0,
    });
    writer = redis.duplicate();
    await Promise.all([redis.connect(), writer.connect()]);
    expect(await redis.info('server')).toMatch(/redis_version:[7-9]\./);
  }, 10_000);

  afterAll(async () => {
    try {
      if (redis?.status === 'ready') {
        const names = [...keys];
        for (let index = 0; index < names.length; index += 500)
          await redis.del(...names.slice(index, index + 500));
      }
    } finally {
      redis?.disconnect();
      writer?.disconnect();
    }
  });

  it('keeps Unicode, native result shapes, TTL and WRONGTYPE with read-only scripts', async () => {
    const textKey = key('unicode');
    const hashKey = key('hash');
    const value = 'Tiếng Việt, "quoted"\n🙂';
    await redis.set(textKey, value, 'PX', 120_000);
    await redis.hset(hashKey, 'field', value, '__proto__', 'literal');
    await expire(hashKey);
    const before = await redis.pttl(textKey);

    expect(await strategy.executeQuery(redis, `GET ${textKey}`)).toMatchObject({
      rows: [{ result: value }],
      columns: ['result'],
      rowCount: 1,
    });
    expect(
      (await strategy.executeQuery(redis, `HGETALL ${hashKey}`)).rows[0].result,
    ).toEqual(await redis.call('HGETALL', hashKey));
    expect(await strategy.getSampleRows(redis, '12', hashKey, 1)).toEqual([
      {
        key: hashKey,
        type: 'hash',
        ttl: expect.any(Number),
        value: { field: value, ['__proto__']: 'literal' },
      },
    ]);
    expect(
      JSON.parse((await strategy.exportStream(redis, '12', textKey)) as string),
    ).toEqual({ key: textKey, type: 'string', value });
    await expect(
      strategy.executeQuery(redis, `SMEMBERS ${textKey}`),
    ).rejects.toThrow('WRONGTYPE');
    await expect(
      strategy.executeQuery(redis, `GET ${hashKey}`),
    ).rejects.toThrow('WRONGTYPE');
    expect(await redis.get(textKey)).toBe(value);
    expect(await redis.pttl(textKey)).toBeGreaterThan(0);
    expect(await redis.pttl(textKey)).toBeLessThanOrEqual(before);

    const evalSpy = jest.spyOn(redis, 'eval');
    await strategy.executeQuery(redis, `HGET ${hashKey} field`);
    expect(evalSpy).not.toHaveBeenCalled();
    evalSpy.mockRestore();
    await expect(
      redis.eval_ro(
        "return redis.call('SET', KEYS[1], 'must-not-write')",
        1,
        textKey,
      ),
    ).rejects.toThrow(/[Ww]rite commands.*read-only/);
    expect(await redis.get(textKey)).toBe(value);
    for (const command of ['EVAL', 'EVAL_RO', 'EVALSHA', 'FCALL_RO']) {
      await expect(
        strategy.executeQuery(redis, `${command} caller-source 0`),
      ).rejects.toThrow(BadRequestException);
    }
  });

  it.each(['set', 'hash'] as const)(
    'closes the real %s cardinality preflight/read race without truncating',
    async (type) => {
      const name = key(`race-${type}`);
      if (type === 'set') await redis.sadd(name, 'initial');
      else await redis.hset(name, 'initial', 'value');
      expect(
        type === 'set' ? await redis.scard(name) : await redis.hlen(name),
      ).toBe(1);
      const members = Array.from({ length: 500 }, (_, index) => `m${index}`);
      if (type === 'set') await writer.sadd(name, ...members);
      else
        await writer.hset(
          name,
          ...members.flatMap((member) => [member, 'value']),
        );
      await expire(name);
      // Real legacy RED control: the separate full read now sees 501 entries.
      const legacy = (await redis.call(
        type === 'set' ? 'SMEMBERS' : 'HGETALL',
        name,
      )) as string[];
      expect(legacy).toHaveLength(type === 'set' ? 501 : 1002);

      const spy = jest.spyOn(redis, 'call');
      try {
        await expect(
          strategy.executeQuery(
            redis,
            `${type === 'set' ? 'SMEMBERS' : 'HGETALL'} ${name}`,
          ),
        ).rejects.toThrow('500');
        await expect(
          strategy.getSampleRows(redis, '12', name, 1),
        ).rejects.toThrow('500');
        await expect(strategy.exportStream(redis, '12', name)).rejects.toThrow(
          '500',
        );
        expect(spy).not.toHaveBeenCalled();
        expect(
          type === 'set' ? await writer.scard(name) : await writer.hlen(name),
        ).toBe(501);
      } finally {
        spy.mockRestore();
      }
    },
  );

  it.each(['list', 'zset'] as const)(
    'rejects concurrent %s creation after zero count instead of issuing 0,-1',
    async (type) => {
      const name = key(`created-${type}`);
      expect(
        type === 'list' ? await redis.llen(name) : await redis.zcard(name),
      ).toBe(0);
      const members = Array.from({ length: 501 }, (_, index) => String(index));
      if (type === 'list') await writer.rpush(name, ...members);
      else
        await writer.zadd(
          name,
          ...members.flatMap((member) => [member, member]),
        );
      await expire(name);
      const listSpy = jest.spyOn(redis, 'lrange');
      const zsetSpy = jest.spyOn(redis, 'zrange');
      try {
        await expect(
          strategy.getSampleRows(redis, '12', name, 1),
        ).rejects.toThrow('500');
        await expect(strategy.exportStream(redis, '12', name)).rejects.toThrow(
          '500',
        );
        await expect(
          strategy.executeQuery(
            redis,
            `${type === 'list' ? 'LRANGE' : 'ZRANGE'} ${name} 0 0`,
          ),
        ).rejects.toThrow('500');
        expect(listSpy).not.toHaveBeenCalled();
        expect(zsetSpy).not.toHaveBeenCalled();
      } finally {
        listSpy.mockRestore();
        zsetSpy.mockRestore();
      }
    },
  );

  it('returns coherent missing/type-changed snapshots and never synthesizes an empty collection', async () => {
    const missing = key('missing');
    expect(await strategy.getSampleRows(redis, '12', missing, 1)).toEqual([
      { key: missing, type: 'none', ttl: -2, value: null },
    ]);
    expect(
      JSON.parse((await strategy.exportStream(redis, '12', missing)) as string),
    ).toEqual({ key: missing, type: 'none', value: null });
    const changed = key('type-change');
    await writer.hset(changed, 'field', 'changed value');
    await expire(changed);
    const staleType = jest.spyOn(redis, 'type').mockResolvedValue('none');
    try {
      const rows = await strategy.getSampleRows(redis, '12', changed, 1);
      expect(rows[0]).toMatchObject({
        type: 'hash',
        value: { field: 'changed value' },
      });
      expect(staleType).not.toHaveBeenCalled();
    } finally {
      staleType.mockRestore();
    }
  });

  it('returns complete 500-item safe collections, score wire shape and finite ranges', async () => {
    const setKey = key('set-500');
    const scoreKey = key('scores');
    const members = Array.from(
      { length: 500 },
      (_, index) => `member-${index}`,
    );
    await redis.sadd(setKey, ...members);
    await redis.zadd(scoreKey, '1.5', 'a', '2', 'b');
    await Promise.all([expire(setKey), expire(scoreKey)]);
    const result = await strategy.executeQuery(redis, `SMEMBERS ${setKey}`);
    expect((result.rows[0].result as string[]).sort()).toEqual(
      [...members].sort(),
    );
    expect(result.truncated).toBeUndefined();
    expect(
      (await strategy.executeQuery(redis, `ZRANGE ${scoreKey} 0 1`)).rows,
    ).toEqual([{ result: ['a', 'b'] }]);
    expect(
      JSON.parse(
        (await strategy.exportStream(redis, '12', scoreKey)) as string,
      ),
    ).toEqual({ key: scoreKey, type: 'zset', value: ['a', '1.5', 'b', '2'] });
    await expect(
      strategy.executeQuery(redis, `ZRANGE ${scoreKey} 0 -1`),
    ).rejects.toThrow('finite range');
    await expect(
      strategy.executeQuery(redis, `LRANGE ${key('absent-list')} 0 500`),
    ).rejects.toThrow('finite range');
    await expect(
      strategy.executeQuery(
        redis,
        `MGET ${Array(501).fill(scoreKey).join(' ')}`,
      ),
    ).rejects.toThrow('500');
  });

  it('rejects byte-heavy scalar/collection values and aggregate MGET before transport', async () => {
    const stringKey = key('bytes-string');
    const setKey = key('bytes-set');
    const hashKey = key('bytes-hash');
    const scoreKey = key('bytes-zset');
    const heavy = '🙂'.repeat(262_145);
    await redis.set(stringKey, heavy, 'PX', 120_000);
    await redis.sadd(setKey, heavy);
    await redis.hset(hashKey, 'field', heavy);
    await redis.zadd(scoreKey, '1', heavy);
    await Promise.all([expire(setKey), expire(hashKey), expire(scoreKey)]);
    const spy = jest.spyOn(redis, 'call');
    try {
      for (const command of [
        `GET ${stringKey}`,
        `HGET ${hashKey} field`,
        `SMEMBERS ${setKey}`,
        `HGETALL ${hashKey}`,
        `ZRANGE ${scoreKey} 0 0`,
      ]) {
        await expect(strategy.executeQuery(redis, command)).rejects.toThrow(
          '1 MiB',
        );
      }
      await expect(strategy.exportStream(redis, '12', hashKey)).rejects.toThrow(
        '1 MiB',
      );
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
    const a = key('mget-a');
    const b = key('mget-b');
    await redis.set(a, 'a'.repeat(600_000), 'PX', 120_000);
    await redis.set(b, 'b'.repeat(600_000), 'PX', 120_000);
    await expect(
      strategy.executeQuery(redis, `MGET ${a} ${b}`),
    ).rejects.toThrow('1 MiB');
    expect(
      (
        await strategy.executeQuery(
          redis,
          `MGET ${key('missing-mget')} ${hashKey}`,
        )
      ).rows,
    ).toEqual([{ result: [null, null] }]);
  });

  it('fails closed for quicklists rather than treating possibly compressed memory as a byte bound', async () => {
    const name = key('quicklist');
    await redis.rpush(name, 'a'.repeat(10_000), 'b'.repeat(10_000));
    await expire(name);
    expect(await redis.object('ENCODING', name)).toBe('quicklist');
    await expect(
      strategy.executeQuery(redis, `LRANGE ${name} 0 1`),
    ).rejects.toThrow('encoding');
    await expect(strategy.exportStream(redis, '12', name)).rejects.toThrow(
      'encoding',
    );
  });

  it('bounds native SCAN results and refuses an over-budget backing keyspace without fake completeness', async () => {
    const scanPrefix = `${prefix}:scan:`;
    const names = Array.from({ length: 5_001 }, (_, index) =>
      key(`scan:${index}`),
    );
    try {
      for (let start = 0; start < names.length; start += 500) {
        const pipeline = redis.pipeline();
        for (const name of names.slice(start, start + 500))
          pipeline.set(name, 'value', 'PX', 120_000);
        const results = await pipeline.exec();
        expect(results?.every(([error]) => !error)).toBe(true);
      }
      const spy = jest.spyOn(redis, 'scan');
      try {
        await expect(
          strategy.executeQuery(redis, `SCAN 0 MATCH ${scanPrefix}* COUNT 1`),
        ).rejects.toThrow(/keyspace exceeds 5000/);
        expect(spy).not.toHaveBeenCalled();
      } finally {
        spy.mockRestore();
      }
    } finally {
      for (let start = 0; start < names.length; start += 500)
        await redis.del(...names.slice(start, start + 500));
    }
    const exact = key('scan-exact');
    await redis.set(exact, 'safe', 'PX', 120_000);
    const result = await strategy.executeQuery(redis, `KEYS ${exact}`);
    expect(result.rows).toEqual([{ key: exact }]);
    expect(result.hasNextPage).toBe(false);
    expect(result.totalCount).toBe(1);
  }, 30_000);
});
