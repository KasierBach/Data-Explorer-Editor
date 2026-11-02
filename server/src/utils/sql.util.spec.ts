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
      'SELECT * FROM (SELECT * FROM users ORDER BY id ORDER BY `id` DESC LIMIT 100 OFFSET 4900) _rev ORDER BY `id` ASC;',
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
      'SELECT * FROM (SELECT * FROM users ORDER BY id ORDER BY "id" DESC LIMIT 100 OFFSET 4900) _rev ORDER BY "id" ASC;',
    );
  });

  it('escapes embedded quote characters in the primary key name', () => {
    const result = SqlUtil.injectPagination(
      'SELECT * FROM users ORDER BY id',
      100,
      6_000,
      'mysql',
      { totalCount: 11_000, primaryKey: 'id`x' },
    );
    expect(result).toContain('ORDER BY `id``x` DESC');
  });

  it.each([
    ["SELECT 'LIMIT 1' AS sample, * FROM users", "SELECT 'LIMIT 1' AS sample, * FROM users LIMIT 100;"],
    ['SELECT * FROM users /* LIMIT 1 */', 'SELECT * FROM users /* LIMIT 1 */ LIMIT 100;'],
    ['SELECT * FROM users WHERE id IN (SELECT id FROM audit LIMIT 1)', 'SELECT * FROM users WHERE id IN (SELECT id FROM audit LIMIT 1) LIMIT 100;'],
    ['WITH one AS (SELECT * FROM users LIMIT 1) SELECT * FROM one', 'WITH one AS (SELECT * FROM users LIMIT 1) SELECT * FROM one LIMIT 100;'],
  ])('does not treat inner or inert LIMIT text as an outer cap', (sql, expected) => {
    expect(SqlUtil.injectLimit(sql, 100)).toBe(expected);
  });

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
    expect(() => SqlUtil.injectLimit('SELECT * FROM users LIMIT NULL', 100)).toThrow();
    expect(() => SqlUtil.injectLimit('SELECT * FROM users LIMIT -1', 100)).toThrow();
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
