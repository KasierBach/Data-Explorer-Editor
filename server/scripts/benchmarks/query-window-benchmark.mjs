import { createRequire } from 'module';
import { performance } from 'perf_hooks';

const require = createRequire(import.meta.url);
require('reflect-metadata');
require('ts-node/register/transpile-only');

const {
  PostgresStrategy,
} = require('../../src/database-strategies/postgres.strategy.ts');
const {
  MongoDbStrategy,
} = require('../../src/database-strategies/mongodb.strategy.ts');

function forceGc() {
  if (typeof global.gc === 'function') {
    global.gc();
  }
}

function round(value) {
  return Number(value.toFixed(3));
}

function toMiB(bytes) {
  return round(bytes / (1024 * 1024));
}

function summarize(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = sorted.reduce((total, sample) => total + sample, 0);
  const pick = (percentile) => {
    const index = Math.min(
      sorted.length - 1,
      Math.max(0, Math.ceil(sorted.length * percentile) - 1),
    );
    return sorted[index];
  };

  return {
    minMs: round(sorted[0] ?? 0),
    avgMs: round(sum / Math.max(sorted.length, 1)),
    p50Ms: round(pick(0.5) ?? 0),
    p95Ms: round(pick(0.95) ?? 0),
    maxMs: round(sorted[sorted.length - 1] ?? 0),
  };
}

function makeSqlRows(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    email: `user_${index + 1}@example.com`,
    score: (index % 97) + 1,
    is_active: index % 2 === 0,
  }));
}

function makeMongoRows(count) {
  return Array.from({ length: count }, (_, index) => ({
    _id: `doc-${index + 1}`,
    category: index % 3 === 0 ? 'events' : 'metrics',
    title: `Aggregate row ${index + 1}`,
    total: index % 200,
    nested: {
      source: 'synthetic',
      bucket: index % 7,
    },
  }));
}

function createSqlPool(rows) {
  return {
    async connect() {
      return {
        async query() {
          const fields = Object.keys(rows[0] ?? {}).map((name) => ({ name }));
          return {
            rows,
            fields,
            rowCount: rows.length,
          };
        },
        release() {},
      };
    },
  };
}

function createMongoClient(rows) {
  return {
    db() {
      return {
        collection() {
          return {
            aggregate() {
              let cursorLimit = rows.length;
              return {
                maxTimeMS() {
                  return this;
                },
                limit(nextLimit) {
                  cursorLimit = nextLimit;
                  return this;
                },
                async toArray() {
                  return rows.slice(0, cursorLimit);
                },
              };
            },
          };
        },
      };
    },
  };
}

async function runSqlScenario({
  label,
  limit,
  offset = 0,
  measuredRuns = 10,
  warmupRuns = 2,
}) {
  const strategy = new PostgresStrategy();
  const rows = makeSqlRows(limit);
  const pool = createSqlPool(rows);
  const durations = [];

  for (let index = 0; index < warmupRuns; index += 1) {
    await strategy.executeQuery(pool, 'SELECT * FROM "users"', {
      limit,
      offset,
    });
  }

  forceGc();
  const heapBefore = process.memoryUsage().heapUsed;

  let returnedRows = 0;
  for (let index = 0; index < measuredRuns; index += 1) {
    const startedAt = performance.now();
    const result = await strategy.executeQuery(pool, 'SELECT * FROM "users"', {
      limit,
      offset,
    });
    durations.push(performance.now() - startedAt);
    returnedRows = result.rows.length;
  }

  forceGc();
  const heapAfter = process.memoryUsage().heapUsed;

  return {
    label,
    limit,
    offset,
    measuredRuns,
    returnedRows,
    heapDeltaBytes: heapAfter - heapBefore,
    heapDeltaMiB: toMiB(heapAfter - heapBefore),
    ...summarize(durations),
  };
}

async function runSqlRawCapScenario() {
  const strategy = new PostgresStrategy();
  const rows = makeSqlRows(50_000);
  const pool = createSqlPool(rows);
  const durations = [];

  for (let index = 0; index < 2; index += 1) {
    await strategy.executeQuery(pool, 'SELECT * FROM "users"');
  }

  forceGc();
  const heapBefore = process.memoryUsage().heapUsed;

  let returnedRows = 0;
  for (let index = 0; index < 5; index += 1) {
    const startedAt = performance.now();
    const result = await strategy.executeQuery(pool, 'SELECT * FROM "users"');
    durations.push(performance.now() - startedAt);
    returnedRows = result.rows.length;
  }

  forceGc();
  const heapAfter = process.memoryUsage().heapUsed;

  return {
    label: 'sql_raw_capped_50000',
    measuredRuns: 5,
    returnedRows,
    heapDeltaBytes: heapAfter - heapBefore,
    heapDeltaMiB: toMiB(heapAfter - heapBefore),
    ...summarize(durations),
  };
}

async function runMongoScenario({ label, rowCount, measuredRuns, warmupRuns }) {
  const strategy = new MongoDbStrategy();
  const rows = makeMongoRows(rowCount);
  const client = createMongoClient(rows);
  const payload = JSON.stringify({
    action: 'aggregate',
    collection: 'events',
    pipeline: [{ $match: { category: 'events' } }],
  });
  const durations = [];

  for (let index = 0; index < warmupRuns; index += 1) {
    await strategy.executeQuery(client, payload);
  }

  forceGc();
  const heapBefore = process.memoryUsage().heapUsed;

  let returnedRows = 0;
  for (let index = 0; index < measuredRuns; index += 1) {
    const startedAt = performance.now();
    const result = await strategy.executeQuery(client, payload);
    durations.push(performance.now() - startedAt);
    returnedRows = result.rows.length;
  }

  forceGc();
  const heapAfter = process.memoryUsage().heapUsed;

  return {
    label,
    sourceRows: rowCount,
    measuredRuns,
    returnedRows,
    heapDeltaBytes: heapAfter - heapBefore,
    heapDeltaMiB: toMiB(heapAfter - heapBefore),
    ...summarize(durations),
  };
}

async function main() {
  const payload = {
    benchmark: 'query-window',
    startedAt: new Date().toISOString(),
    node: process.version,
    platform: process.platform,
    notes: [
      'SQL scenarios exercise the current PostgresStrategy read path with mocked pool/query objects.',
      'Mongo scenarios exercise the current MongoDbStrategy aggregate cursor path with mocked in-memory aggregate results.',
      'The numbers capture service-layer overhead only and intentionally avoid live database round-trips.',
    ],
    sqlWindowScenarios: [
      await runSqlScenario({ label: 'sql_page_100', limit: 100 }),
      await runSqlScenario({ label: 'sql_page_500', limit: 500 }),
    ],
    sqlRawCapScenario: await runSqlRawCapScenario(),
    mongoAggregateScenarios: [
      await runMongoScenario({
        label: 'mongo_aggregate_5000',
        rowCount: 5_000,
        measuredRuns: 5,
        warmupRuns: 1,
      }),
      await runMongoScenario({
        label: 'mongo_aggregate_50000',
        rowCount: 50_000,
        measuredRuns: 3,
        warmupRuns: 1,
      }),
    ],
  };

  console.log(JSON.stringify(payload, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
