export type SqlDialect =
  | 'postgres'
  | 'mysql'
  | 'mssql'
  | 'sqlite'
  | 'clickhouse';

export const SQL_RESULT_HARD_LIMIT = 50_000;

export class SqlResultCapError extends Error {
  constructor(message: string) {
    super(
      `SQL result cap: ${message} The hard ceiling is 50,000 rows; a requested limit is a smaller result window, not permission to bypass that ceiling. Use a finite literal outer LIMIT/TOP/FETCH or simplify the query.`,
    );
    this.name = 'SqlResultCapError';
  }
}

export interface OuterSqlLimit {
  kind: 'limit' | 'top' | 'fetch';
  value?: number;
  offset?: number;
  start: number;
  end: number;
  valid: boolean;
  reason?: string;
  countStart?: number;
  countEnd?: number;
  global?: boolean;
  unlimited?: boolean;
  perKey?: boolean;
}

export interface SqlToken {
  kind: 'word' | 'number' | 'identifier' | 'literal' | 'parameter' | 'symbol';
  value: string;
  upper: string;
  start: number;
  end: number;
  depth: number;
  mate?: number;
}

interface SqlComment {
  start: number;
  end: number;
  line: boolean;
}

export interface SqlQueryShape {
  tokens: SqlToken[];
  top: SqlToken[];
  comments: SqlComment[];
  isSelect: boolean;
  select?: SqlToken;
  hasCte: boolean;
  wrapped: boolean;
  setOperation: boolean;
  hasOuterOrder: boolean;
  tailStart: number;
  statementEnd: number;
  terminator?: SqlToken;
  limits: OuterSqlLimit[];
  outer?: OuterSqlLimit;
  offset?: { value: number; start: number; end: number };
}

/** Matches the fail-closed quoting/comment policy of query-guard's scanner.
 * Unlike its permission view, this view retains punctuation, depth and source spans.
 * MySQL # is understood for direct strategy callers; raw-query policy may reject it.
 */
function scanSqlTokens(sql: string, dialect: SqlDialect) {
  if (sql.length > 500_000 || sql.includes('\0')) {
    throw new SqlResultCapError(
      'SQL is too long or contains a null character.',
    );
  }
  const tokens: SqlToken[] = [];
  const comments: SqlComment[] = [];
  const stack: number[] = [];
  const dollarQuote = /\$(?:[A-Za-z_][A-Za-z_0-9]*)?\$/y;
  const push = (kind: SqlToken['kind'], start: number, end: number) => {
    const value = sql.slice(start, end);
    tokens.push({
      kind,
      value,
      upper: value.toUpperCase(),
      start,
      end,
      depth: stack.length,
    });
  };

  for (let index = 0; index < sql.length; ) {
    const start = index;
    const char = sql[index];
    const next = sql[index + 1];
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    if (
      (char === '-' && next === '-') ||
      (char === '#' && dialect === 'mysql')
    ) {
      if (
        char === '-' &&
        sql[index + 2] &&
        !/[\t\n\v\f\r ]/.test(sql[index + 2])
      ) {
        throw new SqlResultCapError(
          'Ambiguous -- syntax; follow a line-comment marker with ASCII whitespace.',
        );
      }
      while (index < sql.length && !/[\r\n]/.test(sql[index])) index += 1;
      comments.push({ start, end: index, line: true });
      continue;
    }
    if (char === '/' && next === '*') {
      const end = sql.indexOf('*/', index + 2);
      const nested = sql.indexOf('/*', index + 2);
      if (
        end < 0 ||
        (nested >= 0 && nested < end) ||
        /^\/\*(?:!|M!)/i.test(sql.slice(index, index + 5))
      ) {
        throw new SqlResultCapError(
          'Unterminated, nested or executable block comments cannot be safely rewritten.',
        );
      }
      index = end + 2;
      comments.push({ start, end: index, line: false });
      continue;
    }
    dollarQuote.lastIndex = index;
    const delimiter = char === '$' ? dollarQuote.exec(sql)?.[0] : undefined;
    if (delimiter) {
      if (dialect !== 'postgres')
        throw new SqlResultCapError(
          'Dollar quoting is supported only for PostgreSQL.',
        );
      const end = sql.indexOf(delimiter, index + delimiter.length);
      if (end < 0)
        throw new SqlResultCapError('Unterminated PostgreSQL dollar quote.');
      index = end + delimiter.length;
      push('literal', start, index);
      continue;
    }
    if (char === "'" || char === '"' || char === '`' || char === '[') {
      const closing = char === '[' ? ']' : char;
      index += 1;
      let closed = false;
      while (index < sql.length) {
        if (sql[index] === '\\')
          throw new SqlResultCapError(
            'Backslash quoting is ambiguous; use standard doubled quotes.',
          );
        if (sql[index] === closing) {
          if (sql[index + 1] === closing) {
            index += 2;
            continue;
          }
          index += 1;
          closed = true;
          break;
        }
        index += 1;
      }
      if (!closed)
        throw new SqlResultCapError(
          'Unterminated SQL string or quoted identifier.',
        );
      push(char === "'" ? 'literal' : 'identifier', start, index);
      continue;
    }
    if (
      /[A-Za-z_\u0080-\uffff]/.test(char) ||
      (char === '#' && dialect === 'mssql')
    ) {
      index += 1;
      while (
        index < sql.length &&
        /[A-Za-z0-9_$\u0080-\uffff]/.test(sql[index])
      )
        index += 1;
      push('word', start, index);
      continue;
    }
    if (/[0-9]/.test(char)) {
      index += 1;
      while (index < sql.length && /[0-9]/.test(sql[index])) index += 1;
      push('number', start, index);
      continue;
    }
    if (char === '$' || char === '@' || char === ':' || char === '?') {
      index += 1;
      while (index < sql.length && /[A-Za-z0-9_]/.test(sql[index])) index += 1;
      push('parameter', start, index);
      continue;
    }
    if (char === '(') {
      push('symbol', start, ++index);
      stack.push(tokens.length - 1);
      continue;
    }
    if (char === ')') {
      const open = stack.pop();
      if (open === undefined)
        throw new SqlResultCapError('Unbalanced SQL parentheses.');
      push('symbol', start, ++index);
      tokens[open].mate = tokens.length - 1;
      tokens[tokens.length - 1].mate = open;
      continue;
    }
    push('symbol', start, ++index);
  }
  if (stack.length) throw new SqlResultCapError('Unbalanced SQL parentheses.');
  const semicolons = tokens.filter((token) => token.value === ';');
  const terminator = semicolons[0];
  if (
    semicolons.length > 1 ||
    (terminator && terminator !== tokens[tokens.length - 1])
  ) {
    throw new SqlResultCapError(
      'Injection accepts one statement at a time; split SQL batches before applying result caps.',
    );
  }
  if (terminator) tokens.pop();
  return { tokens, comments, terminator };
}

function isWord(token: SqlToken | undefined, word: string): boolean {
  return token?.kind === 'word' && token.upper === word;
}

function parsePositiveInteger(value: string | undefined): number | undefined {
  if (!value || !/^\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

function literalCount(token: SqlToken | undefined): number | undefined {
  return token?.kind === 'number'
    ? parsePositiveInteger(token.value)
    : undefined;
}

function statementStart(
  tokens: SqlToken[],
  first: number,
  last: number,
): number {
  while (tokens[first]?.value === '(' && tokens[first].mate === last) {
    first += 1;
    last -= 1;
  }
  if (!isWord(tokens[first], 'WITH')) return first;
  let index = first + 1;
  if (isWord(tokens[index], 'RECURSIVE')) index += 1;
  for (;;) {
    if (!['word', 'identifier'].includes(tokens[index]?.kind))
      throw new SqlResultCapError(
        'Cannot prove the CTE name and outer statement.',
      );
    index += 1;
    if (tokens[index]?.value === '(') index = (tokens[index].mate ?? last) + 1;
    if (!isWord(tokens[index++], 'AS'))
      throw new SqlResultCapError('Cannot prove the CTE AS boundary.');
    if (isWord(tokens[index], 'NOT')) index += 1;
    if (isWord(tokens[index], 'MATERIALIZED')) index += 1;
    if (tokens[index]?.value !== '(' || tokens[index].mate === undefined)
      throw new SqlResultCapError('Cannot prove the CTE body boundary.');
    index = tokens[index].mate! + 1;
    if (tokens[index]?.value !== ',') return index;
    index += 1;
  }
}

function invalidLimit(
  token: SqlToken,
  reason: string,
  kind: OuterSqlLimit['kind'] = 'limit',
): OuterSqlLimit {
  return { kind, start: token.start, end: token.end, valid: false, reason };
}

function parseTop(
  tokens: SqlToken[],
  selectIndex: number,
): OuterSqlLimit | undefined {
  let index = selectIndex + 1;
  if (isWord(tokens[index], 'ALL') || isWord(tokens[index], 'DISTINCT'))
    index += 1;
  const top = tokens[index];
  if (!isWord(top, 'TOP')) return undefined;
  index += 1;
  let count = tokens[index];
  if (count?.value === '(') {
    if (count.mate !== index + 2)
      return invalidLimit(
        top,
        'TOP requires a complete finite literal, not an expression or parameter.',
        'top',
      );
    count = tokens[index + 1];
    index += 3;
  } else {
    index += 1;
  }
  const value = literalCount(count);
  if (value === undefined)
    return invalidLimit(
      top,
      'TOP requires a complete finite literal row count.',
      'top',
    );
  if (
    tokens[index]?.kind === 'symbol' &&
    !['*', '(', ')'].includes(tokens[index].value)
  )
    return invalidLimit(
      top,
      'TOP count has an unsupported expression boundary.',
      'top',
    );
  if (
    isWord(tokens[index], 'PERCENT') ||
    (isWord(tokens[index], 'WITH') && isWord(tokens[index + 1], 'TIES'))
  ) {
    return invalidLimit(
      top,
      'TOP PERCENT and WITH TIES are not finite total-row caps.',
      'top',
    );
  }
  if (
    count.end === tokens[index]?.start &&
    ['word', 'number', 'parameter'].includes(tokens[index].kind)
  ) {
    return invalidLimit(
      top,
      'TOP count is not a complete finite literal.',
      'top',
    );
  }
  return {
    kind: 'top',
    value,
    start: top.start,
    end: tokens[index - 1].end,
    countStart: count.start,
    countEnd: count.end,
    valid: true,
  };
}

function parseTailLimit(
  top: SqlToken[],
  index: number,
  dialect: SqlDialect,
  tailStart: number,
): OuterSqlLimit {
  const token = top[index];
  const kind = isWord(token, 'FETCH') ? 'fetch' : 'limit';
  let cursor = index + 1;
  if (kind === 'fetch') {
    if (
      !['postgres', 'mssql'].includes(dialect) ||
      (!isWord(top[cursor], 'FIRST') && !isWord(top[cursor], 'NEXT'))
    ) {
      return invalidLimit(
        token,
        'FETCH FIRST/NEXT is unsupported or ambiguous in this dialect.',
        kind,
      );
    }
    cursor += 1;
  } else if (dialect === 'mssql') {
    return invalidLimit(
      token,
      'Use SQL Server TOP or ordered OFFSET/FETCH, not LIMIT.',
    );
  }
  let count = top[cursor];
  if (kind === 'limit' && isWord(count, 'ALL')) {
    return {
      ...invalidLimit(token, 'LIMIT ALL is unbounded.'),
      end: count.end,
      countStart: count.start,
      countEnd: count.end,
      unlimited: true,
    };
  }
  let value = literalCount(count);
  if (kind === 'fetch' && (isWord(count, 'ROW') || isWord(count, 'ROWS')))
    value = 1;
  else cursor += 1;
  if (value === undefined)
    return invalidLimit(
      token,
      `${kind.toUpperCase()} requires a complete finite literal, not an expression or parameter.`,
      kind,
    );
  let offset: number | undefined;
  if (kind === 'limit' && top[cursor]?.value === ',') {
    if (!['mysql', 'sqlite', 'clickhouse'].includes(dialect))
      return invalidLimit(
        token,
        'Comma-offset LIMIT is unsupported in this dialect.',
      );
    offset = value;
    count = top[++cursor];
    value = literalCount(count);
    cursor += 1;
    if (value === undefined)
      return invalidLimit(
        token,
        'Comma-offset LIMIT requires a finite literal row count.',
      );
  }
  if (kind === 'limit' && isWord(top[cursor], 'OFFSET')) {
    offset = literalCount(top[cursor + 1]);
    if (offset === undefined)
      return invalidLimit(
        token,
        'OFFSET requires a complete non-negative literal.',
      );
    cursor += 2;
    if (isWord(top[cursor], 'ROW') || isWord(top[cursor], 'ROWS')) cursor += 1;
  }
  if (kind === 'limit' && isWord(top[cursor], 'BY')) {
    return {
      ...invalidLimit(
        token,
        'LIMIT BY (including OFFSET ... BY) is a per-key bound, not a finite total-row cap.',
      ),
      perKey: true,
    };
  }
  if (kind === 'fetch') {
    if (!isWord(top[cursor], 'ROW') && !isWord(top[cursor], 'ROWS'))
      return invalidLimit(token, 'FETCH must end with ROWS ONLY.', kind);
    cursor += 1;
    if (isWord(top[cursor], 'WITH') && isWord(top[cursor + 1], 'TIES'))
      return invalidLimit(
        token,
        'FETCH WITH TIES is not a finite total-row cap.',
        kind,
      );
    if (!isWord(top[cursor++], 'ONLY'))
      return invalidLimit(token, 'FETCH must end with ROWS ONLY.', kind);
  }
  const following = top[cursor];
  if (
    following &&
    following.start < tailStart &&
    !isWord(following, 'OFFSET')
  ) {
    return invalidLimit(
      token,
      `${kind.toUpperCase()} count has an expression, duplicate clause or unsupported suffix.`,
      kind,
    );
  }
  const hasCount = count?.kind === 'number';
  if (
    following &&
    count?.end === following.start &&
    ['word', 'number', 'parameter'].includes(following.kind)
  )
    return invalidLimit(
      token,
      'Result count is not a complete finite literal.',
      kind,
    );
  return {
    kind,
    value,
    offset,
    start: token.start,
    end: top[cursor - 1].end,
    countStart: hasCount ? count.start : undefined,
    countEnd: hasCount ? count.end : undefined,
    valid: true,
  };
}

function topLevelTokens(
  tokens: SqlToken[],
  first: number,
  last: number,
): SqlToken[] {
  return tokens
    .slice(first, last + 1)
    .filter((token) => token.depth === tokens[first]?.depth);
}

export function inspectSqlQuery(
  sql: string,
  dialect: SqlDialect = 'postgres',
): SqlQueryShape {
  const { tokens, comments, terminator } = scanSqlTokens(sql, dialect);
  const statementEnd = tokens[tokens.length - 1]?.end ?? 0;
  const shape: SqlQueryShape = {
    tokens,
    top: [],
    comments,
    terminator,
    statementEnd,
    tailStart: statementEnd,
    isSelect: false,
    hasCte: false,
    wrapped: false,
    setOperation: false,
    hasOuterOrder: false,
    limits: [],
  };
  if (!tokens.length) return shape;
  let first = 0;
  let last = tokens.length - 1;
  while (tokens[first].value === '(' && tokens[first].mate === last) {
    first += 1;
    last -= 1;
    shape.wrapped = true;
  }
  shape.hasCte = isWord(tokens[first], 'WITH');
  const start = statementStart(tokens, first, last);
  const root = topLevelTokens(tokens, start, last);
  const select = tokens[start];
  if (select?.value === '(' && select.mate !== undefined) {
    if (shape.hasCte && dialect === 'mssql')
      throw new SqlResultCapError(
        'A SQL Server CTE requires a statement-scope outer SELECT, not a parenthesized query expression.',
      );
    const inside = statementStart(tokens, start + 1, select.mate - 1);
    shape.isSelect = isWord(tokens[inside], 'SELECT');
  } else {
    shape.isSelect = isWord(select, 'SELECT');
    shape.select = shape.isSelect ? select : undefined;
  }
  shape.top = root;
  if (!shape.isSelect) return shape;
  // SELECT INTO changes data. Never apply a browse window to a write statement.
  if (root.some((token) => isWord(token, 'INTO'))) {
    shape.isSelect = false;
    return shape;
  }
  const setIndexes = root
    .map((token, index) =>
      ['UNION', 'INTERSECT', 'EXCEPT'].some((word) => isWord(token, word))
        ? index
        : -1,
    )
    .filter((index) => index >= 0);
  shape.setOperation = setIndexes.length > 0;
  const lastSet = setIndexes[setIndexes.length - 1] ?? -1;
  const tail = root.find(
    (token, index) =>
      index > lastSet &&
      ((['postgres', 'mysql'].includes(dialect) &&
        isWord(token, 'FOR') &&
        ['UPDATE', 'SHARE', 'NO', 'KEY'].some((word) =>
          isWord(root[index + 1], word),
        )) ||
        (dialect === 'mysql' &&
          isWord(token, 'LOCK') &&
          isWord(root[index + 1], 'IN')) ||
        (dialect === 'mssql' &&
          isWord(token, 'OPTION') &&
          root[index + 1]?.value === '(') ||
        (dialect === 'clickhouse' &&
          isWord(token, 'SETTINGS') &&
          root[index + 2]?.value === '=') ||
        (dialect === 'clickhouse' &&
          isWord(token, 'FORMAT') &&
          root[index + 1]?.kind === 'word' &&
          index + 2 === root.length)),
  );
  shape.tailStart = tail?.start ?? statementEnd;
  shape.hasOuterOrder = root.some(
    (token, index) =>
      index > lastSet &&
      isWord(token, 'ORDER') &&
      isWord(root[index + 1], 'BY'),
  );

  if (dialect === 'mssql') {
    for (const token of root) {
      if (!isWord(token, 'SELECT')) continue;
      const top = parseTop(tokens, tokens.indexOf(token));
      if (top) {
        top.global = !shape.setOperation;
        shape.limits.push(top);
      }
    }
  }
  for (let index = 0; index < root.length; index += 1) {
    const token = root[index];
    if (token.start >= shape.tailStart) break;
    if (
      isWord(token, 'LIMIT') ||
      (isWord(token, 'FETCH') &&
        (isWord(root[index + 1], 'FIRST') || isWord(root[index + 1], 'NEXT')))
    ) {
      const limit = parseTailLimit(root, index, dialect, shape.tailStart);
      limit.global =
        index > lastSet && !(dialect === 'clickhouse' && shape.setOperation);
      shape.limits.push(limit);
    }
    if (isWord(token, 'OFFSET')) {
      const value = literalCount(root[index + 1]);
      let endIndex = index + 2;
      if (isWord(root[endIndex], 'ROW') || isWord(root[endIndex], 'ROWS'))
        endIndex += 1;
      const following = root[endIndex];
      if (
        value === undefined ||
        (following &&
          following.start < shape.tailStart &&
          !['FETCH', 'LIMIT', 'BY'].some((word) => isWord(following, word)))
      ) {
        throw new SqlResultCapError(
          'OFFSET must be a complete non-negative literal followed by a supported outer clause.',
        );
      }
      if (index > lastSet)
        shape.offset = {
          value,
          start: token.start,
          end: root[endIndex - 1].end,
        };
    }
  }
  const globals = shape.limits.filter((limit) => limit.global && !limit.perKey);
  if (globals.length > 1)
    throw new SqlResultCapError(
      'Multiple outer result clauses cannot be safely combined.',
    );
  shape.outer = globals[0] ?? shape.limits.find((limit) => !limit.valid);
  if (shape.offset && dialect === 'mssql' && !shape.hasOuterOrder)
    throw new SqlResultCapError(
      'SQL Server OFFSET/FETCH requires an outer ORDER BY; an inner CTE order does not satisfy it.',
    );
  if (shape.offset && dialect === 'mssql' && shape.outer?.kind === 'top')
    throw new SqlResultCapError(
      'SQL Server TOP and OFFSET/FETCH cannot be combined at the same outer SELECT.',
    );
  return shape;
}

export function assertSqlResultCap(
  shape: SqlQueryShape,
  allowLimitAll = false,
): void {
  if (!shape.isSelect) return;
  for (const limit of shape.limits) {
    if (limit.perKey && shape.outer?.valid && shape.outer.global) continue;
    if (!limit.valid && !(allowLimitAll && limit.unlimited))
      throw new SqlResultCapError(
        limit.reason || 'The outer row bound is ambiguous.',
      );
    if (limit.value !== undefined && limit.value > SQL_RESULT_HARD_LIMIT)
      throw new SqlResultCapError(
        'An explicit result bound exceeds 50,000 rows, even when a smaller requested window is supplied.',
      );
  }
}

export function analyzeOuterSqlLimit(
  sql: string,
  dialect: SqlDialect,
): OuterSqlLimit | undefined {
  return inspectSqlQuery(sql, dialect).outer;
}

export function hasTopLevelSqlPagination(
  sql: string,
  dialect: SqlDialect = 'postgres',
): boolean {
  const shape = inspectSqlQuery(sql, dialect);
  return Boolean(shape.isSelect && (shape.outer || shape.offset));
}

/** Isolate terminal comments from derived-table closures. Mid-query comments stay put. */
export function sqlStatementParts(sql: string, shape: SqlQueryShape) {
  const body = sql.slice(0, shape.statementEnd).trim();
  const suffix = sql.slice(shape.terminator?.end ?? shape.statementEnd).trim();
  return { body, suffix: suffix ? ` ${suffix}` : '' };
}

export function appendBeforeTrailingLineComment(
  sql: string,
  clause: string,
  dialect: SqlDialect = 'postgres',
): string {
  const shape = inspectSqlQuery(sql, dialect);
  const trailingLine = shape.comments.find(
    (comment) => comment.line && comment.start >= shape.statementEnd,
  );
  const insertAt = Math.min(
    shape.terminator?.start ?? sql.trimEnd().length,
    trailingLine?.start ?? sql.length,
    shape.tailStart < shape.statementEnd ? shape.tailStart : sql.length,
  );
  const prefix = sql.slice(0, insertAt);
  const previousLineComment = shape.comments.find(
    (comment) =>
      comment.line &&
      comment.end <= insertAt &&
      /^\s*$/.test(sql.slice(comment.end, insertAt)),
  );
  // Keep the line break that terminates a comment immediately before a locking/settings tail.
  const before = previousLineComment
    ? prefix.replace(/[\t ]+$/, '')
    : prefix.trimEnd();
  const separator = /[\r\n]$/.test(before) ? '' : ' ';
  const after = sql.slice(insertAt).trim();
  if (shape.tailStart < shape.statementEnd && insertAt === shape.tailStart) {
    return `${before}${separator}${clause} ${after.replace(/;$/, '')}${shape.terminator ? '' : ';'}`;
  }
  const suffix =
    shape.terminator && insertAt === shape.terminator.start
      ? sql.slice(shape.terminator.end).trim()
      : after;
  return `${before} ${clause};${suffix ? ` ${suffix}` : ''}`;
}
