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
     */
    static injectPagination(sql: string, limit: number, offset: number, dialect: 'postgres' | 'mysql' | 'mssql'): string {
        const trimmed = sql.trim().replace(/;$/, '');
        
        // Skip if not a SELECT or already has pagination keywords
        if (!/^\s*SELECT/i.test(trimmed)) return sql;
        if (/\b(LIMIT|OFFSET|FETCH)\b/i.test(trimmed)) return sql;

        if (dialect === 'mssql') {
            // MSSQL OFFSET/FETCH requires an ORDER BY clause. 
            // We use (SELECT NULL) as a dummy order if one isn't provided.
            let paginated = trimmed;
            if (!/ORDER\s+BY/i.test(trimmed)) {
                paginated = `${trimmed} ORDER BY (SELECT NULL)`;
            }
            return `${paginated} OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY;`;
        } else {
            // Postgres & MySQL use LIMIT X OFFSET Y
            return `${trimmed} LIMIT ${limit} OFFSET ${offset};`;
        }
    }
}
