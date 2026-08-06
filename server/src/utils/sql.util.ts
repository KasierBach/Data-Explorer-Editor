export class SqlUtil {
  /** Returns true only when a WITH query's outer statement is a SELECT. */
  private static isSelectStatement(sql: string): boolean {
    const trimmed = sql.trim();
    if (/^SELECT\b/i.test(trimmed)) return true;
    if (!/^WITH\b/i.test(trimmed)) return false;

    let depth = 0;
    let quote: string | null = null;
    for (let index = 0; index < trimmed.length; index += 1) {
      const char = trimmed[index];
      const next = trimmed[index + 1];

      if (quote) {
        if (char === quote) {
          if (next === quote) {
            index += 1;
          } else {
            quote = null;
          }
        }
        continue;
      }
      if (char === "'" || char === '"' || char === '`') {
        quote = char;
      } else if (char === '-' && next === '-') {
        const newline = trimmed.indexOf('\n', index + 2);
        index = newline === -1 ? trimmed.length : newline;
      } else if (char === '/' && next === '*') {
        const end = trimmed.indexOf('*/', index + 2);
        index = end === -1 ? trimmed.length : end + 1;
      } else if (char === '(') {
        depth += 1;
      } else if (char === ')') {
        depth = Math.max(0, depth - 1);
      } else if (depth === 0 && /[A-Za-z]/.test(char)) {
        const start = index;
        while (
          index + 1 < trimmed.length &&
          /[A-Za-z]/.test(trimmed[index + 1])
        ) {
          index += 1;
        }
        const word = trimmed.slice(start, index + 1).toUpperCase();
        if (/^(SELECT|UPDATE|DELETE|INSERT|MERGE)$/.test(word)) {
          return word === 'SELECT';
        }
      }
    }
    return false;
  }

  /**
   * Appends a LIMIT clause to a bare SELECT statement if it lacks one, to prevent OOM.
   */
  static injectLimit(sql: string, limit: number = 50000): string {
    let safeSql = sql;
    if (SqlUtil.isSelectStatement(safeSql) && !/\bLIMIT\b/i.test(safeSql)) {
      safeSql = `${safeSql.trim().replace(/;$/, '')} LIMIT ${limit};`;
    }
    return safeSql;
  }

  /**
   * Injects a TOP N clause into a bare SELECT statement for SQL Server.
   */
  static injectTop(sql: string, limit: number = 50000): string {
    let safeSql = sql;
    if (/^\s*WITH\b/i.test(safeSql)) {
      return SqlUtil.injectPagination(safeSql, limit, 0, 'mssql');
    }
    if (/^\s*SELECT\s+(?!TOP\b)/i.test(safeSql)) {
      safeSql = safeSql.replace(/^\s*SELECT\s+/i, `SELECT TOP ${limit} `);
    }
    return safeSql;
  }

  /**
   * Injects pagination (LIMIT/OFFSET or OFFSET/FETCH) into a SELECT statement.
   * Supports Reverse Pagination optimization when offset is large (> totalCount / 2).
   */
  static injectPagination(
    sql: string,
    limit: number,
    offset: number,
    dialect: 'postgres' | 'mysql' | 'mssql' | 'sqlite' | 'clickhouse',
    options?: { totalCount?: number; primaryKey?: string },
  ): string {
    const trimmed = sql.trim().replace(/;$/, '');

    if (!SqlUtil.isSelectStatement(trimmed)) return sql;

    const hasExplicitPagination =
      /\b(LIMIT|OFFSET|FETCH\s+(?:FIRST|NEXT)|TOP\s*\(?)\b/i.test(trimmed);
    if (hasExplicitPagination) {
      if (dialect === 'mssql') {
        return `SELECT * FROM (${trimmed}) AS _paged_result ORDER BY (SELECT NULL) OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY;`;
      }
      return `SELECT * FROM (${trimmed}) AS _paged_result LIMIT ${limit} OFFSET ${offset};`;
    }

    // Optimization: Reverse pagination for deep offsets if totalCount is available
    if (
      options?.totalCount &&
      options.totalCount > 10000 &&
      offset > options.totalCount / 2
    ) {
      // Do not reverse the final partial page: fetching `limit` rows from the
      // tail would over-read when fewer than `limit` rows remain.
      if (options.totalCount - offset >= limit) {
        const reverseOffset = Math.max(0, options.totalCount - offset - limit);
        if (!/GROUP\s+BY|HAVING|UNION/i.test(trimmed)) {
          if (dialect === 'mssql') {
            const pkOrder = options.primaryKey
              ? `${options.primaryKey} DESC`
              : '(SELECT NULL)';
            return `SELECT * FROM (${trimmed} ORDER BY ${pkOrder} OFFSET ${reverseOffset} ROWS FETCH NEXT ${limit} ROWS ONLY) _rev ORDER BY ${options.primaryKey || '1'} ASC;`;
          }
          if (options.primaryKey) {
            return `SELECT * FROM (${trimmed} ORDER BY "${options.primaryKey}" DESC LIMIT ${limit} OFFSET ${reverseOffset}) _rev ORDER BY "${options.primaryKey}" ASC;`;
          }
        }
      }
    }

    if (dialect === 'mssql') {
      let paginated = trimmed;
      if (!/ORDER\s+BY/i.test(trimmed)) {
        paginated = `${trimmed} ORDER BY (SELECT NULL)`;
      }
      return `${paginated} OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY;`;
    } else {
      return `${trimmed} LIMIT ${limit} OFFSET ${offset};`;
    }
  }

  /**
   * Sanitizes a limit parameter to ensure it is a safe positive integer.
   */
  static sanitizeLimit(limit: number, max: number = 1000): number {
    const val = typeof limit === 'number' ? limit : parseInt(String(limit), 10);
    if (isNaN(val) || val <= 0) return 50;
    return Math.min(val, max);
  }
}
