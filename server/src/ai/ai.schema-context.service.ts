import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { AI_CONSTANTS } from './ai.constants';
import type {
  IDatabaseStrategy,
  ColumnInfo,
  Relationship,
} from '../database-strategies/database-strategy.interface';
import { FreshnessService } from '../common/freshness/freshness.service';

interface SchemaTable {
  name: string;
  schema: string;
  sampleData?: Record<string, unknown>[];
}

function formatSchemaDefaultValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}

@Injectable()
export class AiSchemaContextService {
  private readonly logger = new Logger(AiSchemaContextService.name);
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly freshnessService: FreshnessService,
  ) {}

  async gatherSchemaContext(
    pool: unknown,
    strategy: IDatabaseStrategy,
    database?: string,
    connectionId?: string,
  ): Promise<string> {
    const cacheKey = connectionId
      ? await this.freshnessService.buildKey(
          'ai-schema',
          [connectionId, database || 'default'],
          ['schema-context-v2'], // Versioned key for new format
        )
      : null;

    if (cacheKey) {
      const cached = await this.cacheManager.get<string>(cacheKey);
      if (cached) return cached;
    }

    let schemaContext = '';
    try {
      const schemas = await strategy.getSchemas(pool, database);
      const allTables: SchemaTable[] = [];
      const columnMap = new Map<string, ColumnInfo[]>();
      const skipSchemas = [
        'pg_catalog',
        'information_schema',
        'pg_toast',
        'sys',
        'performance_schema',
        'mysql',
      ];

      // Limit table gathering to prevent context overflow
      let tableCount = 0;
      const MAX_TABLES = 100;

      for (const schema of schemas) {
        const schemaName =
          typeof schema === 'string'
            ? schema
            : (schema as { name?: string }).name;
        if (!schemaName || skipSchemas.includes(schemaName)) continue;

        try {
          const tables = await strategy.getTables(pool, schemaName, database);
          for (const table of tables) {
            if (tableCount >= MAX_TABLES) break;

            const tableName =
              typeof table === 'string'
                ? table
                : (table as { name?: string }).name;
            if (!tableName) continue;

            const tableObj: SchemaTable = {
              name: tableName,
              schema: schemaName,
            };
            allTables.push(tableObj);
            tableCount++;

            try {
              const cols = await strategy.getColumns(
                pool,
                schemaName,
                tableName,
                database,
              );
              columnMap.set(`${schemaName}.${tableName}`, cols);

              // Gather sample data to provide real data type context to AI
              if (tableCount < 30) {
                const sample = await strategy
                  .getSampleRows(pool, schemaName, tableName, 2)
                  .catch(() => []);
                if (sample && sample.length > 0) {
                  tableObj.sampleData = sample;
                }
              }
            } catch {
              // Continue building partial schema context.
            }
          }
        } catch {
          // Continue building partial schema context.
        }
        if (tableCount >= MAX_TABLES) break;
      }

      let relationships: Relationship[] = [];
      try {
        relationships = await strategy.getRelationships(pool, database);
      } catch {
        // Relationships are optional for some engines.
      }

      schemaContext = this.buildSchemaContext(
        allTables,
        columnMap,
        relationships,
      );

      if (
        cacheKey &&
        schemaContext &&
        !schemaContext.includes('Could not load')
      ) {
        await this.cacheManager.set(
          cacheKey,
          schemaContext,
          AI_CONSTANTS.SCHEMA_CACHE_TTL_MS,
        );
      }

      this.logger.log(
        `[AiSchemaContextService] Schema context built: ${allTables.length} tables with sample data`,
      );
    } catch (error) {
      this.logger.error(
        '[AiSchemaContextService] Schema gathering failed:',
        error instanceof Error ? error.message : 'Unknown error',
      );
      schemaContext = '(Could not load schema information)';
    }

    return schemaContext;
  }

  async clearCache(connectionId: string, database?: string) {
    await this.freshnessService.bump('ai-schema', [
      connectionId,
      database || 'default',
    ]);
  }

  buildSchemaContext(
    tables: SchemaTable[],
    columns: Map<string, ColumnInfo[]>,
    relationships: Relationship[],
  ): string {
    let context = '';

    for (const table of tables) {
      const tableName = table.name;
      const schema = table.schema;
      const cols = columns.get(`${schema}.${tableName}`) || [];

      context += `\nTABLE: "${schema}"."${tableName}"\n`;
      context += '  Columns:\n';

      for (const col of cols) {
        const nullable = col.isNullable ? 'NULL' : 'NOT NULL';
        const pk = col.isPrimaryKey ? ' [PRIMARY KEY]' : '';
        const def =
          col.defaultValue !== undefined && col.defaultValue !== null
            ? ` DEFAULT ${formatSchemaDefaultValue(col.defaultValue)}`
            : '';
        context += `    - ${col.name} ${col.type} ${nullable}${pk}${def}\n`;
      }

      if (table.sampleData && table.sampleData.length > 0) {
        context += '  SAMPLE DATA:\n';
        table.sampleData.forEach((row) => {
          context += `    - ${JSON.stringify(row)}\n`;
        });
      }
    }

    if (relationships && relationships.length > 0) {
      const uniqueRels = relationships.filter(
        (rel, index, self) =>
          index ===
          self.findIndex(
            (r) =>
              r.source_table === rel.source_table &&
              r.source_column === rel.source_column &&
              r.target_table === rel.target_table &&
              r.target_column === rel.target_column,
          ),
      );

      context += '\nRELATIONSHIPS (Foreign Keys):\n';
      for (const rel of uniqueRels) {
        context += `  ${rel.source_table}.${rel.source_column} -> ${rel.target_table}.${rel.target_column}\n`;
      }
    }

    return context;
  }
}
