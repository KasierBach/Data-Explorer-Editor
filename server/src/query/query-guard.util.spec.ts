import {
  analyzeDestructiveSql,
  analyzeSqlConfirmation,
  isLikelyDestructiveSql,
} from './query-guard.util';

describe('analyzeDestructiveSql', () => {
  it('does not require confirmation for create table', () => {
    expect(analyzeDestructiveSql('CREATE TABLE users (id INT)')).toEqual(
      expect.objectContaining({
        isDestructive: false,
        requiresConfirmation: false,
        isMutating: true,
      }),
    );
  });

  it('does not require confirmation for insert or targeted delete', () => {
    expect(
      analyzeDestructiveSql('INSERT INTO users (id) VALUES (1)'),
    ).toEqual(
      expect.objectContaining({
        requiresConfirmation: false,
        isMutating: true,
      }),
    );

    expect(
      analyzeDestructiveSql('DELETE FROM users WHERE id = 42'),
    ).toEqual(
      expect.objectContaining({
        requiresConfirmation: false,
        isMutating: true,
      }),
    );
  });

  it('flags unbounded update and delete as high severity', () => {
    expect(analyzeDestructiveSql('UPDATE users SET active = false')).toEqual(
      expect.objectContaining({
        requiresConfirmation: true,
        severity: 'high',
        reason: 'unbounded_row_mutation',
        affectedObject: 'users',
      }),
    );

    expect(analyzeDestructiveSql('DELETE FROM users')).toEqual(
      expect.objectContaining({
        requiresConfirmation: true,
        severity: 'high',
        reason: 'unbounded_row_mutation',
        affectedObject: 'users',
      }),
    );
  });

  it('treats tautological where clauses as unbounded', () => {
    expect(
      analyzeDestructiveSql('DELETE FROM users WHERE 1 = 1'),
    ).toEqual(
      expect.objectContaining({
        requiresConfirmation: true,
        severity: 'high',
        reason: 'unbounded_row_mutation',
      }),
    );
  });

  it('flags create or replace and rename as contract changes', () => {
    expect(
      analyzeDestructiveSql('CREATE OR REPLACE VIEW active_users AS SELECT * FROM users'),
    ).toEqual(
      expect.objectContaining({
        requiresConfirmation: true,
        severity: 'medium',
        reason: 'schema_contract_change',
        objectType: 'VIEW',
        affectedObject: 'active_users',
      }),
    );

    expect(analyzeDestructiveSql('RENAME TABLE users TO users_archive')).toEqual(
      expect.objectContaining({
        requiresConfirmation: true,
        severity: 'medium',
        reason: 'schema_contract_change',
        objectType: 'TABLE',
        affectedObject: 'users',
      }),
    );
  });

  it('distinguishes safe alter add from destructive alter drop', () => {
    expect(
      analyzeDestructiveSql('ALTER TABLE users ADD COLUMN note TEXT'),
    ).toEqual(
      expect.objectContaining({
        requiresConfirmation: false,
        isMutating: true,
      }),
    );

    expect(
      analyzeDestructiveSql('ALTER TABLE users DROP COLUMN note'),
    ).toEqual(
      expect.objectContaining({
        requiresConfirmation: true,
        severity: 'high',
        reason: 'destructive_schema_change',
        affectedObject: 'users',
      }),
    );
  });

  it('flags opaque execution paths for review', () => {
    expect(analyzeDestructiveSql('EXEC dbo.RebuildLedger')).toEqual(
      expect.objectContaining({
        requiresConfirmation: true,
        severity: 'medium',
        reason: 'opaque_execution',
        objectType: 'PROCEDURE',
        affectedObject: 'dbo.RebuildLedger',
      }),
    );
  });
});

describe('analyzeSqlConfirmation', () => {
  it('picks the flagged statement from a multi-statement SQL sequence', () => {
    expect(
      analyzeSqlConfirmation(
        'CREATE TABLE temp_users (id INT); DELETE FROM audit_log',
      ),
    ).toEqual(
      expect.objectContaining({
        requiresConfirmation: true,
        severity: 'high',
        reason: 'unbounded_row_mutation',
        statement: 'DELETE FROM audit_log',
        statementIndex: 2,
        statementCount: 2,
        flaggedStatements: 1,
        affectedObject: 'audit_log',
      }),
    );
  });

  it('prefers the highest-severity flagged statement across a sequence', () => {
    expect(
      analyzeSqlConfirmation(
        'CREATE OR REPLACE VIEW active_users AS SELECT * FROM users; DELETE FROM users',
      ),
    ).toEqual(
      expect.objectContaining({
        requiresConfirmation: true,
        severity: 'high',
        reason: 'unbounded_row_mutation',
        statement: 'DELETE FROM users',
        statementIndex: 2,
        statementCount: 2,
        flaggedStatements: 2,
      }),
    );
  });

  it('marks SQL as destructive when a later statement is dangerous', () => {
    expect(
      isLikelyDestructiveSql(
        'INSERT INTO audit_log (id) VALUES (1); DELETE FROM audit_log',
      ),
    ).toBe(true);
  });
});
