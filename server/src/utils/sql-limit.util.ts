export type SqlDialect =
  | 'postgres'
  | 'mysql'
  | 'mssql'
  | 'sqlite'
  | 'clickhouse';

export interface OuterSqlLimit {
  kind: 'limit' | 'top' | 'fetch';
  value?: number;
  offset?: number;
  start: number;
  end: number;
  valid: boolean;
  reason?: string;
}

interface SqlToken {
  value: string;
  upper: string;
  start: number;
  end: number;
}

function topLevelTokens(sql: string): SqlToken[] {
  const tokens: SqlToken[] = [];
  let depth = 0;
  let quote: string | null = null;

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    const next = sql[index + 1];

    if (quote) {
      if (char === quote) {
        if (next === quote) index += 1;
        else quote = null;
      } else if (char === '\\' && quote === "'") {
        index += 1;
      }
      continue;
    }

    if (char === "'" || char === '"' || char === '`') {
      quote = char;
      continue;
    }
    if (char === '[') {
      quote = ']';
      continue;
    }
    if (char === '-' && next === '-') {
      const newline = sql.indexOf('\n', index + 2);
      index = newline === -1 ? sql.length : newline;
      continue;
    }
    if (char === '/' && next === '*') {
      const end = sql.indexOf('*/', index + 2);
      index = end === -1 ? sql.length : end + 1;
      continue;
    }
    if (char === '(') {
      depth += 1;
      continue;
    }
    if (char === ')') {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (depth !== 0 || !/[A-Za-z0-9_-]/.test(char)) continue;

    const start = index;
    while (
      index + 1 < sql.length &&
      /[A-Za-z0-9_-]/.test(sql[index + 1])
    ) {
      index += 1;
    }
    const value = sql.slice(start, index + 1);
    tokens.push({ value, upper: value.toUpperCase(), start, end: index + 1 });
  }

  return tokens;
}

function parsePositiveInteger(value: string | undefined): number | undefined {
  if (!value || !/^\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export function analyzeOuterSqlLimit(
  sql: string,
  dialect: SqlDialect,
): OuterSqlLimit | undefined {
  const tokens = topLevelTokens(sql);
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.upper === 'TOP') {
      const tail = sql.slice(token.end);
      const match = tail.match(/^\s*\(?\s*(\d+)\s*\)?(\s+PERCENT)?/i);
      const value = match ? parsePositiveInteger(match[1]) : undefined;
      const percent = Boolean(match?.[2]);
      return {
        kind: 'top',
        value,
        start: token.start,
        end: match ? token.end + match[0].length : token.end,
        valid: dialect === 'mssql' && value !== undefined && !percent,
        ...(!value || percent
          ? { reason: 'TOP must be a finite integer row count without PERCENT.' }
          : {}),
      };
    }
    if (token.upper === 'LIMIT') {
      const next = tokens[index + 1];
      const following = tokens[index + 2];
      const separator =
        next && following ? sql.slice(next.end, following.start) : '';
      const commaStyle = separator.includes(',');
      const limitBy = following?.upper === 'BY';
      if (next?.upper === 'ALL' || next?.upper === 'NULL' || next?.value === '-1') {
        return {
          kind: 'limit',
          start: token.start,
          end: next.end,
          valid: false,
          reason: 'LIMIT must be a finite positive integer.',
        };
      }
      const first = parsePositiveInteger(next?.value);
      const second = commaStyle
        ? parsePositiveInteger(following?.value)
        : undefined;
      const value = commaStyle ? second : first;
      return {
        kind: 'limit',
        value,
        offset: commaStyle ? first : undefined,
        start: token.start,
        end: (commaStyle ? following : next)?.end ?? token.end,
        valid:
          dialect !== 'mssql' &&
          !limitBy &&
          value !== undefined &&
          (!commaStyle || dialect === 'mysql'),
        ...(!value || limitBy
          ? { reason: 'LIMIT must be a finite outer row count.' }
          : {}),
      };
    }
    if (
      token.upper === 'FETCH' &&
      (tokens[index + 1]?.upper === 'FIRST' ||
        tokens[index + 1]?.upper === 'NEXT')
    ) {
      const value = parsePositiveInteger(tokens[index + 2]?.value);
      return {
        kind: 'fetch',
        value,
        start: token.start,
        end: tokens[index + 2]?.end ?? token.end,
        valid: value !== undefined,
        ...(!value
          ? { reason: 'FETCH must be a finite integer row count.' }
          : {}),
      };
    }
  }
  return undefined;
}

export function hasTopLevelSqlPagination(sql: string): boolean {
  const tokens = topLevelTokens(sql);
  return tokens.some((token) =>
    ['LIMIT', 'TOP', 'OFFSET', 'FETCH'].includes(token.upper),
  );
}

export function appendBeforeTrailingLineComment(
  sql: string,
  clause: string,
): string {
  const trimmed = sql.trim().replace(/;$/, '');
  let quote: string | null = null;
  let depth = 0;
  for (let index = 0; index < trimmed.length - 1; index += 1) {
    const char = trimmed[index];
    const next = trimmed[index + 1];
    if (quote) {
      if (char === quote) {
        if (next === quote) index += 1;
        else quote = null;
      }
      continue;
    }
    if (char === "'" || char === '"' || char === '`') quote = char;
    else if (char === '(') depth += 1;
    else if (char === ')') depth = Math.max(0, depth - 1);
    else if (char === '/' && next === '*') {
      const end = trimmed.indexOf('*/', index + 2);
      index = end === -1 ? trimmed.length : end + 1;
    } else if (char === '-' && next === '-' && depth === 0) {
      const before = trimmed.slice(0, index).trimEnd().replace(/;$/, '');
      return `${before} ${clause}; ${trimmed.slice(index)}`;
    }
  }
  return `${trimmed} ${clause};`;
}
