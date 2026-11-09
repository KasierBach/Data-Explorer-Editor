import {
  AI_RETRY_MAX_WAIT_MS,
  AiRetryPolicyError,
  aiRetryDelayMs,
  isAiProviderTerminalError,
  parseAiRetryAfter,
} from './ai-retry-policy';

const now = Date.parse('Mon, 09 Nov 2026 10:00:00 GMT');

describe('AI retry policy', () => {
  it.each([
    ['0', 0],
    ['2', 2000],
    [' 003 ', 3000],
    ['Mon, 09 Nov 2026 10:00:02 GMT', 2000],
    ['Mon, 09 Nov 2026 09:59:59 GMT', 0],
  ])(
    'parses valid Retry-After %s without inventing a delay',
    (value, expected) => {
      expect(parseAiRetryAfter(value, now)).toBe(expected);
    },
  );

  it.each([
    undefined,
    null,
    '',
    '-1',
    '1.5',
    '1e3',
    'NaN',
    'Infinity',
    'tomorrow',
    '2026-11-09',
    'Tue, 09 Nov 2026 10:00:00 GMT',
    'Mon, 32 Nov 2026 10:00:00 GMT',
  ])('ignores malformed Retry-After %j', (value) => {
    expect(parseAiRetryAfter(value, now)).toBeUndefined();
  });

  it('preserves excessive valid hints so they cannot turn into an early retry', () => {
    expect(parseAiRetryAfter('9'.repeat(100), now)).toBe(
      Number.MAX_SAFE_INTEGER,
    );
    expect(() =>
      aiRetryDelayMs(
        0,
        { retryAfterMs: parseAiRetryAfter('31', now) },
        undefined,
        now,
        0,
      ),
    ).toThrow(AiRetryPolicyError);
    expect(() =>
      aiRetryDelayMs(
        0,
        {
          retryAfterMs: parseAiRetryAfter('Tue, 10 Nov 2026 10:00:00 GMT', now),
        },
        undefined,
        now,
        0,
      ),
    ).toThrow(AiRetryPolicyError);
  });

  it.each([0, 1, 2, 30])(
    'applies capped full jitter at attempt %s',
    (attempt) => {
      const cap = Math.min(AI_RETRY_MAX_WAIT_MS, 250 * 2 ** attempt);
      expect(aiRetryDelayMs(attempt, undefined, undefined, now, 0)).toBe(0);
      expect(aiRetryDelayMs(attempt, undefined, undefined, now, 0.5)).toBe(
        Math.floor(cap / 2),
      );
      expect(aiRetryDelayMs(attempt, undefined, undefined, now, 1)).toBe(cap);
    },
  );

  it('never jitters below a valid provider minimum', () => {
    expect(aiRetryDelayMs(0, { retryAfterMs: 2000 }, now + 5000, now, 0)).toBe(
      2000,
    );
    expect(aiRetryDelayMs(0, { retryAfterMs: 1 }, now + 5000, now, 0.5)).toBe(
      125,
    );
  });

  it.each([1000, 999, 0])(
    'fails fast when the required wait cannot fit the %s ms remaining deadline',
    (remaining) => {
      expect(() =>
        aiRetryDelayMs(0, { retryAfterMs: 1000 }, now + remaining, now, 0),
      ).toThrow('later request');
    },
  );

  it('allows the wait ceiling only when the remaining deadline is longer', () => {
    expect(
      aiRetryDelayMs(
        0,
        { retryAfterMs: AI_RETRY_MAX_WAIT_MS },
        now + AI_RETRY_MAX_WAIT_MS + 1,
        now,
        0,
      ),
    ).toBe(AI_RETRY_MAX_WAIT_MS);
    expect(() =>
      aiRetryDelayMs(
        0,
        { retryAfterMs: AI_RETRY_MAX_WAIT_MS + 1 },
        now + 90_000,
        now,
        0,
      ),
    ).toThrow(AiRetryPolicyError);
  });

  it.each([
    'GEMINI_BLOCKED',
    'GEMINI_TRUNCATED',
    'GEMINI_INVALID_REQUEST',
    'AI_PROVIDER_REFUSED',
    'UNSAFE_URL',
    'UNSAFE_ADDRESS',
    'LIMIT_EXCEEDED',
    'INVALID_REQUEST',
    'ABORTED',
  ])(
    'marks normalized %s terminal even if it resembles a transient error',
    (code) => {
      expect(
        isAiProviderTerminalError(
          Object.assign(new Error('network unavailable'), {
            code,
            status: 503,
          }),
        ),
      ).toBe(true);
    },
  );

  it.each([400, 401, 403, 413, 415, 422])(
    'treats HTTP %s as terminal instead of provider unavailability',
    (status) => {
      expect(isAiProviderTerminalError({ status })).toBe(true);
      expect(isAiProviderTerminalError({ response: { status } })).toBe(true);
    },
  );

  it('distinguishes compatibility fallback from auth/denial and retry-deferred intent', () => {
    expect(
      isAiProviderTerminalError({ status: 400, schemaUnsupported: true }),
    ).toBe(false);
    expect(
      isAiProviderTerminalError({ status: 401, schemaUnsupported: true }),
    ).toBe(true);
    expect(
      isAiProviderTerminalError({ status: 403, schemaUnsupported: true }),
    ).toBe(true);
    expect(isAiProviderTerminalError({ status: 404 })).toBe(false);
    expect(isAiProviderTerminalError({ status: 503 })).toBe(false);
    expect(
      isAiProviderTerminalError(new AiRetryPolicyError('AI_RETRY_DEFERRED')),
    ).toBe(true);
    expect(isAiProviderTerminalError({ aiRequestFatal: true })).toBe(true);
  });
});
