import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import * as crypto from 'crypto';
import { AiSchemaContextService } from './ai.schema-context.service';
import { AiProviderRunnerService } from './ai.provider-runner.service';
import { AI_CONSTANTS } from './ai.constants';
import type { StreamEvent } from './ai.types';
import type { IDatabaseStrategy, ColumnInfo, Relationship } from '../database-strategies/database-strategy.interface';

interface SchemaTable {
    name: string;
    schema: string;
}

@Injectable()
export class AiSchemaService {
    private readonly logger = new Logger(AiSchemaService.name);

    constructor(
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
        private readonly schemaContextService: AiSchemaContextService,
        private readonly providerRunner: AiProviderRunnerService,
    ) {}

    async suggestTablesBySemantic(searchTerm: string, tableNames: string[]): Promise<string[]> {
        if (!this.providerRunner.isGeminiAvailable() || tableNames.length === 0) return [];

        const cacheKey = `ai:semantic_search:${crypto.createHash('sha256').update(searchTerm + tableNames.join('|')).digest('hex')}`;
        const cached = await this.cacheManager.get<string[]>(cacheKey);
        if (cached) return cached;

        const prompt = `Given the database table names below, find the most relevant ones for the search term: "${searchTerm}".
TABLES:
${tableNames.join(', ')}

Rules:
- Return ONLY a comma-separated list of table names.
- If nothing is relevant, return an empty string.
- Max 5 results.
- Understand synonyms and translations (e.g., "khách hàng" matches "customers", "user" matches "profile").`;

        try {
            const response = await this.providerRunner.completeGeminiText({
                model: 'gemini-3.1-flash-lite-preview',
                prompt,
                temperature: AI_CONSTANTS.TEMPERATURE_PRECISE,
                maxOutputTokens: 100,
            });

            const suggestions = response
                .split(',')
                .map(s => s.trim())
                .filter(s => tableNames.includes(s))
                .slice(0, 5);

            if (suggestions.length > 0) {
                await this.cacheManager.set(cacheKey, suggestions, AI_CONSTANTS.AUTOCOMPLETE_CACHE_TTL_MS);
            }
            return suggestions;
        } catch (error) {
            this.logger.warn('[AiSchemaService] Semantic suggestion failed:', error instanceof Error ? error.message : 'Unknown error');
            return [];
        }
    }

    async gatherSchemaContext(pool: unknown, strategy: IDatabaseStrategy, database?: string, connectionId?: string): Promise<string> {
        return this.schemaContextService.gatherSchemaContext(pool, strategy, database, connectionId);
    }

    clearCache(connectionId: string, database?: string) {
        this.schemaContextService.clearCache(connectionId, database);
    }

    buildSchemaContext(tables: SchemaTable[], columns: Map<string, ColumnInfo[]>, relationships: Relationship[]): string {
        return this.schemaContextService.buildSchemaContext(tables, columns, relationships);
    }
}