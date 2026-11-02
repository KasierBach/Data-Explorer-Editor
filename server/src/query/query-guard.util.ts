import { validateMongoExecutablePayload } from '../ai/mongo-payload-validator';
import {
  sanitizeNoSql,
  validateNoSqlPayload,
} from '../common/utils/nosql-sanitizer.util';

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
  'INTO',
  'VACUUM',
  'COPY',
  'LOAD',
  'DO',
  'SET',
];

const MONGO_READ_ONLY_ACTIONS = new Set(['find', 'aggregate', 'count']);
export const MAX_SQL_LENGTH = 500_000;
export const MAX_SQL_STATEMENTS = 100;

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
  return scanSql(sql)
    .map((statement) => statement.normalized)
    .join('; ');
}

export function isSqlAllowedOnReadOnly(sql: string, dialect?: string): boolean {
  try {
    return scanSql(sql, dialect).every(({ code }) => {
      const normalized = code.toUpperCase();
      if (
        SQL_WRITE_KEYWORDS.some((kw) =>
          new RegExp(`\\b${kw}\\b`).test(normalized),
        )
      ) {
        return false;
      }
      if (/^PRAGMA\b/.test(normalized)) {
        return /^PRAGMA\s+(?:\w+\.)?(?:(?:TABLE_INFO|TABLE_XINFO|INDEX_LIST|INDEX_INFO|INDEX_XINFO|FOREIGN_KEY_LIST)\s*\([^()=;]*\)|DATABASE_LIST|COMPILE_OPTIONS|USER_VERSION|FOREIGN_KEYS)\s*$/.test(
          normalized,
        );
      }
      return SQL_READ_ONLY_PREFIXES.some((prefix) =>
        new RegExp(`^${prefix}\\b`).test(normalized),
      );
    });
  } catch {
    // Unsupported lexical forms fail closed; callers must never infer permission from a parse failure.
    return false;
  }
}

export function isLikelyDestructiveSql(sql: string): boolean {
  return analyzeSqlConfirmation(sql).requiresConfirmation;
}

export function containsMultipleStatements(sql: string): boolean {
  return splitSqlStatements(sql).length > 1;
}

interface ScannedSqlStatement {
  sql: string;
  normalized: string;
  code: string;
  objectCode: string;
}

function scanSql(sql: string, dialect?: string): ScannedSqlStatement[] {
  if (sql.length > MAX_SQL_LENGTH) {
    throw new RangeError(
      `SQL query exceeds the maximum length of ${MAX_SQL_LENGTH} characters.`,
    );
  }

  if (sql.includes('\0'))
    throw new RangeError('SQL contains a null character.');
  const statements: ScannedSqlStatement[] = [];
  const mysqlDialect = dialect === 'mysql' || dialect === 'mariadb';
  const dollarQuote = /\$(?:[A-Za-z_][A-Za-z_0-9]*)?\$/y;
  let start = 0;
  let normalized: string[] = [];
  let code: string[] = [];
  let objectCode: string[] = [];
  const append = (end: number) => {
    const executable = code.join('').replace(/\s+/g, ' ').trim();
    if (!executable) return;
    if (statements.length >= MAX_SQL_STATEMENTS) {
      throw new RangeError(
        `SQL query exceeds the maximum of ${MAX_SQL_STATEMENTS} statements.`,
      );
    }
    statements.push({
      sql: sql.slice(start, end).trim(),
      normalized: normalized.join('').replace(/\s+/g, ' ').trim(),
      code: executable,
      objectCode: objectCode.join('').replace(/\s+/g, ' ').trim(),
    });
  };

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const next = sql[i + 1];
    if (ch === '#' && mysqlDialect) {
      throw new RangeError(
        'MySQL hash comments are unsupported; use -- followed by ASCII whitespace.',
      );
    }
    if (ch === '-' && next === '-') {
      const commentWhitespace = mysqlDialect ? /[\t\n\v\f\r ]/ : /\s/;
      if (sql[i + 2] && !commentWhitespace.test(sql[i + 2])) {
        throw new RangeError(
          'Unsupported SQL line comment; add whitespace after --.',
        );
      }
      while (i + 1 < sql.length && !/[\r\n]/.test(sql[i + 1])) i++;
      normalized.push(' ');
      code.push(' ');
      objectCode.push(' ');
      continue;
    }
    if (ch === '/' && next === '*') {
      const end = sql.indexOf('*/', i + 2);
      const nested = sql.indexOf('/*', i + 2);
      if (
        end < 0 ||
        (nested >= 0 && nested < end) ||
        /^\/\*(?:!|M!)/i.test(sql.slice(i, i + 5))
      ) {
        throw new RangeError(
          'Unsupported SQL comment; use a complete, non-executable, non-nested comment.',
        );
      }
      i = end + 1;
      normalized.push(' ');
      code.push(' ');
      objectCode.push(' ');
      continue;
    }
    dollarQuote.lastIndex = i;
    const dollar = ch === '$' ? dollarQuote.exec(sql)?.[0] : undefined;
    const quoteEnd = ch === '[' ? ']' : ch;
    if (dollar || ch === "'" || ch === '"' || ch === '`' || ch === '[') {
      const quoteStart = i;
      if (dollar) {
        if (dialect && dialect !== 'postgres') {
          throw new RangeError(
            'Dollar-quoted SQL is supported only for PostgreSQL.',
          );
        }
        const end = sql.indexOf(dollar, i + dollar.length);
        if (end < 0) throw new RangeError('Unterminated SQL dollar quote.');
        i = end + dollar.length - 1;
      } else {
        i++;
        for (; i < sql.length; i++) {
          if (sql[i] === '\\') {
            throw new RangeError(
              'Backslash SQL quoting is unsupported; use standard doubled quotes.',
            );
          }
          if (sql[i] !== quoteEnd) continue;
          if (sql[i + 1] !== quoteEnd) break;
          i++;
        }
        if (i >= sql.length) throw new RangeError('Unterminated SQL quote.');
      }
      normalized.push(sql.slice(quoteStart, i + 1));
      code.push(' ? ');
      objectCode.push(
        dollar || ch === "'" ? ' ? ' : sql.slice(quoteStart, i + 1),
      );
      continue;
    }
    if (ch === ';') {
      append(i);
      start = i + 1;
      normalized = [];
      code = [];
      objectCode = [];
      continue;
    }
    normalized.push(ch);
    code.push(ch);
    objectCode.push(ch);
  }
  append(sql.length);
  return statements;
}

export function splitSqlStatements(sql: string, dialect?: string): string[] {
  return scanSql(sql, dialect).map((statement) => statement.sql);
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
    const rawObject = match[pattern.objectGroup];
    const objectStart = (match.index ?? 0) + match[0].lastIndexOf(rawObject);
    const quotedObject = normalized
      .slice(objectStart)
      .match(
        /^(?:"(?:[^"]|"")*"|`(?:[^`]|``)*`|\[(?:[^\]]|\]\])*\])(?:\.(?:"(?:[^"]|"")*"|`(?:[^`]|``)*`|\[(?:[^\]]|\]\])*\]|[\w$]+))*/,
      );
    return {
      affectedObject: cleanIdentifier(quotedObject?.[0] ?? rawObject),
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

function analyzeAlterSql(
  sql: string,
  normalized: string,
  objectSql = normalized,
): DestructiveAnalysis {
  const info = extractObjectInfo(objectSql);

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
  const scanned = scanSql(sql);
  const normalized = scanned.map((statement) => statement.code).join('; ');
  const objectSql = scanned.map((statement) => statement.objectCode).join('; ');

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
        info: extractObjectInfo(objectSql),
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
      info: extractObjectInfo(objectSql),
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
      info: extractObjectInfo(objectSql),
    });
  }

  if (startsWithKeyword(normalized, 'DROP')) {
    const info = extractObjectInfo(objectSql);
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
      info: extractObjectInfo(objectSql),
    });
  }

  if (startsWithKeyword(normalized, 'ALTER')) {
    return analyzeAlterSql(sql, normalized, objectSql);
  }

  if (startsWithKeyword(normalized, 'RENAME')) {
    return createWarningAnalysis({
      sql,
      operation: 'RENAME',
      severity: 'medium',
      reason: 'schema_contract_change',
      info: extractObjectInfo(objectSql),
    });
  }

  if (startsWithKeyword(normalized, 'MERGE')) {
    return createWarningAnalysis({
      sql,
      operation: 'MERGE',
      severity: 'medium',
      reason: 'opaque_execution',
      info: extractObjectInfo(objectSql),
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
      info: extractObjectInfo(objectSql),
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
      info: extractObjectInfo(objectSql),
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
    return createWarningAnalysis({
      sql,
      operation: 'WRITE',
      severity: 'high',
      reason: 'opaque_execution',
      info: extractObjectInfo(objectSql),
    });
  }

  return createSafeAnalysis(false);
}

export function analyzeSqlConfirmation(
  sql: string,
  dialect?: string,
): DestructiveAnalysis {
  const statements = splitSqlStatements(sql, dialect);
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

function isReadOnlyMongoPipeline(pipeline: unknown): boolean {
  if (!Array.isArray(pipeline)) return false;
  if (pipeline.length === 0) return true;
  if (
    validateMongoExecutablePayload({
      action: 'aggregate',
      collection: 'validation',
      pipeline,
    }).length
  )
    return false;
  return pipeline.every((stage: Record<string, unknown>) => {
    const lookup = stage.$lookup as Record<string, unknown> | undefined;
    if (
      lookup?.pipeline !== undefined &&
      !isReadOnlyMongoPipeline(lookup.pipeline)
    )
      return false;
    const facet = stage.$facet as Record<string, unknown> | undefined;
    return !facet || Object.values(facet).every(isReadOnlyMongoPipeline);
  });
}

export function isMongoPayloadAllowedOnReadOnly(
  payloadString: string,
): boolean {
  try {
    const payload = JSON.parse(payloadString) as Record<string, unknown>;
    validateNoSqlPayload(payload);
    sanitizeNoSql(payload);
    if (
      !isMongoActionAllowedOnReadOnly(getMongoActionFromPayload(payloadString))
    )
      return false;
    return (
      payload.action !== 'aggregate' ||
      isReadOnlyMongoPipeline(payload.pipeline)
    );
  } catch {
    return false;
  }
}
