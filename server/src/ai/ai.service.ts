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

interface SchemaTable {
  name: string;
  schema: string;
  sampleData?: Record<string, unknown>[];
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
  ): Promise<string> {
    return this.schemaService.gatherSchemaContext(
      pool,
      strategy,
      database,
      connectionId,
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
  }): Promise<{ sql: string; explanation: string }> {
    const {
      query,
      databaseType = 'postgres',
      schemaContext,
      model,
      mode = 'fast',
      routingMode,
      providerOverride,
    } = params;

    const result = await this.chatService.chat({
      model,
      mode,
      prompt: this.buildCommandGenerationPrompt(query, databaseType),
      schemaContext,
      databaseType,
      routingMode,
      providerOverride,
    });

    const sql = this.normalizeGeneratedCommand(result.sql, databaseType, query);
    const explanation =
      result.explanation?.trim() || result.message?.trim() || 'Done.';

    return { sql, explanation };
  }

  private buildCommandGenerationPrompt(
    query: string,
    databaseType: string,
  ): string {
    const normalizedType = databaseType.toLowerCase();

    if (normalizedType.includes('mongodb')) {
      return `Generate an executable MongoDB MQL query payload for this request. Return a JSON payload for this app, not shell syntax like db.collection.find(...).\n\nUser request:\n${query}`;
    }

    if (normalizedType === 'redis') {
      return `Generate an executable Redis command/query for this request.\n\nUser request:\n${query}`;
    }

    return `Generate an executable SQL query for this request.\n\nUser request:\n${query}`;
  }

  private normalizeGeneratedCommand(
    candidate: string | undefined,
    databaseType: string,
    query: string,
  ): string {
    const raw = this.stripCodeFences(candidate || '');
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
    const quotedMatch = query.match(/for collection\s+["'`](.+?)["'`]\s*:/i);
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
