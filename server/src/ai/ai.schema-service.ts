import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import * as crypto from 'crypto';
import { AiSchemaContextService } from './ai.schema-context.service';
import { AiProviderRunnerService } from './ai.provider-runner.service';
import { AI_CONSTANTS } from './ai.constants';
import type { ChatParams } from './ai.types';
import { isAiDisabledError } from './ai-account-policy.service';
import { isAiHttpFatalError } from './ai-http-execution';
import {
  assertAiRequestActive,
  isAiRequestStoppedError,
  waitForAiResult,
} from './ai-request-lifecycle';
import type {
  IDatabaseStrategy,
  ColumnInfo,
  Relationship,
} from '../database-strategies/database-strategy.interface';

interface SchemaTable {
  name: string;
  schema: string;
}

@Injectable()
export class AiSchemaService {
  private readonly logger = new Logger(AiSchemaService.name);

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly schemaContextService: AiSchemaContextService,
    private readonly providerRunner: AiProviderRunnerService,
  ) {}

  async suggestTablesBySemantic(
    searchTerm: string,
    tableNames: string[],
    beforeProviderRequest?: ChatParams['beforeProviderRequest'],
    request: Pick<
      ChatParams,
      | 'requestScopeKey'
      | 'signal'
      | 'deadlineAt'
      | 'execution'
      | 'beforeProviderAttempt'
    > = {},
  ): Promise<string[]> {
    assertAiRequestActive(request);
    // Only authenticated server call sites can supply these capabilities. No
    // approval snapshot is cached, and unscoped internal calls fail closed.
    if (
      !beforeProviderRequest ||
      !request.beforeProviderAttempt ||
      !request.requestScopeKey ||
      !request.execution
    )
      return [];
    await waitForAiResult(
      Promise.resolve().then(() => beforeProviderRequest?.()),
      request.signal,
    );
    assertAiRequestActive(request);
    if (!this.providerRunner.isGeminiAvailable() || tableNames.length === 0)
      return [];

    const cacheKey = `ai:semantic_search:${crypto
      .createHash('sha256')
      .update(JSON.stringify([request.requestScopeKey, searchTerm, tableNames]))
      .digest('hex')}`;
    const cached = await waitForAiResult(
      this.cacheManager.get<string[]>(cacheKey),
      request.signal,
    );
    assertAiRequestActive(request);
    if (cached !== undefined && cached !== null) {
      return cached.filter((name) => tableNames.includes(name)).slice(0, 5);
    }

    const prompt = `Given the database table names below, find the most relevant ones for the search term: "${searchTerm}".
TABLES:
${tableNames.join(', ')}

Rules:
- Return ONLY a comma-separated list of table names.
- If nothing is relevant, return an empty string.
- Max 5 results.
- Understand synonyms and translations (e.g., "khách hàng" matches "customers", "user" matches "profile").`;

    try {
      const plan = { provider: 'gemini' as const, model: 'gemini-2.5-flash' };
      await waitForAiResult(
        Promise.resolve().then(() => beforeProviderRequest()),
        request.signal,
      );
      assertAiRequestActive(request);
      await waitForAiResult(
        request.beforeProviderAttempt(plan),
        request.signal,
      );
      assertAiRequestActive(request);
      const response = await waitForAiResult(
        this.providerRunner.completeGeminiText({
          ...request,
          beforeProviderRequest,
          model: plan.model,
          prompt,
          temperature: AI_CONSTANTS.TEMPERATURE_PRECISE,
          maxOutputTokens: 100,
        }),
        request.signal,
      );

      assertAiRequestActive(request);
      const suggestions = response
        .split(',')
        .map((s) => s.trim())
        .filter((s) => tableNames.includes(s))
        .slice(0, 5);

      await waitForAiResult(
        this.cacheManager.set(
          cacheKey,
          suggestions,
          AI_CONSTANTS.AUTOCOMPLETE_CACHE_TTL_MS,
        ),
        request.signal,
      );
      assertAiRequestActive(request);
      return suggestions;
    } catch (error) {
      if (
        request.signal?.aborted ||
        isAiDisabledError(error) ||
        isAiHttpFatalError(error) ||
        request.execution ||
        isAiRequestStoppedError(error)
      )
        throw error;
      this.logger.warn(
        '[AiSchemaService] Semantic suggestion failed:',
        error instanceof Error ? error.message : 'Unknown error',
      );
      return [];
    }
  }

  async gatherSchemaContext(
    pool: unknown,
    strategy: IDatabaseStrategy,
    database?: string,
    connectionId?: string,
    searchTerm?: string,
    request: Pick<
      ChatParams,
      'signal' | 'deadlineAt' | 'beforeProviderRequest'
    > = {},
  ): Promise<string> {
    return this.schemaContextService.gatherSchemaContext(
      pool,
      strategy,
      database,
      connectionId,
      searchTerm,
      request,
    );
  }

  clearCache(connectionId: string, database?: string) {
    this.schemaContextService.clearCache(connectionId, database);
  }

  buildSchemaContext(
    tables: SchemaTable[],
    columns: Map<string, ColumnInfo[]>,
    relationships: Relationship[],
  ): string {
    return this.schemaContextService.buildSchemaContext(
      tables,
      columns,
      relationships,
    );
  }
}
