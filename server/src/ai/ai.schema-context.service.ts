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
}

interface SchemaInventory {
  tables: SchemaTable[];
  relationships: Relationship[];
}

const MAX_DETAILED_TABLES = 24;
const MAX_SCHEMA_CONTEXT_CHARACTERS = 32_000;

function tokenize(value: string): string[] {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1);
}

function selectRelevantTables(
  tables: SchemaTable[],
  relationships: Relationship[],
  searchTerm: string,
): SchemaTable[] {
  if (tables.length <= MAX_DETAILED_TABLES) return tables;

  const query = tokenize(searchTerm).join(' ');
  const queryTokens = new Set(tokenize(searchTerm));
  const ranked = tables
    .map((table, index) => {
      const name = tokenize(table.name).join(' ');
      const identifierTokens = tokenize(`${table.schema} ${table.name}`);
      let score = name && query.includes(name) ? 100 : 0;
      for (const token of queryTokens) {
        if (identifierTokens.includes(token)) score += 20;
        else if (
          token.length >= 3 &&
          identifierTokens.some(
            (identifier) =>
              identifier.includes(token) || token.includes(identifier),
          )
        ) {
          score += 4;
        }
      }
      return { table, score, index };
    })
    .sort(
      (left, right) => right.score - left.score || left.index - right.index,
    );

  const matched = ranked.filter(({ score }) => score > 0);
  if (matched.length === 0) {
    return tables.slice(0, MAX_DETAILED_TABLES);
  }

  const selected = matched
    .slice(0, MAX_DETAILED_TABLES)
    .map(({ table }) => table);
  const selectedNames = new Set(selected.map(({ name }) => name));
  const tablesByName = new Map(tables.map((table) => [table.name, table]));

  for (const relationship of relationships) {
    if (selected.length >= MAX_DETAILED_TABLES) break;
    const relatedName = selectedNames.has(relationship.source_table)
      ? relationship.target_table
      : selectedNames.has(relationship.target_table)
        ? relationship.source_table
        : null;
    const relatedTable = relatedName ? tablesByName.get(relatedName) : null;
    if (relatedTable && !selectedNames.has(relatedTable.name)) {
      selected.push(relatedTable);
      selectedNames.add(relatedTable.name);
    }
  }

  return selected;
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
    searchTerm = '',
  ): Promise<string> {
    const scope = [connectionId, database || 'default'];
    const relevanceKey = tokenize(searchTerm).join('|') || 'default';
    const inventoryCacheKey = connectionId
      ? await this.freshnessService.buildKey('ai-schema', scope, [
          'schema-inventory-v4',
        ])
      : null;
    const contextCacheKey = connectionId
      ? await this.freshnessService.buildKey('ai-schema', scope, [
          'schema-context-v4-relevant',
          relevanceKey,
        ])
      : null;

    if (contextCacheKey) {
      const cached = await this.cacheManager.get<string>(contextCacheKey);
      if (cached !== undefined && cached !== null) return cached;
    }

    let schemaContext = '';
    try {
      let inventory = inventoryCacheKey
        ? await this.cacheManager.get<SchemaInventory>(inventoryCacheKey)
        : undefined;
      if (!inventory) {
        const schemas = await strategy.getSchemas(pool, database);
        const allTables: SchemaTable[] = [];
        const skipSchemas = [
          'pg_catalog',
          'information_schema',
          'pg_toast',
          'sys',
          'performance_schema',
          'mysql',
        ];

        for (const schema of schemas) {
          const schemaName =
            typeof schema === 'string'
              ? schema
              : (schema as { name?: string }).name;
          if (!schemaName || skipSchemas.includes(schemaName)) continue;

          try {
            const tables = await strategy.getTables(pool, schemaName, database);
            for (const table of tables) {
              const tableName =
                typeof table === 'string'
                  ? table
                  : (table as { name?: string }).name;
              if (tableName) {
                allTables.push({ name: tableName, schema: schemaName });
              }
            }
          } catch {
            // Continue building a partial inventory.
          }
        }

        let relationships: Relationship[] = [];
        try {
          relationships = await strategy.getRelationships(pool, database);
        } catch {
          // Relationships are optional for some engines.
        }
        inventory = { tables: allTables, relationships };

        if (inventoryCacheKey) {
          await this.cacheManager.set(
            inventoryCacheKey,
            inventory,
            AI_CONSTANTS.SCHEMA_CACHE_TTL_MS,
          );
        }
      }

      const selectedTables = selectRelevantTables(
        inventory.tables,
        inventory.relationships,
        searchTerm,
      );
      const columnMap = new Map<string, ColumnInfo[]>();
      for (const table of selectedTables) {
        try {
          const columns = await strategy.getColumns(
            pool,
            table.schema,
            table.name,
            database,
          );
          columnMap.set(`${table.schema}.${table.name}`, columns);
        } catch {
          // Continue building partial schema context.
        }
      }

      const selectedTableRefs = new Set(
        selectedTables.flatMap((table) => [
          table.name,
          `${table.schema}.${table.name}`,
        ]),
      );
      const relationships = inventory.relationships.filter(
        (relationship) =>
          selectedTableRefs.has(relationship.source_table) &&
          selectedTableRefs.has(relationship.target_table),
      );
      schemaContext = this.buildSchemaContext(
        selectedTables,
        columnMap,
        relationships,
      );
      if (schemaContext.length > MAX_SCHEMA_CONTEXT_CHARACTERS) {
        schemaContext =
          schemaContext.slice(0, MAX_SCHEMA_CONTEXT_CHARACTERS) +
          '\n[Schema context truncated to fit the AI budget]\n';
      }

      if (
        contextCacheKey &&
        schemaContext &&
        !schemaContext.includes('Could not load')
      ) {
        await this.cacheManager.set(
          contextCacheKey,
          schemaContext,
          AI_CONSTANTS.SCHEMA_CACHE_TTL_MS,
        );
      }

      this.logger.log(
        `[AiSchemaContextService] Relevant schema context built: ${selectedTables.length}/${inventory.tables.length} tables`,
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
