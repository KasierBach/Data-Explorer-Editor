import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import * as crypto from 'crypto';
import { AiProviderRunnerService } from './ai.provider-runner.service';
import { AiRoutingService } from './ai.routing.service';
import { AI_CONSTANTS } from './ai.constants';
import type { ChatParams } from './ai.types';

type GeneratedCommandResponse = {
  explanation?: string;
  payload?: unknown;
  sql?: unknown;
};

const MONGO_QUERY_ACTIONS = new Set([
  'find',
  'aggregate',
  'count',
  'distinct',
  'insertOne',
  'insertMany',
  'updateOne',
  'updateMany',
  'deleteOne',
  'deleteMany',
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isEmptyObject(value: unknown): value is Record<string, never> {
  return isPlainObject(value) && Object.keys(value).length === 0;
}

function stripCodeFences(value: string): string {
  return value
    .replace(/^\s*```(?:json|sql)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function extractJsonObject(responseText: string): string {
  const cleaned = stripCodeFences(responseText);
  const firstBrace = cleaned.indexOf('{');

  if (firstBrace === -1) {
    return cleaned;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = firstBrace; index < cleaned.length; index += 1) {
    const char = cleaned[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return cleaned.slice(firstBrace, index + 1);
      }
    }
  }

  return cleaned.slice(firstBrace);
}

function extractPreferredCollection(query: string): string | null {
  const quotedMatch = query.match(/for collection\s+["'`](.+?)["'`]\s*:/i);
  if (quotedMatch?.[1]) {
    return quotedMatch[1].trim();
  }

  const plainMatch = query.match(/\bcollection\s+([A-Za-z0-9_.-]+)/i);
  return plainMatch?.[1]?.trim() || null;
}

function isMongoStageDocument(value: Record<string, unknown>): boolean {
  const keys = Object.keys(value);
  return keys.length > 0 && keys.every((key) => key.startsWith('$'));
}

function normalizeMongoPayloadObject(
  value: unknown,
  preferredCollection: string | null,
): Record<string, unknown> | null {
  const fallbackCollection = preferredCollection || 'yourCollection';

  if (Array.isArray(value)) {
    return {
      action: 'aggregate',
      collection: fallbackCollection,
      pipeline: value,
    };
  }

  if (!isPlainObject(value)) {
    return null;
  }

  const payload = { ...value };
  const action =
    typeof payload.action === 'string' ? payload.action.trim() : null;
  const collection =
    typeof payload.collection === 'string' && payload.collection.trim().length
      ? payload.collection.trim()
      : fallbackCollection;

  if (action && MONGO_QUERY_ACTIONS.has(action)) {
    const normalized: Record<string, unknown> = {
      ...payload,
      action,
      collection,
    };

    if (
      (action === 'find' || action === 'count') &&
      !isPlainObject(normalized.filter)
    ) {
      normalized.filter = {};
    }

    if (action === 'find' && !isPlainObject(normalized.options)) {
      normalized.options = {};
    }

    if (action === 'aggregate' && !Array.isArray(normalized.pipeline)) {
      normalized.pipeline = [];
    }

    return normalized;
  }

  if (Array.isArray(payload.pipeline)) {
    return {
      action: 'aggregate',
      collection,
      pipeline: payload.pipeline,
    };
  }

  if (isMongoStageDocument(payload)) {
    return {
      action: 'aggregate',
      collection,
      pipeline: [payload],
    };
  }

  if (typeof payload.field === 'string') {
    return {
      action: 'distinct',
      collection,
      field: payload.field,
      filter: isPlainObject(payload.filter) ? payload.filter : {},
    };
  }

  if (
    'filter' in payload ||
    'options' in payload ||
    'limit' in payload ||
    'projection' in payload ||
    'sort' in payload
  ) {
    const options = isPlainObject(payload.options)
      ? { ...payload.options }
      : {};

    if ('projection' in payload) {
      options.projection = payload.projection;
    }

    if ('sort' in payload) {
      options.sort = payload.sort;
    }

    const normalized: Record<string, unknown> = {
      action: 'find',
      collection,
      filter: isPlainObject(payload.filter) ? payload.filter : {},
      options,
    };

    if (typeof payload.limit === 'number') {
      normalized.limit = payload.limit;
    }

    return normalized;
  }

  return {
    action: 'find',
    collection,
    filter: payload,
    options: {},
  };
}

function normalizeMongoExecutablePayload(
  candidate: unknown,
  query: string,
): string {
  const preferredCollection = extractPreferredCollection(query);
  const normalized = normalizeMongoPayloadObject(
    candidate,
    preferredCollection,
  );

  if (normalized) {
    return JSON.stringify(normalized, null, 2);
  }

  if (typeof candidate !== 'string') {
    return '';
  }

  const trimmed = stripCodeFences(candidate);
  if (!trimmed) {
    return '';
  }

  try {
    const parsed = JSON.parse(trimmed);
    const normalizedParsed = normalizeMongoPayloadObject(
      parsed,
      preferredCollection,
    );

    if (normalizedParsed) {
      return JSON.stringify(normalizedParsed, null, 2);
    }
  } catch {
    return trimmed;
  }

  return trimmed;
}

@Injectable()
export class AiAutocompleteService {
  private readonly logger = new Logger(AiAutocompleteService.name);

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly providerRunner: AiProviderRunnerService,
    private readonly routingService: AiRoutingService,
  ) {}

  async autocomplete(params: {
    beforeCursor: string;
    afterCursor?: string;
    schemaContext?: string;
    databaseType?: string;
    model?: string;
    providerOverride?: ChatParams['providerOverride'];
  }): Promise<string> {
    const {
      beforeCursor,
      afterCursor = '',
      schemaContext,
      databaseType = 'postgres',
      model,
      providerOverride,
    } = params;

    const isNoSql =
      databaseType === 'mongodb' ||
      databaseType === 'redis' ||
      databaseType?.includes('mongodb');
    const roleTitle = isNoSql
      ? databaseType.includes('mongodb')
        ? 'MongoDB MQL'
        : 'Redis Command'
      : `${databaseType} SQL`;

    const cacheScope = providerOverride
      ? `${providerOverride.baseUrl}:${providerOverride.model}`
      : model || 'assistant-default';
    const cacheContent = `${databaseType}:${cacheScope}:${schemaContext || ''}:${beforeCursor}`;
    const cacheKey = `ai:autocomplete:${crypto.createHash('sha256').update(cacheContent).digest('hex')}`;

    try {
      const cachedSuggestion = await this.cacheManager.get<string>(cacheKey);
      if (cachedSuggestion) {
        return cachedSuggestion;
      }

      const systemPrompt = `You are an expert ${roleTitle} autocomplete engine.
Your task: Predict the next FEW logical characters or a SHORT clause to insert at the cursor.
- **Accuracy over Length**: Prefer a short, 100% correct snippet over a long block.
- **Surgical Precision**: ONLY return the raw string to be appended at the cursor position. No markdown, no commentary.
- **Context Awareness**: Look at the 'BEFORE' and 'AFTER' context to avoid syntax errors.
- **No Redundancy**: If the current statement seems complete, suggest valid next steps but keep it as brief as possible.
${isNoSql ? '- **No SQL**: Do NOT use SQL syntax for NoSQL environments. Use native commands.' : ''}

CONTEXT:
${schemaContext || 'Empty'}

BEFORE CURSOR:
${beforeCursor.length > AI_CONSTANTS.AUTOCOMPLETE_CURSOR_MAX_LENGTH ? beforeCursor.slice(-AI_CONSTANTS.AUTOCOMPLETE_CURSOR_MAX_LENGTH) : beforeCursor}

AFTER CURSOR:
${afterCursor.length > 300 ? afterCursor.slice(0, 300) : afterCursor}

NEXT CHARACTERS (START IMMEDIATELY):`;

      const { plans } = this.routingService.buildPlanChain(
        {
          prompt: beforeCursor,
          schemaContext,
          databaseType,
          model,
          mode: 'fast',
          providerOverride,
        },
        this.providerRunner.isGeminiAvailable(),
      );

      for (const plan of plans) {
        try {
          const responseText =
            plan.provider === 'gemini'
              ? await this.providerRunner.completeGeminiText({
                  model: plan.model,
                  prompt: systemPrompt,
                  temperature: AI_CONSTANTS.TEMPERATURE_PRECISE,
                  maxOutputTokens: AI_CONSTANTS.AUTOCOMPLETE_MAX_OUTPUT_TOKENS,
                })
              : await this.providerRunner.completeOpenAiCompatibleText(plan, {
                  systemPrompt,
                  prompt: beforeCursor,
                  temperature: AI_CONSTANTS.TEMPERATURE_PRECISE,
                  maxOutputTokens: AI_CONSTANTS.AUTOCOMPLETE_MAX_OUTPUT_TOKENS,
                });

          const suggestion = responseText
            .replace(/^```(sql|json|bash)?\n?|```$/g, '')
            .trim();

          if (!suggestion) {
            continue;
          }

          await this.cacheManager.set(
            cacheKey,
            suggestion,
            AI_CONSTANTS.AUTOCOMPLETE_CACHE_TTL_MS,
          );
          return suggestion;
        } catch (planError) {
          this.logger.warn(
            `[AiAutocompleteService] Autocomplete plan ${plan.provider}:${plan.model} failed: ${
              planError instanceof Error ? planError.message : 'Unknown error'
            }`,
          );
        }
      }

      return '';
    } catch (error) {
      this.logger.warn(
        '[AiAutocompleteService] Autocomplete failed:',
        error instanceof Error ? error.message : 'Unknown error',
      );
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

    const isMongoDb = databaseType.includes('mongodb');
    const isRedis = databaseType === 'redis';

    const systemPrompt = isMongoDb
      ? `You are an expert MongoDB query payload generator.
Your task: Convert the user's natural language request into a valid, optimized MongoDB payload that this app can execute directly.

SCHEMA CONTEXT:
${schemaContext || 'Not provided'}

USER REQUEST:
"${query}"

RULES:
1. Return your response in JSON format:
   {
     "payload": {
       "action": "find",
       "collection": "orders",
       "filter": { "status": "active" },
       "options": { "sort": { "createdAt": -1 } },
       "limit": 50
     },
     "explanation": "A brief explanation of what the payload does"
   }
2. The payload must be directly executable JSON for this app. Use an object with keys like "action", "collection", "filter", "options", "limit", "pipeline", or "field".
3. Do NOT return shell syntax like db.orders.find(...). Do NOT return a bare pipeline array as the top-level answer.
4. Prefer read-only actions ("find", "aggregate", "count", "distinct") unless the user explicitly asks to insert, update, or delete.
5. If the request says For collection "X", set "collection" to exactly X.
6. Use "aggregate" with a "pipeline" array for grouping, joins via $lookup, reshaping, or multi-stage analytics.
7. If you cannot generate a safe payload, return an empty object in "payload" and explain why.
8. Do NOT include markdown code blocks.

JSON RESPONSE:`
      : `You are an expert ${isRedis ? 'Redis Command' : `${databaseType} SQL`} generator.
Your task: Convert the user's natural language request into a valid, optimized ${isRedis ? 'native command' : 'SQL query'}.

${isRedis ? '### STRICT RULE: USE NATIVE REDIS COMMANDS ONLY.' : ''}

SCHEMA CONTEXT:
${schemaContext || 'Not provided'}

USER REQUEST:
"${query}"

RULES:
1. Return your response in JSON format:
   {
     "sql": "${isRedis ? 'GET user:123' : 'SELECT * FROM users WHERE active=true'}",
     "explanation": "A brief explanation of what the command does"
   }
2. Only use collections/keys/tables available in the provided SCHEMA CONTEXT.
3. If you cannot generate the command, return an empty "sql" and an explanation of why.
4. Do NOT include markdown code blocks in the "sql" field.

JSON RESPONSE:`;

    try {
      const responseText = await this.providerRunner.completeGeminiText({
        model: 'gemini-3.1-flash-lite-preview',
        prompt: systemPrompt,
        temperature: AI_CONSTANTS.TEMPERATURE_PRECISE,
        maxOutputTokens: AI_CONSTANTS.AUTOCOMPLETE_NLP_MAX_OUTPUT_TOKENS,
      });

      const result = JSON.parse(
        extractJsonObject(responseText),
      ) as GeneratedCommandResponse;
      const explanation =
        typeof result.explanation === 'string' && result.explanation.trim()
          ? result.explanation.trim()
          : 'Done.';

      return {
        sql: isMongoDb
          ? isEmptyObject(result.payload)
            ? ''
            : normalizeMongoExecutablePayload(
                result.payload ?? result.sql,
                query,
              )
          : typeof result.sql === 'string'
            ? stripCodeFences(result.sql)
            : '',
        explanation,
      };
    } catch (error) {
      this.logger.error(
        '[AiAutocompleteService] NLP to Command failed:',
        error,
      );
      throw new Error(
        `Failed to generate command: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
