import { AiPromptBuilderService } from './ai.prompt-builder.service';
import { AI_CONSTANTS } from './ai.constants';

describe('AiPromptBuilderService', () => {
  let service: AiPromptBuilderService;

  beforeEach(() => {
    service = new AiPromptBuilderService();
  });

  it.each([
    { message: 'A closing } in a string', sql: "SELECT '{' AS brace" },
    { message: 'Escaped "quotes" and \\slashes { }', sql: 'SELECT 1' },
    { message: 'Nested data', sql: 'SELECT 2', ignored: [{ value: '}' }] },
  ])(
    'parses complete JSON without counting braces inside strings: %j',
    (value) => {
      const parsed = service.parseAiResponse(
        JSON.stringify(value),
        'structured',
      );

      expect(parsed).toMatchObject({ message: value.message, sql: value.sql });
    },
  );

  it('extracts a fenced JSON object with escaped braces without losing SQL', () => {
    const value = { message: 'Literal } and {', sql: 'SELECT \'{"key":"}"}\'' };
    const parsed = service.parseAiResponse(
      `\`\`\`json\n${JSON.stringify(value)}\n\`\`\``,
      'structured',
    );

    expect(parsed).toMatchObject(value);
  });

  it.each([
    '',
    'null',
    'true',
    '42',
    '[]',
    '{"sql":',
    '{"message":""}',
    'plain text',
  ])('rejects invalid structured output %j', (value) => {
    expect(() => {
      const parsed = service.parseAiResponse(value, 'structured');
      service.assertUsableStructuredResponse(
        parsed,
        value,
        'Fixture',
        'structured',
      );
    }).toThrow();
  });

  it.each([
    { message: ['not text'], sql: 'SELECT 1' },
    { message: 'Ready', sql: { action: 'find' } },
    { explanation: 42, sql: 'SELECT 1' },
  ])(
    'does not coerce invalid response fields into usable content: %j',
    (value) => {
      expect(() =>
        service.parseAiResponse(JSON.stringify(value), 'structured'),
      ).toThrow();
    },
  );

  it('preserves plain chat text when structured output was not requested', () => {
    const value = 'This is a plain chat response with {curly braces}.';
    const parsed = service.parseAiResponse(value, 'chat');

    expect(parsed).toEqual({ message: value });
    expect(() =>
      service.assertUsableStructuredResponse(parsed, value, 'Fixture', 'chat'),
    ).not.toThrow();
  });

  it('bounds response parsing before attempting JSON extraction', () => {
    const value = 'x'.repeat(AI_CONSTANTS.MAX_OUTPUT_TOKENS * 16 + 1);

    expect(() => service.parseAiResponse(value, 'structured')).toThrow(
      /limit|large/i,
    );
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

  it('rejects credential-bearing and control-character source URLs', () => {
    const parsed = service.parseAiResponse(
      JSON.stringify({
        message: 'Answer',
        sources: [
          'https://example.com/safe',
          'https://user:secret@example.com/private',
          'https://example.com/unsafe\npath',
          'javascript:alert(1)',
        ],
      }),
      'structured',
    );

    expect(parsed.sources).toEqual(['https://example.com/safe']);
    expect(JSON.stringify(parsed)).not.toContain('secret');
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
    const geminiHistory = geminiContents.slice(0, -1).map((message) => {
      const firstPart = message.parts[0];
      return (firstPart && 'text' in firstPart ? firstPart.text : '') || '';
    });

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
