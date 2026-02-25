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
        prompt: string;
        schemaContext?: string;
        databaseType?: string;
        image?: string;
        context?: string;
    }): Promise<{ message: string; sql?: string; explanation?: string }> {
        const { prompt, schemaContext, databaseType, image, context } = params;

        // Try multiple models in order of preference (use models with available free-tier quota)
        const models = ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-3-flash'];

        const hasDbContext = schemaContext && schemaContext.trim().length > 0 && !schemaContext.includes('Could not load');

        const systemPrompt = `You are an intelligent AI assistant built into "Data Explorer" — a professional database management tool.
You can help with ANYTHING the user asks: general knowledge, coding, math, advice, conversation, and especially SQL/database topics.

RESPONSE FORMAT — always reply in JSON:
{
  "message": "Your conversational response (in Vietnamese by default, match the user's language)",
  "sql": "SQL query if applicable, or omit this field",
  "explanation": "Brief explanation of the SQL if provided, or omit this field"
}

GUIDELINES:
1. Be friendly, helpful, and conversational — like a knowledgeable friend
2. Reply in the SAME LANGUAGE as the user (Vietnamese if they write in Vietnamese, English if English, etc.)
3. **GIVE DETAILED, THOROUGH, COMPREHENSIVE RESPONSES** — explain things from start to finish with examples, context, and depth. Do NOT be brief or overly concise. The user wants to learn and understand fully.
4. Use bullet points, numbered lists, and structured formatting to organize long explanations
5. Include real-world examples, analogies, and use cases to make concepts clear
6. If the user asks about databases, SQL, or data — and schema context is available — generate accurate SQL with detailed explanation
7. For SQL: use exact table/column names from schema, qualify with schema name (e.g. "public"."table")
8. For non-SQL questions: respond with full depth in "message", omit "sql" and "explanation"
9. Do NOT wrap JSON in markdown code blocks
10. Do NOT include markdown formatting in SQL
${hasDbContext ? `
DATABASE TYPE: ${databaseType || 'postgres'}

SCHEMA CONTEXT:
${schemaContext}` : '\nNo database schema context available — if user asks SQL questions, help with general SQL advice.'}`;

        let lastError: any = null;

        for (const modelName of models) {
            try {
                console.log(`[AiService] Trying model: ${modelName}`);
                const model = this.genAI.getGenerativeModel({ model: modelName });

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
                        responseMimeType: 'application/json',
                    },
                });

                const responseText = result.response.text();

                try {
                    const parsed = JSON.parse(responseText);
                    return {
                        message: parsed.message || '',
                        sql: parsed.sql || undefined,
                        explanation: parsed.explanation || undefined,
                    };
                } catch {
                    // If JSON parse fails, return raw text as message
                    return { message: responseText };
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
