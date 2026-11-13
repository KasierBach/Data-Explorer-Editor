import {
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AiAccountPolicyService } from './ai-account-policy.service';
import {
  AiExecutionLedgerService,
  type AiExecutionContext,
  type AiExecutionFailure,
  type AiExecutionSummary,
  type AiExecutionTask,
} from './ai-execution-ledger.service';
import { assertAiInputBounds } from './ai-input-bounds';
import { aiHttpStoppedException, type AiHttpScope } from './ai-http-lifecycle';
import { AiRequestStoppedError } from './ai-request-lifecycle';
import type { GenerateSqlDto } from './dto/generate-sql.dto';
import type { AutocompleteDto } from './dto/autocomplete.dto';

export function isAiHttpFatalError(error: unknown): boolean {
  return (
    (error instanceof HttpException &&
      error.getStatus() === Number(HttpStatus.SERVICE_UNAVAILABLE)) ||
    (typeof error === 'object' &&
      error !== null &&
      'aiRequestFatal' in error &&
      error.aiRequestFatal === true)
  );
}

export async function runAiLedgerOperation<T>(
  start: () => Promise<T>,
): Promise<T> {
  try {
    return await start();
  } catch (error) {
    if (error instanceof HttpException && error.getStatus() < 500) throw error;
    const unavailable = new ServiceUnavailableException(
      'AI execution storage is unavailable.',
    );
    Object.assign(unavailable, { aiRequestFatal: true });
    throw unavailable;
  }
}

export function aiExecutionMetadata(summary: AiExecutionSummary) {
  return {
    generationId: summary.generationId,
    usageCoverage: summary.usageCoverage,
    attemptCount: summary.attemptCount,
    measuredAttemptCount: summary.measuredAttemptCount,
    costCoverage: summary.costCoverage,
    // Legacy usage is exact only when every attempt was measured. Otherwise
    // expose the observed subtotal separately, without estimating missing use.
    usage: summary.usageCoverage === 'complete' ? summary.usage : null,
    observedUsage: summary.usage,
  };
}

export function createAiHttpExecution(
  scope: AiHttpScope,
  ledger: AiExecutionLedgerService,
) {
  let context: AiExecutionContext | undefined;
  let summary: AiExecutionSummary | undefined;
  let finalizing: Promise<AiExecutionSummary> | undefined;
  let abandoned = false;
  let task: AiExecutionTask;

  const failure = (error?: unknown): AiExecutionFailure => {
    const stopped = aiHttpStoppedException(error, scope.signal);
    return stopped?.getStatus() === 504
      ? 'timed_out'
      : stopped?.getStatus() === 499
        ? 'cancelled'
        : 'failed';
  };
  const finalize = async (
    result?: { provider?: string; model?: string },
    error?: unknown,
  ) => {
    if (!context) return undefined;
    if (summary) return summary;
    if (!finalizing) {
      finalizing = runAiLedgerOperation(() =>
        result
          ? context!.complete({
              provider: result.provider,
              model: result.model,
            })
          : context!.fail(failure(error)),
      );
    }
    try {
      summary = await finalizing;
      if (result && summary.outcome !== 'succeeded') {
        throw new ServiceUnavailableException(
          'AI execution was not durably completed.',
        );
      }
      return summary;
    } finally {
      finalizing = undefined;
    }
  };

  return {
    get generationId() {
      return context?.generationId;
    },
    async start(
      policy: AiAccountPolicyService,
      userId: string,
      ownedTask: AiExecutionTask,
      body: GenerateSqlDto | AutocompleteDto,
    ) {
      task = ownedTask;
      await scope.run(() => policy.assertEnabled(userId));
      await scope.run(() =>
        policy.assertConnectionEnabled(
          userId,
          body.connectionId,
          body.database,
        ),
      );
      const input = body as GenerateSqlDto & AutocompleteDto;
      // Allowlist the input envelope. Actor IDs, lifetime, generation IDs and
      // executable hooks are never taken from a body (including direct calls).
      assertAiInputBounds({
        connectionId: input.connectionId,
        database: input.database,
        prompt:
          task === 'autocomplete' && typeof input.beforeCursor === 'string'
            ? input.beforeCursor || ' '
            : input.prompt,
        afterCursor: input.afterCursor,
        image: input.image,
        document: input.document,
        context: input.context,
        model: input.model,
        mode: input.mode,
        routingMode: input.routingMode,
        history: input.history,
        providerOverride: input.providerOverride,
        disabledProviders: input.disabledProviders,
        fallbackProvider: input.fallbackProvider,
      });
      if (!ledger)
        throw new ServiceUnavailableException(
          'AI execution storage is unavailable.',
        );
      try {
        await scope.run(() =>
          runAiLedgerOperation(() =>
            ledger.begin(userId, task, {
              connectionId: input.connectionId,
              database: input.database,
              requestedModel: input.model,
              deadlineAt: scope.deadlineAt,
            }),
          ).then(async (created) => {
            // scope.run races begin against the HTTP owner. A late reservation
            // must still be failed/released, even after the handler has returned.
            if (
              abandoned ||
              scope.signal.aborted ||
              Date.now() >= scope.deadlineAt
            ) {
              if (!scope.signal.aborted)
                scope.abort(new AiRequestStoppedError('AI_REQUEST_TIMEOUT'));
              try {
                await runAiLedgerOperation(() => created.fail(failure()));
              } finally {
                await runAiLedgerOperation(() => created.release());
              }
              scope.throwIfStopped();
            }
            context = created;
            scope.capDeadline(created.deadlineAt);
            scope.throwIfStopped();
          }),
        );
      } catch (error) {
        abandoned = true;
        throw error;
      }
      const cacheScope = JSON.stringify([
        userId,
        input.connectionId,
        input.database || '',
      ]);
      return {
        signal: scope.signal,
        deadlineAt: scope.deadlineAt,
        execution: context!,
        beforeProviderRequest: policy.beforeProviderRequest(
          userId,
          input.connectionId,
          input.database,
        ),
        beforeProviderAttempt: policy.beforeProviderAttempt(
          userId,
          input.connectionId,
          input.database,
        ),
        cacheScope,
        requestScopeKey: cacheScope,
      };
    },
    async complete<
      T extends {
        provider?: string;
        model?: string;
        message?: string;
        sql?: string;
        completion?: string;
      },
    >(result: T) {
      scope.throwIfStopped();
      const valid =
        result &&
        (task === 'autocomplete'
          ? typeof result.completion === 'string'
          : typeof result.message === 'string' ||
            typeof result.sql === 'string');
      if (!valid)
        throw new InternalServerErrorException(
          'AI returned no valid terminal result.',
        );
      const completed = await finalize(result);
      scope.throwIfStopped();
      if (!completed)
        throw new ServiceUnavailableException(
          'AI execution storage is unavailable.',
        );
      return { ...result, ...aiExecutionMetadata(completed) };
    },
    fail: (error?: unknown) => finalize(undefined, error),
    async release() {
      if (context) await runAiLedgerOperation(() => context!.release());
    },
  };
}
