import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { ConnectionsService } from '../connections/connections.service';
import { DatabaseStrategyFactory } from '../database-strategies';
import { NotificationsService } from '../notifications/notifications.service';
import { AiService } from '../ai/ai.service';

@Injectable()
export class SearchService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SearchService.name);
  private redis: Redis;

  constructor(
    private readonly configService: ConfigService,
    private readonly connectionsService: ConnectionsService,
    private readonly strategyFactory: DatabaseStrategyFactory,
    private readonly notificationsService: NotificationsService,
    private readonly aiService: AiService,
  ) {}

  onModuleInit() {
    const redisUrl =
      this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    this.redis = new Redis(redisUrl);
  }

  onModuleDestroy() {
    this.redis.quit();
  }

  private getIndexKey(userId: string) {
    return `search_index:${userId}`;
  }

  async syncIndex(userId: string) {
    const connections = await this.connectionsService.findAll(userId);
    const indexKey = this.getIndexKey(userId);

    // Clear existing index for this user
    await this.redis.del(indexKey);

    for (const conn of connections) {
      try {
        this.logger.log(`Indexing connection: ${conn.name} (${conn.id})`);
        const strategy = this.strategyFactory.getStrategy(conn.type);
        const pool = await this.connectionsService.getPool(
          conn.id,
          undefined,
          userId,
        );

        // Get all schemas
        const schemas = await strategy.getSchemas(pool);

        for (const schema of schemas) {
          // Robust parsing of schema and db names from ID
          // Format could be: "db:NAME.schema:NAME" or just "schema:NAME"
          let schemaName = schema.name;
          let dbName = '';

          const id = schema.id;
          if (id.includes('db:')) {
            const dbPart = id.split('.schema:')[0] || '';
            dbName = dbPart.replace('db:', '');

            if (id.includes('.schema:')) {
              schemaName = id.split('.schema:')[1] || schema.name;
            }
          } else if (id.includes('schema:')) {
            schemaName = id.replace('schema:', '');
          }

          const tables = await strategy.getTables(
            pool,
            schemaName,
            dbName || undefined,
          );
          const views = await strategy.getViews(
            pool,
            schemaName,
            dbName || undefined,
          );

          const items = [...tables, ...views].map((node) => ({
            id: node.id,
            name: node.name,
            type: node.type,
            connectionId: conn.id,
            connectionName: conn.name,
            database: dbName || conn.database || 'default',
            schema: schemaName,
          }));

          if (items.length > 0) {
            await this.redis.sadd(
              indexKey,
              ...items.map((i) => JSON.stringify(i)),
            );
          }
        }
      } catch (err) {
        this.logger.error(
          `Failed to index connection ${conn.id}: ${err.message}`,
        );
      }
    }

    /* 
        await this.notificationsService.emit(
            userId,
            'success',
            `Global search index synced for ${connections.length} connections.`
        );
        */

    return { success: true, message: 'Sync completed' };
  }

  async search(userId: string, query: string) {
    const indexKey = this.getIndexKey(userId);
    const allItems = await this.redis.smembers(indexKey);
    const parsedItems = allItems.map((item) => JSON.parse(item));

    const q = query.toLowerCase();

    // 1. Keyword Search (Redis Index)
    const keywordResults = parsedItems.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        (item.schema && item.schema.toLowerCase().includes(q)),
    );

    // 2. Semantic Search (AI Fallback)
    // If results are few and query is meaningful, call AI
    if (keywordResults.length < 5 && query.length > 2) {
      const tableNames = parsedItems.map((i) => i.name);
      const aiTableSuggestions = await this.aiService.suggestTablesBySemantic(
        query,
        tableNames,
      );

      if (aiTableSuggestions.length > 0) {
        const aiResults = parsedItems
          .filter((item) => aiTableSuggestions.includes(item.name))
          .map((item) => ({ ...item, isAiSuggested: true }));

        // Combine and deduplicate
        const existingIds = new Set(keywordResults.map((r) => r.id));
        const finalResults = [...keywordResults];

        for (const aiItem of aiResults) {
          if (!existingIds.has(aiItem.id)) {
            finalResults.push(aiItem);
          }
        }

        return finalResults.slice(0, 50);
      }
    }

    return keywordResults
      .sort((a, b) => a.name.length - b.name.length)
      .slice(0, 50);
  }
}
