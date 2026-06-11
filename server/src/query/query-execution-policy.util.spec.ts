import { evaluateQueryExecutionPolicy } from './query-execution-policy.util';

describe('evaluateQueryExecutionPolicy', () => {
  const baseInput = {
    allowQueryExecution: true,
    readOnly: false,
    type: 'postgres' as const,
  };

  it('blocks multi-statement SQL for relational connections', () => {
    expect(
      evaluateQueryExecutionPolicy({
        ...baseInput,
        sql: 'SELECT 1; DROP TABLE users',
      }),
    ).toMatchObject({
      kind: 'block',
      reason: 'MULTI_STATEMENT_BLOCKED',
    });
  });

  it('blocks write-style Mongo payloads on read-only connections', () => {
    expect(
      evaluateQueryExecutionPolicy({
        allowQueryExecution: true,
        readOnly: true,
        type: 'mongodb',
        sql: JSON.stringify({ action: 'deleteOne', collection: 'users' }),
      }),
    ).toMatchObject({
      kind: 'block',
      reason: 'READ_ONLY_CONNECTION',
      extra: { mongoAction: 'deleteOne' },
    });
  });

  it('requires confirmation for destructive SQL on writable connections', () => {
    expect(
      evaluateQueryExecutionPolicy({
        ...baseInput,
        sql: 'DROP TABLE users',
      }),
    ).toMatchObject({
      kind: 'confirmation_required',
      analysis: {
        severity: 'high',
        keywords: ['DROP'],
        affectedObject: 'USERS',
      },
    });
  });

  it('marks confirmed destructive SQL for audit logging', () => {
    expect(
      evaluateQueryExecutionPolicy({
        ...baseInput,
        sql: 'DELETE FROM users WHERE id = 1',
        confirmed: true,
      }),
    ).toMatchObject({
      kind: 'confirmed_destructive',
      analysis: {
        severity: 'high',
        keywords: ['DELETE'],
        affectedObject: 'USERS',
      },
    });
  });

  it('allows read-only-safe queries', () => {
    expect(
      evaluateQueryExecutionPolicy({
        ...baseInput,
        readOnly: true,
        sql: 'SELECT * FROM users',
      }),
    ).toEqual({ kind: 'allow' });
  });
});
