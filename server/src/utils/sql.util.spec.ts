import { SqlUtil } from './sql.util';

describe('SqlUtil pagination', () => {
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
});
