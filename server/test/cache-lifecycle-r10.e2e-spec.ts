import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { INestApplication } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import type KeyvRedis from '@keyv/redis';
import { randomUUID } from 'node:crypto';
import Redis from 'ioredis';
import { createE2eApp, closeE2eApp } from './e2e-app';

describe('R10 Redis cache wiring and lifecycle', () => {
  let first: INestApplication;
  let second: INestApplication;
  let redis: Redis;
  const key = `r10-cache:${randomUUID()}`;
  beforeAll(async () => {
    redis = new Redis(process.env.E2E_REDIS_URL!);
    first = await createE2eApp();
    second = await createE2eApp();
  });
  afterAll(async () => {
    const adapters = [first, second]
      .filter(Boolean)
      .map(
        (app) =>
          app.get<Cache>(CACHE_MANAGER).stores[0].opts.store as KeyvRedis,
      );
    try {
      const keys = await redis.keys(`*${key}*`);
      if (keys.length) await redis.del(...keys);
    } finally {
      if (first) await closeE2eApp(first);
      if (second) await closeE2eApp(second);
      await redis?.quit();
      expect(adapters.every((adapter) => !adapter.client.isOpen)).toBe(true);
    }
  });

  it('shares cached values between two app instances and applies a native Redis TTL', async () => {
    const value = { rows: [{ id: 1, text: 'fixture-only' }] };
    await first.get<Cache>(CACHE_MANAGER).set(key, value);
    expect(await second.get<Cache>(CACHE_MANAGER).get(key)).toEqual(value);
    const keys = await redis.keys(`*${key}*`);
    expect(keys).toHaveLength(1);
    const ttl = await redis.pttl(keys[0]);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(60_000);
    await second.get<Cache>(CACHE_MANAGER).del(key);
    expect(await first.get<Cache>(CACHE_MANAGER).get(key)).toBeUndefined();
  });
});
