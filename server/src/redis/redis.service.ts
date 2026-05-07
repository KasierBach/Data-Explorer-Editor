import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    this.client = new Redis(redisUrl);
    
    this.client.on('error', (err) => {
      this.logger.error('Redis connection error:', err);
    });

    this.client.on('connect', () => {
      this.logger.log('Redis connected successfully');
    });
  }

  onModuleDestroy() {
    this.client.quit();
  }

  /**
   * Set a key-value pair in Redis with an optional TTL (Time To Live).
   */
  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    if (ttlSeconds) {
      await this.client.set(key, stringValue, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, stringValue);
    }
  }

  /**
   * Get a value from Redis by key.
   */
  async get<T = any>(key: string): Promise<T | null> {
    const value = await this.client.get(key);
    if (!value) return null;
    
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  }

  /**
   * Delete one or more keys from Redis.
   */
  async del(key: string | string[]): Promise<void> {
    if (Array.isArray(key)) {
      if (key.length > 0) await this.client.del(...key);
    } else {
      await this.client.del(key);
    }
  }

  /**
   * Get all keys matching a pattern.
   */
  async keys(pattern: string): Promise<string[]> {
    return this.client.keys(pattern);
  }

  /**
   * Get the underlying ioredis client instance.
   */
  getClient(): Redis {
    return this.client;
  }
}
