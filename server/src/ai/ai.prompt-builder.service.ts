import { Injectable } from '@nestjs/common';
import * as Prompts from './ai.prompts';
import type { AiRecommendation, AiRecommendationType } from './ai.types';

@Injectable()
export class AiPromptBuilderService {
    buildSystemPrompt(params: {
        prompt?: string;
        context?: string;
        mode?: string;
        schemaContext?: string;
        databaseType?: string;
    }): string {
        const { prompt = '', context = '', mode = 'planning', schemaContext, databaseType = 'postgres' } = params;
        const hasDbContext = !!(schemaContext && schemaContext.trim().length > 0 && !schemaContext.includes('Could not load'));
        const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const shouldUseStructuredOutput = this.shouldUseStructuredOutput(prompt, context);

        const sqlRules = hasDbContext
            ? Prompts.SQL_RULES_LIVE.replace('{engine}', databaseType)
            : Prompts.SQL_RULES_NONE;

        const modeSection = mode === 'fast' ? Prompts.MODE_FAST : Prompts.MODE_PLANNING;
        const dbContextSection = hasDbContext
            ? `# ACTIVE DATABASE CONTEXT\n\n**Engine**: ${databaseType}\n\n${schemaContext}`
            : `# DATABASE CONTEXT\n\nNo database schema is currently loaded.`;
        const responseFormat = shouldUseStructuredOutput
            ? Prompts.RESPONSE_FORMAT_STRUCTURED
            : Prompts.RESPONSE_FORMAT_CHAT;

        return `${Prompts.SYSTEM_IDENTITY}\n\nToday's date: ${today}\n\n---
# CORE MISSION\n\n${Prompts.CORE_MISSION}\n\n---
# SQL RULES\n\n${sqlRules}\n\n---
${modeSection}\n\n---
${dbContextSection}\n\n---
${responseFormat}`;
    }

    buildOpenAiMessages(prompt: string, systemPrompt: string, context?: string) {
        const userText = context
            ? `${prompt}\n\nAdditional context:\n${context}`
            : prompt;

        return [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userText },
        ];
    }

    prepareGeminiParts(prompt: string, context?: string, image?: string): Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> {
        const userText = context
            ? `${prompt}\n\nAdditional context:\n${context}`
            : prompt;

        const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [{ text: userText }];

        if (image) {
            const match = image.match(/^data:(.*?);base64,(.*)$/);
            if (match) {
                parts.push({
                    inlineData: { mimeType: match[1], data: match[2] },
                });
            }
        }

        return parts;
    }

    parseAiResponse(fullText: string): { message: string; sql?: string; explanation?: string; recommendations?: AiRecommendation[] } {
        try {
            const match = fullText.match(/\{[\s\S]*\}/);
            const cleanJsonStr = match ? match[0] : fullText;
            const parsed = JSON.parse(cleanJsonStr);
            return {
                message: parsed.message || (match ? '' : fullText),
                sql: parsed.sql || undefined,
                explanation: parsed.explanation || undefined,
                recommendations: this.normalizeRecommendations(parsed.recommendations),
            };
        } catch {
            return { message: fullText };
        }
    }

    assertUsableStructuredResponse(
        parsed: { message: string; sql?: string; explanation?: string },
        rawText: string,
        providerLabel: string,
    ) {
        const hasMessage = typeof parsed.message === 'string' && parsed.message.trim().length > 0;
        const hasSql = typeof parsed.sql === 'string' && parsed.sql.trim().length > 0;
        const hasExplanation = typeof parsed.explanation === 'string' && parsed.explanation.trim().length > 0;

        if (hasMessage || hasSql || hasExplanation) {
            return;
        }

        const looksLikeEmptyJsonShell = /^\s*\{\s*"message"\s*:\s*""\s*,\s*"sql"\s*:\s*""\s*,\s*"explanation"\s*:\s*""\s*\}\s*$/s.test(rawText);
        if (looksLikeEmptyJsonShell || rawText.trim().startsWith('{')) {
            throw new Error(`${providerLabel} returned an empty structured response`);
        }
    }

    extractSources(response: { candidates?: Array<{ groundingMetadata?: { groundingChunks?: Array<{ web?: { title?: string; uri?: string } }> } }> }): string {
        const candidate = response.candidates?.[0];
        if (!candidate?.groundingMetadata?.groundingChunks) return '';

        const urls = candidate.groundingMetadata.groundingChunks
            .filter((c): c is { web: { title: string; uri: string } } => !!c.web?.uri && !!c.web?.title)
            .map((c) => ({
                title: c.web.title,
                url: c.web.uri,
            }));

        const uniqueUrls = urls.filter(
            (item, index, array) => array.findIndex((entry) => entry.url === item.url) === index,
        );

        if (uniqueUrls.length === 0) return '';

        return `\n\n---\n**Nguon tham khao**\n${uniqueUrls
            .map((item) => `- [${item.title}](${item.url})`)
            .join('\n')}`;
    }

    extractOpenAiStreamText(payload: { choices?: Array<{ delta?: { content?: string | Array<{ text?: string }> } }> }): string {
        const delta = payload.choices?.[0]?.delta?.content;
        if (typeof delta === 'string') return delta;
        if (Array.isArray(delta)) {
            return delta.map((item) => item?.text || '').join('');
        }
        return '';
    }

    private normalizeRecommendations(value: unknown): AiRecommendation[] | undefined {
        if (!Array.isArray(value)) {
            return undefined;
        }

        const allowedTypes = new Set<AiRecommendationType>([
            'query_fix',
            'index_suggestion',
            'schema_suggestion',
            'chart_suggestion',
        ]);

        const normalized = value
            .flatMap((entry) => {
                if (!entry || typeof entry !== 'object') {
                    return [];
                }

                const candidate = entry as Record<string, unknown>;
                const type = typeof candidate.type === 'string' ? candidate.type.trim() as AiRecommendationType : null;
                const title = typeof candidate.title === 'string' ? candidate.title.trim() : '';
                const summary = typeof candidate.summary === 'string' ? candidate.summary.trim() : '';

                if (!type || !allowedTypes.has(type) || !title || !summary) {
                    return [];
                }

                return [{
                    type,
                    title,
                    summary,
                    sql: typeof candidate.sql === 'string' && candidate.sql.trim() ? candidate.sql.trim() : undefined,
                    chartType: typeof candidate.chartType === 'string' && candidate.chartType.trim() ? candidate.chartType.trim() : undefined,
                    fields: Array.isArray(candidate.fields)
                        ? candidate.fields.filter((field): field is string => typeof field === 'string' && field.trim().length > 0).slice(0, 6)
                        : undefined,
                } satisfies AiRecommendation];
            })
            .slice(0, 3);

        return normalized.length ? normalized : undefined;
    }

    private shouldUseStructuredOutput(prompt: string, context?: string): boolean {
        const combined = `${prompt}\n${context || ''}`.toLowerCase();

        return [
            /\bsql\b/,
            /\bquery\b/,
            /\bselect\b/,
            /\binsert\b/,
            /\bupdate\b/,
            /\bdelete\b/,
            /\bdrop\b/,
            /\balter\b/,
            /\bcreate table\b/,
            /\bjoin\b/,
            /\bwhere\b/,
            /\bgroup by\b/,
            /\border by\b/,
            /\blimit\b/,
            /\boptimi[sz]e\b/,
            /\bexplain\b/,
            /\bschema\b/,
            /\bmigration\b/,
            /\bddl\b/,
            /\bexecute\b/,
            /\brun\b/,
            /\bwrite (me )?(a )?(query|sql)\b/,
        ].some((pattern) => pattern.test(combined));
    }
}
