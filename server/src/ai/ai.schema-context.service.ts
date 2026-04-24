import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { AI_CONSTANTS } from './ai.constants';
import type { IDatabaseStrategy, ColumnInfo, TreeNodeResult, Relationship } from '../database-strategies/database-strategy.interface';

interface SchemaTable {
    name: string;
    schema: string;
}

@Injectable()
export class AiSchemaContextService {
    private readonly logger = new Logger(AiSchemaContextService.name);
    constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

    async gatherSchemaContext(pool: unknown, strategy: IDatabaseStrategy, database?: string, connectionId?: string): Promise<string> {
        const cacheKey = connectionId ? `aicache:${connectionId}:${database || 'default'}` : null;

        if (cacheKey) {
            const cached = await this.cacheManager.get<string>(cacheKey);
            if (cached) return cached;
        }

        let schemaContext = '';
        try {
            const schemas = await strategy.getSchemas(pool, database);
            const allTables: SchemaTable[] = [];
            const columnMap = new Map<string, ColumnInfo[]>();
            const skipSchemas = ['pg_catalog', 'information_schema', 'pg_toast'];

            for (const schema of schemas) {
                const schemaName = typeof schema === 'string' ? schema : (schema as { name?: string }).name;
                if (!schemaName || skipSchemas.includes(schemaName)) continue;

                try {
                    const tables = await strategy.getTables(pool, schemaName, database);
                    for (const table of tables) {
                        const tableName = typeof table === 'string' ? table : (table as { name?: string }).name;
                        if (!tableName) continue;
                        allTables.push({ name: tableName, schema: schemaName });

                        try {
                            const cols = await strategy.getColumns(pool, schemaName, tableName);
                            columnMap.set(`${schemaName}.${tableName}`, cols);
                        } catch {
                            // Continue building partial schema context.
                        }
                    }
                } catch {
                    // Continue building partial schema context.
                }
            }

            let relationships: Relationship[] = [];
            try {
                relationships = await strategy.getRelationships(pool);
            } catch {
                // Relationships are optional for some engines.
            }

            schemaContext = this.buildSchemaContext(allTables, columnMap, relationships);

            if (cacheKey && schemaContext && !schemaContext.includes('Could not load')) {
                await this.cacheManager.set(cacheKey, schemaContext, AI_CONSTANTS.SCHEMA_CACHE_TTL_MS);
            }

            this.logger.log(`[AiSchemaContextService] Schema context built: ${allTables.length} tables found`);
        } catch (error) {
            this.logger.error('[AiSchemaContextService] Schema gathering failed:', error instanceof Error ? error.message : 'Unknown error');
            schemaContext = '(Could not load schema information)';
        }

        return schemaContext;
    }

    async clearCache(connectionId: string, database?: string) {
        if (database) {
            await this.cacheManager.del(`aicache:${connectionId}:${database}`);
            return;
        }
        // Patterns are not easily supported in basic CacheManager, but we can delete the default one
        await this.cacheManager.del(`aicache:${connectionId}:default`);
    }

    buildSchemaContext(tables: SchemaTable[], columns: Map<string, ColumnInfo[]>, relationships: Relationship[]): string {
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
                const def = col.defaultValue ? ` DEFAULT ${col.defaultValue}` : '';
                context += `    - ${col.name} ${col.type} ${nullable}${pk}${def}\n`;
            }
        }

        if (relationships && relationships.length > 0) {
            context += '\nRELATIONSHIPS (Foreign Keys):\n';
            for (const rel of relationships) {
                context += `  ${rel.source_table}.${rel.source_column} -> ${rel.target_table}.${rel.target_column}\n`;
            }
        }

        return context;
    }
}
