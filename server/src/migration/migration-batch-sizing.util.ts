const ENGINE_BASE_BATCH_SIZE: Record<string, number> = {
  postgres: 2000,
  mysql: 1500,
  mssql: 250,
  mongodb: 2000,
  'mongodb+srv': 2000,
  clickhouse: 1000,
  sqlite: 500,
};

const ENGINE_MIN_BATCH_SIZE: Record<string, number> = {
  postgres: 100,
  mysql: 100,
  mssql: 25,
  mongodb: 100,
  'mongodb+srv': 100,
  clickhouse: 100,
  sqlite: 50,
};

export interface MigrationBatchSizingInput {
  targetType: string;
  columnCount: number;
  sampleRow?: Record<string, unknown>;
}

export interface MigrationBatchSizingPlan {
  recommendedBatchSize: number;
  minimumBatchSize: number;
  estimatedRowBytes: number;
}

function estimateRowBytes(
  sampleRow: Record<string, unknown> | undefined,
  columnCount: number,
) {
  if (!sampleRow) {
    return Math.max(128, columnCount * 48);
  }

  try {
    return Math.max(
      64,
      Buffer.byteLength(JSON.stringify(sampleRow), 'utf8'),
    );
  } catch {
    return Math.max(128, columnCount * 48);
  }
}

export function planMigrationBatchSizing({
  targetType,
  columnCount,
  sampleRow,
}: MigrationBatchSizingInput): MigrationBatchSizingPlan {
  const normalizedType = targetType.toLowerCase();
  const minimumBatchSize =
    ENGINE_MIN_BATCH_SIZE[normalizedType] ?? ENGINE_MIN_BATCH_SIZE.postgres;
  const baseBatchSize =
    ENGINE_BASE_BATCH_SIZE[normalizedType] ?? ENGINE_BASE_BATCH_SIZE.postgres;
  const estimatedRowBytes = estimateRowBytes(sampleRow, columnCount);

  let recommendedBatchSize = baseBatchSize;

  if (columnCount > 40) {
    recommendedBatchSize = Math.floor(recommendedBatchSize * 0.25);
  } else if (columnCount > 20) {
    recommendedBatchSize = Math.floor(recommendedBatchSize * 0.5);
  } else if (columnCount > 10) {
    recommendedBatchSize = Math.floor(recommendedBatchSize * 0.75);
  }

  if (estimatedRowBytes > 4000) {
    recommendedBatchSize = Math.floor(recommendedBatchSize * 0.25);
  } else if (estimatedRowBytes > 1500) {
    recommendedBatchSize = Math.floor(recommendedBatchSize * 0.5);
  } else if (estimatedRowBytes > 512) {
    recommendedBatchSize = Math.floor(recommendedBatchSize * 0.75);
  }

  if (normalizedType === 'mssql') {
    const maxRowsByParameterBudget = Math.max(
      1,
      Math.floor(2000 / Math.max(columnCount, 1)),
    );
    recommendedBatchSize = Math.min(
      recommendedBatchSize,
      maxRowsByParameterBudget,
    );
  }

  recommendedBatchSize = Math.max(
    minimumBatchSize,
    Math.min(baseBatchSize, recommendedBatchSize),
  );

  return {
    recommendedBatchSize,
    minimumBatchSize,
    estimatedRowBytes,
  };
}

export function reduceMigrationBatchSize(
  currentBatchSize: number,
  minimumBatchSize: number,
) {
  if (currentBatchSize <= minimumBatchSize) {
    return minimumBatchSize;
  }

  return Math.max(minimumBatchSize, Math.floor(currentBatchSize / 2));
}

export function isRetryableMigrationBatchError(error: unknown) {
  const message =
    error instanceof Error ? error.message : String(error ?? 'Unknown error');

  return /(timeout|timed out|packet|payload|too many|too large|memory|exhausted|parameter|2100|socket hang up|econnreset|request)/i.test(
    message,
  );
}
