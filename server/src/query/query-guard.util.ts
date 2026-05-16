// ─── Allowed Prefixes (Read-Only Queries) ───

const SQL_READ_ONLY_PREFIXES = [
  'SELECT',
  'WITH',
  'SHOW',
  'DESCRIBE',
  'DESC',
  'EXPLAIN',
  'PRAGMA',
];

// ─── Destructive Keywords ───

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
  'EXEC',
  'EXECUTE',
  'RENAME',
  'BACKUP',
  'RESTORE',
  'USE',
  'KILL',
];

/** High-severity keywords that destroy data or structure irreversibly */
const SQL_HIGH_SEVERITY_KEYWORDS = ['DROP', 'TRUNCATE', 'DELETE', 'ALTER'];

const MONGO_READ_ONLY_ACTIONS = new Set(['find', 'aggregate', 'count']);

// ─── SQL Normalization ───

/** Strips comments and collapses whitespace for safe analysis */
export function normalizeSql(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--.*$/gm, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Read-Only Checks ───

export function isSqlAllowedOnReadOnly(sql: string): boolean {
  const normalized = normalizeSql(sql).toUpperCase();
  if (!normalized) return true;

  if (
    SQL_DESTRUCTIVE_KEYWORDS.some((kw) =>
      new RegExp(`\\b${kw}\\b`, 'i').test(normalized),
    )
  ) {
    return false;
  }

  return SQL_READ_ONLY_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function isLikelyDestructiveSql(sql: string): boolean {
  const normalized = normalizeSql(sql).toUpperCase();
  return SQL_DESTRUCTIVE_KEYWORDS.some((kw) =>
    new RegExp(`\\b${kw}\\b`, 'i').test(normalized),
  );
}

// ─── Multi-Statement Detection ───

/**
 * Detects if the SQL string contains multiple statements by looking
 * for semicolons that are NOT inside string literals (single or double quotes).
 *
 * Example: "SELECT 1; DROP TABLE users" → true
 *          "SELECT 'hello; world'"      → false
 */
export function containsMultipleStatements(sql: string): boolean {
  const normalized = normalizeSql(sql);
  let insideSingle = false;
  let insideDouble = false;

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    const prev = i > 0 ? normalized[i - 1] : '';

    if (ch === "'" && !insideDouble && prev !== '\\') {
      insideSingle = !insideSingle;
    } else if (ch === '"' && !insideSingle && prev !== '\\') {
      insideDouble = !insideDouble;
    } else if (ch === ';' && !insideSingle && !insideDouble) {
      // A trailing semicolon at the end of a single statement is fine;
      // we only flag it if there is non-whitespace content AFTER the semicolon.
      const remainder = normalized.slice(i + 1).trim();
      if (remainder.length > 0) return true;
    }
  }

  return false;
}

// ─── Destructive Analysis (for Confirmation Dialog) ───

export interface DestructiveAnalysis {
  isDestructive: boolean;
  severity: 'none' | 'low' | 'high';
  keywords: string[];
  affectedObject: string | null;
}

/**
 * Analyzes a SQL statement and returns structured info about its
 * destructive potential. Used by the confirmation flow.
 */
export function analyzeDestructiveSql(sql: string): DestructiveAnalysis {
  const normalized = normalizeSql(sql).toUpperCase();

  const foundKeywords = SQL_DESTRUCTIVE_KEYWORDS.filter((kw) =>
    new RegExp(`\\b${kw}\\b`, 'i').test(normalized),
  );

  if (foundKeywords.length === 0) {
    return {
      isDestructive: false,
      severity: 'none',
      keywords: [],
      affectedObject: null,
    };
  }

  const isHighSeverity = foundKeywords.some((kw) =>
    SQL_HIGH_SEVERITY_KEYWORDS.includes(kw),
  );

  // Try to extract the affected table/database name
  const objectMatch = normalized.match(
    /(?:DROP\s+(?:TABLE|DATABASE|SCHEMA|INDEX|VIEW)\s+(?:IF\s+EXISTS\s+)?|TRUNCATE\s+(?:TABLE\s+)?|DELETE\s+FROM\s+|ALTER\s+TABLE\s+|UPDATE\s+|INSERT\s+INTO\s+)([^\s(;]+)/i,
  );

  return {
    isDestructive: true,
    severity: isHighSeverity ? 'high' : 'low',
    keywords: foundKeywords,
    affectedObject: objectMatch ? objectMatch[1].replace(/["`[\]]/g, '') : null,
  };
}

// ─── MongoDB Helpers ───

export function getMongoActionFromPayload(
  payloadString: string,
): string | null {
  try {
    const payload = JSON.parse(payloadString);
    return typeof payload?.action === 'string' ? payload.action : null;
  } catch {
    return null;
  }
}

export function isMongoActionAllowedOnReadOnly(action: string | null): boolean {
  if (!action) return false;
  return MONGO_READ_ONLY_ACTIONS.has(action);
}
