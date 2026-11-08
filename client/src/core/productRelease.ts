export const CURRENT_RELEASE = {
  version: '1.6.7',
  tag: 'v1.6.7',
  date: '2026-09-02',
} as const;

export function releaseAnchorId(version: string): string {
  return `release-${version.replaceAll('.', '-')}`;
}

/** UTC keeps the published calendar date stable in browsers and static rendering. */
export function getReleaseDate(language: 'vi' | 'en'): string {
  return new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${CURRENT_RELEASE.date}T00:00:00Z`));
}
