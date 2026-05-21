import { describe, expect, it } from 'vitest';
import { normalizeAppLang, pickLocalizedText } from './i18n';

describe('i18n utils', () => {
  it('normalizes English variants to en', () => {
    expect(normalizeAppLang('en')).toBe('en');
    expect(normalizeAppLang('EN-US')).toBe('en');
    expect(normalizeAppLang('en-GB')).toBe('en');
  });

  it('falls back to vi for missing or unsupported values', () => {
    expect(normalizeAppLang(undefined)).toBe('vi');
    expect(normalizeAppLang(null)).toBe('vi');
    expect(normalizeAppLang('fr')).toBe('vi');
  });

  it('picks localized text from the active app language', () => {
    expect(pickLocalizedText('vi', 'Tìm', 'Find')).toBe('Tìm');
    expect(pickLocalizedText('en', 'Tim', 'Find')).toBe('Find');
  });
});
