import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { ConnectionsService } from '../connections/connections.service';
import { DatabaseStrategyFactory } from '../database-strategies/strategy.factory';

@Injectable()
export class NoSqlService {
  private readonly logger = new Logger(NoSqlService.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly connectionsService: ConnectionsService,
    private readonly strategyFactory: DatabaseStrategyFactory,
  ) {}

  private getSchemaCacheKey(
    connectionId: string,
    database: string,
    collection: string,
  ) {
    return `nosql_schema:${connectionId}:${database}:${collection}`;
  }

  async analyzeSchema(params: {
    connectionId: string;
    database: string;
    collection: string;
    sampleSize?: number;
    userId: string;
    refresh?: boolean;
  }) {
    const {
      connectionId,
      database,
      collection,
      sampleSize = 100,
      userId,
      refresh = false,
    } = params;
    const cacheKey = this.getSchemaCacheKey(connectionId, database, collection);

    // 1. Clear cache if refresh is requested
    if (refresh) {
      await this.redisService.del(cacheKey);
      this.logger.log(`Forced refresh: cleared cache for ${collection}`);
    } else {
      // Try to get from cache
      const cached = await this.redisService.get(cacheKey);
      if (cached) {
        this.logger.log(`Serving cached schema for ${collection}`);
        return cached;
      }
    }

    // 2. Sample and analyze
    this.logger.log(
      `Analyzing schema for ${collection} (sampling ${sampleSize} docs)`,
    );
    const pool = await this.connectionsService.getPool(
      connectionId,
      database,
      userId,
    );
    const strategy = this.strategyFactory.getStrategy('mongodb'); // Explicitly use mongodb for now

    // Get sample data
    const query = JSON.stringify({ find: collection, limit: sampleSize });
    const result = await strategy.executeQuery(pool, query);
    const data = result.rows || [];

    if (data.length === 0) return [];

    // Inference Logic
    const fieldMeta: Record<string, any> = {};
    data.forEach((doc: any) => {
      Object.keys(doc).forEach((key) => {
        if (!fieldMeta[key]) {
          fieldMeta[key] = {
            name: key,
            types: {},
            count: 0,
            probability: 0,
            sampleValues: [],
          };
        }

        const meta = fieldMeta[key];
        meta.count++;

        let type: string = typeof doc[key];
        if (doc[key] === null) type = 'null';
        else if (Array.isArray(doc[key])) type = 'array';
        else if (doc[key] instanceof Date) type = 'date';
        else if (type === 'object' && doc[key]._bsontype)
          type = doc[key]._bsontype.toLowerCase();

        meta.types[type] = (meta.types[type] || 0) + 1;

        if (
          meta.sampleValues.length < 5 &&
          !meta.sampleValues
            .map((v) => JSON.stringify(v))
            .includes(JSON.stringify(doc[key]))
        ) {
          meta.sampleValues.push(doc[key]);
        }
      });
    });

    const totalDocs = data.length;
    const stats = Object.values(fieldMeta)
      .map((stat: any) => ({
        ...stat,
        probability: (stat.count / totalDocs) * 100,
      }))
      .sort((a, b) => b.count - a.count);

    // 3. Save to cache (TTL: 1 hour)
    await this.redisService.set(cacheKey, stats, 3600);

    return stats;
  }

  async clearSchemaCache(
    connectionId: string,
    database: string,
    collection: string,
  ) {
    const cacheKey = this.getSchemaCacheKey(connectionId, database, collection);
    await this.redisService.del(cacheKey);
  }
}
