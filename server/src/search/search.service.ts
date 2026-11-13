import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConnectionsService } from '../connections/connections.service';
import { DatabaseStrategyFactory } from '../database-strategies';
import { AiService } from '../ai/ai.service';
import { AiAccountPolicyService } from '../ai/ai-account-policy.service';
import {
  AiExecutionLedgerService,
  type AiExecutionContext,
} from '../ai/ai-execution-ledger.service';
import type { ChatParams } from '../ai/ai.types';
import {
  createAiRequestScope,
  waitForAiResult,
  assertAiRequestActive,
} from '../ai/ai-request-lifecycle';
import {
  SearchIndexRepository,
  type SearchSemanticScope,
} from './search-index.repository';
import type { SearchIndexItem } from './search-index.types';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private readonly connectionsService: ConnectionsService,
    private readonly strategyFactory: DatabaseStrategyFactory,
    private readonly aiService: AiService,
    private readonly searchIndexRepository: SearchIndexRepository,
    private readonly accountPolicy: AiAccountPolicyService,
    @Optional() private readonly executionLedger?: AiExecutionLedgerService,
  ) {}

  private async suggestNames(
    userId: string,
    query: string,
  ): Promise<
    Array<{
      scope: SearchSemanticScope;
      names: string[];
    }>
  > {
    const scope = createAiRequestScope({ timeoutMs: 1_500 });
    try {
      if (
        !(await waitForAiResult(
          this.accountPolicy.isEnabled(userId),
          scope.signal,
        ))
      )
        return [];
      // Account consent first; each connection gate below also checks the
      // deployment root and exact database approval before indexed schema reads.
      await waitForAiResult(
        this.accountPolicy.assertEnabled(userId),
        scope.signal,
      );
      if (!this.executionLedger) return [];
      const connections = await waitForAiResult(
        this.connectionsService.findAll(userId),
        scope.signal,
      );
      assertAiRequestActive(scope);
      const results: Array<{ scope: SearchSemanticScope; names: string[] }> =
        [];
      // No client scope list, inferred/default database, or database enumeration.
      // Keep enrichment bounded even if the actor has many connections.
      for (const connection of connections.slice(0, 5)) {
        if (!connection.id || !connection.database?.trim()) continue;
        const approvedScope = {
          connectionId: connection.id,
          database: connection.database,
        };
        try {
          await waitForAiResult(
            this.accountPolicy.assertConnectionEnabled(
              userId,
              approvedScope.connectionId,
              approvedScope.database,
            ),
            scope.signal,
          );
        } catch {
          assertAiRequestActive(scope);
          continue;
        }
        let execution: AiExecutionContext | undefined;
        try {
          const names = await waitForAiResult(
            this.searchIndexRepository.getSemanticFallbackNames(userId, [
              approvedScope,
            ]),
            scope.signal,
          );
          assertAiRequestActive(scope);
          if (names.length === 0) continue;
          const activeExecution = await waitForAiResult(
            this.executionLedger
              .begin(userId, 'schema_analysis', {
                ...approvedScope,
                requestedModel: 'gemini-2.5-flash',
                deadlineAt: scope.deadlineAt,
              })
              .then(async (created) => {
                if (scope.signal.aborted || Date.now() >= scope.deadlineAt) {
                  try {
                    await created.fail('timed_out');
                  } finally {
                    await created.release();
                  }
                  assertAiRequestActive(scope);
                }
                return created;
              }),
            scope.signal,
          );
          execution = activeExecution;
          const beforeProviderRequest =
            this.accountPolicy.beforeProviderRequest(
              userId,
              approvedScope.connectionId,
              approvedScope.database,
            );
          const request: Pick<
            ChatParams,
            | 'requestScopeKey'
            | 'signal'
            | 'deadlineAt'
            | 'execution'
            | 'beforeProviderAttempt'
          > = {
            requestScopeKey: JSON.stringify([
              userId,
              approvedScope.connectionId,
              approvedScope.database,
            ]),
            signal: scope.signal,
            deadlineAt: Math.min(scope.deadlineAt, activeExecution.deadlineAt),
            execution: activeExecution,
            beforeProviderAttempt: this.accountPolicy.beforeProviderAttempt(
              userId,
              approvedScope.connectionId,
              approvedScope.database,
            ),
          };
          const suggestions = await waitForAiResult(
            this.aiService.suggestTablesBySemantic(
              query,
              names,
              beforeProviderRequest,
              request,
            ),
            scope.signal,
          );
          assertAiRequestActive(request);
          const completed = await activeExecution.complete();
          assertAiRequestActive(request);
          if (completed.outcome !== 'succeeded')
            throw new Error('Semantic execution did not complete.');
          results.push({
            scope: approvedScope,
            names: suggestions
              .filter((name) => names.includes(name))
              .slice(0, 5),
          });
        } catch (error) {
          if (execution) {
            await execution.fail(scope.signal.aborted ? 'timed_out' : 'failed');
          }
          throw error;
        } finally {
          await execution?.release();
        }
      }
      return results;
    } finally {
      scope.abort();
      scope.dispose();
    }
  }

  async syncIndex(userId: string) {
    const connections = await this.connectionsService.findAll(userId);
    const indexedItems: SearchIndexItem[] = [];

    for (const conn of connections) {
      try {
        this.logger.log(`Indexing connection: ${conn.name} (${conn.id})`);
        const strategy = this.strategyFactory.getStrategy(conn.type);
        const pool = await this.connectionsService.getPool(
          conn.id,
          undefined,
          userId,
        );

        const databases =
          conn.type === 'mongodb' || conn.type === 'mongodb+srv'
            ? await strategy.getDatabases(pool)
            : [null];

        for (const database of databases) {
          const schemas = await strategy.getSchemas(
            pool,
            database?.name || undefined,
          );

          for (const schema of schemas) {
            // ID format: "db:NAME.schema:NAME" or "schema:NAME".
            let schemaName = schema.name;
            let dbName = '';

            const id = schema.id;
            if (id.includes('db:')) {
              const dbPart = id.split('.schema:')[0] || '';
              dbName = dbPart.replace('db:', '');

              if (id.includes('.schema:')) {
                schemaName = id.split('.schema:')[1] || schema.name;
              }
            } else if (id.includes('schema:')) {
              schemaName = id.replace('schema:', '');
            }

            const tables = await strategy.getTables(
              pool,
              schemaName,
              dbName || undefined,
            );
            const views = await strategy.getViews(
              pool,
              schemaName,
              dbName || undefined,
            );

            const items = [...tables, ...views].map((node) => ({
              id: node.id,
              name: node.name,
              type: node.type,
              connectionId: conn.id,
              connectionName: conn.name,
              database: dbName || conn.database || 'default',
              schema: schemaName,
            }));

            indexedItems.push(...items);
          }
        }
      } catch (err) {
        this.logger.error(
          `Failed to index connection ${conn.id}: ${err.message}`,
        );
      }
    }

    await this.searchIndexRepository.replaceUserIndex(userId, indexedItems);

    return { success: true, message: 'Sync completed' };
  }

  async search(userId: string, query: string) {
    const keywordResults = await this.searchIndexRepository.search(
      userId,
      query,
      50,
    );

    // 2. Semantic search fallback for short keyword result sets.
    if (keywordResults.length < 5 && query.length > 2) {
      // Semantic enrichment is optional. Policy storage or provider failures must
      // not turn an otherwise successful keyword search into a failed request.
      try {
        const scopedSuggestions = await this.suggestNames(userId, query);
        const aiResults: Array<SearchIndexItem & { isAiSuggested: boolean }> =
          [];
        for (const suggestion of scopedSuggestions) {
          if (suggestion.names.length === 0) continue;
          // Approval may have changed while the provider was running. Never
          // enrich with an unrelated same-name item from another database.
          await this.accountPolicy.assertConnectionEnabled(
            userId,
            suggestion.scope.connectionId,
            suggestion.scope.database,
          );
          const items = await this.searchIndexRepository.getItemsByNames(
            userId,
            suggestion.names,
            50,
            [suggestion.scope],
          );
          aiResults.push(
            ...items
              .filter(
                (item) =>
                  suggestion.names.includes(item.name) &&
                  item.connectionId === suggestion.scope.connectionId &&
                  item.database === suggestion.scope.database,
              )
              .map((item) => ({ ...item, isAiSuggested: true })),
          );
        }
        if (aiResults.length > 0) {
          const existingIds = new Set(keywordResults.map((r) => r.id));
          const finalResults = [...keywordResults];
          for (const aiItem of aiResults) {
            if (!existingIds.has(aiItem.id)) {
              finalResults.push(aiItem);
              existingIds.add(aiItem.id);
            }
          }
          return finalResults.slice(0, 50);
        }
      } catch {
        this.logger.warn(
          'Semantic search fallback failed; returning keyword results',
        );
      }
    }

    return keywordResults;
  }
}
