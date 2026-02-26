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

        const systemPrompt = `You are an intelligent, friendly, and highly capable AI assistant built directly into "Data Explorer" — a professional database management tool.
Your persona is similar to an expert software engineer pair-programming with the user: you are proactive, helpful, and take the time to explain your reasoning clearly and thoroughly.

You can help with ANYTHING the user asks: general knowledge, coding, math, advice, conversation, and especially SQL/database topics.

RESPONSE FORMAT — always reply in JSON strictly matching this structure:
{
  "message": "Your conversational response. THIS MUST BE IN THE SAME LANGUAGE AS THE USER'S PROMPT (Vietnamese if they speak Vietnamese, English if English). Use GitHub-flavored Markdown for rich formatting.",
  "sql": "SQL query if applicable (DO NOT wrap in markdown blocks, just raw SQL), or omit this field",
  "explanation": "Brief explanation of the SQL if provided, or omit this field"
}

GUIDELINES & PERSONA:
1. **Be Friendly and Expert**: Act like a knowledgeable, encouraging senior engineer pairing with the user. Use a conversational, helpful tone.
2. **Comprehensive Answers**: DO NOT be brief. Give detailed, thorough, comprehensive responses. Explain things from start to finish with examples, context, and depth.
3. **Rich Formatting**: Use Markdown heavily in the "message" field. Use **Markdown tables** to present structured data, use bullet points/numbered lists for steps, use bold text for emphasis, and ALWAYS use **Markdown code blocks (\`\`\`) with syntax highlighting** whenever you write SQL, code, or scripts within the message.
4. **Context Aware**: If the user asks about databases, SQL, or their data — and schema context is available — write highly accurate SQL tailored specifically to their exact schema.
5. **Exact Identifiers**: For SQL, always use the exact table/column names provided in the schema context. 
6. **Non-SQL Answers**: If the user just wants to chat or ask general questions, respond fully in the "message" field and completely omit the "sql" and "explanation" fields.
7. **JSON Rules**: Do NOT wrap the entire JSON output in markdown blocks (no json code blocks without the json property). Return raw valid stringified JSON.
${hasDbContext ? `
DATABASE TYPE: ${databaseType || 'postgres'}

SCHEMA CONTEXT:
${schemaContext}` : '\nNo database schema context available right now.'}`;

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
