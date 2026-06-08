import { AiPromptBuilderService } from './ai.prompt-builder.service';

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

  it('keeps valid source URLs from structured model responses', () => {
    const parsed = service.parseAiResponse(
      '{"message":"Fresh answer","sources":["https://example.com/a","notaurl","https://example.com/a"]}',
    );

    expect(parsed).toMatchObject({
      message: 'Fresh answer',
      sources: ['https://example.com/a'],
    });
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
});
