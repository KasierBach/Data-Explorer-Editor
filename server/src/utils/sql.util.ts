import {
  analyzeOuterSqlLimit,
  appendBeforeTrailingLineComment,
  assertSqlResultCap,
  inspectSqlQuery,
  SQL_RESULT_HARD_LIMIT,
  SqlResultCapError,
  sqlStatementParts,
  type SqlDialect,
  type SqlQueryShape,
} from './sql-limit.util';

export class SqlUtil {
  private static isSelectStatement(
    sql: string,
    dialect: SqlDialect = 'postgres',
  ): boolean {
    return inspectSqlQuery(sql, dialect).isSelect;
  }

  static analyzeOuterLimit(sql: string, dialect: SqlDialect) {
    return analyzeOuterSqlLimit(sql, dialect);
  }

  static isSelect(sql: string, dialect: SqlDialect = 'postgres'): boolean {
    return SqlUtil.isSelectStatement(sql, dialect);
  }

  static assertResultCap(sql: string, dialect: SqlDialect): void {
    assertSqlResultCap(inspectSqlQuery(sql, dialect));
  }

  private static assertWindow(limit: number, offset = 0): void {
    if (
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > SQL_RESULT_HARD_LIMIT
    ) {
      throw new SqlResultCapError(
        'A requested result window must be an integer from 1 to 50,000.',
      );
    }
    if (!Number.isSafeInteger(offset) || offset < 0) {
      throw new SqlResultCapError(
        'A requested offset must be a non-negative safe integer.',
      );
    }
  }

  private static shrinkCount(
    sql: string,
    shape: SqlQueryShape,
    limit: number,
  ): string {
    const outer = shape.outer;
    if (outer?.countStart === undefined || outer.countEnd === undefined) {
      throw new SqlResultCapError(
        'Cannot locate a complete outer literal count for rewriting.',
      );
    }
    return `${sql.slice(0, outer.countStart)}${limit}${sql.slice(outer.countEnd)}`;
  }

  /** Protective defaults and requested windows share the hard ceiling, not their size.
   * A finite LIMIT 10 with requested limit 5 is rewritten to 5, not rejected.
   */
  static injectLimit(
    sql: string,
    limit = SQL_RESULT_HARD_LIMIT,
    dialect: Exclude<SqlDialect, 'mssql'> = 'postgres',
  ): string {
    const shape = inspectSqlQuery(sql, dialect);
    if (!shape.isSelect) return sql;
    SqlUtil.assertWindow(limit);
    assertSqlResultCap(shape, true);
    const outer = shape.outer;
    if (outer?.unlimited) {
      return SqlUtil.shrinkCount(sql, shape, limit);
    }
    if (outer?.valid && outer.global && !shape.wrapped) {
      return outer.value !== undefined && outer.value > limit
        ? SqlUtil.shrinkCount(sql, shape, limit)
        : sql;
    }
    if (dialect === 'clickhouse' && shape.setOperation) {
      return SqlUtil.wrapPage(sql, shape, limit, 0, dialect);
    }
    return appendBeforeTrailingLineComment(sql, `LIMIT ${limit}`, dialect);
  }

  /** TOP is inserted after SELECT [ALL|DISTINCT], never into a projection token.
   * CTEs and compound results instead get a global, ordered OFFSET/FETCH window.
   */
  static injectTop(sql: string, limit = SQL_RESULT_HARD_LIMIT): string {
    const shape = inspectSqlQuery(sql, 'mssql');
    if (!shape.isSelect) return sql;
    SqlUtil.assertWindow(limit);
    assertSqlResultCap(shape);
    if (shape.outer?.valid && shape.outer.global && !shape.wrapped) {
      return shape.outer.value !== undefined && shape.outer.value > limit
        ? SqlUtil.shrinkCount(sql, shape, limit)
        : sql;
    }
    if (shape.offset) {
      return appendBeforeTrailingLineComment(
        sql,
        `FETCH NEXT ${limit} ROWS ONLY`,
        'mssql',
      );
    }
    if (shape.setOperation || shape.wrapped) {
      if (shape.hasOuterOrder && !shape.wrapped) {
        return appendBeforeTrailingLineComment(
          sql,
          `OFFSET 0 ROWS FETCH NEXT ${limit} ROWS ONLY`,
          'mssql',
        );
      }
      return SqlUtil.wrapPage(sql, shape, limit, 0, 'mssql');
    }
    if (shape.hasCte) {
      const order = shape.hasOuterOrder ? '' : 'ORDER BY (SELECT NULL) ';
      return appendBeforeTrailingLineComment(
        sql,
        `${order}OFFSET 0 ROWS FETCH NEXT ${limit} ROWS ONLY`,
        'mssql',
      );
    }
    const select = shape.select;
    if (!select)
      throw new SqlResultCapError('Cannot locate the outer SQL Server SELECT.');
    const selectIndex = shape.top.indexOf(select);
    const modifier = shape.top[selectIndex + 1];
    const at =
      modifier?.kind === 'word' && ['ALL', 'DISTINCT'].includes(modifier.upper)
        ? modifier.end
        : select.end;
    const suffix = sql.slice(at);
    return `${sql.slice(0, at)} TOP ${limit}${/^\s/.test(suffix) ? '' : ' '}${suffix}`;
  }

  private static wrapPage(
    sql: string,
    shape: SqlQueryShape,
    limit: number,
    offset: number,
    dialect: SqlDialect,
  ): string {
    const { body, suffix } = sqlStatementParts(sql, shape);
    let prefix = '';
    let inner = body;
    if (shape.hasCte && dialect === 'mssql') {
      const boundary = shape.select?.start;
      if (boundary === undefined || shape.wrapped)
        throw new SqlResultCapError(
          'Cannot safely lift a wrapped SQL Server CTE into an outer page.',
        );
      prefix = `${sql.slice(0, boundary).trim()} `;
      inner = sql.slice(boundary, shape.statementEnd).trim();
    }
    if (dialect === 'mssql') {
      if (shape.tailStart < shape.statementEnd)
        throw new SqlResultCapError(
          'SQL Server OPTION/locking suffix cannot safely move into a paged derived table; keep the CTE at statement scope and simplify the outer query.',
        );
      if (
        shape.hasOuterOrder &&
        !shape.offset &&
        !(shape.outer?.kind === 'top' && shape.outer.global)
      ) {
        inner = `${inner} OFFSET 0 ROWS`;
      }
      return `${prefix}SELECT * FROM (${inner}) AS _paged_result ORDER BY (SELECT NULL) OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY;${suffix}`;
    }
    return `SELECT * FROM (${inner}) AS _paged_result LIMIT ${limit} OFFSET ${offset};${suffix}`;
  }

  static injectPagination(
    sql: string,
    limit: number,
    offset: number,
    dialect: SqlDialect,
    options?: { totalCount?: number; primaryKey?: string },
  ): string {
    const shape = inspectSqlQuery(sql, dialect);
    if (!shape.isSelect) return sql;
    SqlUtil.assertWindow(limit, offset);
    assertSqlResultCap(shape);
    if (
      shape.outer ||
      shape.offset ||
      shape.wrapped ||
      (dialect === 'clickhouse' && shape.setOperation)
    ) {
      return SqlUtil.wrapPage(sql, shape, limit, offset, dialect);
    }

    // Reverse only a simple ordered projection. Preserve final partial pages and
    // never append a second ORDER BY or treat a literal/CTE order as the outer order.
    if (
      options?.totalCount &&
      options.primaryKey &&
      options.totalCount > 10_000 &&
      offset > options.totalCount / 2 &&
      options.totalCount - offset >= limit &&
      !shape.setOperation &&
      !shape.hasCte &&
      shape.tailStart === shape.statementEnd &&
      !shape.top.some(
        (token) =>
          token.kind === 'word' && ['GROUP', 'HAVING'].includes(token.upper),
      )
    ) {
      const pk = options.primaryKey;
      const orderIndex = shape.top.findIndex(
        (token, index) =>
          token.kind === 'word' &&
          token.upper === 'ORDER' &&
          shape.top[index + 1]?.upper === 'BY',
      );
      const order = orderIndex < 0 ? [] : shape.top.slice(orderIndex + 2);
      const orderName =
        order[0]?.kind === 'identifier'
          ? order[0].value
              .slice(1, -1)
              .replace(/``/g, '`')
              .replace(/""/g, '"')
              .replace(/]]/g, ']')
          : order[0]?.value;
      const matchesPk =
        order.length === 0 ||
        (order.length <= 2 &&
          orderName === pk &&
          (order.length === 1 || order[1].upper === 'ASC'));
      if (matchesPk) {
        const quotedPk =
          dialect === 'mysql' || dialect === 'clickhouse'
            ? `\`${pk.replace(/`/g, '``')}\``
            : dialect === 'mssql'
              ? `[${pk.replace(/]/g, ']]')}]`
              : `"${pk.replace(/"/g, '""')}"`;
        const { body, suffix } = sqlStatementParts(sql, shape);
        const base =
          orderIndex < 0
            ? body
            : sql.slice(0, shape.top[orderIndex].start).trimEnd();
        const reverseOffset = options.totalCount - offset - limit;
        const inner =
          dialect === 'mssql'
            ? `${base} ORDER BY ${quotedPk} DESC OFFSET ${reverseOffset} ROWS FETCH NEXT ${limit} ROWS ONLY`
            : `${base} ORDER BY ${quotedPk} DESC LIMIT ${limit} OFFSET ${reverseOffset}`;
        return `SELECT * FROM (${inner}) _rev ORDER BY ${quotedPk} ASC;${suffix}`;
      }
    }
    if (dialect === 'mssql') {
      const order = shape.hasOuterOrder ? '' : 'ORDER BY (SELECT NULL) ';
      return appendBeforeTrailingLineComment(
        sql,
        `${order}OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`,
        dialect,
      );
    }
    return appendBeforeTrailingLineComment(
      sql,
      `LIMIT ${limit} OFFSET ${offset}`,
      dialect,
    );
  }

  static buildCountQuery(sql: string, dialect: SqlDialect): string | undefined {
    const shape = inspectSqlQuery(sql, dialect);
    if (!shape.isSelect || shape.tailStart < shape.statementEnd)
      return undefined;
    const { body, suffix } = sqlStatementParts(sql, shape);
    let prefix = '';
    let inner = body;
    if (dialect === 'mssql') {
      if (shape.hasCte) {
        if (!shape.select || shape.wrapped) return undefined;
        prefix = `${sql.slice(0, shape.select.start).trim()} `;
        inner = sql.slice(shape.select.start, shape.statementEnd).trim();
      }
      if (
        shape.hasOuterOrder &&
        !shape.offset &&
        !(shape.outer?.kind === 'top' && shape.outer.global)
      )
        inner += ' OFFSET 0 ROWS';
    }
    return `${prefix}SELECT COUNT(*) AS total FROM (${inner}) AS _query_count${suffix}`;
  }

  /** Sanitizes a table-window limit; raw query guards use assertWindow instead. */
  static sanitizeLimit(limit: number, max: number = 1000): number {
    const val = typeof limit === 'number' ? limit : parseInt(String(limit), 10);
    if (isNaN(val) || val <= 0) return 50;
    return Math.min(val, max);
  }
}
