import { AiPromptBuilderService } from './ai.prompt-builder.service';
import { AI_CONSTANTS } from './ai.constants';

describe('AiPromptBuilderService', () => {
  let service: AiPromptBuilderService;

  beforeEach(() => {
    service = new AiPromptBuilderService();
  });

  it('strips raw thought content from parsed model responses', () => {
    const parsed = service.parseAiResponse(
      '<thought>private chain of thought</thought>{"message":"Ready","thought":"private json reasoning","sql":"SELECT 1"}',
    );

    expect(parsed).toMatchObject({
      message: 'Ready',
      sql: 'SELECT 1',
    });
    expect(parsed).not.toHaveProperty('thought');
    expect(JSON.stringify(parsed)).not.toContain('private');
  });

  it('strips think-tag reasoning blocks from provider responses', () => {
    const parsed = service.parseAiResponse(
      '<think>hidden reasoning</think>{"message":"pong"}',
    );

    expect(parsed).toMatchObject({
      message: 'pong',
    });
    expect(JSON.stringify(parsed)).not.toContain('hidden reasoning');
  });

  it('keeps valid source URLs from structured model responses', () => {
    const parsed = service.parseAiResponse(
      '{"message":"Fresh answer","sources":["https://example.com/a","notaurl","https://example.com/a"]}',
    );

    expect(parsed).toMatchObject({
      message: 'Fresh answer',
      sources: ['https://example.com/a'],
    });
  });

  it('renders readable source labels instead of exposing redirect URLs', () => {
    const message = service.appendSourcesToMessage('Fresh answer', [
      'https://vertexaisearch.cloud.google.com/grounding-api-redirect/long-token',
      'https://example.com/articles/data-explorer',
    ]);

    expect(message).toContain(
      '[Google Search source 1](https://vertexaisearch.cloud.google.com/',
    );
    expect(message).toContain(
      '[Source 2 - example.com](https://example.com/articles/data-explorer)',
    );
    expect(message).not.toContain('[https://vertexaisearch.cloud.google.com/');
  });

  it('uses explicit structured response contracts for database-style requests', () => {
    const prompt = service.buildSystemPrompt({
      responseFormat: 'structured',
      databaseType: 'postgres',
      schemaContext: 'TABLE users(id uuid, email text)',
      capabilities: { liveWebSearch: false, citations: false },
    });

    expect(prompt).toContain('<output_contract>');
    expect(prompt).toContain('You MUST respond with a JSON object');
    expect(prompt).toContain('"sources"');
    expect(prompt).toContain('TABLE users');
  });

  it('does not promise live web research when that capability is unavailable', () => {
    const prompt = service.buildSystemPrompt({
      responseFormat: 'chat',
      capabilities: { liveWebSearch: false, citations: false },
    });

    expect(prompt).toContain('Live web research is NOT available');
    expect(prompt).toContain('Do not claim that you searched the web');
  });

  it('enables citation and image instructions only when those capabilities are available', () => {
    const prompt = service.buildSystemPrompt({
      responseFormat: 'chat',
      capabilities: { liveWebSearch: true, citations: true, visionInput: true },
    });

    expect(prompt).toContain('Live web research is available');
    expect(prompt).toContain('place citation URLs in the "sources" array');
    expect(prompt).toContain('An image is attached to this request');
  });

  it('keeps the reusable schema prefix ahead of the changing date context', () => {
    const prompt = service.buildSystemPrompt({
      schemaContext: 'TABLE users(id uuid)',
    });

    expect(prompt.indexOf('TABLE users')).toBeLessThan(
      prompt.indexOf('<time_context>'),
    );
    expect(prompt).toContain('Current date (UTC)');
    expect(prompt).not.toContain('Local time');
  });

  it('bounds chat history consistently for OpenAI-compatible and Gemini requests', () => {
    const history = Array.from({ length: 30 }, (_, index) => ({
      role: index % 2 === 0 ? ('user' as const) : ('ai' as const),
      content: `${index}: ${'x'.repeat(2000)}`,
    }));

    const openAiMessages = service.buildOpenAiMessages(
      'current prompt',
      'system',
      undefined,
      history,
    );
    const openAiHistory = openAiMessages
      .slice(1, -1)
      .flatMap((message) =>
        typeof message.content === 'string' ? [message.content] : [],
      );
    const geminiContents = service.buildGeminiContents(
      'current prompt',
      undefined,
      history,
    );
    const geminiHistory = geminiContents
      .slice(0, -1)
      .map((message) => message.parts[0]?.text || '');

    expect(openAiHistory).toEqual(geminiHistory);
    expect(openAiHistory.length).toBeLessThanOrEqual(
      AI_CONSTANTS.CHAT_HISTORY_MAX_MESSAGES,
    );
    expect(openAiHistory.join('').length).toBeLessThanOrEqual(
      AI_CONSTANTS.CHAT_HISTORY_MAX_CHARACTERS,
    );
    expect(openAiHistory.at(-1)).toContain('29:');
  });

  it('does not duplicate the current user prompt in bounded history', () => {
    const messages = service.buildOpenAiMessages(
      'same prompt',
      'system',
      undefined,
      [
        { role: 'user', content: 'earlier prompt' },
        { role: 'ai', content: 'earlier response' },
        { role: 'user', content: 'same prompt' },
      ],
    );

    expect(
      messages.filter(
        (message) =>
          typeof message.content === 'string' &&
          message.content === 'same prompt',
      ),
    ).toHaveLength(1);
  });

  it('parses valid base64 image data without a regular expression', () => {
    expect(
      service.prepareGeminiParts(
        'Describe this image',
        undefined,
        'data:image/png;base64,aGVsbG8=',
      ),
    ).toEqual([
      { text: 'Describe this image' },
      {
        inlineData: {
          mimeType: 'image/png',
          data: 'aGVsbG8=',
        },
      },
    ]);
  });

  it('ignores malformed image data URLs', () => {
    expect(
      service.prepareGeminiParts(
        'Describe this image',
        undefined,
        'https://example.com/image.png',
      ),
    ).toEqual([{ text: 'Describe this image' }]);
  });
  it('passes PDF data natively to Gemini and OpenRouter message formats', () => {
    const document = {
      name: 'schema.pdf',
      mimeType: 'application/pdf' as const,
      data: 'data:application/pdf;base64,aGVsbG8=',
    };

    expect(
      service.prepareGeminiParts(
        'Read this PDF',
        undefined,
        undefined,
        document,
      ),
    ).toContainEqual({
      inlineData: { mimeType: 'application/pdf', data: 'aGVsbG8=' },
    });

    const messages = service.buildOpenAiMessages(
      'Read this PDF',
      'System',
      undefined,
      [],
      undefined,
      document,
    );
    expect(messages.at(-1)).toMatchObject({
      role: 'user',
      content: expect.arrayContaining([
        {
          type: 'file',
          file: {
            filename: 'schema.pdf',
            file_data: document.data,
          },
        },
      ]),
    });
  });
});
