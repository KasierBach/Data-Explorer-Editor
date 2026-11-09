import { AI_CONSTANTS } from './ai.constants';

export const AI_RETRY_MAX_WAIT_MS = 30_000;

export class AiRetryPolicyError extends Error {
  readonly aiRequestFatal = true;

  constructor(
    readonly code:
      | 'AI_RETRY_DEFERRED'
      | 'AI_ATTEMPT_BUDGET_EXHAUSTED'
      | 'AI_PROVIDER_REFUSED',
  ) {
    super(
      code === 'AI_RETRY_DEFERRED'
        ? 'Provider retry requires a later request.'
        : code === 'AI_PROVIDER_REFUSED'
          ? 'The provider did not return an allowed answer.'
          : 'AI provider attempt budget is exhausted.',
    );
    this.name = 'AiRetryPolicyError';
  }
}

/** Excessive valid hints remain excessive; they never become a quick retry. */
export function parseAiRetryAfter(
  value: string | null | undefined,
  now = Date.now(),
): number | undefined {
  if (typeof value !== 'string' || !Number.isFinite(now)) return undefined;
  const raw = value.trim();
  if (/^\d+$/.test(raw)) {
    const seconds = Number(raw);
    return !Number.isSafeInteger(seconds) ||
      seconds > Number.MAX_SAFE_INTEGER / 1000
      ? Number.MAX_SAFE_INTEGER
      : seconds * 1000;
  }
  if (
    !/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(
      raw,
    )
  )
    return undefined;
  const date = Date.parse(raw);
  if (!Number.isFinite(date) || new Date(date).toUTCString() !== raw)
    return undefined;
  return Math.max(0, date - now);
}

export function aiRetryDelayMs(
  attempt: number,
  error: unknown,
  deadlineAt?: number,
  now = Date.now(),
  random = Math.random(),
): number {
  const cap = Math.min(
    AI_RETRY_MAX_WAIT_MS,
    AI_CONSTANTS.OPENAI_COMPATIBLE_RETRY_BASE_DELAY_MS *
      2 ** Math.max(0, Math.min(attempt, 30)),
  );
  const jitter = Math.floor(Math.max(0, Math.min(random, 1)) * cap);
  const hint =
    error &&
    typeof error === 'object' &&
    'retryAfterMs' in error &&
    typeof error.retryAfterMs === 'number'
      ? error.retryAfterMs
      : 0;
  if (!Number.isFinite(hint) || hint < 0)
    throw new AiRetryPolicyError('AI_RETRY_DEFERRED');
  const delay = Math.max(jitter, hint);
  if (
    delay > AI_RETRY_MAX_WAIT_MS ||
    (deadlineAt !== undefined && delay >= deadlineAt - now)
  )
    throw new AiRetryPolicyError('AI_RETRY_DEFERRED');
  return delay;
}

/** Terminal intent is separate from a provider's infrastructure availability. */
export function isAiProviderTerminalError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  if ('aiRequestFatal' in error && error.aiRequestFatal === true) return true;
  const code =
    'code' in error && typeof error.code === 'string'
      ? error.code.toUpperCase()
      : '';
  if (
    [
      'AI_PROVIDER_REFUSED',
      'AI_RETRY_DEFERRED',
      'AI_ATTEMPT_BUDGET_EXHAUSTED',
      'GEMINI_BLOCKED',
      'GEMINI_TRUNCATED',
      'GEMINI_INVALID_REQUEST',
      'UNSAFE_URL',
      'UNSAFE_ADDRESS',
      'LIMIT_EXCEEDED',
      'INVALID_REQUEST',
      'ABORTED',
      'CANCELLED',
    ].includes(code)
  )
    return true;
  const status =
    'status' in error && typeof error.status === 'number'
      ? error.status
      : 'response' in error &&
          error.response &&
          typeof error.response === 'object' &&
          'status' in error.response &&
          typeof error.response.status === 'number'
        ? error.response.status
        : 'getStatus' in error && typeof error.getStatus === 'function'
          ? error.getStatus()
          : undefined;
  const compatible =
    status !== undefined &&
    [400, 404, 415, 422].includes(status) &&
    'schemaUnsupported' in error &&
    error.schemaUnsupported === true;
  return (
    status !== undefined &&
    [400, 401, 403, 413, 415, 422].includes(status) &&
    !compatible
  );
}
