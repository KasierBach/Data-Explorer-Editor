export class AiRequestStoppedError extends Error {
  constructor(
    public readonly reason: 'AI_REQUEST_CANCELLED' | 'AI_REQUEST_TIMEOUT',
  ) {
    super(
      reason === 'AI_REQUEST_TIMEOUT'
        ? 'AI request deadline exceeded.'
        : 'AI request cancelled.',
    );
    this.name = reason === 'AI_REQUEST_TIMEOUT' ? 'TimeoutError' : 'AbortError';
  }
}

export function assertAiRequestActive(context: {
  signal?: AbortSignal;
  deadlineAt?: number;
}): void {
  if (context.signal?.aborted) {
    throw (
      context.signal.reason ?? new AiRequestStoppedError('AI_REQUEST_CANCELLED')
    );
  }
  if (context.deadlineAt !== undefined && Date.now() >= context.deadlineAt) {
    throw new AiRequestStoppedError('AI_REQUEST_TIMEOUT');
  }
}

export function isAiRequestStoppedError(error: unknown): boolean {
  return (
    error instanceof AiRequestStoppedError ||
    (error instanceof Error && error.name === 'AbortError')
  );
}

export function createAiRequestScope(options: {
  signal?: AbortSignal;
  timeoutMs: number;
  deadlineAt?: number;
}) {
  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0) {
    throw new RangeError(
      'AI request timeout must be a positive finite number.',
    );
  }
  if (
    options.deadlineAt !== undefined &&
    !Number.isFinite(options.deadlineAt)
  ) {
    throw new RangeError('AI request deadline must be finite.');
  }
  const controller = new AbortController();
  const deadlineAt = Math.min(
    options.deadlineAt ?? Infinity,
    Date.now() + options.timeoutMs,
  );
  const cancel = () =>
    controller.abort(
      options.signal?.reason ??
        new AiRequestStoppedError('AI_REQUEST_CANCELLED'),
    );
  if (options.signal?.aborted) cancel();
  else options.signal?.addEventListener('abort', cancel, { once: true });

  let timer: ReturnType<typeof setTimeout> | undefined;
  if (deadlineAt <= Date.now())
    controller.abort(new AiRequestStoppedError('AI_REQUEST_TIMEOUT'));
  else
    timer = setTimeout(
      () => controller.abort(new AiRequestStoppedError('AI_REQUEST_TIMEOUT')),
      deadlineAt - Date.now(),
    );
  return {
    signal: controller.signal,
    deadlineAt,
    abort: (
      reason: unknown = new AiRequestStoppedError('AI_REQUEST_CANCELLED'),
    ) => controller.abort(reason),
    dispose: () => {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', cancel);
    },
  };
}

export async function waitForAiResult<T>(
  promise: Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  if (!signal) return promise;
  let onAbort: (() => void) | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        onAbort = () =>
          reject(
            signal.reason instanceof Error
              ? signal.reason
              : new AiRequestStoppedError('AI_REQUEST_CANCELLED'),
          );
        if (signal.aborted) onAbort();
        else signal.addEventListener('abort', onAbort, { once: true });
      }),
    ]);
  } finally {
    if (onAbort) signal.removeEventListener('abort', onAbort);
  }
}
