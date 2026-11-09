import { AiChatCompletionService } from './ai.chat-completion.service';
import type { StreamEvent } from './ai.types';

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
    const circuit = {
      isOpen: () => false,
      recordSuccess: jest.fn(),
      recordFailure: jest.fn(),
    };
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
    const circuit = {
      isOpen: () => false,
      recordSuccess: jest.fn(),
      recordFailure: jest.fn(),
    };
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
    expect(circuit.recordSuccess).toHaveBeenCalledTimes(1);
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
    const circuitBreaker = {
      isOpen: jest.fn().mockReturnValue(false),
      recordSuccess: jest.fn(),
      recordFailure: jest.fn(),
    };
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
  });
});
