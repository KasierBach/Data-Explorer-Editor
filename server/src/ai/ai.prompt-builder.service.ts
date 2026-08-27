import { Injectable } from '@nestjs/common';
import * as Prompts from './ai.prompts';
import { AI_CONSTANTS } from './ai.constants';
import type {
  AiDocument,
  AiChatMode,
  AiPromptCapabilities,
  AiRecommendation,
  AiRecommendationType,
  AiResponseFormat,
  ChatHistoryMessage,
} from './ai.types';

type SourceDetail = { title: string; url: string };

@Injectable()
export class AiPromptBuilderService {
  buildSystemPrompt(params: {
    mode?: AiChatMode;
    schemaContext?: string;
    databaseType?: string;
    locale?: string;
    responseFormat?: AiResponseFormat;
    capabilities?: AiPromptCapabilities;
  }): string {
    const {
      mode = 'planning',
      schemaContext,
      databaseType = 'postgres',
      responseFormat = 'chat',
      capabilities = {},
    } = params;
    const hasDbContext = !!(
      schemaContext &&
      schemaContext.trim().length > 0 &&
      !schemaContext.includes('Could not load')
    );

    const isNoSql =
      databaseType === 'mongodb' ||
      databaseType === 'redis' ||
      databaseType?.includes('mongodb');

    const sqlRules = hasDbContext
      ? isNoSql
        ? Prompts.NOSQL_RULES_LIVE.replace('{engine}', databaseType)
        : Prompts.SQL_RULES_LIVE.replace('{engine}', databaseType)
      : Prompts.SQL_RULES_NONE;

    const modeSection =
      mode === 'fast' ? Prompts.MODE_FAST : Prompts.MODE_PLANNING;
    const dbContextSection = hasDbContext
      ? `# ACTIVE DATABASE CONTEXT\n\n**Engine**: ${databaseType}\n\n${schemaContext}`
      : `# DATABASE CONTEXT\n\nNo database schema is currently loaded.`;
    const capabilitySection = this.buildCapabilitySection(capabilities);
    const responseSection =
      responseFormat === 'structured'
        ? Prompts.RESPONSE_FORMAT_STRUCTURED
        : Prompts.RESPONSE_FORMAT_CHAT;

    const dateStr = new Date().toISOString().slice(0, 10);

    return [
      `<identity>\n${Prompts.SYSTEM_IDENTITY}\n</identity>`,
      `<global_rules>\n${Prompts.TRUTH_AND_SAFETY_RULES}\n</global_rules>`,
      `<mission>\n${Prompts.CORE_MISSION}\n</mission>`,
      `<task_mode>\n${modeSection}\n</task_mode>`,
      `<capabilities>\n${capabilitySection}\n</capabilities>`,
      `<database_rules>\n${sqlRules}\n</database_rules>`,
      `<database_context>\n${dbContextSection}\n</database_context>`,
      `<output_contract>\n${responseSection}\n</output_contract>`,
      `<time_context>\n- Current date (UTC): ${dateStr}\n</time_context>`,
    ].join('\n\n');
  }

  buildOpenAiMessages(
    prompt: string,
    systemPrompt: string,
    context?: string,
    history: ChatHistoryMessage[] = [],
    image?: string,
    document?: AiDocument,
  ) {
    const userText = context
      ? `${prompt}\n\nAdditional context:\n${context}`
      : prompt;

    const messages: Array<
      | { role: 'system'; content: string }
      | { role: 'assistant' | 'user'; content: string }
      | {
          role: 'user';
          content: Array<
            | { type: 'text'; text: string }
            | { type: 'image_url'; image_url: { url: string } }
            | { type: 'file'; file: { filename: string; file_data: string } }
          >;
        }
    > = [{ role: 'system', content: systemPrompt }];

    const boundedHistory = this.getBoundedHistory(history, prompt);
    if (boundedHistory.length > 0) {
      for (const msg of boundedHistory) {
        messages.push({
          role: msg.role === 'ai' ? 'assistant' : 'user',
          content: msg.content,
        });
      }
    }

    if (image || document) {
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: userText },
          ...(image
            ? [{ type: 'image_url' as const, image_url: { url: image } }]
            : []),
          ...(document
            ? [
                {
                  type: 'file' as const,
                  file: {
                    filename: document.name,
                    file_data: document.data,
                  },
                },
              ]
            : []),
        ],
      });
    } else {
      messages.push({ role: 'user', content: userText });
    }

    return messages;
  }

  buildGeminiContents(
    prompt: string,
    context?: string,
    history: ChatHistoryMessage[] = [],
    image?: string,
    document?: AiDocument,
  ) {
    const contents: Array<{
      role: 'model' | 'user';
      parts: Array<
        { text: string } | { inlineData: { mimeType: string; data: string } }
      >;
    }> = [];

    const boundedHistory = this.getBoundedHistory(history, prompt);
    if (boundedHistory.length > 0) {
      for (const msg of boundedHistory) {
        contents.push({
          role: msg.role === 'ai' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        });
      }
    }

    const currentParts = this.prepareGeminiParts(
      prompt,
      context,
      image,
      document,
    );
    contents.push({
      role: 'user',
      parts: currentParts,
    });

    return contents;
  }

  private getBoundedHistory(
    history: ChatHistoryMessage[],
    prompt: string,
  ): ChatHistoryMessage[] {
    const candidates = history.filter(
      (message, index) =>
        !(
          index === history.length - 1 &&
          message.role === 'user' &&
          message.content === prompt
        ),
    );
    const recent = candidates.slice(-AI_CONSTANTS.CHAT_HISTORY_MAX_MESSAGES);
    const selected: ChatHistoryMessage[] = [];
    let remaining = AI_CONSTANTS.CHAT_HISTORY_MAX_CHARACTERS;

    for (let index = recent.length - 1; index >= 0 && remaining > 0; index--) {
      const message = recent[index];
      const content = message.content.trim();
      if (!content) continue;

      const boundedContent = this.truncateHistoryContent(content, remaining);
      selected.unshift({ ...message, content: boundedContent });
      remaining -= boundedContent.length;
    }

    return selected;
  }

  private truncateHistoryContent(content: string, maxLength: number): string {
    if (content.length <= maxLength) return content;

    const marker = '\n...[earlier content truncated]...\n';
    if (maxLength <= marker.length) return content.slice(0, maxLength);

    const available = maxLength - marker.length;
    const headLength = Math.ceil(available / 2);
    const tailLength = available - headLength;
    return `${content.slice(0, headLength)}${marker}${content.slice(-tailLength)}`;
  }

  prepareGeminiParts(
    prompt: string,
    context?: string,
    image?: string,
    document?: AiDocument,
  ): Array<
    { text: string } | { inlineData: { mimeType: string; data: string } }
  > {
    const userText = context
      ? `${prompt}\n\nAdditional context:\n${context}`
      : prompt;

    const parts: Array<
      { text: string } | { inlineData: { mimeType: string; data: string } }
    > = [{ text: userText }];

    if (image) {
      const prefix = 'data:';
      const marker = ';base64,';
      const markerIndex = image.startsWith(prefix)
        ? image.indexOf(marker, prefix.length)
        : -1;

      if (markerIndex > prefix.length) {
        const mimeType = image.slice(prefix.length, markerIndex);
        const data = image.slice(markerIndex + marker.length);
        if (data) {
          parts.push({ inlineData: { mimeType, data } });
        }
      }
    }

    if (document) {
      const prefix = `data:${document.mimeType};base64,`;
      if (document.data.startsWith(prefix)) {
        const data = document.data.slice(prefix.length);
        if (data) {
          parts.push({ inlineData: { mimeType: document.mimeType, data } });
        }
      }
    }
    return parts;
  }
  parseAiResponse(fullText: string): {
    message: string;
    sql?: string;
    explanation?: string;
    recommendations?: AiRecommendation[];

    sources?: string[];
  } {
    try {
      const remainingText = this.stripHiddenReasoningBlocks(fullText).trim();

      let cleanJsonStr = remainingText;
      const matchIndex = remainingText.indexOf('{');
      if (matchIndex !== -1) {
        let braceCount = 0;
        let jsonEnd = -1;
        for (let i = matchIndex; i < remainingText.length; i++) {
          if (remainingText[i] === '{') braceCount++;
          else if (remainingText[i] === '}') {
            braceCount--;
            if (braceCount === 0) {
              jsonEnd = i;
              break;
            }
          }
        }
        if (jsonEnd !== -1) {
          cleanJsonStr = remainingText.substring(matchIndex, jsonEnd + 1);
        }
      }
      const parsed = JSON.parse(cleanJsonStr);

      return {
        message: parsed.message || (matchIndex !== -1 ? '' : remainingText),
        sql: parsed.sql || undefined,
        explanation: parsed.explanation || undefined,
        recommendations: this.normalizeRecommendations(parsed.recommendations),
        sources: this.normalizeSources(parsed.sources),
      };
    } catch {
      return {
        message: this.stripHiddenReasoningBlocks(fullText).trim(),
      };
    }
  }

  private stripHiddenReasoningBlocks(fullText: string): string {
    return fullText.replace(
      /<(?:thought|think)>[\s\S]*?(?:<\/(?:thought|think)>|$)/gi,
      '',
    );
  }

  assertUsableStructuredResponse(
    parsed: { message: string; sql?: string; explanation?: string },
    rawText: string,
    providerLabel: string,
  ) {
    const hasMessage =
      typeof parsed.message === 'string' && parsed.message.trim().length > 0;
    const hasSql =
      typeof parsed.sql === 'string' && parsed.sql.trim().length > 0;
    const hasExplanation =
      typeof parsed.explanation === 'string' &&
      parsed.explanation.trim().length > 0;

    if (hasMessage || hasSql || hasExplanation) {
      return;
    }

    const looksLikeEmptyJsonShell =
      /^\s*\{\s*"message"\s*:\s*""\s*,\s*"sql"\s*:\s*""\s*,\s*"explanation"\s*:\s*""\s*\}\s*$/s.test(
        rawText,
      );
    if (looksLikeEmptyJsonShell || rawText.trim().startsWith('{')) {
      throw new Error(`${providerLabel} returned an empty structured response`);
    }
  }

  extractSources(response: {
    candidates?: Array<{
      groundingMetadata?: {
        groundingChunks?: Array<{ web?: { title?: string; uri?: string } }>;
      };
    }>;
  }): string[] {
    return this.extractSourceDetails(response).map((source) => source.url);
  }

  extractSourceDetails(response: {
    candidates?: Array<{
      groundingMetadata?: {
        groundingChunks?: Array<{ web?: { title?: string; uri?: string } }>;
      };
    }>;
  }): SourceDetail[] {
    const candidate = response.candidates?.[0];
    if (!candidate?.groundingMetadata?.groundingChunks) return [];

    return candidate.groundingMetadata.groundingChunks
      .filter(
        (chunk): chunk is { web: { title: string; uri: string } } =>
          !!chunk.web?.uri && !!chunk.web?.title,
      )
      .flatMap((chunk) => {
        const url = this.normalizeSources([chunk.web.uri])?.[0];
        return url ? [{ title: chunk.web.title.trim(), url }] : [];
      });
  }

  mergeSources(
    ...sourceLists: Array<string[] | undefined>
  ): string[] | undefined {
    return this.normalizeSources(sourceLists.flatMap((list) => list || []));
  }

  appendSourcesToMessage(
    message: string,
    sources?: string[],
    sourceDetails: SourceDetail[] = [],
  ): string {
    if (!sources?.length) {
      return message;
    }

    const missingSources = sources.filter(
      (source) => !message.includes(source),
    );
    if (missingSources.length === 0) {
      return message;
    }

    return `${message}${this.buildSourcesMarkdown(missingSources, sourceDetails)}`;
  }

  extractOpenAiStreamText(payload: {
    choices?: Array<{
      delta?: { content?: string | Array<{ text?: string }> };
    }>;
  }): string {
    const delta = payload.choices?.[0]?.delta?.content;
    if (typeof delta === 'string') return delta;
    if (Array.isArray(delta)) {
      return delta.map((item) => item?.text || '').join('');
    }
    return '';
  }

  private buildCapabilitySection(capabilities: AiPromptCapabilities): string {
    const sections = [
      capabilities.liveWebSearch
        ? Prompts.LIVE_RESEARCH_ENABLED
        : Prompts.LIVE_RESEARCH_DISABLED,
    ];

    if (capabilities.visionInput) {
      sections.push(Prompts.VISION_INPUT_ENABLED);
    }

    return sections.join('\n\n');
  }

  private normalizeRecommendations(
    value: unknown,
  ): AiRecommendation[] | undefined {
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
        const type =
          typeof candidate.type === 'string'
            ? (candidate.type.trim() as AiRecommendationType)
            : null;
        const title =
          typeof candidate.title === 'string' ? candidate.title.trim() : '';
        const summary =
          typeof candidate.summary === 'string' ? candidate.summary.trim() : '';

        if (!type || !allowedTypes.has(type) || !title || !summary) {
          return [];
        }

        return [
          {
            type,
            title,
            summary,
            sql:
              typeof candidate.sql === 'string' && candidate.sql.trim()
                ? candidate.sql.trim()
                : undefined,
            chartType:
              typeof candidate.chartType === 'string' &&
              candidate.chartType.trim()
                ? candidate.chartType.trim()
                : undefined,
            fields: Array.isArray(candidate.fields)
              ? candidate.fields
                  .filter(
                    (field): field is string =>
                      typeof field === 'string' && field.trim().length > 0,
                  )
                  .slice(0, 6)
              : undefined,
          } satisfies AiRecommendation,
        ];
      })
      .slice(0, 3);

    return normalized.length ? normalized : undefined;
  }

  private normalizeSources(value: unknown): string[] | undefined {
    if (!Array.isArray(value)) {
      return undefined;
    }

    const normalized = value
      .flatMap((entry) => {
        if (typeof entry !== 'string') {
          return [];
        }

        const candidate = entry.trim();
        if (!candidate) {
          return [];
        }

        try {
          const url = new URL(candidate);
          if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            return [];
          }
          return [url.toString()];
        } catch {
          return [];
        }
      })
      .filter(
        (entry, index, array) =>
          array.findIndex((item) => item === entry) === index,
      )
      .slice(0, 6);

    return normalized.length ? normalized : undefined;
  }

  private buildSourcesMarkdown(
    sources: string[],
    sourceDetails: SourceDetail[],
  ): string {
    return `\n\n---\n**Sources**\n${sources
      .map((source, index) => {
        let label = sourceDetails.find(
          (detail) => detail.url === source,
        )?.title;
        if (label) {
          let hostname = '';
          try {
            hostname = new URL(source).hostname;
          } catch {
            // normalizeSources already filters invalid URLs.
          }
          return `- [${label}${hostname ? ` - ${hostname}` : ''}](${source})`;
        }

        label = `Source ${index + 1}`;
        try {
          const url = new URL(source);
          label = url.hostname.includes('vertexaisearch.cloud.google.com')
            ? `Google Search source ${index + 1}`
            : `Source ${index + 1} - ${url.hostname}`;
        } catch {
          // normalizeSources already filters invalid URLs; keep a safe fallback.
        }
        return `- [${label}](${source})`;
      })
      .join('\n')}`;
  }
}
