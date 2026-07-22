export function normalizeProviderBaseUrl(value: string): string {
  const characters = Array.from(value.trim());
  const trailingSlashCount = [...characters]
    .reverse()
    .findIndex((character) => character !== '/');
  if (trailingSlashCount === -1) return '';

  return characters.slice(0, characters.length - trailingSlashCount).join('');
}
