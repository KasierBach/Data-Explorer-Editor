import { ConfigService } from '@nestjs/config';
import { AiPromptBuilderService } from './ai.prompt-builder.service';
import { AiProviderRunnerService } from './ai.provider-runner.service';
import type { AiRoutingMode, StreamEvent } from './ai.types';

function createSseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    }),
  );
}

describe('AiProviderRunnerService streaming', () => {
  let service: AiProviderRunnerService;

  beforeEach(() => {
    service = new AiProviderRunnerService(
      { get: jest.fn(() => undefined) } as unknown as ConfigService,
      new AiPromptBuilderService(),
    );
  });

  it('preserves SSE JSON lines split across network chunks', async () => {
    const response = createSseResponse([
      'data: {"choices":[{"delta"',
      ':{"content":"Hello"}}]}\n',
      'data: [DONE]\n',
    ]);
    const streamFetch = (
      service as unknown as {
        streamFetch: (
          response: Response,
          abortController: { clear: () => void; signal: AbortSignal },
          model: string,
          provider: string,
          routingMode: AiRoutingMode,
        ) => AsyncGenerator<StreamEvent>;
      }
    ).streamFetch.bind(service);

    const events: StreamEvent[] = [];
    for await (const event of streamFetch(
      response,
      { clear: jest.fn(), signal: new AbortController().signal },
      'test-model',
      'openrouter',
      'auto',
    )) {
      events.push(event);
    }

    expect(events[0]).toEqual({ type: 'chunk', text: 'Hello' });
    expect(events[1]).toEqual({
      type: 'done',
      data: {
        message: 'Hello',
        provider: 'openrouter',
        model: 'test-model',
        routingMode: 'auto',
        recommendations: undefined,
        sql: undefined,
        explanation: undefined,
      },
    });
  });
});
