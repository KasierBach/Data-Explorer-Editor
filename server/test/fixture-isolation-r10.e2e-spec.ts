import type { INestApplication } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { createHash, randomUUID } from 'node:crypto';
import { closeE2eApp, createE2eApp } from './e2e-app';

const limiterKey = /^\{[a-f0-9]{64}:default\}:(hits|blocked)$/;

describe('R10 isolated fixture rate limits', () => {
  let first: INestApplication;
  let second: INestApplication;
  let storage: ThrottlerStorageRedisService;
  let previousKeys: Set<string>;

  beforeAll(async () => {
    first = await createE2eApp();
    second = await createE2eApp();
    storage = first.get(ThrottlerStorage);
    previousKeys = new Set(await storage.redis.keys('{*}:*'));
  });

  afterAll(async () => {
    try {
      if (storage && previousKeys) {
        const keys = (await storage.redis.keys('{*}:*')).filter(
          (key) => limiterKey.test(key) && !previousKeys.has(key),
        );
        if (keys.length) await storage.redis.del(...keys);
      }
    } finally {
      if (second) await closeE2eApp(second);
      if (first) await closeE2eApp(first);
    }
  });

  it('keeps the native limit within an app without carrying its IP bucket into another fixture', async () => {
    const key = createHash('sha256').update(randomUUID()).digest('hex');
    const firstStorage =
      first.get<ThrottlerStorageRedisService>(ThrottlerStorage);
    const secondStorage =
      second.get<ThrottlerStorageRedisService>(ThrottlerStorage);
    for (let hit = 1; hit <= 6; hit += 1) {
      const result = await firstStorage.increment(
        key,
        60_000,
        5,
        60_000,
        'default',
      );
      expect(result.totalHits).toBe(hit);
      expect(result.isBlocked).toBe(hit > 5);
    }

    const independent = await secondStorage.increment(
      key,
      60_000,
      5,
      60_000,
      'default',
    );
    expect(independent.totalHits).toBe(1);
    expect(independent.isBlocked).toBe(false);
    const stillBlocked = await firstStorage.increment(
      key,
      60_000,
      5,
      60_000,
      'default',
    );
    expect(stillBlocked.totalHits).toBe(7);
    expect(stillBlocked.isBlocked).toBe(true);
  });
});
