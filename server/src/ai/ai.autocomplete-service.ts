import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import * as crypto from 'crypto';
import { AiProviderRunnerService } from './ai.provider-runner.service';
import { AI_CONSTANTS } from './ai.constants';

@Injectable()
export class AiAutocompleteService {
    private readonly logger = new Logger(AiAutocompleteService.name);

    constructor(
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
        private readonly providerRunner: AiProviderRunnerService,
    ) {}

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

        const cacheContent = `${databaseType}:${schemaContext || ''}:${beforeCursor}`;
        const cacheKey = `ai:autocomplete:${crypto.createHash('sha256').update(cacheContent).digest('hex')}`;

        try {
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
${beforeCursor.length > AI_CONSTANTS.AUTOCOMPLETE_CURSOR_MAX_LENGTH ? beforeCursor.slice(-AI_CONSTANTS.AUTOCOMPLETE_CURSOR_MAX_LENGTH) : beforeCursor}

AFTER CURSOR:
${afterCursor.length > 300 ? afterCursor.slice(0, 300) : afterCursor}

NEXT CHARACTERS (START IMMEDIATELY):`;

            const responseText = await this.providerRunner.completeGeminiText({
                model: 'gemini-3.1-flash-lite-preview',
                prompt: systemPrompt,
                temperature: AI_CONSTANTS.TEMPERATURE_PRECISE,
                maxOutputTokens: AI_CONSTANTS.AUTOCOMPLETE_MAX_OUTPUT_TOKENS,
            });

            const suggestion = responseText.replace(/^```sql\n?|```$/g, '').replace(/^SQL\s+/i, '').trim();

            if (suggestion) {
                await this.cacheManager.set(cacheKey, suggestion, AI_CONSTANTS.AUTOCOMPLETE_CACHE_TTL_MS);
            }

            return suggestion;
        } catch (error) {
            this.logger.warn('[AiAutocompleteService] Autocomplete failed:', error instanceof Error ? error.message : 'Unknown error');
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
                temperature: AI_CONSTANTS.TEMPERATURE_PRECISE,
                maxOutputTokens: AI_CONSTANTS.AUTOCOMPLETE_NLP_MAX_OUTPUT_TOKENS,
            });

            const cleaned = responseText.replace(/```json\n?|```/g, '').trim();
            const result = JSON.parse(cleaned);

            return {
                sql: result.sql?.trim() || '',
                explanation: result.explanation?.trim() || 'Done.'
            };
        } catch (error) {
            this.logger.error('[AiAutocompleteService] NLP to SQL failed:', error);
            throw new Error(`Failed to generate SQL: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}
