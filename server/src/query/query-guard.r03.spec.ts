import {
  analyzeSqlConfirmation,
  isSqlAllowedOnReadOnly,
  normalizeSql,
  splitSqlStatements,
} from './query-guard.util';

describe('R03 SQL lexical boundaries', () => {
  it.each(['mysql', 'mariadb'])(
    'rejects hash comments without interpreting quotes inside them: %s',
    (dialect) => {
      const sql = "# '\nDELETE FROM users # '";
      expect(() => splitSqlStatements(sql, dialect)).toThrow(/hash comment/i);
      expect(() => analyzeSqlConfirmation(sql, dialect)).toThrow(RangeError);
      expect(isSqlAllowedOnReadOnly(sql, dialect)).toBe(false);
      expect(isSqlAllowedOnReadOnly("SELECT '#' AS marker", dialect)).toBe(
        true,
      );
    },
  );

  it.each(['\u00a0', '\u2028', '\ufeff'])(
    'rejects ambiguous MySQL comment whitespace: %j',
    (space) => {
      expect(() =>
        splitSqlStatements(`SELECT 1--${space}comment`, 'mysql'),
      ).toThrow(RangeError);
      expect(() =>
        splitSqlStatements(`SELECT 1--${space}comment`, 'mariadb'),
      ).toThrow(RangeError);
    },
  );

  it('keeps PostgreSQL dollar quoting separate from MySQL identifier syntax', () => {
    expect(isSqlAllowedOnReadOnly('SELECT $$safe$$', 'postgres')).toBe(true);
    expect(isSqlAllowedOnReadOnly('SELECT $$safe$$', 'mysql')).toBe(false);
    expect(() =>
      splitSqlStatements('SELECT $$; DELETE FROM users; SELECT $$', 'mysql'),
    ).toThrow(/only for PostgreSQL/);
  });

  it.each([
    "SELECT '--'; DELETE FROM users",
    "SELECT '/*'; DELETE FROM users; SELECT '*/'",
    'SELECT "--" FROM users; DELETE FROM users',
    'SELECT `/*` FROM users; DELETE FROM users; SELECT `*/` FROM users',
    'SELECT [--] FROM users; DELETE FROM users',
    'SELECT $$/*$$; DELETE FROM users; SELECT $$*/$$',
  ])('blocks executable writes after quoted comment markers: %s', (sql) => {
    expect(isSqlAllowedOnReadOnly(sql)).toBe(false);
    expect(analyzeSqlConfirmation(sql)).toEqual(
      expect.objectContaining({ requiresConfirmation: true }),
    );
  });

  it.each([
    "SELECT 'DROP TABLE users' AS harmless",
    'SELECT "delete" FROM users',
    "SELECT 'it''s; -- safe' AS label; SELECT 2",
    'WITH rows AS (SELECT 1 AS id) SELECT * FROM rows',
  ])('keeps valid read-only queries usable: %s', (sql) => {
    expect(isSqlAllowedOnReadOnly(sql)).toBe(true);
    expect(analyzeSqlConfirmation(sql).requiresConfirmation).toBe(false);
  });

  it.each([
    "SELECT 1; VACUUM INTO 'copy.db'",
    'SELECT 1 INTO copied_rows',
    'EXPLAIN ANALYZE DELETE FROM users',
    'PRAGMA writable_schema = ON',
    'PRAGMA user_version(7)',
    'SELECT 1; SELECTED 2',
  ])(
    'rejects writes and unknown statements despite a read prefix: %s',
    (sql) => {
      expect(isSqlAllowedOnReadOnly(sql)).toBe(false);
    },
  );

  it.each([
    "DELETE FROM users WHERE note = 'WHERE id = 5'",
    "UPDATE users SET note = 'WHERE id = 5'",
    'WITH rows AS (DELETE FROM users RETURNING *) SELECT * FROM rows',
    "WITH rows AS (SELECT 1) UPDATE users SET note = 'x'",
  ])('requires confirmation for unbounded or opaque writes: %s', (sql) => {
    const expected = sql.startsWith('DELETE') ? false : true;
    expect(analyzeSqlConfirmation(sql).requiresConfirmation).toBe(expected);
  });

  it('does not treat a WHERE string or quoted identifier as a predicate', () => {
    expect(
      analyzeSqlConfirmation("DELETE FROM users RETURNING 'WHERE id=1'")
        .requiresConfirmation,
    ).toBe(true);
    expect(
      analyzeSqlConfirmation('DELETE FROM "WHERE"').requiresConfirmation,
    ).toBe(true);
  });

  it('preserves quoted data while removing only actual comments', () => {
    expect(normalizeSql("SELECT '--', '/* x */' /* real */ FROM users")).toBe(
      "SELECT '--', '/* x */' FROM users",
    );
  });

  it.each([
    ['DROP TABLE "real items"', 'real items'],
    ["WITH x AS (SELECT 'DELETE FROM decoy') DELETE FROM items", 'items'],
  ])(
    'reports the actual object rather than keywords in quoted data: %s',
    (sql, object) => {
      expect(analyzeSqlConfirmation(sql).affectedObject).toBe(object);
    },
  );

  it.each([
    'SELECT 1--2; DELETE FROM users',
    'SELECT 1 /*!; DELETE FROM users */',
    'SELECT 1 /* nested /* */; DELETE FROM users */',
    "SELECT 'unterminated",
    "SELECT 'back\\slash'",
  ])(
    'rejects ambiguous or unsupported lexical syntax explicitly: %s',
    (sql) => {
      expect(isSqlAllowedOnReadOnly(sql)).toBe(false);
      expect(() => analyzeSqlConfirmation(sql)).toThrow(RangeError);
    },
  );

  it.each([
    ['SELECT `semi;colon`; SELECT 2', ['SELECT `semi;colon`', 'SELECT 2']],
    ['SELECT [semi;colon]; SELECT 2', ['SELECT [semi;colon]', 'SELECT 2']],
    [
      'SELECT $tag$semi;colon$tag$; SELECT 2',
      ['SELECT $tag$semi;colon$tag$', 'SELECT 2'],
    ],
  ])('splits batches at executable semicolons: %s', (sql, expected) => {
    expect(splitSqlStatements(sql)).toEqual(expected);
  });
});
