import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConnectionsService } from '../connections/connections.service';
import { DatabaseStrategyFactory } from '../database-strategies';
import { AiService } from '../ai/ai.service';
import { SearchIndexRepository } from './search-index.repository';
import type { SearchIndexItem } from './search-index.types';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private readonly connectionsService: ConnectionsService,
    private readonly strategyFactory: DatabaseStrategyFactory,
    private readonly aiService: AiService,
    private readonly searchIndexRepository: SearchIndexRepository,
  ) {}

  private async suggestNames(userId: string, query: string) {
    const names =
      await this.searchIndexRepository.getSemanticFallbackNames(userId);
    if (names.length === 0) {
      return [] as string[];
    }

    const timeoutMs = 1_500;
    const semanticPromise: Promise<string[]> =
      this.aiService.suggestTablesBySemantic(query, names);
    const timeoutPromise = new Promise<string[]>((resolve) => {
        setTimeout(() => resolve([]), timeoutMs);
      });
    return Promise.race([semanticPromise, timeoutPromise]);
  }

  async syncIndex(userId: string) {
    const connections = await this.connectionsService.findAll(userId);
    const indexedItems: SearchIndexItem[] = [];

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

          indexedItems.push(...items);
        }
      } catch (err) {
        this.logger.error(
          `Failed to index connection ${conn.id}: ${err.message}`,
        );
      }
    }

    await this.searchIndexRepository.replaceUserIndex(userId, indexedItems);

    return { success: true, message: 'Sync completed' };
  }

  async search(userId: string, query: string) {
    const keywordResults = await this.searchIndexRepository.search(
      userId,
      query,
      50,
    );

    // 2. Semantic Search (AI Fallback)
    // If results are few and query is meaningful, call AI
    if (keywordResults.length < 5 && query.length > 2) {
      const aiTableSuggestions = await this.suggestNames(userId, query);

      if (aiTableSuggestions.length > 0) {
        const aiResults = (
          await this.searchIndexRepository.getItemsByNames(
            userId,
            aiTableSuggestions,
            50,
          )
        )
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

    return keywordResults;
  }
}
