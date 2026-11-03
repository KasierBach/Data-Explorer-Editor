import Database from 'better-sqlite3';
import { SqlUtil } from './sql.util';

describe('SqlUtil pagination', () => {
  it('protects bare CTE queries with a LIMIT', () => {
    expect(
      SqlUtil.injectLimit(
        'WITH active AS (SELECT 1) SELECT * FROM active',
        100,
      ),
    ).toBe('WITH active AS (SELECT 1) SELECT * FROM active LIMIT 100;');
  });

  it('protects bare MSSQL CTE queries with OFFSET/FETCH', () => {
    expect(
      SqlUtil.injectTop('WITH active AS (SELECT 1) SELECT * FROM active', 100),
    ).toBe(
      'WITH active AS (SELECT 1) SELECT * FROM active ORDER BY (SELECT NULL) OFFSET 0 ROWS FETCH NEXT 100 ROWS ONLY;',
    );
  });

  it('does not append row limits to a data-changing CTE', () => {
    const sql = 'WITH changed AS (SELECT 1) UPDATE users SET active = true';
    expect(SqlUtil.injectLimit(sql, 100)).toBe(sql);
    expect(SqlUtil.injectTop(sql, 100)).toBe(sql);
    expect(SqlUtil.injectPagination(sql, 100, 0, 'postgres')).toBe(sql);
  });

  it('pages a query that already has a LIMIT without loading the whole limited result', () => {
    expect(
      SqlUtil.injectPagination(
        'SELECT * FROM users ORDER BY id LIMIT 1000',
        100,
        200,
        'postgres',
      ),
    ).toBe(
      'SELECT * FROM (SELECT * FROM users ORDER BY id LIMIT 1000) AS _paged_result LIMIT 100 OFFSET 200;',
    );
  });

  it('adds pagination to CTE queries', () => {
    expect(
      SqlUtil.injectPagination(
        'WITH active AS (SELECT * FROM users WHERE active = true) SELECT * FROM active ORDER BY id',
        100,
        300,
        'postgres',
      ),
    ).toBe(
      'WITH active AS (SELECT * FROM users WHERE active = true) SELECT * FROM active ORDER BY id LIMIT 100 OFFSET 300;',
    );
  });

  it('leaves mutations untouched', () => {
    expect(
      SqlUtil.injectPagination(
        'UPDATE users SET active = false',
        100,
        0,
        'postgres',
      ),
    ).toBe('UPDATE users SET active = false');
  });

  it('does not reverse a final partial page', () => {
    expect(
      SqlUtil.injectPagination(
        'SELECT * FROM users ORDER BY id',
        100,
        10_000,
        'postgres',
        { totalCount: 10_001, primaryKey: 'id' },
      ),
    ).toBe('SELECT * FROM users ORDER BY id LIMIT 100 OFFSET 10000;');
  });

  it('quotes the primary key with backticks for MySQL reverse pagination', () => {
    const result = SqlUtil.injectPagination(
      'SELECT * FROM users ORDER BY id',
      100,
      6_000,
      'mysql',
      { totalCount: 11_000, primaryKey: 'id' },
    );
    // MySQL treats "id" as a string literal, so backticks are required.
    expect(result).toBe(
      'SELECT * FROM (SELECT * FROM users ORDER BY `id` DESC LIMIT 100 OFFSET 4900) _rev ORDER BY `id` ASC;',
    );
  });

  it('quotes the primary key with double quotes for Postgres reverse pagination', () => {
    const result = SqlUtil.injectPagination(
      'SELECT * FROM users ORDER BY id',
      100,
      6_000,
      'postgres',
      { totalCount: 11_000, primaryKey: 'id' },
    );
    expect(result).toBe(
      'SELECT * FROM (SELECT * FROM users ORDER BY "id" DESC LIMIT 100 OFFSET 4900) _rev ORDER BY "id" ASC;',
    );
  });

  it('escapes embedded quote characters in the primary key name', () => {
    const result = SqlUtil.injectPagination(
      'SELECT * FROM users ORDER BY `id``x`',
      100,
      6_000,
      'mysql',
      { totalCount: 11_000, primaryKey: 'id`x' },
    );
    expect(result).toContain('ORDER BY `id``x` DESC');
  });

  it.each([
    [
      "SELECT 'LIMIT 1' AS sample, * FROM users",
      "SELECT 'LIMIT 1' AS sample, * FROM users LIMIT 100;",
    ],
    [
      'SELECT * FROM users /* LIMIT 1 */',
      'SELECT * FROM users /* LIMIT 1 */ LIMIT 100;',
    ],
    [
      'SELECT * FROM users WHERE id IN (SELECT id FROM audit LIMIT 1)',
      'SELECT * FROM users WHERE id IN (SELECT id FROM audit LIMIT 1) LIMIT 100;',
    ],
    [
      'WITH one AS (SELECT * FROM users LIMIT 1) SELECT * FROM one',
      'WITH one AS (SELECT * FROM users LIMIT 1) SELECT * FROM one LIMIT 100;',
    ],
  ])(
    'does not treat inner or inert LIMIT text as an outer cap',
    (sql, expected) => {
      expect(SqlUtil.injectLimit(sql, 100)).toBe(expected);
    },
  );

  it('inserts the outer cap before a trailing line comment', () => {
    expect(SqlUtil.injectLimit('SELECT * FROM users -- LIMIT 1', 100)).toBe(
      'SELECT * FROM users LIMIT 100; -- LIMIT 1',
    );
  });

  it('rewrites only an outer LIMIT ALL', () => {
    expect(
      SqlUtil.injectLimit(
        'SELECT * FROM users WHERE id IN (SELECT id FROM audit LIMIT ALL)',
        100,
      ),
    ).toBe(
      'SELECT * FROM users WHERE id IN (SELECT id FROM audit LIMIT ALL) LIMIT 100;',
    );
  });

  it('rejects ambiguous or unbounded outer cap forms', () => {
    expect(() =>
      SqlUtil.injectLimit('SELECT * FROM users LIMIT NULL', 100),
    ).toThrow();
    expect(() =>
      SqlUtil.injectLimit('SELECT * FROM users LIMIT -1', 100),
    ).toThrow();
  });

  it.each([
    ['postgres', 'SELECT $$LIMIT 1$$ AS label, * FROM users'],
    ['postgres', 'SELECT $q$LIMIT 1$q$ AS label, * FROM users'],
    ['postgres', '/* header */ SELECT top FROM users'],
    ['sqlite', 'SELECT id AS [-- label] FROM users'],
    ['sqlite', 'WITH [update] AS (SELECT * FROM users) SELECT * FROM [update]'],
    [
      'sqlite',
      'WITH update_data AS (SELECT * FROM users) SELECT * FROM update_data',
    ],
    ['postgres', 'SELECT * FROM users -- note\nORDER BY id'],
  ] as const)(
    'caps executable SQL, not inert lexical text (%s)',
    (dialect, sql) => {
      expect(SqlUtil.injectLimit(sql, 5, dialect)).toBe(`${sql} LIMIT 5;`);
    },
  );

  it.each(['\n', '\r', '\r\n'])(
    'terminates a trailing line comment before requested pagination (%j)',
    (newline) => {
      const sql = `SELECT * FROM users -- LIMIT 1${newline}`;
      expect(SqlUtil.injectPagination(sql, 5, 0, 'postgres')).toBe(
        'SELECT * FROM users LIMIT 5 OFFSET 0; -- LIMIT 1',
      );
    },
  );

  it('handles MySQL hash comments safely for direct driver injection', () => {
    expect(
      SqlUtil.injectLimit('SELECT * FROM users # LIMIT 1', 5, 'mysql'),
    ).toBe('SELECT * FROM users LIMIT 5; # LIMIT 1');
  });

  it.each(['postgres', 'mysql', 'sqlite', 'clickhouse'] as const)(
    'does not reject a smaller requested window over a bounded SQL result (%s)',
    (dialect) => {
      expect(
        SqlUtil.injectLimit('SELECT * FROM users LIMIT 10', 5, dialect),
      ).toBe('SELECT * FROM users LIMIT 5');
      expect(
        SqlUtil.injectPagination('SELECT * FROM users LIMIT 10', 5, 0, dialect),
      ).toBe(
        'SELECT * FROM (SELECT * FROM users LIMIT 10) AS _paged_result LIMIT 5 OFFSET 0;',
      );
      expect(
        SqlUtil.injectLimit('SELECT * FROM users LIMIT 3', 5, dialect),
      ).toBe('SELECT * FROM users LIMIT 3');
    },
  );

  it.each(['mysql', 'sqlite', 'clickhouse'] as const)(
    'understands finite off,count syntax including offset zero (%s)',
    (dialect) => {
      expect(
        SqlUtil.analyzeOuterLimit('SELECT * FROM users LIMIT 0, 10', dialect),
      ).toMatchObject({
        valid: true,
        value: 10,
        offset: 0,
      });
      expect(
        SqlUtil.injectLimit('SELECT * FROM users LIMIT 0, 10', 5, dialect),
      ).toBe('SELECT * FROM users LIMIT 0, 5');
    },
  );

  it('does not interpret a comment comma or a PG top projection as a clause', () => {
    const sql = 'SELECT top FROM users LIMIT 10 /* , */ OFFSET 0';
    expect(SqlUtil.analyzeOuterLimit(sql, 'postgres')).toMatchObject({
      valid: true,
      value: 10,
      offset: 0,
    });
    expect(SqlUtil.injectLimit(sql, 5)).toBe(
      'SELECT top FROM users LIMIT 5 /* , */ OFFSET 0',
    );
  });

  it.each([
    ['postgres', 'SELECT * FROM users LIMIT $1'],
    ['postgres', 'SELECT * FROM users LIMIT (1 + 100000)'],
    ['sqlite', 'SELECT * FROM users LIMIT 1+100000'],
    ['sqlite', 'SELECT * FROM users LIMIT ?'],
    ['mssql', 'SELECT TOP (1+100000) * FROM users'],
    ['mssql', 'SELECT TOP (@n) * FROM users'],
    ['mssql', 'SELECT TOP (1) /* note */ PERCENT * FROM users'],
    ['mssql', 'SELECT TOP (1) WITH TIES * FROM users ORDER BY id'],
    [
      'postgres',
      'SELECT * FROM users ORDER BY id FETCH FIRST 1 ROWS WITH TIES',
    ],
    ['clickhouse', 'SELECT * FROM users LIMIT 1 OFFSET 0 BY id'],
  ] as const)(
    'rejects unproved row-cap grammar before injection (%s)',
    (dialect, sql) => {
      expect(() =>
        dialect === 'mssql'
          ? SqlUtil.injectTop(sql, 5)
          : SqlUtil.injectLimit(sql, 5, dialect),
      ).toThrow(/cap|finite|LIMIT BY|PERCENT|TIES/i);
    },
  );

  it('caps a parenthesized whole PostgreSQL query outside its branch', () => {
    expect(
      SqlUtil.injectLimit(
        '(SELECT * FROM users LIMIT 1) UNION ALL SELECT * FROM audit',
        5,
      ),
    ).toBe(
      '(SELECT * FROM users LIMIT 1) UNION ALL SELECT * FROM audit LIMIT 5;',
    );
    expect(SqlUtil.injectLimit('(SELECT * FROM users)', 5)).toBe(
      '(SELECT * FROM users) LIMIT 5;',
    );
  });

  it('bounds an MSSQL set result rather than trusting branch TOP', () => {
    expect(
      SqlUtil.injectTop(
        'SELECT TOP 1 * FROM users UNION ALL SELECT * FROM audit',
        5,
      ),
    ).toBe(
      'SELECT * FROM (SELECT TOP 1 * FROM users UNION ALL SELECT * FROM audit) AS _paged_result ORDER BY (SELECT NULL) OFFSET 0 ROWS FETCH NEXT 5 ROWS ONLY;',
    );
  });

  it('keeps MSSQL CTEs outside a paged derived table', () => {
    expect(
      SqlUtil.injectPagination(
        'WITH one AS (SELECT id FROM users) SELECT TOP 10 * FROM one ORDER BY id',
        5,
        0,
        'mssql',
      ),
    ).toBe(
      'WITH one AS (SELECT id FROM users) SELECT * FROM (SELECT TOP 10 * FROM one ORDER BY id) AS _paged_result ORDER BY (SELECT NULL) OFFSET 0 ROWS FETCH NEXT 5 ROWS ONLY;',
    );
  });

  it('requires an outer MSSQL order, not an inner order or quoted ORDER BY', () => {
    expect(
      SqlUtil.injectTop(
        'WITH one AS (SELECT TOP 2 id FROM users ORDER BY id) SELECT * FROM one',
        5,
      ),
    ).toBe(
      'WITH one AS (SELECT TOP 2 id FROM users ORDER BY id) SELECT * FROM one ORDER BY (SELECT NULL) OFFSET 0 ROWS FETCH NEXT 5 ROWS ONLY;',
    );
    expect(
      SqlUtil.injectPagination(
        "SELECT 'ORDER BY' AS label, * FROM users",
        5,
        0,
        'mssql',
      ),
    ).toBe(
      "SELECT 'ORDER BY' AS label, * FROM users ORDER BY (SELECT NULL) OFFSET 0 ROWS FETCH NEXT 5 ROWS ONLY;",
    );
    expect(
      SqlUtil.injectTop('SELECT * FROM users ORDER BY id OFFSET 0 ROWS', 5),
    ).toBe(
      'SELECT * FROM users ORDER BY id OFFSET 0 ROWS FETCH NEXT 5 ROWS ONLY;',
    );
  });

  it('inserts MSSQL TOP positionally through comments and DISTINCT', () => {
    expect(SqlUtil.injectTop('SELECT/* note */ * FROM users', 5)).toBe(
      'SELECT TOP 5 /* note */ * FROM users',
    );
    expect(SqlUtil.injectTop('SELECT DISTINCT id FROM users', 5)).toBe(
      'SELECT DISTINCT TOP 5 id FROM users',
    );
    expect(SqlUtil.injectTop('SELECT TOP 10 * FROM users', 5)).toBe(
      'SELECT TOP 5 * FROM users',
    );
  });

  it('accepts complete finite FETCH and zero-row LIMIT forms', () => {
    expect(
      SqlUtil.injectLimit('SELECT * FROM users FETCH FIRST 10 ROWS ONLY', 5),
    ).toBe('SELECT * FROM users FETCH FIRST 5 ROWS ONLY');
    expect(SqlUtil.injectLimit('SELECT * FROM users LIMIT 0', 5)).toBe(
      'SELECT * FROM users LIMIT 0',
    );
  });

  it('does not put a wrapper closure inside a trailing line comment', () => {
    expect(
      SqlUtil.injectPagination(
        'SELECT * FROM users LIMIT 10 -- note',
        5,
        0,
        'postgres',
      ),
    ).toBe(
      'SELECT * FROM (SELECT * FROM users LIMIT 10) AS _paged_result LIMIT 5 OFFSET 0; -- note',
    );
  });

  it.each([
    ['postgres', '(SELECT * FROM users) LIMIT 1+100000'],
    ['postgres', 'SELECT * FROM users LIMIT 1 OFFSET 0 + 100000'],
    ['postgres', 'SELECT * FROM users LIMIT 1 OFFSET 0 BY id'],
    [
      'postgres',
      'SELECT * FROM users LIMIT 1 FOR UPDATE UNION ALL SELECT * FROM audit',
    ],
    ['mssql', 'SELECT TOP 1+100000 id FROM users'],
    ['mssql', 'WITH one AS (SELECT * FROM users) (SELECT * FROM one)'],
    ['postgres', 'SELECT * FROM users LIMIT 1 FORMAT JSON'],
  ] as const)(
    'contains ambiguous outer grammar rather than guessing (%s)',
    (dialect, sql) => {
      expect(() =>
        dialect === 'mssql'
          ? SqlUtil.injectTop(sql, 5)
          : SqlUtil.injectLimit(sql, 5, dialect),
      ).toThrow(/cap|finite|unsupported|simplify/i);
    },
  );

  it('preserves a globally bounded ClickHouse LIMIT BY and validates its count', () => {
    expect(
      SqlUtil.injectLimit(
        'SELECT * FROM users LIMIT 1 OFFSET 0 BY id LIMIT 10',
        5,
        'clickhouse',
      ),
    ).toBe('SELECT * FROM users LIMIT 1 OFFSET 0 BY id LIMIT 5');
    expect(() =>
      SqlUtil.injectLimit(
        'SELECT * FROM users LIMIT 1+100000 BY id LIMIT 10',
        5,
        'clickhouse',
      ),
    ).toThrow('cap');
  });

  it.each([
    ['postgres', 'FOR UPDATE'],
    ['mysql', 'LOCK IN SHARE MODE'],
    ['clickhouse', 'SETTINGS max_threads = 1'],
  ] as const)(
    'keeps line-comment terminators before a capped %s tail',
    (dialect, tail) => {
      const sql = `SELECT * FROM users -- note\n${tail}`;
      const bounded = SqlUtil.injectLimit(sql, 5, dialect);
      expect(bounded).toBe(`SELECT * FROM users -- note\nLIMIT 5 ${tail};`);
      const executable = bounded.replace(/--[^\r\n]*/g, '').replace(tail, '');
      const db = new Database(':memory:');
      try {
        db.exec(
          'CREATE TABLE users (id INTEGER); WITH RECURSIVE items(id) AS (SELECT 1 UNION ALL SELECT id + 1 FROM items WHERE id < 25) INSERT INTO users SELECT id FROM items;',
        );
        expect(db.prepare(executable).all()).toHaveLength(5);
      } finally {
        db.close();
      }
    },
  );

  it('accepts a parenthesized projection after a complete parenthesized TOP literal', () => {
    expect(SqlUtil.injectTop('SELECT TOP (10) (id) FROM users', 5)).toBe(
      'SELECT TOP (5) (id) FROM users',
    );
    expect(() =>
      SqlUtil.injectTop('SELECT TOP (1+100000) (id) FROM users', 5),
    ).toThrow('finite');
  });

  it('retains safe observation comments outside count wrappers', () => {
    expect(
      SqlUtil.buildCountQuery(
        'SELECT id FROM users /*native-count-marker*/',
        'postgres',
      ),
    ).toBe(
      'SELECT COUNT(*) AS total FROM (SELECT id FROM users) AS _query_count /*native-count-marker*/',
    );
    const lineCount = SqlUtil.buildCountQuery(
      'SELECT id FROM users -- native-count-marker',
      'postgres',
    );
    expect(lineCount).toBe(
      'SELECT COUNT(*) AS total FROM (SELECT id FROM users) AS _query_count -- native-count-marker',
    );
    const db = new Database(':memory:');
    try {
      db.exec(
        'CREATE TABLE users (id INTEGER); INSERT INTO users VALUES (1),(2);',
      );
      expect(db.prepare(lineCount!).get()).toEqual({ total: 2 });
    } finally {
      db.close();
    }
  });

  it('rewrites LIMIT ALL to a bounded limit', () => {
    expect(SqlUtil.injectLimit('SELECT * FROM users LIMIT ALL', 500)).toBe(
      'SELECT * FROM users LIMIT 500',
    );
  });

  it('rewrites LIMIT ALL in CTE queries', () => {
    expect(
      SqlUtil.injectLimit(
        'WITH active AS (SELECT 1) SELECT * FROM active LIMIT ALL',
        100,
      ),
    ).toBe('WITH active AS (SELECT 1) SELECT * FROM active LIMIT 100');
  });
});
