import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { AiPromptBuilderService } from './ai.prompt-builder.service';
import { AiProviderRunnerService } from './ai.provider-runner.service';
import { AiRoutingService } from './ai.routing.service';
import { AiSchemaContextService } from './ai.schema-context.service';
import type { ChatParams, ChatResult, StreamEvent } from './ai.types';
import * as crypto from 'crypto';

@Injectable()
export class AiService {
    constructor(
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
        private readonly promptBuilder: AiPromptBuilderService,
        private readonly providerRunner: AiProviderRunnerService,
        private readonly routingService: AiRoutingService,
        private readonly schemaContextService: AiSchemaContextService,
    ) {}

    async chat(params: ChatParams): Promise<ChatResult> {
        const { routingMode, plans } = this.routingService.buildPlanChain(params, this.providerRunner.isGeminiAvailable());
        let lastError: any = null;

        for (const plan of plans) {
            try {
                if (plan.provider === 'gemini') {
                    return await this.providerRunner.runGemini(plan, params, routingMode);
                }

                return await this.providerRunner.runOpenAiCompatible(plan, params, routingMode);
            } catch (error: any) {
                lastError = error;
                console.warn(`[AiService] Provider ${plan.provider}/${plan.model} failed:`, error?.message || error);
            }
        }

        throw new Error(`AI generation failed: ${lastError?.message || 'No provider could complete the request'}`);
    }

    async * chatStream(params: ChatParams): AsyncGenerator<StreamEvent> {
        const { routingMode, plans } = this.routingService.buildPlanChain(params, this.providerRunner.isGeminiAvailable());
        let lastError: any = null;

        for (const plan of plans) {
            try {
                if (plan.provider === 'gemini') {
                    yield* this.providerRunner.streamGemini(plan, params, routingMode);
                    return;
                }

                yield* this.providerRunner.streamOpenAiCompatible(plan, params, routingMode);
                return;
            } catch (error: any) {
                lastError = error;
                console.warn(`[AiService:Stream] Provider ${plan.provider}/${plan.model} failed:`, error?.message || error);
            }
        }

        yield {
            type: 'error',
            text: `AI generation failed: ${lastError?.message || 'No provider could complete the request'}`,
        };
    }

    async gatherSchemaContext(pool: any, strategy: any, database?: string, connectionId?: string): Promise<string> {
        return this.schemaContextService.gatherSchemaContext(pool, strategy, database, connectionId);
    }

    clearCache(connectionId: string, database?: string) {
        this.schemaContextService.clearCache(connectionId, database);
    }

    buildSchemaContext(tables: any[], columns: Map<string, any[]>, relationships: any[]): string {
        return this.schemaContextService.buildSchemaContext(tables, columns, relationships);
    }

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
                temperature: 0.1,
                maxOutputTokens: 100,
            });

            const suggestions = response
                .split(',')
                .map(s => s.trim())
                .filter(s => tableNames.includes(s))
                .slice(0, 5);

            if (suggestions.length > 0) {
                await this.cacheManager.set(cacheKey, suggestions, 3600000);
            }
            return suggestions;
        } catch (error) {
            console.warn('[AiService] Semantic suggestion failed:', (error as any).message);
            return [];
        }
    }

    async autocomplete(params: {
        beforeCursor: string;
        afterCursor?: string;
        schemaContext?: string;
        databaseType?: string;
    }): Promise<string> {
        const { beforeCursor, afterCursor = '', schemaContext, databaseType = 'postgres' } = params;

        if (!this.providerRunner.isGeminiAvailable()) {
            return '';
        }

        // Cache Key generation logic: Hash of context + cursor
        const cacheContent = `${databaseType}:${schemaContext || ''}:${beforeCursor}`;
        const cacheKey = `ai:autocomplete:${crypto.createHash('sha256').update(cacheContent).digest('hex')}`;

        try {
            // Check Redis cache first
            const cachedSuggestion = await this.cacheManager.get<string>(cacheKey);
            if (cachedSuggestion) {
                return cachedSuggestion;
            }

            const systemPrompt = `You are an expert SQL autocomplete engine for ${databaseType}.
Your task: Predict the next FEW logical characters or a SHORT clause to insert at the cursor.
- **Accuracy over Length**: Prefer a short, 100% correct snippet (like a column name or keyword) over a long query that might be wrong.
- **Surgical Precision**: ONLY return the raw string to be appended at the cursor position. No markdown, no commentary.
- **NEVER repeat any text from the 'BEFORE' context**. If the user already typed 'SELECT', do NOT start with 'SELECT'.
- **Context Awareness**: Look at the 'AFTER' context. Do NOT suggest code that would result in a syntax error or redundant tokens (e.g., don't suggest a closing brace or semicolon if it's already there).
- **No Redundancy**: If the current line seems complete, suggest valid next steps (WHERE, ORDER BY, LIMIT) but keep it as brief as possible.
- **Handling Semicolons**: Do NOT suggest a semicolon if the 'BEFORE' context already ends with one or the 'AFTER' context starts with one.
- **Strict Table Completion**: If the 'BEFORE' context contains a closing ')' for a 'CREATE TABLE' statement, do NOT suggest more column-like definitions or another semicolon immediately.
- **No gluing**: NEVER suggest a snippet that glues a word to another word. Start with a space if you are continuing after a word and your suggestion starts with a word.

SCHEMA:
${schemaContext || 'Empty'}

BEFORE CURSOR:
${beforeCursor.length > 1500 ? beforeCursor.slice(-1500) : beforeCursor}

AFTER CURSOR:
${afterCursor.length > 300 ? afterCursor.slice(0, 300) : afterCursor}

NEXT CHARACTERS (START IMMEDIATELY):`;

            const responseText = await this.providerRunner.completeGeminiText({
                model: 'gemini-3.1-flash-lite-preview',
                prompt: systemPrompt,
                temperature: 0.1,
                maxOutputTokens: 32,
            });

            const suggestion = responseText.replace(/^```sql\n?|```$/g, '').replace(/^SQL\s+/i, '').trim();
            
            // Save to Redis for 1 hour
            if (suggestion) {
                await this.cacheManager.set(cacheKey, suggestion, 3600000);
            }

            return suggestion;
        } catch (error) {
            console.warn('[AiService] Autocomplete failed:', (error as any).message);
            return '';
        }
    }

    async generateSql(params: {
        query: string;
        databaseType?: string;
        schemaContext?: string;
    }): Promise<{ sql: string; explanation: string }> {
        const { query, databaseType = 'postgres', schemaContext } = params;

        if (!this.providerRunner.isGeminiAvailable()) {
            throw new Error('Gemini provider is not available');
        }

        const systemPrompt = `You are an expert SQL generator for ${databaseType}.
Your task: Convert the user's natural language request into a valid, optimized SQL query.

SCHEMA CONTEXT:
${schemaContext || 'Not provided'}

USER REQUEST:
"${query}"

RULES:
1. Return your response in JSON format:
   {
     "sql": "SELECT ...",
     "explanation": "A brief explanation of what the query does"
   }
2. Only use tables and columns available in the provided SCHEMA CONTEXT.
3. If the request is ambiguous, make a reasonable assumption and explain it.
4. If you cannot generate the SQL, return an empty "sql" and an explanation of why.
5. Do NOT include markdown code blocks like \`\`\`sql in the "sql" field.

JSON RESPONSE:`;

        try {
            const responseText = await this.providerRunner.completeGeminiText({
                model: 'gemini-3.1-flash-lite-preview',
                prompt: systemPrompt,
                temperature: 0.1,
                maxOutputTokens: 1000,
            });

            // Clean up possible markdown code blocks if AI ignored instructions
            const cleaned = responseText.replace(/```json\n?|```/g, '').trim();
            const result = JSON.parse(cleaned);

            return {
                sql: result.sql?.trim() || '',
                explanation: result.explanation?.trim() || 'Done.'
            };
        } catch (error) {
            console.error('[AiService] NLP to SQL failed:', error);
            throw new Error(`Failed to generate SQL: ${(error as any).message}`);
        }
    }

    // Exposed for tests that verify parsing behavior without the transport layers.
    private parseAiResponse(fullText: string) {
        return this.promptBuilder.parseAiResponse(fullText);
    }
}
