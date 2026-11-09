import {
  AiRequestStoppedError,
  assertAiRequestActive,
  createAiRequestScope,
  waitForAiResult,
} from './ai-request-lifecycle';

describe('AI request lifecycle', () => {
  afterEach(() => jest.useRealTimers());

  it('inherits cancellation and disposes the parent listener and deadline', () => {
    jest.useFakeTimers();
    const parent = new AbortController();
    const remove = jest.spyOn(parent.signal, 'removeEventListener');
    const scope = createAiRequestScope({
      signal: parent.signal,
      timeoutMs: 90_000,
    });
    parent.abort(new AiRequestStoppedError('AI_REQUEST_CANCELLED'));
    expect(() => assertAiRequestActive(scope)).toThrow('cancelled');
    scope.dispose();
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
    expect(jest.getTimerCount()).toBe(0);
  });

  it('does not restart an inherited total deadline for a later attempt', () => {
    jest.useFakeTimers();
    const first = createAiRequestScope({ timeoutMs: 100 });
    jest.advanceTimersByTime(60);
    const second = createAiRequestScope({
      timeoutMs: 100,
      deadlineAt: first.deadlineAt,
    });
    jest.advanceTimersByTime(40);
    expect(first.signal.aborted).toBe(true);
    expect(second.signal.aborted).toBe(true);
    first.dispose();
    second.dispose();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('rejects pending results when cancelled even if the transport ignores abort', async () => {
    const controller = new AbortController();
    const result = waitForAiResult(
      new Promise<string>(() => undefined),
      controller.signal,
    );
    controller.abort(new AiRequestStoppedError('AI_REQUEST_CANCELLED'));
    await expect(result).rejects.toMatchObject({
      reason: 'AI_REQUEST_CANCELLED',
    });
  });

  it('rejects already expired deadlines before an operation begins', () => {
    const scope = createAiRequestScope({
      timeoutMs: 100,
      deadlineAt: Date.now() - 1,
    });
    expect(scope.signal.aborted).toBe(true);
    expect(() => assertAiRequestActive(scope)).toThrow('deadline');
    scope.dispose();
  });

  it.each([NaN, Infinity, 0, -1])('rejects invalid timeout %s', (timeoutMs) => {
    expect(() => createAiRequestScope({ timeoutMs })).toThrow(RangeError);
  });
});
