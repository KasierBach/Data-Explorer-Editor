import { describe, expect, it } from 'vitest';
import { describeAiProviderError } from './aiProviderStatus';

describe('describeAiProviderError', () => {
  it.each([
    ['provider error (429)', 'rate-limited'],
    ['provider requires provider credits (402)', 'credits-required'],
    ['provider model old-model is unavailable (404)', 'unavailable'],
  ] as const)('classifies %s', (message, status) => {
    expect(describeAiProviderError(message, 'en').status).toBe(status);
  });

  it('preserves unknown errors', () => {
    expect(describeAiProviderError('network failed', 'vi')).toEqual({
      message: 'network failed',
    });
  });
});
