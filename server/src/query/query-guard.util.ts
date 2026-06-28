const SQL_READ_ONLY_PREFIXES = [
  'SELECT',
  'WITH',
  'SHOW',
  'DESCRIBE',
  'DESC',
  'EXPLAIN',
  'PRAGMA',
];

const SQL_WRITE_KEYWORDS = [
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
  'CALL',
  'RENAME',
  'BACKUP',
  'RESTORE',
  'USE',
  'KILL',
];

const MONGO_READ_ONLY_ACTIONS = new Set(['find', 'aggregate', 'count']);

type ImpactScope = 'rows' | 'object' | 'database' | 'instance' | 'unknown';
type DestructiveReason =
  | 'unbounded_row_mutation'
  | 'destructive_schema_change'
  | 'schema_contract_change'
  | 'opaque_execution';

interface SqlObjectInfo {
  affectedObject: string | null;
  objectType: string | null;
  impactScope: ImpactScope;
}

export function normalizeSql(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--.*$/gm, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isSqlAllowedOnReadOnly(sql: string): boolean {
  const normalized = normalizeSql(sql).toUpperCase();
  if (!normalized) return true;

  if (
    SQL_WRITE_KEYWORDS.some((kw) =>
      new RegExp(`\\b${kw}\\b`, 'i').test(normalized),
    )
  ) {
    return false;
  }

  return SQL_READ_ONLY_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function isLikelyDestructiveSql(sql: string): boolean {
  return analyzeSqlConfirmation(sql).requiresConfirmation;
}

export function containsMultipleStatements(sql: string): boolean {
  return splitSqlStatements(sql).length > 1;
}

export function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let insideSingle = false;
  let insideDouble = false;
  let insideLineComment = false;
  let insideBlockComment = false;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const next = i < sql.length - 1 ? sql[i + 1] : '';
    const prev = i > 0 ? sql[i - 1] : '';

    if (insideLineComment) {
      current += ch;
      if (ch === '\n') {
        insideLineComment = false;
      }
      continue;
    }

    if (insideBlockComment) {
      current += ch;
      if (ch === '*' && next === '/') {
        current += next;
        i += 1;
        insideBlockComment = false;
      }
      continue;
    }

    if (!insideSingle && !insideDouble) {
      if (ch === '-' && next === '-') {
        current += ch + next;
        i += 1;
        insideLineComment = true;
        continue;
      }

      if (ch === '/' && next === '*') {
        current += ch + next;
        i += 1;
        insideBlockComment = true;
        continue;
      }
    }

    if (ch === "'" && !insideDouble && prev !== '\\') {
      insideSingle = !insideSingle;
      current += ch;
    } else if (ch === '"' && !insideSingle && prev !== '\\') {
      insideDouble = !insideDouble;
      current += ch;
    } else if (ch === ';' && !insideSingle && !insideDouble) {
      if (normalizeSql(current)) {
        statements.push(current.trim());
      }
      current = '';
    } else {
      current += ch;
    }
  }

  if (normalizeSql(current)) {
    statements.push(current.trim());
  }

  return statements;
}

export interface DestructiveAnalysis {
  isDestructive: boolean;
  isMutating: boolean;
  requiresConfirmation: boolean;
  severity: 'none' | 'medium' | 'high';
  keywords: string[];
  affectedObject: string | null;
  objectType?: string | null;
  impactScope?: ImpactScope;
  reason?: DestructiveReason;
  summary?: string;
  reviewChecklist?: string[];
  statement?: string;
  statementIndex?: number;
  statementCount?: number;
  flaggedStatements?: number;
}

function startsWithKeyword(normalized: string, keyword: string) {
  return new RegExp(`^${keyword}\\b`, 'i').test(normalized);
}

function cleanIdentifier(value: string | undefined): string | null {
  if (!value) return null;
  return (
    value
      .replace(/["`[\]]/g, '')
      .replace(/[;,]+$/g, '')
      .trim() || null
  );
}

function getImpactScopeForObjectType(objectType: string | null): ImpactScope {
  if (!objectType) return 'unknown';
  if (objectType === 'DATABASE' || objectType === 'SCHEMA') return 'database';
  if (objectType === 'SESSION' || objectType === 'INSTANCE') return 'instance';
  return 'object';
}

function extractObjectInfo(normalized: string): SqlObjectInfo {
  const patterns: Array<{
    regex: RegExp;
    objectType?: string;
    objectTypeGroup?: number;
    objectGroup: number;
    impactScope?: ImpactScope;
  }> = [
    {
      regex:
        /\bDROP\s+(TABLE|VIEW|INDEX|DATABASE|SCHEMA|FUNCTION|PROCEDURE|TRIGGER)\s+(?:IF\s+EXISTS\s+)?([^\s(;]+)/i,
      objectTypeGroup: 1,
      objectGroup: 2,
    },
    {
      regex: /\bTRUNCATE\s+(?:TABLE\s+)?([^\s(;]+)/i,
      objectType: 'TABLE',
      objectGroup: 1,
      impactScope: 'rows',
    },
    {
      regex:
        /\bALTER\s+(TABLE|VIEW|INDEX|DATABASE|SCHEMA|FUNCTION|PROCEDURE|TRIGGER)\s+([^\s(;]+)/i,
      objectTypeGroup: 1,
      objectGroup: 2,
    },
    {
      regex:
        /\bCREATE\s+OR\s+REPLACE\s+(VIEW|FUNCTION|PROCEDURE|TRIGGER)\s+([^\s(;]+)/i,
      objectTypeGroup: 1,
      objectGroup: 2,
    },
    {
      regex: /\bRENAME\s+(TABLE|VIEW|INDEX)\s+([^\s(;]+)/i,
      objectTypeGroup: 1,
      objectGroup: 2,
    },
    {
      regex: /\bUPDATE\s+([^\s(;]+)/i,
      objectType: 'TABLE',
      objectGroup: 1,
      impactScope: 'rows',
    },
    {
      regex: /\bDELETE\s+FROM\s+([^\s(;]+)/i,
      objectType: 'TABLE',
      objectGroup: 1,
      impactScope: 'rows',
    },
    {
      regex: /^\s*(EXEC|EXECUTE|CALL)\s+([^\s(;]+)/i,
      objectType: 'PROCEDURE',
      objectGroup: 2,
      impactScope: 'object',
    },
    {
      regex: /\b(ATTACH|DETACH|RESTORE|KILL)\b\s*([^\s(;]+)?/i,
      objectTypeGroup: 1,
      objectGroup: 2,
      impactScope: 'instance',
    },
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern.regex);
    if (!match) continue;

    const rawObjectType =
      pattern.objectType ||
      cleanIdentifier(match[pattern.objectTypeGroup || 0]);
    const objectType = rawObjectType ? rawObjectType.toUpperCase() : null;
    return {
      affectedObject: cleanIdentifier(match[pattern.objectGroup]),
      objectType,
      impactScope:
        pattern.impactScope || getImpactScopeForObjectType(objectType),
    };
  }

  return {
    affectedObject: null,
    objectType: null,
    impactScope: 'unknown',
  };
}

function hasUnsafeWhereClause(normalized: string): boolean {
  if (!/\bWHERE\b/i.test(normalized)) {
    return true;
  }

  return /\bWHERE\s*(?:\(\s*)?(?:1\s*=\s*1|TRUE)(?:\s*\))?(?=\s*(?:;|$|AND\b|OR\b))/i.test(
    normalized,
  );
}

function buildReviewChecklist(reason: DestructiveReason): string[] {
  switch (reason) {
    case 'unbounded_row_mutation':
      return [
        'Preview the target rows with SELECT first.',
        'Confirm the filter is narrow enough for the intended change.',
        'Use a transaction or backup path before running it on shared data.',
      ];
    case 'destructive_schema_change':
      return [
        'Check downstream views, jobs, dashboards, and saved queries.',
        'Make sure rollback or backup steps are ready.',
        'Coordinate the change if other users share this database.',
      ];
    case 'schema_contract_change':
      return [
        'Verify dependent queries and ORM mappings still match.',
        'Review application code that expects the old object shape or name.',
        'Prefer running in a maintenance window on shared environments.',
      ];
    case 'opaque_execution':
      return [
        'Review the procedure or command body before execution.',
        'Confirm the expected side effects and touched objects.',
        'Test it in a non-production database first if possible.',
      ];
  }
}

function buildSummary(
  operation: string,
  reason: DestructiveReason,
  info: SqlObjectInfo,
): string {
  const target = info.affectedObject ? ` ${info.affectedObject}` : '';

  if (reason === 'unbounded_row_mutation') {
    return `${operation} can affect many rows${target} because the filter is missing or effectively wide open.`;
  }

  if (operation === 'TRUNCATE') {
    return `${operation} will remove all rows${target ? ` from${target}` : ''}.`;
  }

  if (reason === 'destructive_schema_change') {
    return `${operation} can permanently remove or rewrite database objects${target}.`;
  }

  if (reason === 'opaque_execution') {
    return `${operation} can run opaque logic with side effects${target ? ` through ${target}` : ''}.`;
  }

  return `${operation} changes a database contract that other queries or tools may depend on${target}.`;
}

function createSafeAnalysis(isMutating = false): DestructiveAnalysis {
  return {
    isDestructive: false,
    isMutating,
    requiresConfirmation: false,
    severity: 'none',
    keywords: [],
    affectedObject: null,
  };
}

function createWarningAnalysis(params: {
  sql: string;
  operation: string;
  severity: 'medium' | 'high';
  reason: DestructiveReason;
  info: SqlObjectInfo;
}): DestructiveAnalysis {
  return {
    isDestructive: true,
    isMutating: true,
    requiresConfirmation: true,
    severity: params.severity,
    keywords: [params.operation],
    affectedObject: params.info.affectedObject,
    objectType: params.info.objectType,
    impactScope: params.info.impactScope,
    reason: params.reason,
    summary: buildSummary(params.operation, params.reason, params.info),
    reviewChecklist: buildReviewChecklist(params.reason),
    statement: params.sql.trim().slice(0, 4000),
  };
}

function analyzeAlterSql(sql: string, normalized: string): DestructiveAnalysis {
  const info = extractObjectInfo(normalized);

  if (/\bALTER\s+TABLE\b/i.test(normalized)) {
    if (/\bADD\s+(?:COLUMN|CONSTRAINT)\b/i.test(normalized)) {
      return createSafeAnalysis(true);
    }

    if (/\bDROP\s+(?:COLUMN|CONSTRAINT)\b/i.test(normalized)) {
      return createWarningAnalysis({
        sql,
        operation: 'ALTER',
        severity: 'high',
        reason: 'destructive_schema_change',
        info,
      });
    }

    if (/\b(?:ALTER\s+COLUMN|MODIFY\s+COLUMN|RENAME\b)\b/i.test(normalized)) {
      return createWarningAnalysis({
        sql,
        operation: 'ALTER',
        severity: 'medium',
        reason: 'schema_contract_change',
        info,
      });
    }

    return createSafeAnalysis(true);
  }

  return createWarningAnalysis({
    sql,
    operation: 'ALTER',
    severity: 'medium',
    reason: 'schema_contract_change',
    info,
  });
}

export function analyzeDestructiveSql(sql: string): DestructiveAnalysis {
  const normalized = normalizeSql(sql);

  if (!normalized) {
    return createSafeAnalysis(false);
  }

  if (startsWithKeyword(normalized, 'INSERT')) {
    return createSafeAnalysis(true);
  }

  if (startsWithKeyword(normalized, 'CREATE')) {
    if (/\bCREATE\s+OR\s+REPLACE\b/i.test(normalized)) {
      return createWarningAnalysis({
        sql,
        operation: 'CREATE OR REPLACE',
        severity: 'medium',
        reason: 'schema_contract_change',
        info: extractObjectInfo(normalized),
      });
    }

    return createSafeAnalysis(true);
  }

  if (startsWithKeyword(normalized, 'UPDATE')) {
    if (!hasUnsafeWhereClause(normalized)) {
      return createSafeAnalysis(true);
    }

    return createWarningAnalysis({
      sql,
      operation: 'UPDATE',
      severity: 'high',
      reason: 'unbounded_row_mutation',
      info: extractObjectInfo(normalized),
    });
  }

  if (startsWithKeyword(normalized, 'DELETE')) {
    if (!hasUnsafeWhereClause(normalized)) {
      return createSafeAnalysis(true);
    }

    return createWarningAnalysis({
      sql,
      operation: 'DELETE',
      severity: 'high',
      reason: 'unbounded_row_mutation',
      info: extractObjectInfo(normalized),
    });
  }

  if (startsWithKeyword(normalized, 'DROP')) {
    const info = extractObjectInfo(normalized);
    const severity = info.objectType === 'INDEX' ? 'medium' : 'high';
    return createWarningAnalysis({
      sql,
      operation: 'DROP',
      severity,
      reason:
        severity === 'high'
          ? 'destructive_schema_change'
          : 'schema_contract_change',
      info,
    });
  }

  if (startsWithKeyword(normalized, 'TRUNCATE')) {
    return createWarningAnalysis({
      sql,
      operation: 'TRUNCATE',
      severity: 'high',
      reason: 'destructive_schema_change',
      info: extractObjectInfo(normalized),
    });
  }

  if (startsWithKeyword(normalized, 'ALTER')) {
    return analyzeAlterSql(sql, normalized);
  }

  if (startsWithKeyword(normalized, 'RENAME')) {
    return createWarningAnalysis({
      sql,
      operation: 'RENAME',
      severity: 'medium',
      reason: 'schema_contract_change',
      info: extractObjectInfo(normalized),
    });
  }

  if (startsWithKeyword(normalized, 'MERGE')) {
    return createWarningAnalysis({
      sql,
      operation: 'MERGE',
      severity: 'medium',
      reason: 'opaque_execution',
      info: extractObjectInfo(normalized),
    });
  }

  if (
    startsWithKeyword(normalized, 'EXEC') ||
    startsWithKeyword(normalized, 'EXECUTE') ||
    startsWithKeyword(normalized, 'CALL')
  ) {
    return createWarningAnalysis({
      sql,
      operation: startsWithKeyword(normalized, 'CALL') ? 'CALL' : 'EXECUTE',
      severity: 'medium',
      reason: 'opaque_execution',
      info: extractObjectInfo(normalized),
    });
  }

  if (
    startsWithKeyword(normalized, 'ATTACH') ||
    startsWithKeyword(normalized, 'DETACH') ||
    startsWithKeyword(normalized, 'RESTORE') ||
    startsWithKeyword(normalized, 'KILL')
  ) {
    const operation = normalized.split(/\s+/, 1)[0].toUpperCase();
    return createWarningAnalysis({
      sql,
      operation,
      severity: 'high',
      reason:
        operation === 'ATTACH'
          ? 'schema_contract_change'
          : 'destructive_schema_change',
      info: extractObjectInfo(normalized),
    });
  }

  if (startsWithKeyword(normalized, 'REPLACE')) {
    return createSafeAnalysis(true);
  }

  if (
    startsWithKeyword(normalized, 'GRANT') ||
    startsWithKeyword(normalized, 'REVOKE') ||
    startsWithKeyword(normalized, 'COMMENT') ||
    startsWithKeyword(normalized, 'USE') ||
    startsWithKeyword(normalized, 'BACKUP')
  ) {
    return createSafeAnalysis(true);
  }

  if (
    SQL_WRITE_KEYWORDS.some((kw) =>
      new RegExp(`\\b${kw}\\b`, 'i').test(normalized),
    )
  ) {
    return createSafeAnalysis(true);
  }

  return createSafeAnalysis(false);
}

export function analyzeSqlConfirmation(sql: string): DestructiveAnalysis {
  const statements = splitSqlStatements(sql);
  const executableStatements = statements.length > 0 ? statements : [sql];
  const analyses = executableStatements.map((statement) =>
    analyzeDestructiveSql(statement),
  );
  const flaggedAnalyses: DestructiveAnalysis[] = [];

  analyses.forEach((analysis, index) => {
    if (!analysis.requiresConfirmation) return;

    flaggedAnalyses.push({
      ...analysis,
      statement:
        analysis.statement || executableStatements[index].trim().slice(0, 4000),
      statementIndex: index + 1,
      statementCount: executableStatements.length,
    });
  });

  if (flaggedAnalyses.length === 0) {
    return createSafeAnalysis(analyses.some((analysis) => analysis.isMutating));
  }

  const selectedAnalysis =
    flaggedAnalyses.find((analysis) => analysis.severity === 'high') ??
    flaggedAnalyses[0];

  return {
    ...selectedAnalysis,
    flaggedStatements: flaggedAnalyses.length,
  };
}

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
