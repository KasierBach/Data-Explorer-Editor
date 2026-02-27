import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class AiService {
    private genAI: GoogleGenerativeAI;

    constructor(private configService: ConfigService) {
        const apiKey = this.configService.get<string>('GEMINI_API_KEY');
        if (!apiKey) {
            console.warn('[AiService] GEMINI_API_KEY not set — AI features disabled');
        }
        this.genAI = new GoogleGenerativeAI(apiKey || '');
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
        const { model: requestedModel, mode = 'planning', prompt, schemaContext, databaseType, image, context } = params;

        // Try multiple models in order of preference, or use specific model if requested
        const legacyMap: Record<string, string> = {
            'gemini-3-flash': 'gemini-3-flash-preview',
            'gemini-3-pro': 'gemini-3-pro-preview',
            'gemini-3.1-pro': 'gemini-3.1-pro-preview'
        };
        const actualModel = requestedModel ? (legacyMap[requestedModel] || requestedModel) : null;
        const models = actualModel ? [actualModel] : ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-3-flash-preview'];

        const hasDbContext = schemaContext && schemaContext.trim().length > 0 && !schemaContext.includes('Could not load');

        let systemPrompt = `You are an intelligent, senior-level AI pair programmer built directly into "Data Explorer".
Your mission is to assist the user with software engineering, database management, architecture design, debugging, and general technical guidance.
HOWEVER, you are also a versatile assistant capable of answering ANY questions the user asks, including general knowledge, everyday topics, life advice, and casual conversation.

CORE OBJECTIVE:
- Provide accurate, practical, and highly optimized technical solutions.
- Be proactive in pointing out potential edge cases, security risks (like SQL injection), and performance improvements.
- You can converse in any language, but you MUST MATCH the language the user is speaking (e.g., if they ask in Vietnamese, respond in Vietnamese).

RESPONSE FORMAT — you MUST reply with a JSON object strictly matching this schema:
{
  "message": "Your conversational or explanatory response in Markdown format. Use tables, bolding, lists, and code blocks (\`\`\`) to make it easily readable.",
  "sql": "Raw SQL query if specifically asked to generate one. Omit this field if the user is asking about general code or concepts.",
  "explanation": "Brief explanation of the SQL script if one is provided. Omit this field otherwise."
}

CRITICAL RULES:
1. **JSON Only**: Do NOT wrap the JSON output in markdown blocks (e.g., no \`\`\`json). Return a valid, parseable JSON string.
2. **Context-Aware Database Queries**: If the user asks for SQL and schema context is provided, YOU MUST use the EXACT table names and column names from the schema. Never guess column names.
3. **General Coding & Chat**: If the user asks about frontend React code, backend Node.js, Python scripts, or general conversations, put your entire rich response inside the \`message\` field. Do NOT try to stuff general code into the \`sql\` field.
4. **Citations & Sources**: If you use Google Search to find information or provide facts, naturally cite your sources if helpful. We will automatically append the direct URLs to your message, so you do not need to manually print raw URLs unless explicitly asked.

`;

        if (mode === 'fast') {
            systemPrompt += `CURRENT MODE: [FAST EXECUTION]
Behavior Directives:
- YOU MUST BE EXTREMELY CONCISE.
- Skip all pleasantries, greetings, and filler words ("Here is the code", "Sure, I can help").
- Directly provide the code, SQL, or exact answer requested.
- Limit explanations to 1-2 sentences highlighting only the crucial logic or potential gotchas.
- Focus purely on delivering the solution instantly.`;
        } else {
            systemPrompt += `CURRENT MODE: [PLANNING / DEEP DIVE]
Behavior Directives:
- YOU MUST BE THOROUGH AND EXPLANATORY.
- Act as a mentor. Explain the "Why" behind the "How".
- When proposing architectures or refactoring, break it down step-by-step.
- Provide comprehensive code examples with inline comments.
- Before committing to a massive code block, consider outlining your implementation plan first if the task is complex.
- Anticipate follow-up questions and proactively address them.`;
        }

        systemPrompt += `

${hasDbContext ? `
DATABASE TYPE: ${databaseType || 'postgres'}

SCHEMA CONTEXT:
${schemaContext}` : '\nNo database schema context available right now.'}`;

        let lastError: any = null;

        for (const modelName of models) {
            try {
                console.log(`[AiService] Trying model: ${modelName}`);
                const model = this.genAI.getGenerativeModel({
                    model: modelName,
                    tools: [{ googleSearch: {} } as any]
                });

                // Build user message parts
                const userText = context
                    ? systemPrompt + '\n\nUser: ' + prompt + '\n\nAdditional context provided by user:\n' + context
                    : systemPrompt + '\n\nUser: ' + prompt;

                const parts: any[] = [{ text: userText }];

                // Add image if provided (Gemini Vision)
                if (image) {
                    // Extract mime type and data from base64 data URL
                    const match = image.match(/^data:(.*?);base64,(.*)$/);
                    if (match) {
                        parts.push({
                            inlineData: {
                                mimeType: match[1],
                                data: match[2],
                            }
                        });
                    }
                }

                const result = await model.generateContent({
                    contents: [
                        { role: 'user', parts }
                    ],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 8192,
                    },
                });

                const responseText = result.response.text();

                // Extract citations
                let sourcesSuffix = '';
                const candidate = result.response.candidates?.[0];
                if (candidate?.groundingMetadata?.groundingChunks) {
                    const chunks = candidate.groundingMetadata.groundingChunks;
                    const urls = chunks
                        .filter((c: any) => c.web?.uri && c.web?.title)
                        .map((c: any) => {
                            const title = c.web.title || c.web.uri.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
                            return `[${title}](${c.web.uri})`;
                        });

                    const uniqueUrls = [...new Set(urls)];
                    if (uniqueUrls.length > 0) {
                        sourcesSuffix = '\n\n---\n<div class="not-prose mt-4 pt-4 border-t border-border/50">\n<p class="text-[11px] font-semibold text-muted-foreground mb-3 flex items-center gap-1.5"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-link"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> Nguồn tham khảo</p>\n<div class="flex flex-wrap gap-2">' + uniqueUrls.map(u => {
                            const linkText = u.match(/\[(.*?)\]/)?.[1] || 'Link';
                            const linkHref = u.match(/\((.*?)\)/)?.[1] || '#';
                            return `<a title="Chuyển đến: ${linkHref}" class="inline-flex items-center rounded-md border border-border/50 bg-muted/30 px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted/80 no-underline cursor-pointer" href="${linkHref}" target="_blank" rel="noopener noreferrer">${linkText}</a>`;
                        }).join('') + '</div>\n</div>';
                    }
                }

                try {
                    // Extract JSON object ignoring any markdown wrappers
                    const match = responseText.match(/\{[\s\S]*\}/);
                    const cleanJsonStr = match ? match[0] : responseText;
                    const parsed = JSON.parse(cleanJsonStr);

                    return {
                        message: (parsed.message || '') + sourcesSuffix,
                        sql: parsed.sql || undefined,
                        explanation: parsed.explanation || undefined,
                    };
                } catch (e) {
                    console.error('[AiService] Failed to parse JSON:', e, 'Raw:', responseText);
                    // If JSON parse fails, return raw text as message
                    return { message: responseText + sourcesSuffix };
                }
            } catch (error) {
                lastError = error;
                console.warn(`[AiService] Model ${modelName} failed:`, error.message);
                if (error.status === 429) {
                    console.log(`[AiService] Rate limited on ${modelName}, trying next model...`);
                    continue;
                }
                continue;
            }
        }

        console.error('[AiService] All models failed:', lastError?.message);
        throw new Error(`AI generation failed: ${lastError?.message}`);
    }

    async gatherSchemaContext(pool: any, strategy: any, database?: string): Promise<string> {
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
            console.log(`[AiService] Schema context built: ${allTables.length} tables found`);
        } catch (error: any) {
            console.error(`[AiService] Schema gathering failed:`, error.message);
            // Continue with empty context rather than failing completely
            schemaContext = '(Could not load schema information)';
        }
        return schemaContext;
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
}
