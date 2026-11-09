import { EventEmitter } from 'events';
import type { Request, Response } from 'express';
import {
  aiHttpStoppedException,
  createAiHttpScope,
  writeAiSse,
} from './ai-http-lifecycle';
import { AiRequestStoppedError } from './ai-request-lifecycle';
import type { StreamEvent } from './ai.types';

function transport() {
  const res = Object.assign(new EventEmitter(), {
    destroyed: false,
    writableEnded: false,
    writableFinished: false,
    write: jest.fn((_frame: string) => true),
    end: jest.fn(() => {
      res.writableEnded = true;
      res.emit('close');
    }),
  });
  const req = Object.assign(new EventEmitter(), { aborted: false, res });
  const scope = createAiHttpScope(
    req as unknown as Request,
    res as unknown as Response,
    100,
  );
  return { req, res, scope };
}

function iterator(events: StreamEvent[]) {
  let index = 0;
  const next = jest.fn(
    async (): Promise<IteratorResult<StreamEvent>> =>
      index < events.length
        ? { done: false, value: events[index++] }
        : { done: true, value: undefined },
  );
  const stream = {
    next,
    return: jest.fn(async () => ({ done: true as const, value: undefined })),
    [Symbol.asyncIterator]() {
      return this;
    },
  };
  return stream;
}

async function flush() {
  for (let index = 0; index < 20; index += 1) await Promise.resolve();
}

describe('AI HTTP request lifecycle', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('ignores normal request close, aborts on unexpected response close and removes listeners', async () => {
    const { req, res, scope } = transport();
    req.emit('close');
    expect(scope.signal.aborted).toBe(false);
    const pending = scope.run(() => new Promise<void>(() => {}));
    const rejected = expect(pending).rejects.toMatchObject({
      reason: 'AI_REQUEST_CANCELLED',
    });
    res.emit('close');
    await rejected;
    const dispatch = jest.fn();
    await expect(scope.run(dispatch)).rejects.toMatchObject({
      reason: 'AI_REQUEST_CANCELLED',
    });
    expect(dispatch).not.toHaveBeenCalled();
    scope.dispose();
    expect(req.listenerCount('aborted')).toBe(0);
    expect(res.listenerCount('close')).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('does not treat normal response completion as cancellation', () => {
    const { res, scope } = transport();
    res.end();
    expect(scope.signal.aborted).toBe(false);
    expect(scope.isResponseOpen()).toBe(false);
    scope.dispose();
  });

  it('uses a finite total deadline and a safe typed HTTP timeout', async () => {
    const { scope } = transport();
    const pending = scope.run(() => new Promise<void>(() => {}));
    const rejected = expect(pending).rejects.toMatchObject({
      reason: 'AI_REQUEST_TIMEOUT',
    });
    await jest.advanceTimersByTimeAsync(100);
    await rejected;
    const exception = aiHttpStoppedException(
      new Error('sk-provider-secret'),
      scope.signal,
    );
    expect(exception?.getStatus()).toBe(504);
    expect(exception?.getResponse()).toEqual({
      reason: 'AI_REQUEST_TIMEOUT',
      message: 'AI request deadline exceeded.',
    });
    scope.dispose();
  });

  it('sanitizes a foreign abort reason and prevents pre-aborted dispatch', async () => {
    const { scope } = transport();
    scope.abort(new Error('secret credentials'));
    const dispatch = jest.fn();
    await expect(scope.run(dispatch)).rejects.toMatchObject({
      reason: 'AI_REQUEST_CANCELLED',
    });
    expect(dispatch).not.toHaveBeenCalled();
    const exception = aiHttpStoppedException(scope.signal.reason, scope.signal);
    expect(exception?.getStatus()).toBe(499);
    expect(JSON.stringify(exception?.getResponse())).not.toContain('secret');
    scope.dispose();
  });

  it('accepts minimal request mocks without event methods', async () => {
    const scope = createAiHttpScope({} as Request);
    await expect(scope.run(() => Promise.resolve('ok'))).resolves.toBe('ok');
    scope.dispose();
    expect(jest.getTimerCount()).toBe(0);
  });
});

describe('AI SSE writer', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it.each(['done', 'error'] as const)(
    'stops after terminal %s, cleans the iterator and finalizes once',
    async (type) => {
      const { res, scope } = transport();
      const event: StreamEvent =
        type === 'done'
          ? {
              type,
              data: {
                message: 'SQL',
                provider: 'groq',
                model: 'model',
                routingMode: 'fast',
              },
            }
          : { type, text: 'provider secret sk-hidden' };
      const stream = iterator([
        event,
        { type: 'chunk', text: 'must not arrive' },
      ]);
      await writeAiSse(res as unknown as Response, scope, () => stream);
      expect(stream.next).toHaveBeenCalledTimes(1);
      expect(stream.return).toHaveBeenCalledTimes(1);
      expect(res.write).toHaveBeenCalledTimes(2);
      expect(res.write).toHaveBeenLastCalledWith('data: [DONE]\n\n');
      expect(res.end).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(res.write.mock.calls)).not.toContain(
        'must not arrive',
      );
      expect(JSON.stringify(res.write.mock.calls)).not.toContain('sk-hidden');
      expect(scope.signal.aborted).toBe(false);
      scope.dispose();
    },
  );

  it('waits for drain before pulling another event', async () => {
    const { res, scope } = transport();
    res.write.mockReturnValueOnce(false);
    const stream = iterator([
      { type: 'chunk', text: 'first' },
      {
        type: 'done',
        data: {
          message: 'ok',
          provider: 'groq',
          model: 'model',
          routingMode: 'fast',
        },
      },
    ]);
    const running = writeAiSse(res as unknown as Response, scope, () => stream);
    await flush();
    expect(stream.next).toHaveBeenCalledTimes(1);
    expect(res.listenerCount('drain')).toBe(1);
    expect(res.end).not.toHaveBeenCalled();
    res.emit('drain');
    await running;
    expect(stream.next).toHaveBeenCalledTimes(2);
    expect(res.listenerCount('drain')).toBe(0);
    expect(res.end).toHaveBeenCalledTimes(1);
    scope.dispose();
  });

  it('abort during backpressure prevents further pulls, writes or finalization on a closed response', async () => {
    const { res, scope } = transport();
    res.write.mockReturnValue(false);
    const stream = iterator([{ type: 'chunk', text: 'first' }]);
    const running = writeAiSse(res as unknown as Response, scope, () => stream);
    await flush();
    res.emit('close');
    await running;
    res.emit('drain');
    expect(stream.next).toHaveBeenCalledTimes(1);
    expect(stream.return).toHaveBeenCalledTimes(1);
    expect(res.write).toHaveBeenCalledTimes(1);
    expect(res.end).not.toHaveBeenCalled();
    expect(res.listenerCount('drain')).toBe(0);
    scope.dispose();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('bounds a never-settling next and cleanup by the same total deadline', async () => {
    const { res, scope } = transport();
    const stream = iterator([]);
    stream.next.mockImplementation(() => new Promise(() => {}));
    stream.return.mockImplementation(() => new Promise(() => {}));
    const running = writeAiSse(res as unknown as Response, scope, () => stream);
    await flush();
    await jest.advanceTimersByTimeAsync(100);
    await running;
    expect(scope.signal.reason).toBeInstanceOf(AiRequestStoppedError);
    expect(scope.signal.reason.reason).toBe('AI_REQUEST_TIMEOUT');
    expect(res.write).not.toHaveBeenCalled();
    expect(res.end).toHaveBeenCalledTimes(1);
    expect(stream.return).toHaveBeenCalledTimes(1);
    scope.dispose();
  });

  it('does not restart the total deadline for active chunks or stalled drain', async () => {
    const { res, scope } = transport();
    res.write.mockReturnValueOnce(false);
    const stream = iterator([{ type: 'chunk', text: 'first' }]);
    const running = writeAiSse(res as unknown as Response, scope, () => stream);
    await flush();
    await jest.advanceTimersByTimeAsync(100);
    await running;
    expect(stream.next).toHaveBeenCalledTimes(1);
    expect(res.write).toHaveBeenCalledTimes(1);
    expect(res.listenerCount('drain')).toBe(0);
    scope.dispose();
  });

  it('never dispatches or writes for an already destroyed response', async () => {
    const { res, scope } = transport();
    res.destroyed = true;
    const start = jest.fn(() => iterator([]));
    await writeAiSse(res as unknown as Response, scope, start);
    expect(start).not.toHaveBeenCalled();
    expect(res.write).not.toHaveBeenCalled();
    expect(res.end).not.toHaveBeenCalled();
    scope.dispose();
  });

  it('returns a safe typed stopped error from a provider, without free-form provider text', async () => {
    const { res, scope } = transport();
    const stream = iterator([]);
    stream.next.mockRejectedValue(
      new AiRequestStoppedError('AI_REQUEST_TIMEOUT'),
    );
    await writeAiSse(res as unknown as Response, scope, () => stream);
    expect(res.write).toHaveBeenCalledWith(
      'data: {"type":"error","reason":"AI_REQUEST_TIMEOUT","text":"AI request deadline exceeded."}\n\n',
    );
    expect(res.end).toHaveBeenCalledTimes(1);
    scope.dispose();
  });
});
