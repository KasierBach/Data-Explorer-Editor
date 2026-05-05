import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { createHash } from 'crypto';

@Injectable()
export class FreshnessService {
  private readonly versionTtlMs = 30 * 24 * 60 * 60 * 1000;

  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

  private normalizeScope(scopeParts: Array<string | number | null | undefined>) {
    return scopeParts
      .map((part) => String(part ?? '').trim().toLowerCase())
      .filter(Boolean);
  }

  private hash(parts: string[]) {
    return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 16);
  }

  private getVersionKey(namespace: string, scopeParts: Array<string | number | null | undefined>) {
    const scopeHash = this.hash(this.normalizeScope(scopeParts));
    return `freshness:${namespace}:${scopeHash}:version`;
  }

  private async readVersion(namespace: string, scopeParts: Array<string | number | null | undefined>) {
    const versionKey = this.getVersionKey(namespace, scopeParts);
    const current = await this.cacheManager.get<number>(versionKey);
    return Number(current ?? 0) || 0;
  }

  async bump(namespace: string, scopeParts: Array<string | number | null | undefined>) {
    const versionKey = this.getVersionKey(namespace, scopeParts);
    const nextVersion = (await this.readVersion(namespace, scopeParts)) + 1;
    await this.cacheManager.set(versionKey, nextVersion, this.versionTtlMs);
    return nextVersion;
  }

  async buildKey(
    namespace: string,
    scopeParts: Array<string | number | null | undefined>,
    cacheParts: Array<string | number | null | undefined>,
  ) {
    const version = await this.readVersion(namespace, scopeParts);
    const scopeHash = this.hash(this.normalizeScope(scopeParts));
    const cacheHash = this.hash(this.normalizeScope(cacheParts));
    return `freshness:${namespace}:${scopeHash}:v${version}:${cacheHash}`;
  }
}
