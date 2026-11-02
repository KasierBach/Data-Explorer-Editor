import fc from 'fast-check';
import { isPrivateIp } from '../common/utils/ssrf-validator.util';
import {
  isSqlAllowedOnReadOnly,
  normalizeSql,
  splitSqlStatements,
} from './query-guard.util';

/**
 * Property-based fuzzing: fast-check generates thousands of randomized
 * inputs to explore edge cases curated tests cannot anticipate.
 * Properties assert invariants that must hold for ANY input.
 */
describe('Property-based fuzzing — SSRF validator', () => {
  // Invariant 1: the validator never crashes, whatever the input.
  it('isPrivateIp never throws for arbitrary strings', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 200 }), (input) => {
        expect(() => isPrivateIp(input)).not.toThrow();
      }),
      { numRuns: 1000 },
    );
  });

  // Invariant 2: any IPv4 private address embedded in an IPv6-mapped form
  // is always blocked (regression guard for the bypass we fixed).
  it('IPv4-mapped IPv6 of any private IPv4 is always blocked', () => {
    const privateOctet = fc.constantFrom(10, 127, 172, 192, 169, 0);
    fc.assert(
      fc.property(
        privateOctet,
        fc.nat(255),
        fc.nat(255),
        fc.nat(255),
        fc.option(fc.constantFrom('::ffff:', '0:0:0:0:0:ffff:')),
        (first, b, c, d, prefix) => {
          const ipv4 = `${first}.${b}.${c}.${d}`;
          // Only test when the raw IPv4 itself is considered private —
          // the mapped form must agree with the raw form.
          if (isPrivateIp(ipv4)) {
            const mapped = `${prefix ?? '::ffff:'}${ipv4}`;
            expect(isPrivateIp(mapped)).toBe(true);
          }
        },
      ),
      { numRuns: 500 },
    );
  });

  // Invariant 3: idempotence — checking twice gives the same answer.
  it('isPrivateIp is deterministic (idempotent)', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 60 }), (input) => {
        expect(isPrivateIp(input)).toBe(isPrivateIp(input));
      }),
      { numRuns: 500 },
    );
  });
});

describe('Property-based fuzzing — SQL guard', () => {
  // Invariant 1: the guard never crashes on arbitrary input.
  it('isSqlAllowedOnReadOnly never throws for arbitrary strings', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 500 }), (input) => {
        expect(() => isSqlAllowedOnReadOnly(input)).not.toThrow();
      }),
      { numRuns: 1000 },
    );
  });

  // Invariant 2: any SQL that starts with a write keyword is blocked,
  // no matter what random suffix follows.
  it('write-prefixed statements are always blocked on readOnly', () => {
    const writeKeyword = fc.constantFrom(
      'INSERT',
      'UPDATE',
      'DELETE',
      'DROP',
      'TRUNCATE',
      'ALTER',
      'GRANT',
      'REVOKE',
    );
    fc.assert(
      fc.property(
        writeKeyword,
        fc.string({ maxLength: 100 }).filter((s) => !s.includes(';')),
        (keyword, suffix) => {
          const sql = `${keyword} ${suffix}`.trim();
          expect(isSqlAllowedOnReadOnly(sql)).toBe(false);
        },
      ),
      { numRuns: 500 },
    );
  });

  // Invariant 3: stacking a write statement after ANY read statement is
  // always blocked — the guard must inspect every statement, not just the first.
  it('read-then-write stacked statements are always blocked', () => {
    const readKeyword = fc.constantFrom('SELECT', 'SHOW', 'DESCRIBE', 'WITH');
    const writeKeyword = fc.constantFrom(
      'INSERT',
      'UPDATE',
      'DELETE',
      'DROP',
      'TRUNCATE',
    );
    fc.assert(
      fc.property(
        readKeyword,
        writeKeyword,
        fc.string({ maxLength: 50 }),
        (read, write, filler) => {
          // Keep arbitrary data inside a closed literal, so the generated write is executable code.
          const literal = `'${filler.replace(/'/g, "''")}'`;
          const sql = `${read} ${literal}; ${write} ${literal}`;
          expect(isSqlAllowedOnReadOnly(sql)).toBe(false);
        },
      ),
      { numRuns: 500 },
    );
  });

  it('normalizeSql removes actual comments while preserving quoted data, or explicitly rejects unsupported quoting', () => {
    fc.assert(
      fc.property(
        fc.string({ maxLength: 80 }),
        fc.string({ maxLength: 80 }),
        (before, after) => {
          const plain = `SELECT '${before.replace(/'/g, "''")}' '${after.replace(/'/g, "''")}'`;
          const commented = plain.replace(
            'SELECT ',
            'SELECT /* actual comment */ ',
          );
          try {
            expect(normalizeSql(commented)).toBe(
              plain.replace(/\s+/g, ' ').trim(),
            );
          } catch (error) {
            expect(error).toBeInstanceOf(RangeError);
            expect(isSqlAllowedOnReadOnly(commented)).toBe(false);
          }
        },
      ),
      { numRuns: 500 },
    );
  });

  it('splitSqlStatements produces nonempty statements or an explicit fail-closed syntax error', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 300 }), (input) => {
        try {
          for (const statement of splitSqlStatements(input)) {
            expect(statement.trim().length).toBeGreaterThan(0);
          }
        } catch (error) {
          expect(error).toBeInstanceOf(RangeError);
          expect(isSqlAllowedOnReadOnly(input)).toBe(false);
        }
      }),
      { numRuns: 500 },
    );
  });

  // Invariant 6: ReDoS guard — normalization completes quickly even for
  // adversarial comment-heavy input.
  it('normalizeSql completes within budget for comment floods', () => {
    fc.assert(
      fc.property(fc.nat(50), fc.nat(200), (nestCount, fillerLen) => {
        const payload =
          '/*'.repeat(nestCount) +
          'a'.repeat(fillerLen) +
          '*/'.repeat(nestCount);
        const start = Date.now();
        try {
          normalizeSql(payload);
        } catch (error) {
          expect(error).toBeInstanceOf(RangeError);
          expect(isSqlAllowedOnReadOnly(payload)).toBe(false);
        }
        expect(Date.now() - start).toBeLessThan(500);
      }),
      { numRuns: 200 },
    );
  });
});
