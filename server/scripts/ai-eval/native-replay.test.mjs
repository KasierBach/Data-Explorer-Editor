import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  readJsonArtifact,
  validateCatalog,
  validateOutputs,
} from './evaluator.mjs';
import {
  NATIVE_CASES,
  NATIVE_CONTROLS,
  assertNativeProfile,
} from './native-fixture-profile.mjs';

const catalogPath = fileURLToPath(
  new URL('./synthetic-catalog.v1.json', import.meta.url),
);
const outputsPath = fileURLToPath(
  new URL('./prerecorded-outputs.v1.json', import.meta.url),
);
const catalog = assertNativeProfile(
  validateCatalog((await readJsonArtifact(catalogPath)).data),
);
const outputs = validateOutputs(
  (await readJsonArtifact(outputsPath)).data,
  catalog,
);
const replay = () => import('./native-replay.mjs');
const config = {
  runId: 'a12_' + 'a'.repeat(32),
  postgresUrl:
    'postgresql://a12_reader_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:a12-fixture-read-only@127.0.0.1:18432/data_explorer_ai_eval',
  mongoUrl:
    'mongodb://a12_reader_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:a12-fixture-read-only@127.0.0.1:18017/a12_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa?authSource=a12_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
};

test('native profiles cover exactly 19 answers and preserve author-draft claims', () => {
  assert.equal(NATIVE_CASES.length, 19);
  assert.equal(catalog.cases.length, 24);
  assert.equal(catalog.reviewStatus, 'AUTHOR_DRAFT_NOT_EXPERT_REVIEWED');
  assert.equal(catalog.responseMetadata.execution, 'NOT_EXECUTED');
  assert.equal(outputs.origin, 'AUTHOR_SYNTHETIC_PRERECORDED');
  const wrong = structuredClone(catalog);
  wrong.sourceFixtures.sql.orders[0].amount = 999;
  assert.throws(
    () => assertNativeProfile(wrong),
    /NATIVE_PROFILE_BINDING_MISMATCH/,
  );
});
test('native endpoint configuration admits only scoped read roles and dedicated fixture ports', async () => {
  const { validateNativeConfig } = await replay();
  assert.deepEqual(validateNativeConfig(config), config);
  for (const patch of [
    { runId: 'main' },
    { postgresUrl: config.postgresUrl.replace('18432', '5432') },
    { postgresUrl: config.postgresUrl.replace('127.0.0.1', 'db.example.com') },
    {
      postgresUrl: config.postgresUrl.replace(
        'data_explorer_ai_eval',
        'customer',
      ),
    },
    {
      postgresUrl: config.postgresUrl.replace('a12_reader_', 'a12_bootstrap_'),
    },
    { postgresUrl: config.postgresUrl + '?host=private.example' },
    { mongoUrl: config.mongoUrl.replace('18017', '27017') },
    {
      mongoUrl: config.mongoUrl.replace('authSource=a12_', 'authSource=other_'),
    },
    { mongoUrl: config.mongoUrl + '&replicaSet=external' },
    { mongoUrl: config.mongoUrl.replace('127.0.0.1', 'mongo.example.com') },
  ])
    assert.throws(
      () => validateNativeConfig({ ...config, ...patch }),
      /NATIVE_FIXTURE_CONFIG_INVALID/,
    );
});
test('untrusted query proposals cannot broaden the pinned execution subset', async () => {
  const { assertReadReplayQuery } = await replay();
  for (const item of catalog.cases.filter(
    (entry) => entry.expected.response.kind === 'answer',
  )) {
    assert.equal(
      assertReadReplayQuery(item.engine, item.expected.response.query).engine,
      item.engine,
    );
  }
  for (const query of [
    'SELECT 1; DELETE FROM orders',
    'SELECT pg_sleep(100)',
    'SELECT pg_advisory_lock(1)',
    'SELECT * FROM pg_catalog.pg_authid',
    'SELECT id INTO TEMP scratch FROM orders',
    'WITH deleted AS (DELETE FROM orders RETURNING *) SELECT * FROM deleted',
    'SELECT * FROM orders FOR UPDATE',
    'SELECT * FROM external.orders',
  ])
    assert.throws(
      () => assertReadReplayQuery('sql', query),
      /QUERY_OUTSIDE_PINNED_REPLAY/,
    );
  for (const query of [
    { collection: 'private', pipeline: [{ $match: {} }] },
    { collection: 'invoices', pipeline: [{ $out: 'copied' }] },
    { collection: 'invoices', pipeline: [{ $merge: 'copied' }] },
    {
      collection: 'invoices',
      pipeline: [{ $match: { $where: 'return true' } }],
    },
    {
      collection: 'invoices',
      pipeline: [
        {
          $project: {
            answer: { $function: { body: 'return 1', args: [], lang: 'js' } },
          },
        },
      ],
    },
    {
      collection: 'invoices',
      pipeline: [
        {
          $lookup: {
            from: 'private',
            as: 'rows',
            localField: 'id',
            foreignField: 'id',
          },
        },
      ],
    },
  ])
    assert.throws(
      () => assertReadReplayQuery('mongo', query),
      /QUERY_OUTSIDE_PINNED_REPLAY/,
    );
});
test('native PostgreSQL contracts use actual OIDs, field names and safe exact conversions', async () => {
  const { normalizePostgresResult } = await replay();
  const profile = NATIVE_CASES.find((item) => item.caseId === 'sql-count-null');
  const native = {
    fields: [
      { name: 'total_rows', dataTypeID: 20 },
      { name: 'known_amounts', dataTypeID: 20 },
    ],
    rows: [['6', '5']],
  };
  assert.deepEqual(normalizePostgresResult(native, profile).rows, [[6, 5]]);
  for (const change of [
    (value) => {
      value.fields[0].name = 'other';
    },
    (value) => {
      value.fields[0].dataTypeID = 25;
    },
    (value) => {
      value.rows[0][0] = '9007199254740993';
    },
    (value) => {
      value.rows[0][0] = null;
    },
    (value) => {
      value.rows[0].push('extra');
    },
  ]) {
    const invalid = structuredClone(native);
    change(invalid);
    assert.throws(() => normalizePostgresResult(invalid, profile));
  }
  const average = NATIVE_CASES.find(
    (item) => item.caseId === 'sql-average-known',
  );
  assert.deepEqual(
    normalizePostgresResult(
      {
        fields: [{ name: 'average_amount', dataTypeID: 1700 }],
        rows: [['6.0000000000000000']],
      },
      average,
    ).rows,
    [[6]],
  );
  assert.throws(
    () =>
      normalizePostgresResult(
        {
          fields: [{ name: 'average_amount', dataTypeID: 1700 }],
          rows: [['0.1000000000000000']],
        },
        average,
      ),
    /NATIVE_NUMERIC_NOT_EXACT/,
  );
});
test('native result contracts preserve NULL, zero and duplicate rows without inventing fields', async () => {
  const { normalizePostgresResult, normalizeMongoResult } = await replay();
  const sum = NATIVE_CASES.find((item) => item.caseId === 'sql-empty-sum');
  assert.deepEqual(
    normalizePostgresResult(
      { fields: [{ name: 'total', dataTypeID: 1700 }], rows: [[null]] },
      sum,
    ).rows,
    [[null]],
  );
  const mongo = NATIVE_CASES.find(
    (item) => item.caseId === 'mongo-paid-projection',
  );
  assert.deepEqual(
    normalizeMongoResult(
      [
        { id: 1, amount: 0 },
        { id: 1, amount: 0 },
      ],
      mongo,
    ).rows,
    [
      [1, 0],
      [1, 0],
    ],
  );
  for (const docs of [
    [{ id: 1 }],
    [{ id: 1, amount: null }],
    [{ id: 1, amount: '0' }],
    [{ id: 1, amount: 0, _id: 'extra' }],
  ])
    assert.throws(() => normalizeMongoResult(docs, mongo));
});
test('row and byte bounds reject excess output rather than silently truncating', async () => {
  const { normalizePostgresResult } = await replay();
  const profile = NATIVE_CASES.find(
    (item) => item.caseId === 'sql-region-multiset',
  );
  const fields = [{ name: 'region', dataTypeID: 25 }];
  assert.throws(
    () =>
      normalizePostgresResult(
        { fields, rows: Array.from({ length: 201 }, () => ['EU']) },
        profile,
      ),
    /NATIVE_ROW_LIMIT/,
  );
  assert.throws(
    () =>
      normalizePostgresResult(
        {
          fields,
          rows: Array.from({ length: 200 }, () => ['x'.repeat(16000)]),
        },
        profile,
      ),
    /NATIVE_BYTE_LIMIT/,
  );
});
test('native assessment catches forged provided bundles independently of expected results', async () => {
  const { assessNativeResult } = await replay();
  const item = catalog.cases.find((entry) => entry.id === 'sql-null-note');
  const output = structuredClone(
    outputs.outputs.find((entry) => entry.caseId === item.id),
  );
  const wrong = { columns: item.expected.result.columns, rows: [[11]] };
  const result = assessNativeResult(item, output, catalog, wrong);
  assert.equal(result.outcome, 'fail');
  assert.ok(result.reasons.includes('SUPPLIED_RESULT_DRIFT'));
  const altered = structuredClone(output);
  altered.result.rows = [[99]];
  const drift = assessNativeResult(
    item,
    altered,
    catalog,
    item.expected.result,
  );
  assert.equal(drift.outcome, 'fail');
  assert.ok(drift.reasons.includes('SUPPLIED_RESULT_DRIFT'));
});
test('query validation refuses serialization hooks and snapshots plain data once', async () => {
  const { assertReadReplayQuery } = await replay();
  const sql = NATIVE_CONTROLS.find(
    (item) => item.caseId === 'control-sql-empty-note',
  ).controlQuery;
  let hooks = 0;
  const crafted = {
    toJSON() {
      hooks++;
      return sql;
    },
    toString() {
      return 'DELETE FROM orders';
    },
  };
  assert.throws(
    () => assertReadReplayQuery('sql', crafted),
    /QUERY_OUTSIDE_PINNED_REPLAY/,
  );
  assert.equal(hooks, 0);
  const mongo = structuredClone(
    NATIVE_CONTROLS.find((item) => item.engine === 'mongo').controlQuery,
  );
  Object.defineProperty(mongo, 'pipeline', {
    enumerable: true,
    get() {
      hooks++;
      return [{ $out: 'copied' }];
    },
  });
  assert.throws(
    () => assertReadReplayQuery('mongo', mongo),
    /QUERY_OUTSIDE_PINNED_REPLAY/,
  );
  assert.equal(hooks, 0);
  const { snapshotPlainJson } = await import('./native-fixture-profile.mjs');
  const input = {
    collection: 'invoices',
    pipeline: [{ $sort: { region: 1, id: -1 } }],
  };
  const frozen = snapshotPlainJson(input);
  input.pipeline[0].$sort.id = 1;
  assert.deepEqual(Object.keys(frozen.pipeline[0].$sort), ['region', 'id']);
  assert.equal(frozen.pipeline[0].$sort.id, -1);
  assert.equal(Object.isFrozen(frozen.pipeline[0].$sort), true);
  assert.equal(
    Object.isFrozen(
      NATIVE_CONTROLS.find((item) => item.engine === 'mongo').controlQuery
        .pipeline[0],
    ),
    true,
  );
});
test('deadline cancellation is bounded and cannot leak cancellation callback errors', async () => {
  const { withNativeDeadline } = await replay();
  let cancelled = false;
  await assert.rejects(
    withNativeDeadline(
      () => new Promise(() => {}),
      () => {
        cancelled = true;
      },
      10,
    ),
    /NATIVE_DEADLINE/,
  );
  assert.equal(cancelled, true);
  assert.equal(
    await withNativeDeadline(
      async () => 42,
      () => {},
      50,
    ),
    42,
  );
});
test('cleanup retries wait for the previous disposal and driver operations to settle', async () => {
  const { createCleanupGate } = await replay();
  assert.equal(typeof createCleanupGate, 'function');
  let releaseOperation;
  let releaseDriver;
  let calls = 0;
  let cancelled = 0;
  const operation = new Promise((resolve) => {
    releaseOperation = resolve;
  });
  const driver = new Promise((resolve) => {
    releaseDriver = resolve;
  });
  const close = createCleanupGate(async (lifecycle) => {
    calls++;
    if (calls === 1) {
      lifecycle.pending.add(driver);
      driver.then(() => lifecycle.pending.delete(driver));
      lifecycle.aborters.add(() => {
        cancelled++;
      });
      await operation;
    }
    return calls;
  }, 20);
  await assert.rejects(close(), /NATIVE_FIXTURE_CLEANUP_FAILED/);
  assert.equal(cancelled, 1);
  releaseOperation();
  await assert.rejects(close(), /NATIVE_FIXTURE_CLEANUP_FAILED/);
  assert.equal(calls, 1);
  releaseDriver();
  assert.equal(await close(), 2);
  assert.equal(await close(), 2);
  assert.equal(calls, 2);
});

test('holdout opt-in and immutable CLI scope cannot be bypassed with extra flags', async () => {
  const { parseNativeArgs } = await replay();
  const argv = [
    '--catalog',
    catalogPath,
    '--outputs',
    outputsPath,
    '--run-id',
    config.runId,
    '--report',
    '/tmp/native-report.json',
  ];
  assert.equal(parseNativeArgs(argv).split, 'dev');
  assert.throws(
    () => parseNativeArgs([...argv, '--split', 'holdout']),
    /HOLDOUT_REQUIRES_EXPLICIT_OPT_IN/,
  );
  assert.equal(
    parseNativeArgs([...argv, '--split', 'holdout', '--allow-holdout', 'true'])
      .allowHoldout,
    true,
  );
  for (const extra of [
    ['--command', 'curl'],
    ['--allow-query', 'SELECT 1'],
    ['--catalog', catalogPath],
    ['--report', '../output.json'],
    ['--split', 'all'],
  ])
    assert.throws(() => parseNativeArgs([...argv, ...extra]));
});
