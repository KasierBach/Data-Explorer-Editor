import type { RedisOptions } from 'ioredis';

export const REDIS_CONNECT_TIMEOUT_MS = 5_000;
export const REDIS_COMMAND_TIMEOUT_MS = 5_000;

export function redisUrl(config: { get<T>(key: string): T | undefined }) {
  return config.get<string>('REDIS_URL') || 'redis://localhost:6379';
}

export function redisOptions(): RedisOptions {
  return {
    connectTimeout: REDIS_CONNECT_TIMEOUT_MS,
    commandTimeout: REDIS_COMMAND_TIMEOUT_MS,
    maxRetriesPerRequest: 1,
    enableReadyCheck: true,
    retryStrategy: (times) => Math.min(times * 200, 2_000),
  };
}
