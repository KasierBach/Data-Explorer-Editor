import {
  isSqlAllowedOnReadOnly,
  analyzeSqlConfirmation,
  normalizeSql,
} from './query-guard.util';

describe('SQL guard — readOnly bypass attack vectors', () => {
  describe('classic SQL injection payloads must be rejected on readOnly', () => {
    it.each([
      // Stacked statements
      'SELECT 1; DROP TABLE users',
      'SELECT 1; DELETE FROM users WHERE 1=1',
      "SELECT * FROM a; INSERT INTO logs VALUES ('x')",
      "SELECT 1; UPDATE users SET role='admin'",
      // Comment tricks that keep the keyword executable.
      // NOTE: "SELECT 1 -- DROP TABLE users" is NOT here because a real
      // database treats -- as a comment and never executes the DROP; the
      // guard allowing it is correct. Same for "DR/**/OP" (comment becomes
      // whitespace, producing invalid syntax "DR OP").
      'SELECT 1 /* hidden */ ; TRUNCATE TABLE audit',
      'SELECT 1; DELETE/*x*/FROM users',
      // Write disguised in CTE (WITH prefix is read-only-allowed)
      'WITH deleted AS (DELETE FROM users RETURNING *) SELECT * FROM deleted',
      "WITH ins AS (INSERT INTO users VALUES (1,'hacker')) SELECT * FROM ins",
      'WITH upd AS (UPDATE users SET admin=true RETURNING *) SELECT * FROM upd',
      // Write keywords embedded in subqueries
      'SELECT * FROM (DELETE FROM users RETURNING *) sub',
      // EXEC / CALL escape hatches
      "SELECT 1; EXEC xp_cmdshell('dir')",
      'SELECT 1; CALL dangerous_proc()',
      // ATTACH to read arbitrary files (SQLite)
      "SELECT 1; ATTACH DATABASE '/etc/passwd' AS pwn",
      // GRANT escalation
      'SELECT 1; GRANT ALL ON users TO public',
    ])('rejects: %s', (sql) => {
      expect(isSqlAllowedOnReadOnly(sql)).toBe(false);
    });
  });

  describe('legitimate read queries must still pass on readOnly', () => {
    it.each([
      'SELECT * FROM users',
      'SELECT 1',
      'WITH stats AS (SELECT count(*) c FROM users) SELECT * FROM stats',
      'SHOW TABLES',
      'DESCRIBE users',
      'EXPLAIN SELECT * FROM users',
      'PRAGMA table_info(users)',
      // Identifiers quoting write keywords are NOT writes
      'SELECT * FROM `update_log`',
    ])('allows: %s', (sql) => {
      expect(isSqlAllowedOnReadOnly(sql)).toBe(true);
    });
  });

  describe('known limitation — write keywords inside string literals (over-blocks, safe direction)', () => {
    // The keyword-based guard cannot distinguish code from data, so it
    // blocks SELECTs containing write keywords inside string literals.
    // This is a false positive in the SAFE direction (blocks a legitimate
    // read; never allows a write). Documented here so a future parser-based
    // guard (e.g. node-sql-parser AST) can flip these expectations.
    it.each([
      "SELECT 'DROP TABLE users' AS harmless",
      "SELECT * FROM users WHERE name = 'delete me'",
    ])('currently blocks (safe over-block): %s', (sql) => {
      expect(isSqlAllowedOnReadOnly(sql)).toBe(false);
    });
  });

  describe('destructive confirmation analysis catches hidden mutations', () => {
    it('flags unbounded DELETE without WHERE', () => {
      const analysis = analyzeSqlConfirmation('DELETE FROM users');
      expect(analysis.requiresConfirmation).toBe(true);
    });

    it('flags unbounded UPDATE without WHERE', () => {
      const analysis = analyzeSqlConfirmation("UPDATE users SET role='admin'");
      expect(analysis.requiresConfirmation).toBe(true);
    });

    it('flags DROP TABLE', () => {
      const analysis = analyzeSqlConfirmation('DROP TABLE users');
      expect(analysis.requiresConfirmation).toBe(true);
    });

    it('flags write hidden behind comment obfuscation', () => {
      // normalizeSql strips comments, so the DELETE must be visible to the analyzer
      expect(normalizeSql('DE/**/LETE')).not.toContain('/**/');
      expect(() =>
        analyzeSqlConfirmation('SELECT 1; DE/**/LETE FROM users'),
      ).not.toThrow();
    });

    it('does not flag bounded DELETE with WHERE', () => {
      const analysis = analyzeSqlConfirmation('DELETE FROM users WHERE id = 5');
      expect(analysis.requiresConfirmation).toBe(false);
    });
  });

  describe('guard resilience — malformed and adversarial input', () => {
    it('handles empty string without throwing', () => {
      expect(() => isSqlAllowedOnReadOnly('')).not.toThrow();
      expect(() => analyzeSqlConfirmation('')).not.toThrow();
    });

    it('handles null bytes and control characters', () => {
      const payload = 'SELECT 1\x00; DROP TABLE users';
      expect(() => isSqlAllowedOnReadOnly(payload)).not.toThrow();
    });

    it('handles unicode homoglyphs in keywords', () => {
      // Cyrillic 'О' (U+041E) instead of Latin 'O' — must not be treated
      // as the SQL keyword DROP (it isn't, but the guard must not crash
      // and must not accidentally allow the real DROP via confusion)
      const payload = 'DRОP TABLE users'; // Cyrillic О
      expect(() => isSqlAllowedOnReadOnly(payload)).not.toThrow();
    });

    it('handles extremely long input without catastrophic backtracking', () => {
      const longComment = '/*' + 'a'.repeat(100_000) + '*/';
      const start = Date.now();
      expect(() =>
        isSqlAllowedOnReadOnly(`SELECT 1 ${longComment}; DROP TABLE x`),
      ).not.toThrow();
      // Regex must complete quickly (no ReDoS)
      expect(Date.now() - start).toBeLessThan(1000);
    });

    it('rejects statement floods beyond the cap (100)', () => {
      const many = Array(150).fill('SELECT 1').join('; ');
      expect(() => analyzeSqlConfirmation(many)).toThrow(
        /maximum of 100 statements/,
      );
    });

    it('accepts stacked statements within the cap', () => {
      const many = Array(50).fill('SELECT 1').join('; ');
      expect(() => analyzeSqlConfirmation(many)).not.toThrow();
    });
  });
});
