import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import type {
  SearchIndexItem,
  StoredSearchIndexItem,
} from './search-index.types';

@Injectable()
export class SearchIndexRepository {
  private readonly maxSemanticFallbackNames = 500;

  constructor(private readonly redisService: RedisService) {}

  private namespace(userId: string) {
    return `search_index:${userId}`;
  }

  private itemsKey(userId: string) {
    return `${this.namespace(userId)}:items`;
  }

  private manifestKey(userId: string) {
    return `${this.namespace(userId)}:manifest`;
  }

  private termKey(userId: string, term: string) {
    return `${this.namespace(userId)}:term:${term}`;
  }

  private normalize(value: string) {
    return value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private tokenize(value: string) {
    return this.normalize(value).match(/[a-z0-9]+/g) ?? [];
  }

  private buildSearchText(item: SearchIndexItem) {
    return this.tokenize(
      [item.name, item.schema, item.database, item.connectionName, item.type]
        .filter(Boolean)
        .join(' '),
    ).join(' ');
  }

  private buildIndexTerms(item: SearchIndexItem) {
    const tokens = new Set<string>();
    const addTokenVariants = (token: string) => {
      if (!token) {
        return;
      }

      tokens.add(`prefix:${token.slice(0, 1)}`);
      if (token.length >= 2) {
        tokens.add(`prefix:${token.slice(0, 2)}`);
      }

      if (token.length < 3) {
        tokens.add(`prefix:${token}`);
        return;
      }

      for (let index = 0; index <= token.length - 3; index += 1) {
        tokens.add(`gram:${token.slice(index, index + 3)}`);
      }
    };

    for (const token of this.tokenize(
      [item.name, item.schema, item.database, item.connectionName, item.type]
        .filter(Boolean)
        .join(' '),
    )) {
      addTokenVariants(token);
    }

    return [...tokens];
  }

  private buildQueryTerms(query: string) {
    const terms = new Set<string>();
    for (const token of this.tokenize(query)) {
      if (token.length < 3) {
        terms.add(`prefix:${token}`);
        continue;
      }

      for (let index = 0; index <= token.length - 3; index += 1) {
        terms.add(`gram:${token.slice(index, index + 3)}`);
      }
    }

    return [...terms];
  }

  private parseStoredItem(value: string | null): StoredSearchIndexItem | null {
    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value) as StoredSearchIndexItem;
    } catch {
      return null;
    }
  }

  private matchesAllQueryTokens(
    storedItem: StoredSearchIndexItem,
    queryTokens: string[],
  ) {
    return queryTokens.every((token) => storedItem.searchText.includes(token));
  }

  private toPublicItem(storedItem: StoredSearchIndexItem): SearchIndexItem {
    const { searchText: _searchText, ...item } = storedItem;
    return item;
  }

  private async flushPipeline(pipeline: any) {
    await pipeline.exec();
  }

  async clearUserIndex(userId: string) {
    const client = this.redisService.getClient();
    const manifestKey = this.manifestKey(userId);
    const keys = await client.smembers(manifestKey);
    if (keys.length > 0) {
      await client.del(...keys);
    }
    await client.del(manifestKey);
  }

  async replaceUserIndex(userId: string, items: SearchIndexItem[]) {
    const client = this.redisService.getClient();
    await this.clearUserIndex(userId);

    const manifestKey = this.manifestKey(userId);
    const itemsKey = this.itemsKey(userId);

    let pipeline = client.pipeline();
    pipeline.sadd(manifestKey, itemsKey);

    let commandCount = 1;
    for (const item of items) {
      const storedItem: StoredSearchIndexItem = {
        ...item,
        searchText: this.buildSearchText(item),
      };
      pipeline.hset(itemsKey, item.id, JSON.stringify(storedItem));
      commandCount += 1;

      for (const term of this.buildIndexTerms(item)) {
        const key = this.termKey(userId, term);
        pipeline.sadd(key, item.id);
        pipeline.sadd(manifestKey, key);
        commandCount += 2;
      }

      if (commandCount >= 2_000) {
        await this.flushPipeline(pipeline);
        pipeline = client.pipeline();
        commandCount = 0;
      }
    }

    await this.flushPipeline(pipeline);
  }

  async search(userId: string, query: string, limit = 50) {
    const queryTokens = this.tokenize(query);
    if (queryTokens.length === 0) {
      return [];
    }
    const normalizedQuery = this.normalize(query);

    const client = this.redisService.getClient();
    const termKeys = this.buildQueryTerms(query).map((term) =>
      this.termKey(userId, term),
    );

    if (termKeys.length === 0) {
      return [];
    }

    const candidateGroups = await Promise.all(
      termKeys.map((key) => client.smembers(key)),
    );

    if (candidateGroups.some((group) => group.length === 0)) {
      return [];
    }

    let candidateIds = candidateGroups[0] ?? [];
    for (const group of candidateGroups.slice(1)) {
      const allowedIds = new Set(group);
      candidateIds = candidateIds.filter((candidateId) =>
        allowedIds.has(candidateId),
      );
      if (candidateIds.length === 0) {
        return [];
      }
    }

    const storedItems = await client.hmget(
      this.itemsKey(userId),
      ...candidateIds,
    );
    const matchedItems = storedItems
      .map((value) => this.parseStoredItem(value))
      .filter((item): item is StoredSearchIndexItem => Boolean(item))
      .filter((item) => this.matchesAllQueryTokens(item, queryTokens))
      .sort((left, right) => {
        const exactLeft = this.normalize(left.name).startsWith(normalizedQuery)
          ? 0
          : 1;
        const exactRight = this.normalize(right.name).startsWith(
          normalizedQuery,
        )
          ? 0
          : 1;

        if (exactLeft !== exactRight) {
          return exactLeft - exactRight;
        }

        return left.name.length - right.name.length;
      })
      .slice(0, limit)
      .map((item) => this.toPublicItem(item));

    return matchedItems;
  }

  async getSemanticFallbackNames(userId: string) {
    const client = this.redisService.getClient();
    const itemsKey = this.itemsKey(userId);
    const names = new Set<string>();
    let cursor = '0';

    do {
      const [nextCursor, chunk] = await client.hscan(
        itemsKey,
        cursor,
        'COUNT',
        100,
      );

      cursor = nextCursor;
      for (let index = 1; index < chunk.length; index += 2) {
        const storedItem = this.parseStoredItem(chunk[index]);
        if (!storedItem?.name) {
          continue;
        }

        names.add(storedItem.name);
        if (names.size >= this.maxSemanticFallbackNames) {
          return [...names];
        }
      }
    } while (cursor !== '0');

    return [...names];
  }

  async getItemsByNames(userId: string, names: string[], limit = 50) {
    if (names.length === 0) {
      return [];
    }

    const client = this.redisService.getClient();
    const itemsKey = this.itemsKey(userId);
    const wantedNames = new Set(names);
    const matches: SearchIndexItem[] = [];
    let cursor = '0';

    do {
      const [nextCursor, chunk] = await client.hscan(
        itemsKey,
        cursor,
        'COUNT',
        100,
      );

      cursor = nextCursor;
      for (let index = 1; index < chunk.length; index += 2) {
        const storedItem = this.parseStoredItem(chunk[index]);
        if (!storedItem || !wantedNames.has(storedItem.name)) {
          continue;
        }

        matches.push(this.toPublicItem(storedItem));
        if (matches.length >= limit) {
          return matches;
        }
      }
    } while (cursor !== '0');

    return matches;
  }
}
