import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class AiSchemaContextService {
    constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}
    private readonly CACHE_TTL = 1000 * 60 * 15; // 15 minutes

    async gatherSchemaContext(pool: any, strategy: any, database?: string, connectionId?: string): Promise<string> {
        const cacheKey = connectionId ? `aicache:${connectionId}:${database || 'default'}` : null;

        if (cacheKey) {
            const cached = await this.cacheManager.get<string>(cacheKey);
            if (cached) return cached;
        }

        let schemaContext = '';
        try {
            const schemas = await strategy.getSchemas(pool, database);
            const allTables: any[] = [];
            const columnMap = new Map<string, any[]>();
            const skipSchemas = ['pg_catalog', 'information_schema', 'pg_toast'];

            for (const schema of schemas) {
                const schemaName = typeof schema === 'string' ? schema : (schema as any).name;
                if (!schemaName || skipSchemas.includes(schemaName)) continue;

                try {
                    const tables = await strategy.getTables(pool, schemaName, database);
                    for (const table of tables) {
                        const tableName = typeof table === 'string' ? table : (table as any).name;
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

            let relationships: any[] = [];
            try {
                relationships = await strategy.getRelationships(pool);
            } catch {
                // Relationships are optional for some engines.
            }

            schemaContext = this.buildSchemaContext(allTables, columnMap, relationships);

            if (cacheKey && schemaContext && !schemaContext.includes('Could not load')) {
                await this.cacheManager.set(cacheKey, schemaContext, this.CACHE_TTL);
            }

            console.log(`[AiSchemaContextService] Schema context built: ${allTables.length} tables found`);
        } catch (error: any) {
            console.error('[AiSchemaContextService] Schema gathering failed:', error.message);
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

    buildSchemaContext(tables: any[], columns: Map<string, any[]>, relationships: any[]): string {
        let context = '';

        for (const table of tables) {
            const tableName = table.name || table;
            const schema = table.schema || 'public';
            const cols = columns.get(`${schema}.${tableName}`) || [];

            context += `\nTABLE: "${schema}"."${tableName}"\n`;
            context += '  Columns:\n';

            for (const col of cols) {
                const nullable = col.nullable ? 'NULL' : 'NOT NULL';
                const pk = col.isPrimaryKey ? ' [PRIMARY KEY]' : '';
                const def = col.defaultValue ? ` DEFAULT ${col.defaultValue}` : '';
                context += `    - ${col.name} ${col.type} ${nullable}${pk}${def}\n`;
            }
        }

        if (relationships && relationships.length > 0) {
            context += '\nRELATIONSHIPS (Foreign Keys):\n';
            for (const rel of relationships) {
                context += `  ${rel.sourceTable}.${rel.sourceColumn} -> ${rel.targetTable}.${rel.targetColumn}\n`;
            }
        }

        return context;
    }
}
