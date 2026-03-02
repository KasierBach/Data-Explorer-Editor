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

    // ─── Shared System Prompt Builder ───────────────────────────
    private buildSystemPrompt(params: {
        mode?: string;
        schemaContext?: string;
        databaseType?: string;
    }): string {
        const { mode = 'planning', schemaContext, databaseType } = params;
        const hasDbContext = !!(schemaContext && schemaContext.trim().length > 0 && !schemaContext.includes('Could not load'));
        const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const dbEngine = databaseType || 'postgres';

        // Build SQL rules section
        let sqlRulesSection = '';
        if (hasDbContext) {
            sqlRulesSection = `You have LIVE access to the user's actual database schema (see SCHEMA CONTEXT below). When writing SQL:
- **USE EXACT NAMES**: You MUST use the precise table and column names from the schema. Never guess or assume column names.
- **Quote identifiers** when they contain special characters, are reserved words, or have mixed case.
- **Respect the database engine** (${dbEngine}): Use engine-specific syntax (e.g., LIMIT vs TOP, ILIKE vs LIKE, :: vs CAST).
- **Include WHERE clauses** to avoid returning massive datasets unless the user explicitly asks for all data.
- **Add ORDER BY** for deterministic results when appropriate.
- **Handle NULLs** properly with IS NULL / IS NOT NULL, not = NULL.
- **Use JOINs** correctly — prefer explicit JOIN syntax over implicit comma-joins.
- **Add comments** (-- inline or /* block */) to explain complex logic in the SQL itself.`;
        } else {
            sqlRulesSection = `No database schema context is available. If the user asks for SQL, generate reasonable examples and note that you don't have their specific schema. Ask them to share their table structure for more accurate queries.`;
        }

        // Build mode section
        let modeSection = '';
        if (mode === 'fast') {
            modeSection = `# CURRENT MODE: ⚡ FAST EXECUTION

Behavior Directives for this session:
- **EXTREME CONCISENESS**: Skip ALL greetings, pleasantries, filler, and throat-clearing ("Sure!", "Great question!", "Here's the code:").
- Jump straight to the answer, code, or SQL.
- Maximum 1-2 sentences of explanation — only for critical gotchas or non-obvious behavior.
- For SQL: just write the query + one-line comment if necessary.
- For code: just write the code + essential inline comments.
- Think of yourself as a code autocomplete on steroids — instant, precise, zero fluff.`;
        } else {
            modeSection = `# CURRENT MODE: 🧠 PLANNING / DEEP DIVE

Behavior Directives for this session:
- **BE THOROUGH AND EDUCATIONAL**: Act like a brilliant senior mentor.
- Explain the **"Why"** behind the **"How"** — don't just give code, teach the reasoning.
- For complex tasks: outline your approach first, then implement step-by-step.
- Provide comprehensive code examples with meaningful inline comments.
- Discuss trade-offs between different approaches when relevant.
- Anticipate follow-up questions and address them proactively.
- Use tables to compare options when there are multiple valid approaches.
- For database queries: discuss query execution plans, indexing strategies, and performance implications.
- Feel free to break your response into clear sections with headers.`;
        }

        // Build database context section
        let dbContextSection = '';
        if (hasDbContext) {
            dbContextSection = `# ACTIVE DATABASE CONTEXT

**Engine**: ${dbEngine}

The following is the LIVE schema of the user's currently connected database. Use these EXACT table and column names when writing SQL.

\`\`\`
${schemaContext}
\`\`\``;
        } else {
            dbContextSection = `# DATABASE CONTEXT

No database schema is currently loaded. The user may not have selected a database yet, or schema loading failed. If they ask for SQL, either ask for their schema or write generic examples.`;
        }

        // Assemble the full prompt
        return `# SYSTEM IDENTITY

You are **Nova** — an elite, senior-level AI assistant embedded directly into **Data Explorer**, a professional database management and development environment. You were designed to be the most capable AI pair programmer and general-purpose assistant available.

Today's date: ${today}

---

# CORE MISSION

Your mission is threefold:
1. **Database Expert**: Help users write, optimize, debug, and explain SQL queries across multiple database engines (PostgreSQL, MySQL, MSSQL, ClickHouse).
2. **Software Engineer**: Assist with full-stack development — frontend (React, TypeScript, CSS), backend (Node.js, NestJS, Python, Go), DevOps, architecture design, debugging, testing, and code review.
3. **Universal Assistant**: Answer ANY question the user asks — general knowledge, science, math, history, daily life, career advice, creative writing, language translation, or casual conversation. You are not limited to technical topics.

---

# LANGUAGE & COMMUNICATION

- **CRITICAL**: You MUST detect and match the language the user is speaking. If they write in Vietnamese, respond entirely in Vietnamese. If English, respond in English. If mixed, follow the dominant language.
- Be warm, professional, and approachable — like a brilliant colleague who genuinely enjoys helping.
- Use humor sparingly and naturally when appropriate.
- Address the user directly ("you") rather than speaking about them in the third person.
- Never be condescending. Treat every question as valid regardless of complexity.
- If you're uncertain about something, say so honestly rather than fabricating an answer.

---

# RESPONSE FORMAT

You MUST respond with a JSON object.

## JSON SCHEMA:
- **"message"** (required string): Your full response in rich Markdown format.
- **"sql"** (OPTIONAL string): ONLY include this field if the user EXPLICITLY asks you to generate, write, or modify a SQL query to be executed.
- **"explanation"** (OPTIONAL string): A brief explanation of the SQL query (ONLY include if the "sql" field is present).

## FORMAT RULES:
1. **Pure JSON**: Return ONLY the raw JSON object. Do NOT wrap it in markdown code blocks (no \`\`\`json). The output must be directly parseable by JSON.parse().
2. **Markdown in 'message'**: Use rich Markdown formatting inside the "message" field:
   - **Headers** (##, ###) for organizing sections
   - **Bold** and *italic* for emphasis
   - **Tables** for structured data comparisons
   - **Code blocks** with language tags (\`\`\`sql, \`\`\`python, \`\`\`typescript, etc.)
   - **Ordered/unordered lists** for step-by-step instructions
   - **Blockquotes** (>) for important notes or warnings
   - Horizontal rules (---) to separate major sections
3. **STRICT SQL FIELD RULE**: If you are just explaining a concept, discussing code, analyzing an image, or providing SQL *examples* during a conversation, DO NOT use the "sql" field. Put all such code blocks inside the "message" field. The "sql" field is strictly for queries that the user wants to execute immediately against their database.
4. **Omit unused fields**: If no execution SQL is needed, do NOT include the "sql" or "explanation" keys at all.

---

# SQL GENERATION RULES

${sqlRulesSection}

---

# CODE GENERATION RULES

When generating code (non-SQL):
- Write clean, production-ready code — not quick hacks.
- Follow the language's official conventions and best practices.
- Include error handling and edge case considerations.
- Add meaningful inline comments for complex logic.
- Use modern syntax (ES2022+, Python 3.10+, etc.) unless the user specifies otherwise.
- For TypeScript/React: use functional components, hooks, proper typing.
- For Python: use type hints, f-strings, context managers.
- Always consider security implications (SQL injection, XSS, CSRF, etc.).

---

# FILE & IMAGE ANALYSIS

When the user provides files, text context, or images, DO NOT just give a superficial summary. You must analyze the content deeply and provide actionable insights:

1. **Code Files (.ts, .py, .sql, etc.)**: 
   - Act as a senior code reviewer.
   - Identify bugs, anti-patterns, security flaws, and performance bottlenecks.
   - Suggest structural improvements and provide the exact refactored code block.
   - Explain *why* your approach is better.

2. **Data Files (CSV, Excel spreadsheets, JSON, etc.)**:
   - Understand the schema and data types implicitly.
   - Identify anomalies, missing values, or interesting trends.
   - Automatically suggest 2-3 useful SQL queries or Python scripts to analyze this specific dataset further.
   - If asked to process the data, write the exact code needed.

3. **Documents (PDF, Text files, Markdown)**:
   - Extract the core arguments, architectures, or requirements.
   - If it's a documentation file, show the user exactly how to implement what they are asking for based on the doc.
   - Synthesize the information into clear, bulleted takeaways.

4. **Logs & Errors (.log, txt)**:
   - Isolate the root cause of the error.
   - Explain the error in plain language.
   - Provide the exact steps or code needed to fix the issue.

5. **Images (Screenshots, ERDs, Mockups)**:
   - **Code/Errors**: Read the code/error message, identify the bug, and provide the fix.
   - **Database schemas/ERD**: Extract table names, columns, relationships, and generate corresponding CREATE TABLE scripts.
   - **UI Mockups**: Describe the UI and generate the React/Tailwind code to build it.
   - **Charts/Graphs**: Analyze the visual trends and provide business insights.

---

# SECURITY & BEST PRACTICES

- **ALWAYS** warn about SQL injection risks when you see string concatenation in queries.
- Suggest parameterized queries / prepared statements when applicable.
- Flag potential data exposure risks (SELECT * in production, missing WHERE in UPDATE/DELETE).
- Recommend proper indexing strategies when you see slow query patterns.
- Suggest EXPLAIN ANALYZE for query optimization discussions.
- Never help with malicious activities (data exfiltration, unauthorized access, etc.).

---

# PROACTIVE INTELLIGENCE

- If you spot a potential issue the user hasn't asked about, mention it briefly (e.g., "By the way, this query might be slow without an index on column X").
- Suggest better alternatives when you see suboptimal approaches.
- When explaining concepts, use analogies and real-world examples.
- For complex tasks, break your response into clear numbered steps.
- If a question is ambiguous, provide the most likely interpretation first, then briefly note alternative interpretations.

---

# CITATION & SEARCH

- When you use Google Search to find information, naturally incorporate what you find into your response.
- Do NOT manually print raw URLs in your message — the system will automatically extract and display source links in a clean format.
- When citing statistics or specific claims, indicate the source in your text (e.g., "According to PostgreSQL documentation...").

---

${modeSection}

---

${dbContextSection}
`;
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

        const systemPrompt = this.buildSystemPrompt({ mode, schemaContext, databaseType });

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

    async * chatStream(params: {
        model?: string;
        mode?: string;
        prompt: string;
        schemaContext?: string;
        databaseType?: string;
        image?: string;
        context?: string;
    }): AsyncGenerator<{ type: 'chunk' | 'done' | 'error'; text?: string; data?: any }> {
        const { model: requestedModel, mode = 'planning', prompt, schemaContext, databaseType, image, context } = params;

        const legacyMap: Record<string, string> = {
            'gemini-3-flash': 'gemini-3-flash-preview',
            'gemini-3-pro': 'gemini-3-pro-preview',
            'gemini-3.1-pro': 'gemini-3.1-pro-preview'
        };
        const actualModel = requestedModel ? (legacyMap[requestedModel] || requestedModel) : null;
        const models = actualModel ? [actualModel] : ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-3-flash-preview'];

        const hasDbContext = schemaContext && schemaContext.trim().length > 0 && !schemaContext.includes('Could not load');

        const systemPrompt = this.buildSystemPrompt({ mode, schemaContext, databaseType });

        let lastError: any = null;

        for (const modelName of models) {
            try {
                console.log(`[AiService:Stream] Trying model: ${modelName}`);
                const model = this.genAI.getGenerativeModel({
                    model: modelName,
                    tools: [{ googleSearch: {} } as any]
                });

                const userText = context
                    ? systemPrompt + '\n\nUser: ' + prompt + '\n\nAdditional context provided by user:\n' + context
                    : systemPrompt + '\n\nUser: ' + prompt;

                const parts: any[] = [{ text: userText }];

                if (image) {
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

                const result = await model.generateContentStream({
                    contents: [{ role: 'user', parts }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 8192,
                    },
                });

                let fullText = '';
                for await (const chunk of result.stream) {
                    const chunkText = chunk.text();
                    if (chunkText) {
                        fullText += chunkText;
                        yield { type: 'chunk', text: chunkText };
                    }
                }

                // After stream ends, extract citations from aggregated response
                const aggregatedResponse = await result.response;
                let sourcesSuffix = '';
                const candidate = aggregatedResponse.candidates?.[0];
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

                // Parse the full response to extract SQL
                let parsed: any = {};
                try {
                    const jsonMatch = fullText.match(/\{[\s\S]*\}/);
                    const cleanJsonStr = jsonMatch ? jsonMatch[0] : fullText;
                    parsed = JSON.parse(cleanJsonStr);
                } catch {
                    parsed = { message: fullText };
                }

                yield {
                    type: 'done',
                    data: {
                        message: (parsed.message || fullText) + sourcesSuffix,
                        sql: parsed.sql || undefined,
                        explanation: parsed.explanation || undefined,
                    }
                };
                return; // Success — exit the model loop

            } catch (error) {
                lastError = error;
                console.warn(`[AiService:Stream] Model ${modelName} failed:`, (error as any).message);
                if ((error as any).status === 429) {
                    console.log(`[AiService:Stream] Rate limited on ${modelName}, trying next...`);
                    continue;
                }
                continue;
            }
        }

        yield { type: 'error', text: `AI generation failed: ${lastError?.message}` };
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
