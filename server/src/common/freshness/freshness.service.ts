import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { createHash, randomUUID } from 'crypto';
import { MongoBulkWriteError } from 'mongodb';

@Injectable()
export class FreshnessService {
  private readonly logger = new Logger(FreshnessService.name);
  private readonly versionTtlMs = 30 * 24 * 60 * 60 * 1000;

  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

  private hash(parts: Array<string | number | null | undefined>) {
    return createHash('sha256')
      .update(JSON.stringify(parts))
      .digest('hex')
      .slice(0, 16);
  }

  private getVersionKey(
    namespace: string,
    scopeParts: Array<string | number | null | undefined>,
  ) {
    const scopeHash = this.hash(scopeParts);
    return `freshness:v2:${namespace}:${scopeHash}:version`;
  }

  private async readVersion(
    namespace: string,
    scopeParts: Array<string | number | null | undefined>,
  ) {
    const versionKey = this.getVersionKey(namespace, scopeParts);
    return (await this.cacheManager.get<string>(versionKey)) ?? '0';
  }

  async bump(
    namespace: string,
    scopeParts: Array<string | number | null | undefined>,
  ) {
    const versionKey = this.getVersionKey(namespace, scopeParts);
    // Unique generations avoid concurrent read/increment/write reusing a cache key.
    const nextVersion = randomUUID();
    await this.cacheManager.set(versionKey, nextVersion, this.versionTtlMs);
    return nextVersion;
  }

  async buildKey(
    namespace: string,
    scopeParts: Array<string | number | null | undefined>,
    cacheParts: Array<string | number | null | undefined>,
  ) {
    const version = await this.readVersion(namespace, scopeParts);
    const scopeHash = this.hash(scopeParts);
    const cacheHash = this.hash(cacheParts);
    return `freshness:v2:${namespace}:${scopeHash}:v${version}:${cacheHash}`;
  }

  async invalidateConnection(connectionId: string, database?: string | null) {
    await this.bump('query', [connectionId, database ?? null]);
    for (const namespace of [
      'hierarchy',
      'databases',
      'relationships',
      'columns',
      'metrics',
      'fullmeta',
    ]) {
      await this.bump(namespace, [connectionId]);
    }
    await this.bump('nosql-schema', [connectionId, database ?? null]);
    await this.bump('ai-schema', [connectionId, database ?? null]);
    if (database != null) await this.bump('ai-schema', [connectionId, null]);
  }

  async invalidatePartialWrite(
    error: unknown,
    connectionId: string,
    database?: string | null,
  ) {
    if (
      error instanceof MongoBulkWriteError &&
      (error.insertedCount > 0 ||
        error.modifiedCount > 0 ||
        error.deletedCount > 0 ||
        error.upsertedCount > 0)
    ) {
      try {
        await this.invalidateConnection(connectionId, database);
      } catch {
        this.logger.error(
          `Cache refresh failed after a partial write on connection ${connectionId}.`,
        );
      }
    }
  }
}
