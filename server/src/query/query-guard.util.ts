const SQL_READ_ONLY_PREFIXES = [
  'SELECT',
  'WITH',
  'SHOW',
  'DESCRIBE',
  'DESC',
  'EXPLAIN',
  'PRAGMA',
];

const SQL_DESTRUCTIVE_KEYWORDS = [
  'INSERT',
  'UPDATE',
  'DELETE',
  'DROP',
  'ALTER',
  'TRUNCATE',
  'CREATE',
  'REPLACE',
  'MERGE',
  'GRANT',
  'REVOKE',
  'COMMENT',
  'ATTACH',
  'DETACH',
];

const MONGO_READ_ONLY_ACTIONS = new Set(['find', 'aggregate', 'count']);

export function normalizeSql(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--.*$/gm, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isSqlAllowedOnReadOnly(sql: string): boolean {
  const normalized = normalizeSql(sql).toUpperCase();
  if (!normalized) {
    return true;
  }

  if (SQL_DESTRUCTIVE_KEYWORDS.some((keyword) => new RegExp(`\\b${keyword}\\b`, 'i').test(normalized))) {
    return false;
  }

  return SQL_READ_ONLY_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function isLikelyDestructiveSql(sql: string): boolean {
  const normalized = normalizeSql(sql).toUpperCase();
  return SQL_DESTRUCTIVE_KEYWORDS.some((keyword) =>
    new RegExp(`\\b${keyword}\\b`, 'i').test(normalized),
  );
}

export function getMongoActionFromPayload(payloadString: string): string | null {
  try {
    const payload = JSON.parse(payloadString);
    return typeof payload?.action === 'string' ? payload.action : null;
  } catch {
    return null;
  }
}

export function isMongoActionAllowedOnReadOnly(action: string | null): boolean {
  if (!action) {
    return false;
  }
  return MONGO_READ_ONLY_ACTIONS.has(action);
}
