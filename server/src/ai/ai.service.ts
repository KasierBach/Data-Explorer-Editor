import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as Prompts from './ai.prompts';

@Injectable()
export class AiService {
    private genAI: GoogleGenerativeAI;
    private schemaCache = new Map<string, { context: string, timestamp: number }>();
    private readonly CACHE_TTL = 1000 * 60 * 15; // 15 minutes

    constructor(private configService: ConfigService) {
        const apiKey = this.configService.get<string>('GEMINI_API_KEY');
        if (!apiKey) {
            console.warn('[AiService] GEMINI_API_KEY not set — AI features disabled');
        }
        this.genAI = new GoogleGenerativeAI(apiKey || '');
    }

    // ─── Shared System Prompt Builder ───────────────────────────
    private buildSystemPrompt(params: {
        mode?: string;
        schemaContext?: string;
        databaseType?: string;
    }): string {
        const { mode = 'planning', schemaContext, databaseType = 'postgres' } = params;
        const hasDbContext = !!(schemaContext && schemaContext.trim().length > 0 && !schemaContext.includes('Could not load'));
        const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

        const sqlRules = hasDbContext 
            ? Prompts.SQL_RULES_LIVE.replace('{engine}', databaseType)
            : Prompts.SQL_RULES_NONE;
            
        const modeSection = mode === 'fast' ? Prompts.MODE_FAST : Prompts.MODE_PLANNING;

        const dbContextSection = hasDbContext
            ? `# ACTIVE DATABASE CONTEXT\n\n**Engine**: ${databaseType}\n\n${schemaContext}`
            : `# DATABASE CONTEXT\n\nNo database schema is currently loaded.`;

        return `${Prompts.SYSTEM_IDENTITY}\n\nToday's date: ${today}\n\n---
# CORE MISSION\n\n${Prompts.CORE_MISSION}\n\n---
# SQL RULES\n\n${sqlRules}\n\n---
${modeSection}\n\n---
${dbContextSection}\n\n---
${Prompts.RESPONSE_FORMAT}`;
    }

    private getModelList(requestedModel?: string): string[] {
        const legacyMap: Record<string, string> = {
            'gemini-3-flash': 'gemini-3-flash-preview',
            'gemini-3-pro': 'gemini-3-pro-preview',
            'gemini-3.1-pro': 'gemini-3.1-pro-preview'
        };
        const actualModel = requestedModel ? (legacyMap[requestedModel] || requestedModel) : null;
        return actualModel ? [actualModel] : ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-3-flash-preview'];
    }

    private prepareUserParts(prompt: string, systemPrompt: string, context?: string, image?: string): any[] {
        const userText = context
            ? `${systemPrompt}\n\nUser: ${prompt}\n\nAdditional context:\n${context}`
            : `${systemPrompt}\n\nUser: ${prompt}`;

        const parts: any[] = [{ text: userText }];

        if (image) {
            const match = image.match(/^data:(.*?);base64,(.*)$/);
            if (match) {
                parts.push({
                    inlineData: { mimeType: match[1], data: match[2] }
                });
            }
        }
        return parts;
    }

    async chat(params: {
        model?: string;
        mode?: string;
        prompt: string;
        schemaContext?: string;
        databaseType?: string;
        image?: string;
        context?: string;
    }): Promise<{ message: string; sql?: string; explanation?: string }> {
        const { model: requestedModel, mode, prompt, schemaContext, databaseType, image, context } = params;
        
        const models = this.getModelList(requestedModel);
        const systemPrompt = this.buildSystemPrompt({ mode, schemaContext, databaseType });
        const parts = this.prepareUserParts(prompt, systemPrompt, context, image);

        let lastError: any = null;

        for (const modelName of models) {
            try {
                const model = this.genAI.getGenerativeModel({
                    model: modelName,
                    tools: [{ googleSearch: {} } as any]
                });

                const result = await model.generateContent({
                    contents: [{ role: 'user', parts }],
                    generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
                });

                const responseText = result.response.text();
                const sourcesSuffix = this.extractSources(result.response);
                const parsed = this.parseAiResponse(responseText);

                return {
                    ...parsed,
                    message: parsed.message + sourcesSuffix
                };
            } catch (error) {
                lastError = error;
                if (error.status === 429) continue;
                console.warn(`[AiService] Model ${modelName} failed:`, error.message);
                continue;
            }
        }
        throw new Error(`AI generation failed: ${lastError?.message}`);
    }

    private extractSources(response: any): string {
        const candidate = response.candidates?.[0];
        if (!candidate?.groundingMetadata?.groundingChunks) return '';

        const urls = candidate.groundingMetadata.groundingChunks
            .filter((c: any) => c.web?.uri && c.web?.title)
            .map((c: any) => ({
                title: c.web.title,
                url: c.web.uri,
            }));

        const uniqueUrls = urls.filter(
            (item: { title: string; url: string }, index: number, array: { title: string; url: string }[]) =>
                array.findIndex((entry) => entry.url === item.url) === index,
        );
        if (uniqueUrls.length === 0) return '';

        return `\n\n---\n**Nguon tham khao**\n${uniqueUrls
            .map((item: { title: string; url: string }) => `- [${item.title}](${item.url})`)
            .join('\n')}`;
    }

    private parseAiResponse(fullText: string): { message: string; sql?: string; explanation?: string } {
        try {
            const match = fullText.match(/\{[\s\S]*\}/);
            const cleanJsonStr = match ? match[0] : fullText;
            const parsed = JSON.parse(cleanJsonStr);
            return {
                message: parsed.message || (match ? '' : fullText),
                sql: parsed.sql || undefined,
                explanation: parsed.explanation || undefined,
            };
        } catch (e) {
            return { message: fullText };
        }
    }

    async * chatStream(params: {
        model?: string;
        mode?: string;
        prompt: string;
        schemaContext?: string;
        databaseType?: string;
        image?: string;
        context?: string;
    }): AsyncGenerator<{ type: 'chunk' | 'done' | 'error'; text?: string; data?: any }> {
        const { model: requestedModel, mode, prompt, schemaContext, databaseType, image, context } = params;

        const models = this.getModelList(requestedModel);
        const systemPrompt = this.buildSystemPrompt({ mode, schemaContext, databaseType });
        const parts = this.prepareUserParts(prompt, systemPrompt, context, image);

        let lastError: any = null;

        for (const modelName of models) {
            try {
                const model = this.genAI.getGenerativeModel({
                    model: modelName,
                    tools: [{ googleSearch: {} } as any]
                });

                const result = await model.generateContentStream({
                    contents: [{ role: 'user', parts }],
                    generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
                });

                let fullText = '';
                for await (const chunk of result.stream) {
                    const chunkText = chunk.text();
                    if (chunkText) {
                        fullText += chunkText;
                        yield { type: 'chunk', text: chunkText };
                    }
                }

                const aggregatedResponse = await result.response;
                const sourcesSuffix = this.extractSources(aggregatedResponse);
                const parsed = this.parseAiResponse(fullText);

                yield {
                    type: 'done',
                    data: {
                        ...parsed,
                        message: parsed.message + sourcesSuffix
                    }
                };
                return;
            } catch (error) {
                lastError = error;
                if ((error as any).status === 429) continue;
                console.warn(`[AiService:Stream] Model ${modelName} failed:`, (error as any).message);
                continue;
            }
        }
        yield { type: 'error', text: `AI generation failed: ${lastError?.message}` };
    }

    async gatherSchemaContext(pool: any, strategy: any, database?: string, connectionId?: string): Promise<string> {
        const cacheKey = connectionId ? `${connectionId}:${database || 'default'}` : null;
        
        if (cacheKey) {
            const cached = this.schemaCache.get(cacheKey);
            if (cached && (Date.now() - cached.timestamp < this.CACHE_TTL)) {
                // console.log(`[AiService] Using cached schema context for ${cacheKey}`);
                return cached.context;
            }
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
                        } catch { /* skip columns we can't read */ }
                    }
                } catch { /* skip schemas we can't read */ }
            }

            // Get relationships
            let relationships: any[] = [];
            try {
                relationships = await strategy.getRelationships(pool);
            } catch { /* no relationships available */ }

            schemaContext = this.buildSchemaContext(allTables, columnMap, relationships);
            
            if (cacheKey && schemaContext && !schemaContext.includes('Could not load')) {
                this.schemaCache.set(cacheKey, {
                    context: schemaContext,
                    timestamp: Date.now()
                });
            }
            
            console.log(`[AiService] Schema context built and cached: ${allTables.length} tables found`);
        } catch (error: any) {
            console.error(`[AiService] Schema gathering failed:`, error.message);
            // Continue with empty context rather than failing completely
            schemaContext = '(Could not load schema information)';
        }
        return schemaContext;
    }

    clearCache(connectionId: string, database?: string) {
        if (database) {
            this.schemaCache.delete(`${connectionId}:${database}`);
        } else {
            // Delete all entries for this connection
            for (const key of this.schemaCache.keys()) {
                if (key.startsWith(`${connectionId}:`)) {
                    this.schemaCache.delete(key);
                }
            }
        }
    }

    buildSchemaContext(tables: any[], columns: Map<string, any[]>, relationships: any[]): string {
        let context = '';

        for (const table of tables) {
            const tableName = table.name || table;
            const schema = table.schema || 'public';
            const cols = columns.get(`${schema}.${tableName}`) || [];

            context += `\nTABLE: "${schema}"."${tableName}"\n`;
            context += `  Columns:\n`;

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
                context += `  ${rel.sourceTable}.${rel.sourceColumn} → ${rel.targetTable}.${rel.targetColumn}\n`;
            }
        }

        return context;
    }

    async autocomplete(params: {
        beforeCursor: string;
        afterCursor?: string;
        schemaContext?: string;
        databaseType?: string;
    }): Promise<string> {
        const { beforeCursor, afterCursor = '', schemaContext, databaseType = 'postgres' } = params;

        try {
            // Use Gemini 3.1 Flash Lite — specifically designed for ultra-low latency autocomplete
            const model = this.genAI.getGenerativeModel({
                model: 'gemini-3.1-flash-lite-preview',
                generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: 32,
                }
            });

            // Keep context size reasonable to minimize latency
            const trimmedBefore = beforeCursor.length > 1500 ? beforeCursor.slice(-1500) : beforeCursor;
            const trimmedAfter = afterCursor.length > 300 ? afterCursor.slice(0, 300) : afterCursor;

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
${trimmedBefore}

AFTER CURSOR:
${trimmedAfter}

NEXT CHARACTERS (START IMMEDIATELY):`;

            const result = await model.generateContent(systemPrompt);
            const responseText = result.response.text().trim();

            // Clean up: remove any accidental markdown backticks or prefixes
            return responseText.replace(/^```sql\n?|```$/g, '').replace(/^SQL\s+/i, '').trim();
        } catch (error) {
            console.warn('[AiService] Autocomplete failed:', (error as any).message);
            return '';
        }
    }
}
