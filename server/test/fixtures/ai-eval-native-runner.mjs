import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import { Collection, MongoClient } from 'mongodb';
import {
  readJsonArtifact,
  validateCatalog,
  validateOutputs,
} from '../../scripts/ai-eval/evaluator.mjs';
import {
  NATIVE_CONTROLS,
  NATIVE_PROFILE_VERSION,
  NATIVE_SEED_SHA256,
  queryDigest,
} from '../../scripts/ai-eval/native-fixture-profile.mjs';
import {
  NativeReplayError,
  createNativeFixtures,
  nativeConfig,
  runNativeReplay,
  assessNativeResult,
} from '../../scripts/ai-eval/native-replay.mjs';

export const NATIVE_SCENARIOS = Object.freeze([
  'replay-dev',
  'replay-calibration',
  'replay-holdout',
  'forged-query',
  'forged-result',
  'sql-privileges',
  'mongo-privileges',
  'query-guards',
  'row-overflow',
  'immutable-handle',
  'cleanup-readback',
  'lock-deadline',
  'cleanup-refusal',
  'mongo-marker-ack-loss',
  'close-seed-phase',
]);
const catalogPath = fileURLToPath(
  new URL('../../scripts/ai-eval/synthetic-catalog.v1.json', import.meta.url),
);
const outputsPath = fileURLToPath(
  new URL('../../scripts/ai-eval/prerecorded-outputs.v1.json', import.meta.url),
);
const pgAdminUrl =
  'postgresql://a12_bootstrap:a12-fixture-bootstrap-only@127.0.0.1:18432/data_explorer_ai_eval';
const mongoAdminUrl =
  'mongodb://a12_bootstrap:a12-fixture-bootstrap-only@127.0.0.1:18017/admin';
const postgresClient = (connectionString) =>
  new Client({
    connectionString,
    connectionTimeoutMillis: 2000,
    query_timeout: 3000,
    statement_timeout: 2000,
    lock_timeout: 1000,
  });
const mongoClient = (url) =>
  new MongoClient(url, {
    serverSelectionTimeoutMS: 2000,
    connectTimeoutMS: 2000,
    socketTimeoutMS: 3000,
    timeoutMS: 3000,
  });

async function cleanupReadback(runId) {
  const role = `a12_reader_${runId.slice(4)}`;
  const postgres = postgresClient(pgAdminUrl);
  const mongo = mongoClient(mongoAdminUrl);
  try {
    await postgres.connect();
    await mongo.connect();
    const schema = await postgres.query(
      'SELECT COUNT(*)::int AS count FROM pg_namespace WHERE nspname=$1',
      [runId],
    );
    const principals = await postgres.query(
      'SELECT COUNT(*)::int AS count FROM pg_roles WHERE rolname=$1',
      [role],
    );
    assert.equal(schema.rows[0].count, 0);
    assert.equal(principals.rows[0].count, 0);
    const db = mongo.db(runId);
    assert.equal(
      (await db.command({ usersInfo: role }, { maxTimeMS: 2000 })).users.length,
      0,
    );
    assert.equal(
      (await db.command({ rolesInfo: role }, { maxTimeMS: 2000 })).roles.length,
      0,
    );
    assert.equal(
      (
        await db
          .listCollections({}, { nameOnly: true, maxTimeMS: 2000 })
          .toArray()
      ).length,
      0,
    );
  } finally {
    await Promise.allSettled([postgres.end(), mongo.close()]);
  }
}

async function runScenario(scenario) {
  const runId = `a12_${randomUUID().replace(/-/g, '')}`;
  const catalog = validateCatalog((await readJsonArtifact(catalogPath)).data);
  const outputs = validateOutputs(
    (await readJsonArtifact(outputsPath)).data,
    catalog,
  );
  const config = nativeConfig(runId);
  let fixture;
  if (scenario === 'mongo-marker-ack-loss') {
    const insert = Collection.prototype.insertOne;
    let committed = false;
    Collection.prototype.insertOne = async function (document, options) {
      const value = await insert.call(this, document, options);
      if (
        this.collectionName === 'fixture_identity' &&
        document.runId === runId
      ) {
        committed = true;
        throw new Error('Synthetic lost acknowledgement');
      }
      return value;
    };
    try {
      await assert.rejects(
        createNativeFixtures(catalog, runId),
        (error) => error.code === 'NATIVE_FIXTURE_SETUP_FAILED',
      );
      assert.equal(committed, true);
    } finally {
      Collection.prototype.insertOne = insert;
    }
    await cleanupReadback(runId);
  }
  fixture = await createNativeFixtures(catalog, runId);
  let report;
  try {
    if (scenario.startsWith('replay-')) {
      const split = scenario.slice(7);
      const expected = { dev: [8, 4], calibration: [6, 0], holdout: [5, 1] }[
        split
      ];
      report = await runNativeReplay({
        catalogPath,
        outputsPath,
        runId,
        split,
        allowHoldout: split === 'holdout',
        fixture,
      });
      assert.equal(report.allPassed, true);
      assert.equal(report.totals.pass, expected[0]);
      assert.equal(report.totals.executed, expected[0]);
      assert.equal(report.totals.abstain, expected[1]);
      assert.equal(report.totals.fail, 0);
      assert.equal(report.totals.unevaluated, 0);
      assert.equal(report.reviewStatus, 'AUTHOR_DRAFT_NOT_EXPERT_REVIEWED');
      assert.equal(report.evidenceStatus, 'INSUFFICIENT_EVIDENCE');
      assert.equal(report.semanticModelAccuracy, 'NOT_ASSESSED');
      assert.equal(report.deploymentAuthorized, false);
      assert.equal(report.usageCoverage.providerCalls, 0);
      assert.equal(report.nativeSeedReadback, 'MATCHED_BEFORE_AND_AFTER');
      assert.equal(
        report.caseResults.filter(
          (item) => item.execution === 'NATIVE_QUERY_EXECUTED',
        ).length,
        expected[0],
      );
      if (split === 'holdout')
        assert.deepEqual(report.holdoutPolicy, {
          optIn: true,
          blind: false,
          tuningPermitted: false,
        });
    } else if (scenario === 'forged-query') {
      const item = catalog.cases.find((entry) => entry.id === 'sql-null-note');
      const output = structuredClone(
        outputs.outputs.find((entry) => entry.caseId === item.id),
      );
      const query = NATIVE_CONTROLS.find(
        (entry) => entry.caseId === 'control-sql-empty-note',
      ).controlQuery;
      const result = await fixture.execute('sql', query);
      assert.deepEqual(result.rows, [[11]]);
      output.response.query = query;
      const assessed = assessNativeResult(item, output, catalog, result);
      assert.equal(assessed.outcome, 'fail');
      assert.ok(assessed.reasons.includes('SUPPLIED_RESULT_DRIFT'));
      assert.equal(assessed.querySha256, queryDigest(query));
    } else if (scenario === 'forged-result') {
      const item = catalog.cases.find(
        (entry) => entry.id === 'mongo-null-or-missing',
      );
      const output = structuredClone(
        outputs.outputs.find((entry) => entry.caseId === item.id),
      );
      output.result.rows = [[999]];
      const assessed = assessNativeResult(
        item,
        output,
        catalog,
        await fixture.execute('mongo', output.response.query),
      );
      assert.equal(assessed.outcome, 'fail');
      assert.ok(assessed.reasons.includes('SUPPLIED_RESULT_DRIFT'));
    } else if (scenario === 'sql-privileges') {
      const reader = postgresClient(config.postgresUrl);
      try {
        await reader.connect();
        // Prove the ACL independently of transaction READ ONLY, not merely its default.
        await reader.query('SET default_transaction_read_only = off');
        for (const query of [
          `DELETE FROM "${runId}".orders`,
          'CREATE TEMP TABLE a12_forbidden(id integer)',
          'SELECT pg_catalog.pg_advisory_lock(1::bigint)',
          "SELECT pg_catalog.set_config('application_name', 'forbidden', false)",
        ])
          await assert.rejects(
            reader.query(query),
            (error) => error.code === '42501',
          );
      } finally {
        await reader.end();
      }
      assert.equal(await fixture.verifySeed(), NATIVE_SEED_SHA256);
    } else if (scenario === 'mongo-privileges') {
      const reader = mongoClient(config.mongoUrl);
      try {
        await reader.connect();
        const db = reader.db(runId);
        await assert.rejects(
          db.collection('invoices').insertOne({ id: 999 }),
          (error) => error.code === 13,
        );
        await assert.rejects(
          db
            .collection('invoices')
            .aggregate([{ $out: 'copied' }], {
              maxTimeMS: 2000,
              allowDiskUse: false,
            })
            .toArray(),
          (error) => error.code === 13,
        );
        await assert.rejects(
          db
            .collection('invoices')
            .aggregate([{ $merge: 'copied' }], {
              maxTimeMS: 2000,
              allowDiskUse: false,
            })
            .toArray(),
          (error) => error.code === 13,
        );
        await assert.rejects(
          db.collection('fixture_identity').findOne({}),
          (error) => error.code === 13,
        );
      } finally {
        await reader.close();
      }
      assert.equal(await fixture.verifySeed(), NATIVE_SEED_SHA256);
    } else if (scenario === 'query-guards') {
      for (const query of [
        'SELECT * FROM orders; DELETE FROM orders',
        'SELECT pg_sleep(2)',
        'SELECT * FROM other_schema.orders',
      ]) {
        await assert.rejects(
          fixture.execute('sql', query),
          (error) => error.code === 'QUERY_OUTSIDE_PINNED_REPLAY',
        );
      }
      const permitted = NATIVE_CONTROLS.find(
        (entry) => entry.caseId === 'control-sql-empty-note',
      ).controlQuery;
      let hooks = 0;
      await assert.rejects(
        fixture.execute('sql', {
          toJSON() {
            hooks++;
            return permitted;
          },
          toString() {
            return 'DELETE FROM orders';
          },
        }),
        (error) => error.code === 'QUERY_OUTSIDE_PINNED_REPLAY',
      );
      assert.equal(hooks, 0);
      for (const query of [
        { collection: 'invoices', pipeline: [{ $merge: 'copied' }] },
        {
          collection: 'invoices',
          pipeline: [
            {
              $project: {
                value: {
                  $function: { body: 'return 1', args: [], lang: 'js' },
                },
              },
            },
          ],
        },
      ])
        await assert.rejects(
          fixture.execute('mongo', query),
          (error) => error.code === 'QUERY_OUTSIDE_PINNED_REPLAY',
        );
      assert.equal(await fixture.verifySeed(), NATIVE_SEED_SHA256);
    } else if (scenario === 'row-overflow') {
      const control = NATIVE_CONTROLS.find(
        (entry) => entry.caseId === 'control-sql-overflow',
      );
      await assert.rejects(
        fixture.execute('sql', control.controlQuery),
        (error) => error.code === 'NATIVE_ROW_LIMIT',
      );
      const item = catalog.cases.find((entry) => entry.id === 'sql-null-note');
      assert.deepEqual(
        (await fixture.execute('sql', item.expected.response.query)).rows,
        [[10], [13], [14]],
      );
    } else if (scenario === 'immutable-handle') {
      assert.equal(Object.isFrozen(fixture), true);
      assert.deepEqual(Object.keys(fixture).sort(), [
        'close',
        'execute',
        'profileVersion',
        'runId',
        'verifySeed',
      ]);
      assert.throws(() => {
        fixture.execute = () => {};
      }, TypeError);
      await assert.rejects(
        runNativeReplay({
          catalogPath,
          outputsPath,
          runId,
          fixture: { ...fixture },
        }),
        (error) => error.code === 'NATIVE_FIXTURE_NOT_OWNED',
      );
      await assert.rejects(
        runNativeReplay({
          catalogPath,
          outputsPath,
          runId,
          split: 'holdout',
          fixture,
        }),
        (error) => error.code === 'HOLDOUT_REQUIRES_EXPLICIT_OPT_IN',
      );
      await fixture.close();
      await assert.rejects(
        runNativeReplay({ catalogPath, outputsPath, runId, fixture }),
        (error) => error.code === 'NATIVE_FIXTURE_NOT_OWNED',
      );
      await assert.rejects(
        fixture.execute('sql', catalog.cases[0].expected.response.query),
        (error) => error.code === 'NATIVE_FIXTURE_CLOSED',
      );
    } else if (scenario === 'close-seed-phase') {
      const role = `a12_reader_${runId.slice(4)}`;
      const end = Client.prototype.end;
      const connect = MongoClient.prototype.connect;
      let armed = true;
      let closing = false;
      let closePromise;
      let closeOutcome;
      let lateReaderConnections = 0;
      Client.prototype.end = function (...args) {
        const operation = end.apply(this, args);
        if (args.length) return operation;
        return Promise.resolve(operation).then((value) => {
          if (armed && this.connectionParameters.user === role) {
            armed = false;
            closing = true;
            closePromise = fixture.close().then(
              () => {
                closeOutcome = 'CLOSED';
              },
              (error) => {
                closeOutcome = error.code ?? 'CLEANUP_FAILED';
              },
            );
          }
          return value;
        });
      };
      MongoClient.prototype.connect = function (...args) {
        if (closing && this.options.credentials?.username === role)
          lateReaderConnections++;
        return connect.apply(this, args);
      };
      try {
        const outcome = await fixture.verifySeed().then(
          () => 'FULFILLED',
          (error) => error.code,
        );
        await closePromise;
        assert.equal(closing, true);
        assert.equal(lateReaderConnections, 0);
        assert.equal(outcome, 'NATIVE_FIXTURE_CLOSED');
        assert.equal(closeOutcome, 'CLOSED');
        await assert.rejects(
          fixture.verifySeed(),
          (error) => error.code === 'NATIVE_FIXTURE_CLOSED',
        );
        assert.equal(lateReaderConnections, 0);
      } finally {
        Client.prototype.end = end;
        MongoClient.prototype.connect = connect;
        await closePromise;
      }
    } else if (scenario === 'cleanup-readback') {
      await fixture.close();
      await fixture.close();
      await cleanupReadback(runId);
      fixture = await createNativeFixtures(catalog, runId);
      assert.equal(await fixture.verifySeed(), NATIVE_SEED_SHA256);
    } else if (scenario === 'lock-deadline') {
      const blocker = postgresClient(pgAdminUrl);
      try {
        await blocker.connect();
        await blocker.query('BEGIN');
        await blocker.query(
          `LOCK TABLE "${runId}".orders IN ACCESS EXCLUSIVE MODE`,
        );
        await assert.rejects(
          fixture.execute('sql', catalog.cases[0].expected.response.query),
          (error) => error.code === 'NATIVE_DEADLINE',
        );
      } finally {
        await blocker.query('ROLLBACK').catch(() => {});
        await blocker.end();
      }
      assert.deepEqual(
        (await fixture.execute('sql', catalog.cases[0].expected.response.query))
          .rows,
        [[10], [13], [14]],
      );
    } else if (scenario === 'cleanup-refusal') {
      const admin = postgresClient(pgAdminUrl);
      try {
        await admin.connect();
        await admin.query(`COMMENT ON SCHEMA "${runId}" IS 'not-this-run'`);
        await assert.rejects(
          fixture.close(),
          (error) => error.code === 'NATIVE_FIXTURE_CLEANUP_FAILED',
        );
        assert.equal(
          (
            await admin.query(
              'SELECT COUNT(*)::int AS count FROM pg_namespace WHERE nspname=$1',
              [runId],
            )
          ).rows[0].count,
          1,
        );
        await admin.query(`COMMENT ON SCHEMA "${runId}" IS '${runId}'`);
        await fixture.close();
      } finally {
        await admin
          .query(`COMMENT ON SCHEMA "${runId}" IS '${runId}'`)
          .catch(() => {});
        await admin.end();
      }
    }
  } finally {
    await fixture.close();
  }
  await cleanupReadback(runId);
  return {
    scenario,
    passed: true,
    profileVersion: NATIVE_PROFILE_VERSION,
    providerCalls: 0,
    semanticModelAccuracy: 'NOT_ASSESSED',
    deploymentAuthorized: false,
    cleanupVerified: true,
    ...(report ? { report } : {}),
  };
}

async function main() {
  const argv = process.argv.slice(2);
  if (
    argv.length !== 2 ||
    argv[0] !== '--scenario' ||
    !NATIVE_SCENARIOS.includes(argv[1])
  ) {
    process.stderr.write(
      `${JSON.stringify({ code: 'NATIVE_SCENARIO_INVALID' })}\n`,
    );
    process.exitCode = 2;
    return;
  }
  const hardStop = setTimeout(() => {
    process.stderr.write(
      `${JSON.stringify({ code: 'NATIVE_SCENARIO_DEADLINE' })}\n`,
    );
    process.exit(2);
  }, 30000);
  try {
    const result = await runScenario(argv[1]);
    assert.ok(Buffer.byteLength(JSON.stringify(result)) <= 64 * 1024);
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(
      `${JSON.stringify({ code: error instanceof NativeReplayError ? error.code : 'NATIVE_SCENARIO_FAILED', ...(error instanceof NativeReplayError && ['sql-bootstrap', 'mongo-bootstrap', 'sql-reader', 'seed-readback'].includes(error.stage) ? { stage: error.stage } : {}), ...(error instanceof NativeReplayError && typeof error.storeCode === 'string' && /^(?:\d{5}|MONGO_\d{2,5})$/.test(error.storeCode) ? { storeCode: error.storeCode } : {}), deploymentAuthorized: false })}\n`,
    );
    process.exitCode = 1;
  } finally {
    clearTimeout(hardStop);
  }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1])
  void main();
