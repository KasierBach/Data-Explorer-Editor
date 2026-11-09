import { HttpException, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AI_CONSTANTS } from './ai.constants';
import { isAiDisabledError } from './ai-account-policy.service';
import {
  AiRequestStoppedError,
  createAiRequestScope,
  isAiRequestStoppedError,
  waitForAiResult,
} from './ai-request-lifecycle';
import type { StreamEvent } from './ai.types';

function stoppedError(error: unknown, signal?: AbortSignal) {
  const reason = signal?.aborted ? signal.reason : error;
  if (!signal?.aborted && !isAiRequestStoppedError(reason)) {
    return undefined;
  }
  return new AiRequestStoppedError(
    reason instanceof AiRequestStoppedError &&
      reason.reason === 'AI_REQUEST_TIMEOUT'
      ? 'AI_REQUEST_TIMEOUT'
      : 'AI_REQUEST_CANCELLED',
  );
}

export function aiHttpStoppedException(error: unknown, signal: AbortSignal) {
  const stopped = stoppedError(error, signal);
  return stopped
    ? new HttpException(
        { reason: stopped.reason, message: stopped.message },
        stopped.reason === 'AI_REQUEST_TIMEOUT'
          ? HttpStatus.GATEWAY_TIMEOUT
          : 499,
      )
    : undefined;
}

export function createAiHttpScope(
  req: Request,
  res: Response | undefined = req.res,
  timeoutMs: number = AI_CONSTANTS.DEFAULT_PROVIDER_TIMEOUT_MS,
) {
  const scope = createAiRequestScope({ timeoutMs });
  let responseClosed = false;
  const onAborted = () => scope.abort();
  const onClose = () => {
    responseClosed = true;
    if (!res?.writableEnded && !res?.writableFinished) scope.abort();
  };
  req.on?.('aborted', onAborted);
  res?.on?.('close', onClose);
  if (req.aborted || (res?.destroyed && !res.writableEnded)) scope.abort();

  let deadlineAt = scope.deadlineAt;
  let deadlineTimer: ReturnType<typeof setTimeout> | undefined;
  const throwIfStopped = () => {
    if (!scope.signal.aborted && Date.now() >= deadlineAt) {
      scope.abort(new AiRequestStoppedError('AI_REQUEST_TIMEOUT'));
    }
    if (scope.signal.aborted)
      throw (
        stoppedError(undefined, scope.signal) ??
        new AiRequestStoppedError('AI_REQUEST_CANCELLED')
      );
  };

  return {
    ...scope,
    get deadlineAt() {
      return deadlineAt;
    },
    capDeadline(cap: number) {
      if (!Number.isFinite(cap))
        throw new RangeError('AI execution deadline must be finite.');
      deadlineAt = Math.min(deadlineAt, cap);
      clearTimeout(deadlineTimer);
      if (deadlineAt <= Date.now())
        scope.abort(new AiRequestStoppedError('AI_REQUEST_TIMEOUT'));
      else
        deadlineTimer = setTimeout(
          () => scope.abort(new AiRequestStoppedError('AI_REQUEST_TIMEOUT')),
          deadlineAt - Date.now(),
        );
    },
    throwIfStopped,
    isResponseOpen: () =>
      !responseClosed &&
      !res?.destroyed &&
      !res?.writableEnded &&
      !res?.writableFinished,
    async run<T>(start: () => Promise<T> | T): Promise<T> {
      try {
        throwIfStopped();
        const result = await waitForAiResult(
          Promise.resolve(start()),
          scope.signal,
        );
        throwIfStopped();
        return result;
      } catch (error) {
        throw stoppedError(error, scope.signal) ?? error;
      }
    },
    dispose() {
      clearTimeout(deadlineTimer);
      req.removeListener?.('aborted', onAborted);
      res?.removeListener?.('close', onClose);
      scope.dispose();
    },
  };
}

export type AiHttpScope = ReturnType<typeof createAiHttpScope>;

function safeStreamError(
  error: unknown,
  signal: AbortSignal,
  reason?: Extract<StreamEvent, { type: 'error' }>['reason'],
): Extract<StreamEvent, { type: 'error' }> {
  const stopped =
    stoppedError(error, signal) ??
    (reason === 'AI_REQUEST_CANCELLED' || reason === 'AI_REQUEST_TIMEOUT'
      ? new AiRequestStoppedError(reason)
      : undefined);
  if (stopped) {
    return { type: 'error', reason: stopped.reason, text: stopped.message };
  }
  if (reason === 'AI_DISABLED' || isAiDisabledError(error)) {
    return { type: 'error', reason: 'AI_DISABLED', text: 'AI is disabled' };
  }
  return { type: 'error', text: 'AI generation failed.' };
}

export async function writeAiSse(
  res: Response,
  scope: AiHttpScope,
  start: () => AsyncIterable<StreamEvent> | Promise<AsyncIterable<StreamEvent>>,
  lifecycle?: {
    complete(
      data: Extract<StreamEvent, { type: 'done' }>['data'],
    ): Promise<unknown>;
    fail(error?: unknown): Promise<unknown>;
  },
) {
  let iterator: AsyncIterator<StreamEvent> | undefined;
  let terminal = false;
  const write = async (frame: string) => {
    scope.throwIfStopped();
    if (!scope.isResponseOpen()) {
      scope.abort();
      scope.throwIfStopped();
    }
    if (res.write(frame) !== false) return;
    let onDrain: (() => void) | undefined;
    try {
      await scope.run(
        () =>
          new Promise<void>((resolve) => {
            onDrain = resolve;
            res.on?.('drain', onDrain);
          }),
      );
    } finally {
      if (onDrain) res.removeListener?.('drain', onDrain);
    }
  };

  try {
    scope.throwIfStopped();
    if (!scope.isResponseOpen()) {
      scope.abort();
      scope.throwIfStopped();
    }
    const stream = await scope.run(start);
    iterator = stream[Symbol.asyncIterator]();
    while (true) {
      const step = await scope.run(() => iterator!.next());
      if (step.done) break;
      const event = step.value;
      let output: unknown = event;
      if (event.type === 'done' && lifecycle) {
        // Complete durable accounting before allowing a success frame out.
        output = { ...event, data: await lifecycle.complete(event.data) };
      } else if (event.type === 'error') {
        const error = Object.assign(new Error('AI generation failed.'), {
          aiRequestFatal: true,
          reason: event.reason,
        });
        if (lifecycle) {
          await lifecycle.fail(
            event.reason === 'AI_REQUEST_CANCELLED' ||
              event.reason === 'AI_REQUEST_TIMEOUT'
              ? new AiRequestStoppedError(event.reason)
              : error,
          );
        }
        output = safeStreamError(undefined, scope.signal, event.reason);
      }
      await write(`data: ${JSON.stringify(output)}\n\n`);
      terminal = event.type === 'done' || event.type === 'error';
      if (terminal) break;
    }
    if (!terminal && lifecycle)
      throw new Error('AI stream ended without a terminal result.');
    await write('data: [DONE]\n\n');
    terminal = true;
  } catch (error) {
    let fatal = error;
    try {
      await lifecycle?.fail(error);
    } catch (durabilityError) {
      fatal = durabilityError;
    }
    if (!terminal && !scope.signal.aborted && scope.isResponseOpen()) {
      terminal = true;
      try {
        await write(
          `data: ${JSON.stringify(safeStreamError(fatal, scope.signal))}\n\n`,
        );
        await write('data: [DONE]\n\n');
      } catch {
        scope.abort();
      }
    }
    if (
      fatal instanceof HttpException &&
      fatal.getStatus() === Number(HttpStatus.SERVICE_UNAVAILABLE)
    )
      throw fatal;
  } finally {
    try {
      if (scope.isResponseOpen()) res.end();
    } finally {
      // Async generators may queue return() behind a pending next(). Do not
      // let cleanup outlive the same total request deadline or disconnect.
      try {
        if (iterator?.return) {
          await waitForAiResult(
            Promise.resolve(iterator.return()),
            scope.signal,
          );
        }
      } catch {
        // The owner has stopped, or the provider's cleanup failed.
      }
    }
  }
}
