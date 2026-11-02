// Run separately: an uncaught pg callback regression must fail the test, not the Jest/API process.
const assert = require('node:assert/strict');
const { createE2eEnvironment } = require('../e2e-environment.cjs');
process.env = createE2eEnvironment(process.env);
const {
  PostgresStrategy,
} = require('../../src/database-strategies/postgres.strategy');
const { URL } = require('node:url');
const { Pool } = require('pg');
const uri = new URL(process.env.E2E_DATABASE_URL);
const strategy = new PostgresStrategy();
const mode = process.argv[2],
  table = process.argv[3];
assert(/^r05_[a-z0-9_]+$/.test(table), 'Only synthetic R05 tables are allowed');
const pool = strategy.createPool({
  host: uri.hostname,
  port: Number(uri.port),
  username: decodeURIComponent(uri.username),
  password: decodeURIComponent(uri.password),
  database: uri.pathname.slice(1),
  statementTimeout: 1000,
  queryTimeout: mode === 'deadline' ? 100 : 2000,
});
(async () => {
  let stream,
    error,
    rows = [];
  const control =
    mode === 'disconnect'
      ? new Pool({ connectionString: process.env.E2E_DATABASE_URL })
      : undefined;
  let backendPid, interruption, elapsedMs;
  pool.on('acquire', (client) => {
    backendPid = client.processID;
  });
  const started = performance.now();
  try {
    stream = await strategy.exportStream(
      pool,
      'public',
      mode === 'source-error' ? `${table}_missing` : table,
    );
    if (control)
      interruption = new Promise((resolve, reject) => {
        setTimeout(
          () =>
            control
              .query('SELECT pg_terminate_backend($1)', [backendPid])
              .then(resolve, reject),
          200,
        );
      });
    try {
      for await (const row of stream) rows.push(row);
    } catch (e) {
      error = e.message;
    }
    elapsedMs = performance.now() - started;
    await interruption;
    if (mode === 'five') {
      assert.equal(error, undefined);
      assert.deepEqual(
        rows,
        Array.from({ length: 5 }, (_, i) => ({
          id: i + 1,
          note: `row-${i + 1}`,
        })),
      );
      assert.equal(
        (await pool.query('SHOW statement_timeout')).rows[0].statement_timeout,
        '1s',
      );
    } else assert(error, 'Expected a controlled stream rejection');
  } finally {
    await strategy.closePool(pool);
    await control?.end();
  }
  assert.equal(pool.totalCount, 0);
  assert.equal(pool.waitingCount, 0);
  console.log(
    JSON.stringify({
      mode,
      rows,
      error,
      poolTotal: pool.totalCount,
      poolWaiting: pool.waitingCount,
      closed: stream?.closed,
      elapsedMs,
    }),
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
