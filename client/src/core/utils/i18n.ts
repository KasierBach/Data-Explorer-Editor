export type AppLang = 'vi' | 'en';

export function normalizeAppLang(value?: string | null): AppLang {
  if (typeof value !== 'string') return 'vi';
  return value.toLowerCase().startsWith('en') ? 'en' : 'vi';
}

export function pickLocalizedText(
  lang: AppLang | string | null | undefined,
  vi: string,
  en: string,
): string {
  return normalizeAppLang(lang) === 'en' ? en : vi;
}
