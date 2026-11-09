import { EventEmitter } from 'events';
import { ServiceUnavailableException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AiAccountPolicyService } from './ai-account-policy.service';
import {
  AiExecutionLedgerService,
  type AiExecutionSummary,
} from './ai-execution-ledger.service';
import { createAiHttpExecution } from './ai-http-execution';
import { createAiHttpScope, writeAiSse } from './ai-http-lifecycle';
import type { StreamEvent } from './ai.types';

function fixture() {
  const summary: AiExecutionSummary = {
    generationId: 'server-owned',
    outcome: 'succeeded',
    provider: 'groq',
    model: 'model',
    attemptCount: 2,
    measuredAttemptCount: 1,
    usageCoverage: 'partial',
    usage: { promptTokens: 12, completionTokens: null, totalTokens: null },
    costCoverage: 'unavailable',
  };
  const context = {
    generationId: summary.generationId,
    deadlineAt: Date.now() + 100,
    beforeAttempt: jest.fn(),
    complete: jest.fn().mockResolvedValue(summary),
    fail: jest
      .fn()
      .mockImplementation(async (outcome) => ({ ...summary, outcome })),
    release: jest.fn().mockResolvedValue(undefined),
  };
  const ledger = { begin: jest.fn().mockResolvedValue(context) };
  const policy = {
    assertEnabled: jest.fn().mockResolvedValue(undefined),
    assertConnectionEnabled: jest.fn().mockResolvedValue(undefined),
    beforeProviderRequest: jest.fn(() => jest.fn()),
    beforeProviderAttempt: jest.fn(() => jest.fn()),
  };
  const res = Object.assign(new EventEmitter(), {
    destroyed: false,
    writableEnded: false,
    writableFinished: false,
    write: jest.fn(() => true),
    end: jest.fn(() => {
      res.writableEnded = true;
      res.emit('close');
    }),
  });
  const req = Object.assign(new EventEmitter(), { res, aborted: false });
  const scope = createAiHttpScope(
    req as unknown as Request,
    res as unknown as Response,
    100,
  );
  const execution = createAiHttpExecution(
    scope,
    ledger as unknown as AiExecutionLedgerService,
  );
  const start = () =>
    execution.start(
      policy as unknown as AiAccountPolicyService,
      'actor',
      'chat',
      {
        connectionId: 'connection',
        database: 'database',
        prompt: 'hello',
      },
    );
  return {
    summary,
    context,
    ledger,
    policy,
    res,
    req,
    scope,
    execution,
    start,
  };
}

describe('AI HTTP execution accounting', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('reserves after account and connection checks and before any returned capability', async () => {
    const f = fixture();
    const request = await f.start();
    expect(f.policy.assertEnabled.mock.invocationCallOrder[0]).toBeLessThan(
      f.policy.assertConnectionEnabled.mock.invocationCallOrder[0],
    );
    expect(
      f.policy.assertConnectionEnabled.mock.invocationCallOrder[0],
    ).toBeLessThan(f.ledger.begin.mock.invocationCallOrder[0]);
    expect(request.execution).toBe(f.context);
    expect(request.cacheScope).toBe(
      JSON.stringify(['actor', 'connection', 'database']),
    );
    await f.execution.fail();
    await f.execution.release();
    f.scope.dispose();
  });

  it('caps the HTTP owner at the earlier ledger deadline and never extends it', async () => {
    const f = fixture();
    f.context.deadlineAt = Date.now() + 20;
    const request = await f.start();
    expect(request.deadlineAt).toBe(f.context.deadlineAt);
    f.scope.capDeadline(Date.now() + 1000);
    expect(f.scope.deadlineAt).toBe(f.context.deadlineAt);
    await jest.advanceTimersByTimeAsync(20);
    await f.execution.fail();
    expect(f.context.fail).toHaveBeenCalledWith('timed_out');
    await f.execution.release();
    f.scope.dispose();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('exposes partial observed subtotals without presenting them as full usage', async () => {
    const f = fixture();
    await f.start();
    const response = await f.execution.complete({
      message: 'ok',
      usage: { promptTokens: 999, completionTokens: 999, totalTokens: 1998 },
    });
    expect(response).toMatchObject({
      generationId: 'server-owned',
      usageCoverage: 'partial',
      attemptCount: 2,
      measuredAttemptCount: 1,
      costCoverage: 'unavailable',
      usage: null,
      observedUsage: f.summary.usage,
    });
    expect(f.context.complete).toHaveBeenCalledWith({
      provider: undefined,
      model: undefined,
    });
    await f.execution.release();
    f.scope.dispose();
  });

  it('rejects invalid terminal results rather than completing accounting', async () => {
    const f = fixture();
    await f.start();
    await expect(f.execution.complete({})).rejects.toMatchObject({
      status: 500,
    });
    await f.execution.fail();
    expect(f.context.complete).not.toHaveBeenCalled();
    expect(f.context.fail).toHaveBeenCalledWith('failed');
    await f.execution.release();
    f.scope.dispose();
  });

  it('fails closed when the ledger is absent', async () => {
    const f = fixture();
    const execution = createAiHttpExecution(
      f.scope,
      undefined as unknown as AiExecutionLedgerService,
    );
    await expect(
      execution.start(
        f.policy as unknown as AiAccountPolicyService,
        'actor',
        'chat',
        { connectionId: 'connection', prompt: 'hello' },
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(f.ledger.begin).not.toHaveBeenCalled();
    f.scope.dispose();
  });

  it('validates aggregate input before spending admission budget', async () => {
    const f = fixture();
    await expect(
      f.execution.start(
        f.policy as unknown as AiAccountPolicyService,
        'actor',
        'chat',
        {
          connectionId: 'connection',
          prompt: 'hello',
          context: 'x'.repeat(10 * 1024 * 1024),
        },
      ),
    ).rejects.toMatchObject({ status: 413 });
    expect(f.ledger.begin).not.toHaveBeenCalled();
    f.scope.dispose();
  });

  it('does not emit SSE success until durable completion settles', async () => {
    const f = fixture();
    await f.start();
    let resolve!: (summary: AiExecutionSummary) => void;
    f.context.complete.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const running = writeAiSse(
      f.res as unknown as Response,
      f.scope,
      async function* () {
        yield {
          type: 'done',
          data: {
            message: 'ok',
            provider: 'groq',
            model: 'model',
            routingMode: 'fast',
          },
        } as StreamEvent;
      },
      f.execution,
    );
    for (let index = 0; index < 30; index++) await Promise.resolve();
    expect(f.context.complete).toHaveBeenCalledTimes(1);
    expect(f.res.write).not.toHaveBeenCalled();
    resolve(f.summary);
    await running;
    expect(f.res.write).toHaveBeenCalledWith(
      expect.stringContaining('"generationId":"server-owned"'),
    );
    await f.execution.release();
    f.scope.dispose();
  });

  it('treats a stream ending without a done/error event as failed, never succeeded', async () => {
    const f = fixture();
    await f.start();
    await writeAiSse(
      f.res as unknown as Response,
      f.scope,
      async function* () {
        yield { type: 'chunk', text: 'partial' } as StreamEvent;
      },
      f.execution,
    );
    expect(f.context.complete).not.toHaveBeenCalled();
    expect(f.context.fail).toHaveBeenCalledWith('failed');
    expect(f.res.write).toHaveBeenCalledWith(
      'data: {"type":"error","text":"AI generation failed."}\n\n',
    );
    await f.execution.release();
    f.scope.dispose();
  });

  it('propagates failure and release durability errors as 503', async () => {
    const f = fixture();
    await f.start();
    f.context.fail.mockRejectedValueOnce(new Error('storage secret'));
    await expect(f.execution.fail()).rejects.toMatchObject({ status: 503 });
    f.context.release.mockRejectedValueOnce(new Error('storage secret'));
    await expect(f.execution.release()).rejects.toMatchObject({ status: 503 });
    f.scope.dispose();
  });
});
