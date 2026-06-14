import {
  isRetryableMigrationBatchError,
  planMigrationBatchSizing,
  reduceMigrationBatchSize,
} from './migration-batch-sizing.util';

describe('migration-batch-sizing.util', () => {
  it('keeps narrow Mongo-style batches large enough for throughput', () => {
    const plan = planMigrationBatchSizing({
      targetType: 'mongodb',
      columnCount: 3,
      sampleRow: {
        id: 1,
        email: 'user@example.com',
        score: 42,
      },
    });

    expect(plan.recommendedBatchSize).toBe(2000);
    expect(plan.minimumBatchSize).toBe(100);
  });

  it('reduces wide SQL Server batches to stay under parameter and payload pressure', () => {
    const plan = planMigrationBatchSizing({
      targetType: 'mssql',
      columnCount: 24,
      sampleRow: {
        id: 1,
        email: 'user@example.com',
        description:
          'This is a deliberately wide payload row used to force a smaller adaptive batch size for SQL Server imports.',
        status: 'active',
        tier: 'enterprise',
        notes:
          'The utility should detect this as a wider row and cut the recommended batch size.',
      },
    });

    expect(plan.recommendedBatchSize).toBeLessThan(250);
    expect(plan.recommendedBatchSize).toBeGreaterThanOrEqual(25);
  });

  it('halves a failing batch size until it reaches the minimum floor', () => {
    expect(reduceMigrationBatchSize(250, 25)).toBe(125);
    expect(reduceMigrationBatchSize(30, 25)).toBe(25);
  });

  it('recognizes retryable batch errors', () => {
    expect(
      isRetryableMigrationBatchError(
        new Error('Request timeout while sending a large packet'),
      ),
    ).toBe(true);
    expect(
      isRetryableMigrationBatchError(
        new Error('Duplicate key value violates unique constraint'),
      ),
    ).toBe(false);
  });
});
