import { normalizeProviderBaseUrl } from './ai-url.util';

describe('normalizeProviderBaseUrl', () => {
  it('trims whitespace and all trailing slashes', () => {
    expect(
      normalizeProviderBaseUrl('  https://provider.example.com/v1///  '),
    ).toBe('https://provider.example.com/v1');
  });

  it('preserves internal URL path separators', () => {
    expect(
      normalizeProviderBaseUrl('https://provider.example.com/v1/models'),
    ).toBe('https://provider.example.com/v1/models');
  });
});
