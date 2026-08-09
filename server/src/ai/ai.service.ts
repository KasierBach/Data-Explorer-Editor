import { Injectable } from '@nestjs/common';
import { AiChatCompletionService } from './ai.chat-completion.service';
import { AiSchemaService } from './ai.schema-service';
import { AiAutocompleteService } from './ai.autocomplete-service';
import type {
  ChatParams,
  ChatResult,
  StreamEvent,
  AiRoutingMode,
  AiChatMode,
} from './ai.types';
import type {
  ColumnInfo,
  IDatabaseStrategy,
  Relationship,
} from '../database-strategies/database-strategy.interface';
import { validateMongoExecutableCommand } from './mongo-payload-validator';

interface SchemaTable {
  name: string;
  schema: string;
}

@Injectable()
export class AiService {
  constructor(
    private readonly chatService: AiChatCompletionService,
    private readonly schemaService: AiSchemaService,
    private readonly autocompleteService: AiAutocompleteService,
  ) {}

  async chat(params: ChatParams): Promise<ChatResult> {
    return this.chatService.chat(params);
  }

  async *chatStream(params: ChatParams): AsyncGenerator<StreamEvent> {
    yield* this.chatService.chatStream(params);
  }

  async gatherSchemaContext(
    pool: unknown,
    strategy: IDatabaseStrategy,
    database?: string,
    connectionId?: string,
    searchTerm?: string,
  ): Promise<string> {
    return this.schemaService.gatherSchemaContext(
      pool,
      strategy,
      database,
      connectionId,
      searchTerm,
    );
  }

  clearCache(connectionId: string, database?: string) {
    this.schemaService.clearCache(connectionId, database);
  }

  buildSchemaContext(
    tables: SchemaTable[],
    columns: Map<string, ColumnInfo[]>,
    relationships: Relationship[],
  ): string {
    return this.schemaService.buildSchemaContext(
      tables,
      columns,
      relationships,
    );
  }

  async suggestTablesBySemantic(
    searchTerm: string,
    tableNames: string[],
  ): Promise<string[]> {
    return this.schemaService.suggestTablesBySemantic(searchTerm, tableNames);
  }

  async autocomplete(params: {
    beforeCursor: string;
    afterCursor?: string;
    schemaContext?: string;
    databaseType?: string;
    model?: string;
    providerOverride?: ChatParams['providerOverride'];
  }): Promise<string> {
    return this.autocompleteService.autocomplete(params);
  }

  async generateSql(params: {
    query: string;
    databaseType?: string;
    schemaContext?: string;
    model?: string;
    mode?: AiChatMode;
    routingMode?: AiRoutingMode;
    providerOverride?: ChatParams['providerOverride'];
  }): Promise<
    Pick<ChatResult, 'provider' | 'model' | 'routingMode'> & {
      sql: string;
      explanation: string;
    }
  > {
    const {
      query,
      databaseType = 'postgres',
      schemaContext,
      model,
      mode = 'fast',
      routingMode,
      providerOverride,
    } = params;

    let result = await this.chatService.chat({
      model,
      mode,
      prompt: this.buildCommandGenerationPrompt(query, databaseType),
      schemaContext,
      databaseType,
      routingMode,
      providerOverride,
    });

    let sql = this.normalizeGeneratedCommand(result.sql, databaseType, query);
    let explanation =
      result.explanation?.trim() || result.message?.trim() || 'Done.';

    if (databaseType.toLowerCase().includes('mongodb')) {
      const validationIssues = validateMongoExecutableCommand(sql);
      if (validationIssues.length > 0) {
        const repairResult = await this.chatService.chat({
          model,
          mode,
          prompt: this.buildMongoRepairPrompt(query, sql, validationIssues),
          schemaContext,
          databaseType,
          routingMode,
          providerOverride,
        });
        const repairedSql = this.normalizeGeneratedCommand(
          repairResult.sql,
          databaseType,
          query,
        );
        const repairIssues = validateMongoExecutableCommand(repairedSql);

        result = repairResult;
        if (repairIssues.length === 0) {
          sql = repairedSql;
          explanation =
            repairResult.explanation?.trim() ||
            repairResult.message?.trim() ||
            'Generated and validated a MongoDB command.';
        } else {
          sql = '';
          explanation = `The AI response could not be converted into a safe executable MongoDB payload: ${repairIssues[0]}`;
        }
      }
    }

    return {
      sql,
      explanation,
      provider: result.provider,
      model: result.model,
      routingMode: result.routingMode,
    };
  }

  private buildCommandGenerationPrompt(
    query: string,
    databaseType: string,
  ): string {
    const normalizedType = databaseType.toLowerCase();

    if (normalizedType.includes('mongodb')) {
      return `Generate one executable MongoDB JSON payload for this app.

OUTPUT CONTRACT:
- Follow the system structured-response contract.
- Put the serialized executable payload in the top-level "sql" string field.
- The value inside "sql" uses this shape: { "action": "aggregate", "collection": "orders", "pipeline": [...] }.
- Do not put Markdown or Mongo shell syntax inside "sql".
- Briefly explain the selected fields and assumptions in "explanation".
- Prefer read-only actions: find, aggregate, count, or distinct.
- Use only fields present in SCHEMA CONTEXT. Never invent a field.
- If the request is vague, choose a useful categorical or date field from SCHEMA CONTEXT; avoid _id and high-cardinality identifier fields.

AGGREGATION RULES:
1. Every pipeline item contains exactly one stage operator.
2. Supported stages: $match, $group, $project, $sort, $limit, $skip, $lookup, $unwind, $facet, $addFields.
3. $unwind uses a field path such as { "$unwind": "$genres" }.
4. $group always contains "_id". Every other output field must contain exactly one accumulator object.
5. Correct group example: { "$group": { "_id": "$genres", "count": { "$sum": 1 } } }.
6. Never place accumulators directly beside $group and never use a plain number as a grouped output field.
7. $sort directions are 1 or -1. $limit is a positive integer. $skip is a non-negative integer.
8. For an array field grouped by each element, unwind it before grouping.

USER REQUEST:
${query}`;
    }

    if (normalizedType === 'redis') {
      return `Generate an executable Redis command/query for this request.\n\nUser request:\n${query}`;
    }

    return `Generate an executable SQL query for this request.\n\nUser request:\n${query}`;
  }

  private buildMongoRepairPrompt(
    query: string,
    invalidCommand: string,
    validationIssues: string[],
  ): string {
    return `Repair the MongoDB JSON payload below so this app can execute it safely.

ORIGINAL USER REQUEST:
${query}

VALIDATION ERRORS:
${validationIssues.map((issue) => `- ${issue}`).join('\n')}

INVALID PAYLOAD:
${invalidCommand.slice(0, 12000)}

Follow the system structured-response contract and put only the corrected serialized MongoDB payload in the top-level "sql" string field. Keep the requested collection and intent.
Every pipeline item must contain exactly one supported stage operator.
For $group, include "_id" and make every other output field an accumulator object, for example:
{ "$group": { "_id": "$genres", "count": { "$sum": 1 } } }
Do not return Markdown, commentary, or Mongo shell syntax.`;
  }

  private normalizeGeneratedCommand(
    candidate: unknown,
    databaseType: string,
    query: string,
  ): string {
    let candidateText = '';
    if (typeof candidate === 'string') {
      candidateText = candidate;
    } else if (candidate !== null && candidate !== undefined) {
      try {
        candidateText = JSON.stringify(candidate);
      } catch {
        candidateText = '';
      }
    }

    const raw = this.stripCodeFences(candidateText);
    if (!raw) {
      return '';
    }

    if (!databaseType.toLowerCase().includes('mongodb')) {
      return raw;
    }

    return this.normalizeMongoExecutablePayload(raw, query);
  }

  private stripCodeFences(value: string): string {
    return value
      .replace(/^\s*```(?:json|sql)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
  }

  private extractPreferredCollection(query: string): string | null {
    const quotedMatch = query.match(
      /for collection\s+["'`]([^"'`\r\n]+)["'`]\s*:/i,
    );
    if (quotedMatch?.[1]) {
      return quotedMatch[1].trim();
    }

    const plainMatch = query.match(/\bcollection\s+([A-Za-z0-9_.-]+)/i);
    return plainMatch?.[1]?.trim() || null;
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private isMongoStageDocument(value: Record<string, unknown>): boolean {
    const keys = Object.keys(value);
    return keys.length > 0 && keys.every((key) => key.startsWith('$'));
  }

  private normalizeMongoPayloadObject(
    value: unknown,
    preferredCollection: string | null,
  ): Record<string, unknown> | null {
    const fallbackCollection = preferredCollection || 'yourCollection';
    const mongoActions = new Set([
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

    if (Array.isArray(value)) {
      return {
        action: 'aggregate',
        collection: fallbackCollection,
        pipeline: value,
      };
    }

    if (!this.isPlainObject(value)) {
      return null;
    }

    const payload = { ...value };
    const action =
      typeof payload.action === 'string' ? payload.action.trim() : null;
    const collection =
      typeof payload.collection === 'string' && payload.collection.trim().length
        ? payload.collection.trim()
        : fallbackCollection;

    if (action && mongoActions.has(action)) {
      const normalized: Record<string, unknown> = {
        ...payload,
        action,
        collection,
      };

      if (
        (action === 'find' || action === 'count') &&
        !this.isPlainObject(normalized.filter)
      ) {
        normalized.filter = {};
      }

      if (action === 'find' && !this.isPlainObject(normalized.options)) {
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

    if (this.isMongoStageDocument(payload)) {
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
        filter: this.isPlainObject(payload.filter) ? payload.filter : {},
      };
    }

    if (
      'filter' in payload ||
      'options' in payload ||
      'limit' in payload ||
      'projection' in payload ||
      'sort' in payload
    ) {
      const options = this.isPlainObject(payload.options)
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
        filter: this.isPlainObject(payload.filter) ? payload.filter : {},
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

  private normalizeMongoExecutablePayload(
    candidate: string,
    query: string,
  ): string {
    const preferredCollection = this.extractPreferredCollection(query);
    const trimmed = this.stripCodeFences(candidate);
    if (!trimmed) {
      return '';
    }

    try {
      const parsed = JSON.parse(trimmed);
      const normalized = this.normalizeMongoPayloadObject(
        parsed,
        preferredCollection,
      );

      if (normalized) {
        return JSON.stringify(normalized, null, 2);
      }
    } catch {
      return trimmed;
    }

    return trimmed;
  }
}
