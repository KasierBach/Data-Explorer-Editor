export type AppLanguage = 'vi' | 'en';

export function normalizeAppLanguage(value?: string | null): AppLanguage {
  if (typeof value !== 'string') {
    return 'vi';
  }

  return value.toLowerCase().startsWith('en') ? 'en' : 'vi';
}

export function pickLocalizedText(
  lang: AppLanguage | string | null | undefined,
  vi: string,
  en: string,
): string {
  return normalizeAppLanguage(lang) === 'en' ? en : vi;
}

export function resolveRequestLanguage(
  value?: string | string[] | null,
): AppLanguage {
  if (Array.isArray(value)) {
    return normalizeAppLanguage(value[0]);
  }

  if (typeof value !== 'string') {
    return 'vi';
  }

  const [firstLocale] = value.split(',');
  return normalizeAppLanguage(firstLocale?.trim());
}
