import { AiChatCompletionService } from './ai.chat-completion.service';
import { AiCircuitBreakerService } from './ai.circuit-breaker.service';
import { AiService } from './ai.service';
import { AiGeminiProviderError } from './ai-gemini-transport';
import type {
  ChatParams,
  ChatResult,
  ProviderPlan,
  StreamEvent,
} from './ai.types';
import { AiRequestStoppedError } from './ai-request-lifecycle';

function circuitFixture() {
  const admissions: Array<{
    success: jest.Mock;
    failure: jest.Mock;
    cancel: jest.Mock;
  }> = [];
  const circuit = {
    isOpen: jest.fn(() => false),
    recordSuccess: jest.fn(),
    recordFailure: jest.fn(),
    releaseProbe: jest.fn(),
    tryAcquire: jest.fn(() => {
      const handle = {
        success: jest.fn(),
        failure: jest.fn(),
        cancel: jest.fn(),
      };
      admissions.push(handle);
      return handle;
    }),
  };
  return { circuit, admissions };
}

const finalReply: ChatResult = {
  message: 'Final',
  provider: 'groq',
  model: 'first',
  routingMode: 'auto',
};
const plan: ProviderPlan = {
  provider: 'groq',
  model: 'first',
  apiKey: 'fixture-key',
  baseUrl: 'https://fixture.example/v1',
};
function completionFixture(
  circuit: ReturnType<typeof circuitFixture>['circuit'],
) {
  const runner = {
    isGeminiAvailable: jest.fn(() => false),
    runOpenAiCompatible: jest
      .fn<Promise<ChatResult>, [ChatParams]>()
      .mockResolvedValue(finalReply),
    streamOpenAiCompatible: jest.fn(() =>
      (async function* (): AsyncGenerator<StreamEvent> {
        yield { type: 'done', data: finalReply };
      })(),
    ),
  };
  const routing = {
    buildPlanChain: () => ({
      routingMode: 'auto',
      routeDecision: {},
      plans: [plan],
    }),
  };
  const service = new AiChatCompletionService(
    {} as never,
    {} as never,
    runner as never,
    routing as never,
    circuit as never,
  );
  return { service, runner };
}

describe('fenced circuit admission lifecycle', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each(['success', 'failure', 'cancel'] as const)(
    'keeps replacement probe authority when actual chat probe A reports late %s',
    async (outcome) => {
      const clock = jest.spyOn(Date, 'now').mockReturnValue(0);
      const breaker = new AiCircuitBreakerService();
      const acquire = jest.spyOn(breaker, 'tryAcquire');
      const { service, runner } = completionFixture(breaker as never);
      const params = {
        prompt: 'Hello',
        requestScopeKey: 'actor/connection/db',
      };
      await service.chat(params);
      const scope = acquire.mock.calls[0][2];
      for (let index = 0; index < 5; index++)
        breaker.tryAcquire(plan.provider, plan.model, scope)!.failure();
      clock.mockReturnValue(30_000);
      let resolve!: (value: ChatResult) => void;
      let reject!: (error: Error) => void;
      runner.runOpenAiCompatible.mockImplementationOnce(
        () =>
          new Promise<ChatResult>((done, fail) => {
            resolve = done;
            reject = fail;
          }),
      );
      const controller = new AbortController();
      const pending = service
        .chat({ ...params, signal: controller.signal })
        .then(
          (value) => ({ value }),
          (error) => ({ error }),
        );
      for (let index = 0; index < 30; index++) await Promise.resolve();
      expect(runner.runOpenAiCompatible).toHaveBeenCalledTimes(2);
      clock.mockReturnValue(60_000);
      const replacement = breaker.tryAcquire(plan.provider, plan.model, scope);
      expect(replacement).toBeDefined();
      if (outcome === 'success') resolve(finalReply);
      else if (outcome === 'failure')
        reject(new Error('Late upstream failure'));
      else controller.abort(new AiRequestStoppedError('AI_REQUEST_CANCELLED'));
      const result = await pending;
      expect(
        outcome === 'success' ? 'value' in result : 'error' in result,
      ).toBe(true);
      expect(
        breaker.tryAcquire(plan.provider, plan.model, scope),
      ).toBeUndefined();
      replacement!.success();
      expect(
        breaker.tryAcquire(plan.provider, plan.model, scope),
      ).toBeDefined();
      if (outcome === 'cancel') resolve(finalReply);
    },
  );

  it('does not close a newly opened circuit with a late success admitted while closed', async () => {
    const breaker = new AiCircuitBreakerService();
    const acquire = jest.spyOn(breaker, 'tryAcquire');
    const { service, runner } = completionFixture(breaker as never);
    let resolve!: (value: ChatResult) => void;
    runner.runOpenAiCompatible.mockImplementationOnce(
      () =>
        new Promise<ChatResult>((done) => {
          resolve = done;
        }),
    );
    const pending = service.chat({ prompt: 'Hello' });
    for (let index = 0; index < 30; index++) await Promise.resolve();
    const scope = acquire.mock.calls[0][2];
    for (let index = 0; index < 5; index++)
      breaker.tryAcquire(plan.provider, plan.model, scope)!.failure();
    resolve(finalReply);
    await expect(pending).resolves.toBe(finalReply);
    expect(
      breaker.tryAcquire(plan.provider, plan.model, scope),
    ).toBeUndefined();
  });

  it.each(['sync', 'stream'])(
    'does not fallback to another provider after an explicit refusal: %s',
    async (lane) => {
      const { circuit, admissions } = circuitFixture();
      const blocked = new AiGeminiProviderError('GEMINI_BLOCKED');
      const runner = {
        isGeminiAvailable: () => true,
        runGemini: jest.fn().mockRejectedValue(blocked),
        runOpenAiCompatible: jest.fn().mockResolvedValue(finalReply),
        streamGemini: jest.fn(() =>
          (async function* (): AsyncGenerator<StreamEvent> {
            yield await Promise.reject<StreamEvent>(blocked);
          })(),
        ),
        streamOpenAiCompatible: jest.fn(() =>
          (async function* (): AsyncGenerator<StreamEvent> {
            yield { type: 'done', data: finalReply };
          })(),
        ),
      };
      const routing = {
        buildPlanChain: () => ({
          routingMode: 'auto',
          routeDecision: {},
          plans: [{ provider: 'gemini', model: 'fixture' }, plan],
        }),
      };
      const service = new AiChatCompletionService(
        {} as never,
        {} as never,
        runner as never,
        routing as never,
        circuit as never,
      );
      if (lane === 'sync')
        await expect(service.chat({ prompt: 'Hello' })).rejects.toBe(blocked);
      else
        await expect(
          service.chatStream({ prompt: 'Hello' }).next(),
        ).rejects.toBe(blocked);
      expect(runner.runOpenAiCompatible).not.toHaveBeenCalled();
      expect(runner.streamOpenAiCompatible).not.toHaveBeenCalled();
      expect(admissions).toHaveLength(1);
      expect(admissions[0].cancel).toHaveBeenCalledTimes(1);
      expect(admissions[0].failure).not.toHaveBeenCalled();
    },
  );

  it('settles success through AiService.chatStream before the terminal consumer returns', async () => {
    const { circuit, admissions } = circuitFixture();
    const { service } = completionFixture(circuit);
    const facade = new AiService(service, {} as never, {} as never);
    const stream = facade.chatStream({ prompt: 'Hello' });
    expect(await stream.next()).toMatchObject({ value: { type: 'done' } });
    expect(admissions[0].success).toHaveBeenCalledTimes(1);
    await stream.return(undefined);
    expect(admissions[0].success).toHaveBeenCalledTimes(1);
    expect(admissions[0].cancel).not.toHaveBeenCalled();
    expect(admissions[0].failure).not.toHaveBeenCalled();
  });

  it('uses only admission handles for sync success and cancellation', async () => {
    const { circuit, admissions } = circuitFixture();
    const { service, runner } = completionFixture(circuit);
    await expect(
      service.chat({ prompt: 'Hello', requestScopeKey: 'actor/connection/db' }),
    ).resolves.toBe(finalReply);
    expect(circuit.tryAcquire).toHaveBeenCalledWith(
      plan.provider,
      plan.model,
      expect.any(String),
    );
    expect(admissions[0].success).toHaveBeenCalledTimes(1);
    expect(admissions[0].failure).not.toHaveBeenCalled();
    expect(circuit.isOpen).not.toHaveBeenCalled();
    expect(circuit.recordSuccess).not.toHaveBeenCalled();
    const controller = new AbortController();
    runner.runOpenAiCompatible.mockImplementationOnce(async () => {
      controller.abort();
      throw controller.signal.reason;
    });
    await expect(
      service.chat({ prompt: 'Hello', signal: controller.signal }),
    ).rejects.toThrow();
    expect(admissions[1].cancel).toHaveBeenCalledTimes(1);
    expect(admissions[1].failure).not.toHaveBeenCalled();
    expect(circuit.releaseProbe).not.toHaveBeenCalled();
    expect(circuit.recordFailure).not.toHaveBeenCalled();
  });

  it('settles success before done is yielded even when the consumer immediately returns', async () => {
    const { circuit, admissions } = circuitFixture();
    const { service } = completionFixture(circuit);
    const stream = service.chatStream({ prompt: 'Hello' });
    expect(await stream.next()).toMatchObject({ value: { type: 'done' } });
    expect(admissions[0].success).toHaveBeenCalledTimes(1);
    await stream.return(undefined);
    expect(admissions[0].success).toHaveBeenCalledTimes(1);
    expect(admissions[0].failure).not.toHaveBeenCalled();
    expect(circuit.recordSuccess).not.toHaveBeenCalled();
    expect(circuit.releaseProbe).not.toHaveBeenCalled();
  });

  it('releases only the admitted handle when a consumer returns after a chunk', async () => {
    const { circuit, admissions } = circuitFixture();
    const { service, runner } = completionFixture(circuit);
    runner.streamOpenAiCompatible.mockImplementationOnce(() =>
      (async function* (): AsyncGenerator<StreamEvent> {
        yield { type: 'chunk', text: 'Partial' };
        yield { type: 'done', data: finalReply };
      })(),
    );
    const stream = service.chatStream({ prompt: 'Hello' });
    expect(await stream.next()).toMatchObject({ value: { type: 'chunk' } });
    await stream.return(undefined);
    expect(admissions[0].cancel).toHaveBeenCalledTimes(1);
    expect(admissions[0].success).not.toHaveBeenCalled();
    expect(admissions[0].failure).not.toHaveBeenCalled();
    expect(circuit.releaseProbe).not.toHaveBeenCalled();
  });

  it.each([
    undefined,
    'AI_REQUEST_CANCELLED',
    'AI_REQUEST_TIMEOUT',
    'AI_DISABLED',
  ] as const)(
    'settles terminal error reason %s before yielding it without fallback',
    async (reason) => {
      const { circuit, admissions } = circuitFixture();
      const { service, runner } = completionFixture(circuit);
      runner.streamOpenAiCompatible.mockImplementationOnce(() =>
        (async function* (): AsyncGenerator<StreamEvent> {
          yield { type: 'error', text: 'Provider stopped', reason };
        })(),
      );
      const stream = service.chatStream({ prompt: 'Hello' });
      expect(await stream.next()).toMatchObject({ value: { type: 'error' } });
      expect(
        reason ? admissions[0].cancel : admissions[0].failure,
      ).toHaveBeenCalledTimes(1);
      expect(admissions[0].success).not.toHaveBeenCalled();
      await stream.return(undefined);
      expect(runner.streamOpenAiCompatible).toHaveBeenCalledTimes(1);
      expect(circuit.recordFailure).not.toHaveBeenCalled();
    },
  );

  it('fails closed before provider dispatch when the fenced API is absent', async () => {
    const { circuit } = circuitFixture();
    const { tryAcquire: _unused, ...legacyOnly } = circuit;
    const { service, runner } = completionFixture(legacyOnly as typeof circuit);
    await expect(service.chat({ prompt: 'Hello' })).rejects.toMatchObject({
      status: 503,
    });
    expect(runner.runOpenAiCompatible).not.toHaveBeenCalled();
    expect(circuit.isOpen).not.toHaveBeenCalled();
  });

  it('releases the admission on cancellation of a pending stream read', async () => {
    const { circuit, admissions } = circuitFixture();
    const { service, runner } = completionFixture(circuit);
    runner.streamOpenAiCompatible.mockImplementationOnce(() =>
      (async function* (): AsyncGenerator<StreamEvent> {
        await new Promise<void>(() => undefined);
        yield { type: 'done', data: finalReply };
      })(),
    );
    const controller = new AbortController();
    const stream = service.chatStream({
      prompt: 'Hello',
      signal: controller.signal,
    });
    const pending = stream.next().catch((error) => error);
    for (let index = 0; index < 30; index++) await Promise.resolve();
    controller.abort(new AiRequestStoppedError('AI_REQUEST_CANCELLED'));
    expect(await pending).toMatchObject({ reason: 'AI_REQUEST_CANCELLED' });
    expect(admissions[0].cancel).toHaveBeenCalledTimes(1);
    expect(admissions[0].failure).not.toHaveBeenCalled();
    expect(circuit.releaseProbe).not.toHaveBeenCalled();
  });
});

describe('AiChatCompletionService streaming fallback', () => {
  it('rejects pre-aborted requests before routing or provider dispatch', async () => {
    const runner = {
      isGeminiAvailable: jest.fn(),
      runOpenAiCompatible: jest.fn(),
    };
    const routing = { buildPlanChain: jest.fn() };
    const service = new AiChatCompletionService(
      {} as never,
      {} as never,
      runner as never,
      routing as never,
      {} as never,
    );
    const controller = new AbortController();
    controller.abort();

    await expect(
      service.chat({ prompt: 'Hello', signal: controller.signal }),
    ).rejects.toThrow();
    expect(routing.buildPlanChain).not.toHaveBeenCalled();
    expect(runner.runOpenAiCompatible).not.toHaveBeenCalled();
  });

  it('does not try a fallback provider or record circuit failure after user cancellation', async () => {
    const controller = new AbortController();
    const runner = {
      isGeminiAvailable: () => false,
      runOpenAiCompatible: jest.fn(async () => {
        controller.abort();
        throw controller.signal.reason;
      }),
    };
    const routing = {
      buildPlanChain: () => ({
        routingMode: 'auto',
        routeDecision: {},
        plans: [
          { provider: 'groq', model: 'first' },
          { provider: 'openrouter', model: 'second' },
        ],
      }),
    };
    const { circuit, admissions } = circuitFixture();
    const service = new AiChatCompletionService(
      {} as never,
      {} as never,
      runner as never,
      routing as never,
      circuit as never,
    );

    await expect(
      service.chat({ prompt: 'Hello', signal: controller.signal }),
    ).rejects.toThrow();
    expect(runner.runOpenAiCompatible).toHaveBeenCalledTimes(1);
    expect(circuit.recordFailure).not.toHaveBeenCalled();
    expect(admissions[0].failure).not.toHaveBeenCalled();
    expect(admissions[0].cancel).toHaveBeenCalledTimes(1);
  });

  it('stops at the first terminal stream event and ignores later chunks', async () => {
    const runner = {
      isGeminiAvailable: () => false,
      streamOpenAiCompatible: async function* () {
        yield {
          type: 'done',
          data: {
            message: 'Final',
            provider: 'groq',
            model: 'first',
            routingMode: 'auto',
          },
        };
        yield { type: 'chunk', text: 'Late text' };
      },
    };
    const routing = {
      buildPlanChain: () => ({
        routingMode: 'auto',
        routeDecision: {},
        plans: [{ provider: 'groq', model: 'first' }],
      }),
    };
    const { circuit, admissions } = circuitFixture();
    const service = new AiChatCompletionService(
      {} as never,
      {} as never,
      runner as never,
      routing as never,
      circuit as never,
    );
    const events: StreamEvent[] = [];
    for await (const event of service.chatStream({ prompt: 'Hello' }))
      events.push(event);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'done',
      data: { message: 'Final' },
    });
    expect(admissions[0].success).toHaveBeenCalledTimes(1);
    expect(circuit.recordSuccess).not.toHaveBeenCalled();
  });

  it('does not append a fallback response after a provider emitted partial output', async () => {
    const firstStream = async function* () {
      yield { type: 'chunk' as const, text: 'partial' };
      throw new Error('upstream disconnected');
    };
    const secondStream = async function* () {
      yield { type: 'chunk' as const, text: 'fallback' };
    };
    const providerRunner = {
      isGeminiAvailable: jest.fn().mockReturnValue(false),
      streamOpenAiCompatible: jest
        .fn()
        .mockReturnValueOnce(firstStream())
        .mockReturnValueOnce(secondStream()),
      streamGemini: jest.fn(),
    };
    const routingService = {
      buildPlanChain: jest.fn().mockReturnValue({
        routingMode: 'auto',
        routeDecision: {},
        plans: [
          { provider: 'groq', model: 'first' },
          { provider: 'openrouter', model: 'second' },
        ],
      }),
    };
    const { circuit: circuitBreaker, admissions } = circuitFixture();
    const service = new AiChatCompletionService(
      {} as never,
      {} as never,
      providerRunner as never,
      routingService as never,
      circuitBreaker as never,
    );

    const events: StreamEvent[] = [];
    for await (const event of service.chatStream({ prompt: 'hello' })) {
      events.push(event);
    }

    expect(events).toEqual([
      { type: 'chunk', text: 'partial' },
      {
        type: 'error',
        text: 'AI generation interrupted: upstream disconnected',
      },
    ]);
    expect(providerRunner.streamOpenAiCompatible).toHaveBeenCalledTimes(1);
    expect(admissions[0].failure).toHaveBeenCalledTimes(1);
    expect(circuitBreaker.recordFailure).not.toHaveBeenCalled();
  });
});
