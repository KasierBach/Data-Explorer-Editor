import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { ForbiddenException } from '@nestjs/common';
import { ConnectionsService } from '../connections/connections.service';
import { DatabaseStrategyFactory } from '../database-strategies/strategy.factory';
import { FreshnessService } from '../common/freshness/freshness.service';

@Injectable()
export class NoSqlService {
  private readonly logger = new Logger(NoSqlService.name);
  private readonly DEFAULT_SCHEMA_SAMPLE_SIZE = 100;
  private readonly MAX_SCHEMA_SAMPLE_SIZE = 1000;

  constructor(
    private readonly redisService: RedisService,
    private readonly connectionsService: ConnectionsService,
    private readonly strategyFactory: DatabaseStrategyFactory,
    private readonly freshnessService: FreshnessService,
  ) {}

  private getSchemaCacheKey(
    connectionId: string,
    database: string,
    collection: string,
    sampleSize: number,
  ) {
    return this.freshnessService.buildKey(
      'nosql-schema',
      [connectionId, database],
      [collection, sampleSize],
    );
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
      sampleSize = this.DEFAULT_SCHEMA_SAMPLE_SIZE,
      userId,
      refresh = false,
    } = params;
    const connection = await this.connectionsService.authorizeAccess(
      connectionId,
      userId,
      database,
    );
    if (connection.allowQueryExecution === false)
      throw new ForbiddenException(
        'Schema sampling is disabled for this connection.',
      );
    const normalizedSampleSize = Math.min(
      Math.max(sampleSize, 1),
      this.MAX_SCHEMA_SAMPLE_SIZE,
    );
    if (refresh)
      await this.freshnessService.bump('nosql-schema', [
        connectionId,
        database,
      ]);
    const cacheKey = await this.getSchemaCacheKey(
      connectionId,
      database,
      collection,
      normalizedSampleSize,
    );

    if (refresh) {
      await this.redisService.del(cacheKey);
      this.logger.log(`Forced refresh: cleared cache for ${collection}`);
    } else {
      const cached = await this.redisService.get(cacheKey);
      if (cached) {
        this.logger.log(`Serving cached schema for ${collection}`);
        return cached;
      }
    }

    this.logger.log(
      `Analyzing schema for ${collection} (sampling ${normalizedSampleSize} docs)`,
    );
    const pool = await this.connectionsService.getPool(
      connectionId,
      database,
      userId,
    );
    const strategy = this.strategyFactory.getStrategy('mongodb');

    const query = JSON.stringify({
      action: 'find',
      collection,
      limit: normalizedSampleSize,
    });
    const result = await strategy.executeQuery(pool, query);
    const data = result.rows || [];

    if (data.length === 0) return [];

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

    await this.redisService.set(cacheKey, stats, 3600);

    return stats;
  }

  async clearSchemaCache(
    connectionId: string,
    database: string,
    collection: string,
    userId: string,
  ) {
    await this.connectionsService.getPool(connectionId, database, userId);
    await this.freshnessService.bump('nosql-schema', [connectionId, database]);
  }
}
