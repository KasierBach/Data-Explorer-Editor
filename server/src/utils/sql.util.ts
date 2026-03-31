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
}
