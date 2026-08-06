export class SqlUtil {
  /**
   * Appends a LIMIT clause to a bare SELECT statement if it lacks one, to prevent OOM.
   */
  static injectLimit(sql: string, limit: number = 50000): string {
    let safeSql = sql;
    if (/^\s*SELECT/i.test(safeSql) && !/\bLIMIT\b/i.test(safeSql)) {
      safeSql = `${safeSql.trim().replace(/;$/, '')} LIMIT ${limit};`;
    }
    return safeSql;
  }

  /**
   * Injects a TOP N clause into a bare SELECT statement for SQL Server.
   */
  static injectTop(sql: string, limit: number = 50000): string {
    let safeSql = sql;
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

    if (!/^\s*(SELECT|WITH)\b/i.test(trimmed)) return sql;

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
