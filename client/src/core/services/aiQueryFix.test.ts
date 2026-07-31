import { describe, expect, it } from 'vitest';
import { buildAiQueryFixPrompt } from './aiQueryFix';

describe('buildAiQueryFixPrompt', () => {
  it('includes the failed query and error without asking AI to execute it', () => {
    const prompt = buildAiQueryFixPrompt(
      'SELECT missing FROM users',
      'column missing does not exist',
      'SQL',
      'en',
    );

    expect(prompt).toContain('SELECT missing FROM users');
    expect(prompt).toContain('column missing does not exist');
    expect(prompt).toContain('do not run it');
  });

  it('bounds large error payloads', () => {
    const prompt = buildAiQueryFixPrompt('SELECT 1', 'x'.repeat(5_000), 'SQL', 'en');

    expect(prompt).toContain('[truncated]');
    expect(prompt.length).toBeLessThan(4_500);
  });
});
