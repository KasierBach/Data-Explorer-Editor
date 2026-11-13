import type { INestApplication } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import Redis from 'ioredis';
import { closeE2eApp, createE2eApp } from './e2e-app';

const { cleanupRateLimitFixture, trackRateLimitKeys } = createRequire(
  __filename,
)('./fixtures/rate-limit-cleanup.cjs') as {
  cleanupRateLimitFixture(options: {
    client: Redis | undefined;
    keys: Set<string>;
    apps: INestApplication[];
    closeApp: typeof closeE2eApp;
  }): Promise<void>;
  trackRateLimitKeys(
    client: ThrottlerStorageRedisService['redis'],
    keys: Set<string>,
  ): () => void;
};

describe('R10 isolated fixture rate limits', () => {
  let first: INestApplication;
  let second: INestApplication;
  let control: Redis;
  const keys = new Set<string>();
  const restorers: Array<() => void> = [];

  beforeAll(async () => {
    control = new Redis(process.env.E2E_REDIS_URL!, {
      lazyConnect: true,
      connectTimeout: 2_000,
      commandTimeout: 2_000,
      maxRetriesPerRequest: 0,
      enableOfflineQueue: false,
      retryStrategy: () => null,
    });
    control.on('error', () => {});
    await control.connect();
    first = await createE2eApp();
    second = await createE2eApp();
    for (const app of [first, second]) {
      restorers.push(
        trackRateLimitKeys(
          app.get<ThrottlerStorageRedisService>(ThrottlerStorage).redis,
          keys,
        ),
      );
    }
  });

  afterAll(async () => {
    for (const restore of restorers) restore();
    await cleanupRateLimitFixture({
      client: control,
      keys,
      apps: [second, first],
      closeApp: closeE2eApp,
    });
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
    expect(keys.size).toBe(4);
    expect(new Set([...keys].map((value) => value.split('}:')[0])).size).toBe(
      2,
    );
  });
});
