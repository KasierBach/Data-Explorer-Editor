import { AiChatCompletionService } from './ai.chat-completion.service';

describe('AiChatCompletionService streaming fallback', () => {
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
    const service = new AiChatCompletionService(
      {} as never,
      {} as never,
      providerRunner as never,
      routingService as never,
    );

    const events = [];
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
