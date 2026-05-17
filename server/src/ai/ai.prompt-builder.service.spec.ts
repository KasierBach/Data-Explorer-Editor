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
});
