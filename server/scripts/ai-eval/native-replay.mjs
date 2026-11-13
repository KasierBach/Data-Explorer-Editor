import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  assertLocalJsonPath,
  readJsonArtifact,
  validateCatalog,
  validateOutputs,
  validateResultBundle,
  compareResultBundles,
  evaluateCase,
} from './evaluator.mjs';
import {
  NATIVE_PROFILE_VERSION,
  NATIVE_DATASET_VERSION,
  NATIVE_SEED_SHA256,
  NATIVE_LIMITS,
  canonicalJson,
  digest,
  queryDigest,
  snapshotPlainJson,
  assertNativeProfile,
  resolveNativeQuery,
} from './native-fixture-profile.mjs';

export class NativeReplayError extends Error {
  constructor(code) {
    super(code);
    this.name = 'NativeReplayError';
    this.code = code;
  }
}
const requireValue = (value, code) => {
  if (!value) throw new NativeReplayError(code);
};
const terminalPolicy = Object.freeze({
  ordering: 'ordered',
  numericTolerance: {
    absolute: 0,
    relative: 0,
    rationale:
      'Exact native replay by default; supplied bundles are not execution evidence.',
  },
});
const readerPassword = 'a12-fixture-read-only';
const bootstrapPassword = 'a12-fixture-bootstrap-only';
const pgDatabase = 'data_explorer_ai_eval';
const fixtureRun = /^a12_[0-9a-f]{32}$/;
const fixtureStates = new WeakMap();
const sourceDigest = (value) =>
  createHash('sha256').update(value).digest('hex');

export function validateNativeConfig(config) {
  try {
    const value = snapshotPlainJson(config);
    if (
      value === null ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      Object.keys(value).sort().join(',') !== 'mongoUrl,postgresUrl,runId' ||
      typeof value.runId !== 'string' ||
      !fixtureRun.test(value.runId)
    )
      throw new Error();
    const pg = new URL(value.postgresUrl);
    const mongo = new URL(value.mongoUrl);
    const user = `a12_reader_${value.runId.slice(4)}`;
    if (
      !['postgres:', 'postgresql:'].includes(pg.protocol) ||
      pg.hostname !== '127.0.0.1' ||
      pg.port !== '18432' ||
      pg.pathname !== `/${pgDatabase}` ||
      decodeURIComponent(pg.username) !== user ||
      decodeURIComponent(pg.password) !== readerPassword ||
      pg.search ||
      pg.hash
    )
      throw new Error();
    if (
      mongo.protocol !== 'mongodb:' ||
      mongo.hostname !== '127.0.0.1' ||
      mongo.port !== '18017' ||
      mongo.pathname !== `/${value.runId}` ||
      decodeURIComponent(mongo.username) !== user ||
      decodeURIComponent(mongo.password) !== readerPassword ||
      mongo.hash ||
      mongo.searchParams.size !== 1 ||
      mongo.searchParams.get('authSource') !== value.runId
    )
      throw new Error();
    return value;
  } catch {
    throw new NativeReplayError('NATIVE_FIXTURE_CONFIG_INVALID');
  }
}
export function nativeConfig(runId) {
  requireValue(
    typeof runId === 'string' && fixtureRun.test(runId),
    'NATIVE_FIXTURE_CONFIG_INVALID',
  );
  const user = `a12_reader_${runId.slice(4)}`;
  return validateNativeConfig({
    runId,
    postgresUrl: `postgresql://${user}:${readerPassword}@127.0.0.1:18432/${pgDatabase}`,
    mongoUrl: `mongodb://${user}:${readerPassword}@127.0.0.1:18017/${runId}?authSource=${runId}`,
  });
}
function snapshotQuery(engine, query) {
  try {
    requireValue(
      ['sql', 'mongo'].includes(engine) &&
        (engine !== 'sql' || typeof query === 'string'),
      'QUERY_OUTSIDE_PINNED_REPLAY',
    );
    const value = snapshotPlainJson(query);
    requireValue(
      resolveNativeQuery(engine, value) !== null,
      'QUERY_OUTSIDE_PINNED_REPLAY',
    );
    return value;
  } catch {
    throw new NativeReplayError('QUERY_OUTSIDE_PINNED_REPLAY');
  }
}
export function assertReadReplayQuery(engine, query) {
  return resolveNativeQuery(engine, snapshotQuery(engine, query));
}

// Decimal normalization is deliberately exact and narrower than general
// financial semantics. Numeric strings do not become arbitrary float estimates.
function exactNumber(value) {
  if (typeof value === 'number') {
    requireValue(
      Number.isFinite(value) &&
        (!Number.isInteger(value) || Number.isSafeInteger(value)),
      'NATIVE_NUMERIC_NOT_EXACT',
    );
    return value;
  }
  requireValue(
    typeof value === 'string' &&
      value.length <= 256 &&
      /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(value),
    'NATIVE_NUMERIC_NOT_EXACT',
  );
  const number = Number(value);
  requireValue(
    Number.isFinite(number) &&
      (!Number.isInteger(number) || Number.isSafeInteger(number)),
    'NATIVE_NUMERIC_NOT_EXACT',
  );
  const [coefficient, exponentText = '0'] = value.toLowerCase().split('e');
  const exponent = Number(exponentText);
  const scale = (coefficient.split('.')[1]?.length ?? 0) - exponent;
  requireValue(
    Number.isInteger(exponent) && Math.abs(scale) <= 128,
    'NATIVE_NUMERIC_NOT_EXACT',
  );
  let numerator = BigInt(coefficient.replace('.', ''));
  let denominator = 1n;
  if (scale >= 0) denominator = 10n ** BigInt(scale);
  else numerator *= 10n ** BigInt(-scale);
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, number);
  const bits = view.getBigUint64(0);
  const power = Number((bits >> 52n) & 2047n);
  let binary = bits & ((1n << 52n) - 1n);
  if (power) binary += 1n << 52n;
  if (bits >> 63n) binary = -binary;
  const shift = power ? power - 1075 : -1074;
  const binaryNumerator = shift >= 0 ? binary << BigInt(shift) : binary;
  const binaryDenominator = shift < 0 ? 1n << BigInt(-shift) : 1n;
  requireValue(
    numerator * binaryDenominator === binaryNumerator * denominator,
    'NATIVE_NUMERIC_NOT_EXACT',
  );
  return number;
}
function normalizeCell(value, column, postgres) {
  if (value === null) {
    requireValue(column.nullable, 'NATIVE_NULL_CONTRACT');
    return null;
  }
  if (column.type === 'integer') {
    if (postgres && typeof value === 'string') {
      requireValue(
        /^-?(?:0|[1-9]\d*)$/.test(value) && value.length <= 32,
        'NATIVE_INTEGER_NOT_EXACT',
      );
      const count = BigInt(value);
      requireValue(
        count >= BigInt(Number.MIN_SAFE_INTEGER) &&
          count <= BigInt(Number.MAX_SAFE_INTEGER),
        'NATIVE_INTEGER_NOT_EXACT',
      );
      return Number(count);
    }
    requireValue(
      typeof value === 'number' && Number.isSafeInteger(value),
      'NATIVE_INTEGER_NOT_EXACT',
    );
    return value;
  }
  if (column.type === 'number') {
    requireValue(
      postgres || typeof value === 'number',
      'NATIVE_NUMERIC_NOT_EXACT',
    );
    return exactNumber(value);
  }
  requireValue(
    column.type === 'string' && typeof value === 'string',
    'NATIVE_STRING_CONTRACT',
  );
  return value;
}
function boundedBundle(columns, rows) {
  requireValue(
    Array.isArray(rows) && rows.length <= NATIVE_LIMITS.rows,
    'NATIVE_ROW_LIMIT',
  );
  const bundle = {
    columns: columns.map(({ name, type, nullable }) => ({
      name,
      type,
      nullable,
    })),
    rows,
  };
  requireValue(
    Buffer.byteLength(JSON.stringify(bundle)) <= NATIVE_LIMITS.bytes,
    'NATIVE_BYTE_LIMIT',
  );
  try {
    validateResultBundle(bundle);
  } catch {
    throw new NativeReplayError('NATIVE_RESULT_CONTRACT');
  }
  return bundle;
}
export function normalizePostgresResult(result, profile) {
  requireValue(
    Array.isArray(result?.fields) &&
      Array.isArray(result?.rows) &&
      result.fields.length === profile.columns.length,
    'NATIVE_COLUMN_CONTRACT',
  );
  requireValue(result.rows.length <= NATIVE_LIMITS.rows, 'NATIVE_ROW_LIMIT');
  for (const [index, field] of result.fields.entries())
    requireValue(
      field.name === profile.columns[index].name &&
        field.dataTypeID === profile.columns[index].oid,
      'NATIVE_COLUMN_CONTRACT',
    );
  return boundedBundle(
    profile.columns,
    result.rows.map((row) => {
      requireValue(
        Array.isArray(row) && row.length === profile.columns.length,
        'NATIVE_COLUMN_CONTRACT',
      );
      return row.map((value, index) =>
        normalizeCell(value, profile.columns[index], true),
      );
    }),
  );
}
export function normalizeMongoResult(documents, profile) {
  requireValue(
    Array.isArray(documents) && documents.length <= NATIVE_LIMITS.rows,
    'NATIVE_ROW_LIMIT',
  );
  const keys = profile.columns.map((column) => column.name);
  return boundedBundle(
    profile.columns,
    documents.map((document) => {
      const value = snapshotPlainJson(document);
      requireValue(
        value !== null &&
          !Array.isArray(value) &&
          typeof value === 'object' &&
          Object.keys(value).length === keys.length &&
          keys.every((key) => Object.hasOwn(value, key)),
        'NATIVE_COLUMN_CONTRACT',
      );
      return profile.columns.map((column) =>
        normalizeCell(value[column.name], column, false),
      );
    }),
  );
}
export function assessNativeResult(item, output, catalog, nativeResult) {
  const assessed = evaluateCase(
    item,
    { ...output, result: nativeResult },
    catalog,
    'result-bundle',
  );
  const supplied = compareResultBundles(
    nativeResult,
    output.result,
    item.comparison ?? terminalPolicy,
  );
  const reasons = [
    ...assessed.reasons,
    ...(!supplied.equal ? ['SUPPLIED_RESULT_DRIFT'] : []),
  ];
  return {
    ...assessed,
    execution: 'NATIVE_QUERY_EXECUTED',
    outcome: reasons.length ? 'fail' : 'pass',
    reasons,
    queryAssessment: 'PINNED_QUERY_EXECUTED_NOT_MODEL_ACCURACY',
    resultAssessment:
      assessed.resultAssessment === 'PROVIDED_FIXTURE_BUNDLES_MATCH'
        ? 'MEASURED_NATIVE_RESULT_MATCH'
        : 'MEASURED_NATIVE_RESULT_DIFFER',
    suppliedResultAssessment: supplied.equal
      ? 'SUPPLIED_BUNDLE_MATCHES_EXECUTION'
      : 'SUPPLIED_BUNDLE_DIFFERS_FROM_EXECUTION',
    nativeResultSha256: digest(nativeResult),
    querySha256: queryDigest(output.response.query),
  };
}
export async function withNativeDeadline(
  operation,
  cancel = () => {},
  milliseconds = NATIVE_LIMITS.wallMs,
) {
  requireValue(
    Number.isSafeInteger(milliseconds) &&
      milliseconds > 0 &&
      milliseconds <= NATIVE_LIMITS.wallMs,
    'INVALID_NATIVE_DEADLINE',
  );
  let timer;
  const running = Promise.resolve().then(operation);
  const expired = new Promise((_, reject) => {
    timer = setTimeout(() => {
      try {
        Promise.resolve(cancel()).catch(() => {});
      } catch {
        /* Do not expose cancellation callback text. */
      }
      reject(new NativeReplayError('NATIVE_DEADLINE'));
    }, milliseconds);
  });
  try {
    return await Promise.race([running, expired]);
  } finally {
    clearTimeout(timer);
  }
}
export function createCleanupGate(
  operation,
  milliseconds = NATIVE_LIMITS.wallMs,
) {
  let previous;
  let pending;
  return () => {
    if (pending) return pending;
    const until = Date.now() + milliseconds;
    const remaining = () => {
      const value = until - Date.now();
      requireValue(value > 0, 'NATIVE_FIXTURE_CLEANUP_FAILED');
      return value;
    };
    pending = (async () => {
      if (previous) {
        await withNativeDeadline(
          async () => {
            await Promise.allSettled([previous.running]);
            while (previous.lifecycle.pending.size) {
              await Promise.allSettled([...previous.lifecycle.pending]);
            }
          },
          previous.cancel,
          remaining(),
        );
      }
      const lifecycle = { pending: new Set(), aborters: new Set() };
      const controller = new AbortController();
      const aborted = new Set();
      const cancel = () => {
        if (!controller.signal.aborted)
          controller.abort(
            new NativeReplayError('NATIVE_FIXTURE_CLEANUP_FAILED'),
          );
        for (const abort of lifecycle.aborters) {
          if (aborted.has(abort)) continue;
          aborted.add(abort);
          try {
            Promise.resolve(abort()).catch(() => {});
          } catch {
            /* Cleanup errors remain redacted. */
          }
        }
      };
      const running = Promise.resolve().then(() =>
        operation(lifecycle, controller.signal),
      );
      previous = { lifecycle, running, cancel };
      try {
        const value = await withNativeDeadline(
          () => running,
          cancel,
          remaining(),
        );
        await withNativeDeadline(
          () => Promise.allSettled([...lifecycle.pending]),
          cancel,
          remaining(),
        );
        requireValue(
          lifecycle.pending.size === 0,
          'NATIVE_FIXTURE_CLEANUP_FAILED',
        );
        return value;
      } catch {
        cancel();
        throw new NativeReplayError('NATIVE_FIXTURE_CLEANUP_FAILED');
      }
    })().catch(() => {
      pending = undefined;
      throw new NativeReplayError('NATIVE_FIXTURE_CLEANUP_FAILED');
    });
    return pending;
  };
}
function trackedOperation(lifecycle, operation, abort) {
  const running = Promise.resolve().then(operation);
  lifecycle.pending.add(running);
  lifecycle.aborters.add(abort);
  const settled = () => {
    lifecycle.pending.delete(running);
    lifecycle.aborters.delete(abort);
  };
  running.then(settled, settled);
  return withNativeDeadline(() => running, abort);
}
async function withPgConnection(
  Client,
  connectionString,
  lifecycle,
  operation,
) {
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 2000,
    query_timeout: 3000,
    statement_timeout: 2000,
    lock_timeout: 1000,
    idle_in_transaction_session_timeout: 3000,
  });
  client.on('error', () => {});
  const controller = new AbortController();
  let ended;
  const end = () => (ended ??= client.end());
  const abort = () => {
    controller.abort(new NativeReplayError('NATIVE_DEADLINE'));
    void end().catch(() => {});
  };
  return trackedOperation(
    lifecycle,
    async () => {
      try {
        controller.signal.throwIfAborted();
        await client.connect();
        controller.signal.throwIfAborted();
        return await operation(client, controller.signal);
      } finally {
        await end();
      }
    },
    abort,
  );
}
async function withMongoConnection(MongoClient, url, lifecycle, operation) {
  const client = new MongoClient(url, {
    serverSelectionTimeoutMS: 2000,
    connectTimeoutMS: 2000,
    socketTimeoutMS: 3000,
    timeoutMS: 3000,
  });
  const controller = new AbortController();
  let ended;
  const end = () => (ended ??= client.close());
  const abort = () => {
    controller.abort(new NativeReplayError('NATIVE_DEADLINE'));
    void end().catch(() => {});
  };
  return trackedOperation(
    lifecycle,
    async () => {
      try {
        await client.connect();
        controller.signal.throwIfAborted();
        return await operation(client, controller.signal);
      } finally {
        await end();
      }
    },
    abort,
  );
}

export async function createNativeFixtures(input, runId) {
  const catalog = assertNativeProfile(
    validateCatalog(snapshotPlainJson(input)),
  );
  const config = nativeConfig(runId);
  const { Client } = await import('pg');
  const { MongoClient } = await import('mongodb');
  const role = `a12_reader_${runId.slice(4)}`;
  const pgAdminUrl = `postgresql://a12_bootstrap:${bootstrapPassword}@127.0.0.1:18432/${pgDatabase}`;
  const mongoAdminUrl = `mongodb://a12_bootstrap:${bootstrapPassword}@127.0.0.1:18017/admin`;
  const lifecycle = { pending: new Set(), aborters: new Set() };
  const state = { runId, closed: false, replaying: false };
  let ownsSql = false,
    ownsRole = false,
    ownsMongo = false,
    ownsMongoRole = false,
    ownsMongoUser = false;
  let setupStage = 'sql-bootstrap';
  const dispose = createCleanupGate(async (disposing, cleanupSignal) => {
    for (const abort of lifecycle.aborters) abort();
    await withNativeDeadline(
      () => Promise.allSettled([...lifecycle.pending]),
      () => {
        for (const abort of lifecycle.aborters) abort();
      },
    );
    requireValue(lifecycle.pending.size === 0, 'NATIVE_FIXTURE_CLEANUP_FAILED');
    const cleanupSql = async () => {
      if (!ownsSql && !ownsRole) return;
      await withPgConnection(
        Client,
        pgAdminUrl,
        disposing,
        async (client, signal) => {
          const query = async (text, values) => {
            cleanupSignal.throwIfAborted();
            signal.throwIfAborted();
            return client.query(text, values);
          };
          await query('BEGIN');
          try {
            if (ownsSql) {
              const rows = (
                await query(
                  "SELECT pg_get_userbyid(nspowner)::text AS owner, obj_description(oid, 'pg_namespace') AS marker FROM pg_namespace WHERE nspname=$1",
                  [runId],
                )
              ).rows;
              if (rows.length) {
                requireValue(
                  rows.length === 1 &&
                    rows[0].owner === 'a12_bootstrap' &&
                    rows[0].marker === runId,
                  'NATIVE_CLEANUP_OWNERSHIP',
                );
                await query(`DROP SCHEMA "${runId}" CASCADE`);
              }
            }
            if (ownsRole) {
              const rows = (
                await query(
                  "SELECT rolname, shobj_description(oid, 'pg_authid') AS marker FROM pg_roles WHERE rolname=$1",
                  [role],
                )
              ).rows;
              if (rows.length) {
                requireValue(
                  rows.length === 1 && rows[0].marker === runId,
                  'NATIVE_CLEANUP_OWNERSHIP',
                );
                await query(
                  `REVOKE ALL ON DATABASE "${pgDatabase}" FROM "${role}"`,
                );
                await query(`DROP ROLE "${role}"`);
              }
            }
            await query('COMMIT');
            ownsSql = false;
            ownsRole = false;
          } catch (error) {
            if (!cleanupSignal.aborted && !signal.aborted)
              await client.query('ROLLBACK');
            throw error;
          }
        },
      );
    };
    const cleanupMongo = async () => {
      if (!ownsMongo && !ownsMongoRole && !ownsMongoUser) return;
      await withMongoConnection(
        MongoClient,
        mongoAdminUrl,
        disposing,
        async (client, signal) => {
          const db = client.db(runId);
          const command = async (value) => {
            cleanupSignal.throwIfAborted();
            signal.throwIfAborted();
            return db.command(value, { maxTimeMS: 2000 });
          };
          if (ownsMongoUser) {
            const users = (await command({ usersInfo: role })).users;
            if (users.length) {
              requireValue(
                users.length === 1 &&
                  users[0].customData?.fixtureRun === runId &&
                  users[0].customData?.profile === NATIVE_PROFILE_VERSION,
                'NATIVE_CLEANUP_OWNERSHIP',
              );
              await command({ dropUser: role });
            }
            ownsMongoUser = false;
          }
          if (ownsMongoRole) {
            const roles = (
              await command({ rolesInfo: role, showPrivileges: true })
            ).roles;
            if (roles.length) {
              const privileges = roles[0].privileges;
              requireValue(
                roles.length === 1 &&
                  roles[0].roles.length === 0 &&
                  privileges.length === 1 &&
                  privileges[0].resource.db === runId &&
                  privileges[0].resource.collection === 'invoices' &&
                  privileges[0].actions.length === 1 &&
                  privileges[0].actions[0] === 'find',
                'NATIVE_CLEANUP_OWNERSHIP',
              );
              await command({ dropRole: role });
            }
            ownsMongoRole = false;
          }
          if (ownsMongo) {
            cleanupSignal.throwIfAborted();
            signal.throwIfAborted();
            const marker = await db
              .collection('fixture_identity')
              .findOne({ runId }, { signal, maxTimeMS: 2000 });
            if (marker) {
              requireValue(
                marker.profile === NATIVE_PROFILE_VERSION,
                'NATIVE_CLEANUP_OWNERSHIP',
              );
              await command({ dropDatabase: 1 });
            } else {
              const collections = await db
                .listCollections({}, { nameOnly: true, maxTimeMS: 2000 })
                .toArray();
              requireValue(
                collections.length === 0,
                'NATIVE_CLEANUP_OWNERSHIP',
              );
            }
            ownsMongo = false;
          }
        },
      );
    };
    const results = await Promise.allSettled([cleanupSql(), cleanupMongo()]);
    requireValue(
      results.every((result) => result.status === 'fulfilled'),
      'NATIVE_FIXTURE_CLEANUP_FAILED',
    );
  });
  const close = () => {
    state.closed = true;
    return dispose();
  };
  try {
    await withPgConnection(
      Client,
      pgAdminUrl,
      lifecycle,
      async (client, signal) => {
        const query = async (text, values) => {
          signal.throwIfAborted();
          return client.query(text, values);
        };
        const identity = (
          await query(
            "SELECT current_database()::text AS database, current_user::text AS actor, current_setting('a12.fixture', true) AS marker",
          )
        ).rows[0];
        requireValue(
          identity?.database === pgDatabase &&
            identity.actor === 'a12_bootstrap' &&
            identity.marker === 'synthetic-commerce.v1',
          'NATIVE_FIXTURE_IDENTITY',
        );
        const existing = await query(
          'SELECT 1 FROM pg_namespace WHERE nspname=$1 UNION ALL SELECT 1 FROM pg_roles WHERE rolname=$2',
          [runId, role],
        );
        requireValue(
          existing.rows.length === 0,
          'NATIVE_FIXTURE_ALREADY_EXISTS',
        );
        await query('BEGIN');
        try {
          await query(
            `CREATE SCHEMA "${runId}"; COMMENT ON SCHEMA "${runId}" IS '${runId}'`,
          );
          await query(
            `CREATE ROLE "${role}" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '${readerPassword}'; COMMENT ON ROLE "${role}" IS '${runId}'; ALTER ROLE "${role}" SET default_transaction_read_only = on`,
          );
          await query(
            `REVOKE ALL ON DATABASE "${pgDatabase}" FROM PUBLIC; GRANT CONNECT ON DATABASE "${pgDatabase}" TO "${role}"; REVOKE ALL ON SCHEMA public FROM PUBLIC`,
          );
          await query(`CREATE TABLE "${runId}".customers(id integer PRIMARY KEY, name text NOT NULL, region text NOT NULL);
          CREATE TABLE "${runId}".orders(id integer PRIMARY KEY, customer_id integer REFERENCES "${runId}".customers(id), amount numeric, note text, status text NOT NULL, created_at timestamptz NOT NULL);
          CREATE TABLE "${runId}".line_items(order_id integer REFERENCES "${runId}".orders(id), sku text NOT NULL, quantity integer NOT NULL)`);
          for (const row of catalog.sourceFixtures.sql.customers)
            await query(`INSERT INTO "${runId}".customers VALUES ($1,$2,$3)`, [
              row.id,
              row.name,
              row.region,
            ]);
          for (const row of catalog.sourceFixtures.sql.orders)
            await query(
              `INSERT INTO "${runId}".orders VALUES ($1,$2,$3,$4,$5,$6)`,
              [
                row.id,
                row.customer_id,
                row.amount,
                row.note,
                row.status,
                row.created_at,
              ],
            );
          for (const row of catalog.sourceFixtures.sql.line_items)
            await query(`INSERT INTO "${runId}".line_items VALUES ($1,$2,$3)`, [
              row.order_id,
              row.sku,
              row.quantity,
            ]);
          await query(
            `GRANT USAGE ON SCHEMA "${runId}" TO "${role}"; GRANT SELECT ON "${runId}".customers,"${runId}".orders,"${runId}".line_items TO "${role}"; REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA "${runId}" FROM PUBLIC`,
          );
          for (const signature of [
            'pg_advisory_lock(bigint)',
            'pg_advisory_lock(integer,integer)',
            'pg_try_advisory_lock(bigint)',
            'pg_try_advisory_lock(integer,integer)',
            'pg_sleep(double precision)',
            'set_config(text,text,boolean)',
            'pg_notify(text,text)',
          ])
            await query(
              `REVOKE EXECUTE ON FUNCTION pg_catalog.${signature} FROM PUBLIC`,
            );
          ownsSql = true;
          ownsRole = true;
          await query('COMMIT');
        } catch (error) {
          if (!signal.aborted) await client.query('ROLLBACK');
          throw error;
        }
      },
    );
    setupStage = 'mongo-bootstrap';
    await withMongoConnection(
      MongoClient,
      mongoAdminUrl,
      lifecycle,
      async (client, signal) => {
        const db = client.db(runId);
        const command = async (value) => {
          signal.throwIfAborted();
          return db.command(value, { maxTimeMS: 2000 });
        };
        requireValue(
          (
            await db
              .listCollections({}, { nameOnly: true, maxTimeMS: 2000 })
              .toArray()
          ).length === 0 &&
            (await command({ usersInfo: role })).users.length === 0 &&
            (await command({ rolesInfo: role })).roles.length === 0,
          'NATIVE_FIXTURE_ALREADY_EXISTS',
        );
        ownsMongo = true;
        await db
          .collection('fixture_identity')
          .insertOne({ runId, profile: NATIVE_PROFILE_VERSION }, { signal });
        await db
          .collection('invoices')
          .insertMany(structuredClone(catalog.sourceFixtures.mongo.invoices), {
            signal,
          });
        ownsMongoRole = true;
        await command({
          createRole: role,
          privileges: [
            {
              resource: { db: runId, collection: 'invoices' },
              actions: ['find'],
            },
          ],
          roles: [],
        });
        ownsMongoUser = true;
        await command({
          createUser: role,
          pwd: readerPassword,
          customData: { fixtureRun: runId, profile: NATIVE_PROFILE_VERSION },
          roles: [{ role, db: runId }],
        });
      },
    );
    setupStage = 'sql-reader';
    await withPgConnection(
      Client,
      config.postgresUrl,
      lifecycle,
      async (client) => {
        const privilege = (
          await client.query(
            'SELECT current_user::text AS actor, rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls FROM pg_roles WHERE rolname=current_user',
          )
        ).rows[0];
        requireValue(
          privilege?.actor === role &&
            [
              'rolsuper',
              'rolcreatedb',
              'rolcreaterole',
              'rolreplication',
              'rolbypassrls',
            ].every((key) => privilege[key] === false),
          'NATIVE_READ_ROLE_INVALID',
        );
        const memberships = await client.query(
          'SELECT COUNT(*) AS count FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname=current_user)',
        );
        requireValue(
          memberships.rows[0]?.count === '0',
          'NATIVE_READ_ROLE_INVALID',
        );
      },
    );
    const verifySeed = async () => {
      requireValue(!state.closed, 'NATIVE_FIXTURE_CLOSED');
      const sql = await withPgConnection(
        Client,
        config.postgresUrl,
        lifecycle,
        async (client, signal) => {
          const query = async (text) => {
            signal.throwIfAborted();
            return client.query(text);
          };
          const customers = (
            await query(
              `SELECT id,name,region FROM "${runId}".customers ORDER BY id`,
            )
          ).rows;
          const orders = (
            await query(
              `SELECT id,customer_id,amount,note,status,created_at FROM "${runId}".orders ORDER BY id`,
            )
          ).rows.map((row) => ({
            ...row,
            amount: row.amount === null ? null : exactNumber(row.amount),
            created_at: row.created_at.toISOString(),
          }));
          const line_items = (
            await query(
              `SELECT order_id,sku,quantity FROM "${runId}".line_items ORDER BY order_id,sku`,
            )
          ).rows;
          return { customers, orders, line_items };
        },
      );
      requireValue(!state.closed, 'NATIVE_FIXTURE_CLOSED');
      const invoices = await withMongoConnection(
        MongoClient,
        config.mongoUrl,
        lifecycle,
        async (client, signal) => {
          const cursor = client
            .db(runId)
            .collection('invoices')
            .find(
              {},
              {
                projection: { _id: 0 },
                sort: { id: 1 },
                maxTimeMS: 2000,
                signal,
              },
            )
            .limit(201);
          try {
            return await cursor.toArray();
          } finally {
            await cursor.close();
          }
        },
      );
      requireValue(!state.closed, 'NATIVE_FIXTURE_CLOSED');
      requireValue(
        digest(canonicalJson({ sql, mongo: { invoices } })) ===
          NATIVE_SEED_SHA256,
        'NATIVE_SEED_READBACK_MISMATCH',
      );
      return NATIVE_SEED_SHA256;
    };
    const execute = async (engine, inputQuery) => {
      requireValue(!state.closed, 'NATIVE_FIXTURE_CLOSED');
      const query = snapshotQuery(engine, inputQuery);
      const profile = resolveNativeQuery(engine, query);
      requireValue(lifecycle.pending.size < 4, 'NATIVE_FIXTURE_BUSY');
      try {
        const bundle =
          engine === 'sql'
            ? await withPgConnection(
                Client,
                config.postgresUrl,
                lifecycle,
                async (client, signal) => {
                  let began = false;
                  try {
                    signal.throwIfAborted();
                    await client.query('BEGIN READ ONLY');
                    began = true;
                    signal.throwIfAborted();
                    await client.query(
                      `SET LOCAL search_path = pg_catalog,"${runId}"; SET LOCAL statement_timeout = 2000; SET LOCAL lock_timeout = 1000; SET LOCAL idle_in_transaction_session_timeout = 3000; SET LOCAL timezone = 'UTC'`,
                    );
                    signal.throwIfAborted();
                    return normalizePostgresResult(
                      await client.query({
                        text: `SELECT * FROM (${query}) AS a12_native_result LIMIT 201`,
                        rowMode: 'array',
                      }),
                      profile,
                    );
                  } finally {
                    if (began && !signal.aborted)
                      await client.query('ROLLBACK');
                  }
                },
              )
            : await withMongoConnection(
                MongoClient,
                config.mongoUrl,
                lifecycle,
                async (client, signal) => {
                  const cursor = client
                    .db(runId)
                    .collection(query.collection)
                    .aggregate([...query.pipeline, { $limit: 201 }], {
                      allowDiskUse: false,
                      maxTimeMS: 2000,
                      batchSize: 201,
                      signal,
                    });
                  try {
                    return normalizeMongoResult(
                      await cursor.toArray(),
                      profile,
                    );
                  } finally {
                    await cursor.close();
                  }
                },
              );
        requireValue(!state.closed, 'NATIVE_FIXTURE_CLOSED');
        return bundle;
      } catch (error) {
        if (error instanceof NativeReplayError) throw error;
        throw new NativeReplayError(
          ['57014', '55P03'].includes(error?.code) || error?.code === 50
            ? 'NATIVE_DEADLINE'
            : 'NATIVE_EXECUTION_FAILED',
        );
      }
    };
    const fixture = Object.freeze({
      runId,
      profileVersion: NATIVE_PROFILE_VERSION,
      execute,
      verifySeed,
      close,
    });
    fixtureStates.set(fixture, { state, execute, verifySeed, close });
    setupStage = 'seed-readback';
    await verifySeed();
    return fixture;
  } catch (error) {
    try {
      await close();
    } catch {
      throw new NativeReplayError('NATIVE_FIXTURE_CLEANUP_FAILED');
    }
    const failed =
      error instanceof NativeReplayError
        ? error
        : new NativeReplayError('NATIVE_FIXTURE_SETUP_FAILED');
    failed.stage = setupStage;
    if (
      [
        '42501',
        '42601',
        '42704',
        '23505',
        '28P01',
        '3D000',
        '55P03',
        '57014',
      ].includes(error?.code)
    )
      failed.storeCode = error.code;
    else if ([13, 18, 26, 50, 51003, 51024].includes(error?.code))
      failed.storeCode = `MONGO_${error.code}`;
    throw failed;
  }
}

export async function runNativeReplay({
  catalogPath,
  outputsPath,
  runId,
  split = 'dev',
  allowHoldout = false,
  fixture,
}) {
  requireValue(
    ['dev', 'calibration', 'holdout'].includes(split),
    'INVALID_NATIVE_SPLIT',
  );
  requireValue(
    split !== 'holdout' || allowHoldout === true,
    'HOLDOUT_REQUIRES_EXPLICIT_OPT_IN',
  );
  const catalogArtifact = await readJsonArtifact(catalogPath);
  const catalog = assertNativeProfile(validateCatalog(catalogArtifact.data));
  const outputsArtifact = await readJsonArtifact(outputsPath);
  const outputs = validateOutputs(outputsArtifact.data, catalog);
  const selected = catalog.cases.filter((item) => item.split === split);
  requireValue(selected.length > 0, 'EMPTY_SELECTED_SPLIT');
  const session = fixture ?? (await createNativeFixtures(catalog, runId));
  const capabilities = fixtureStates.get(session);
  requireValue(
    capabilities &&
      !capabilities.state.closed &&
      !capabilities.state.replaying &&
      capabilities.state.runId === runId,
    'NATIVE_FIXTURE_NOT_OWNED',
  );
  capabilities.state.replaying = true;
  const results = [];
  try {
    await capabilities.verifySeed();
    for (const item of selected) {
      const output = outputs.outputs.find((entry) => entry.caseId === item.id);
      if (
        !output ||
        item.expected.response.kind === 'abstain' ||
        output.response.kind === 'abstain'
      ) {
        results.push({
          ...evaluateCase(item, output, catalog, 'result-bundle'),
          execution: 'NOT_EXECUTED',
          nativeResultSha256: null,
          querySha256: output ? queryDigest(output.response.query) : null,
        });
        continue;
      }
      try {
        assertReadReplayQuery(item.engine, output.response.query);
      } catch {
        results.push({
          caseId: item.id,
          cohort: `${item.engine}/${item.language}`,
          split,
          execution: 'NOT_EXECUTED',
          outcome: 'fail',
          reasons: ['QUERY_OUTSIDE_PINNED_REPLAY'],
          nativeResultSha256: null,
          querySha256: queryDigest(output.response.query),
        });
        continue;
      }
      try {
        results.push(
          assessNativeResult(
            item,
            output,
            catalog,
            await capabilities.execute(item.engine, output.response.query),
          ),
        );
      } catch (error) {
        results.push({
          caseId: item.id,
          cohort: `${item.engine}/${item.language}`,
          split,
          execution: 'NATIVE_ATTEMPT_FAILED',
          outcome: 'fail',
          reasons: [
            error instanceof NativeReplayError
              ? error.code
              : 'NATIVE_EXECUTION_FAILED',
          ],
          nativeResultSha256: null,
          querySha256: queryDigest(output.response.query),
        });
      }
    }
    await capabilities.verifySeed();
    const count = (outcome) =>
      results.filter((item) => item.outcome === outcome).length;
    const totals = {
      total: results.length,
      pass: count('pass'),
      fail: count('fail'),
      abstain: count('abstain'),
      unevaluated: count('unevaluated'),
      executed: results.filter(
        (item) => item.execution === 'NATIVE_QUERY_EXECUTED',
      ).length,
    };
    return {
      formatVersion: 1,
      profileVersion: NATIVE_PROFILE_VERSION,
      datasetVersion: NATIVE_DATASET_VERSION,
      evaluationStatus:
        'NATIVE_FIXTURE_REPLAY_NOT_MODEL_ACCURACY_CERTIFICATION',
      reviewStatus: catalog.reviewStatus,
      evidenceStatus: catalog.evidenceStatus,
      outputOrigin: outputs.origin,
      split,
      holdoutPolicy: {
        optIn: split === 'holdout',
        blind: false,
        tuningPermitted: split !== 'holdout',
      },
      databaseExecution: 'READ_ONLY_PINNED_FIXTURE',
      semanticModelAccuracy: 'NOT_ASSESSED',
      nativeSeedSha256: NATIVE_SEED_SHA256,
      nativeSeedReadback: 'MATCHED_BEFORE_AND_AFTER',
      catalogSha256: catalogArtifact.metadata.sha256,
      outputsSha256: outputsArtifact.metadata.sha256,
      executorSha256: sourceDigest(
        await readFile(new URL('./native-replay.mjs', import.meta.url)),
      ),
      profileSha256: sourceDigest(
        await readFile(
          new URL('./native-fixture-profile.mjs', import.meta.url),
        ),
      ),
      allPassed:
        totals.total > 0 && totals.fail === 0 && totals.unevaluated === 0,
      totals,
      caseResults: results,
      usageCoverage: {
        providerCalls: 0,
        tokens: null,
        cost: null,
        status: 'UNAVAILABLE',
      },
      limits: NATIVE_LIMITS,
      declaration:
        'Projection nullability comes from the independently declared fixture profile, not native nullable metadata inference.',
      deploymentAuthorized: false,
      certification: 'NOT_CERTIFIED',
    };
  } finally {
    capabilities.state.replaying = false;
    if (!fixture) await capabilities.close();
  }
}
export function parseNativeArgs(argv) {
  requireValue(
    Array.isArray(argv) && argv.length % 2 === 0,
    'INVALID_NATIVE_ARGUMENTS',
  );
  const names = {
    '--catalog': 'catalogPath',
    '--outputs': 'outputsPath',
    '--run-id': 'runId',
    '--report': 'reportPath',
    '--split': 'split',
    '--allow-holdout': 'allowHoldout',
  };
  const options = { split: 'dev', allowHoldout: false };
  const seen = new Set();
  for (let index = 0; index < argv.length; index += 2) {
    const key = names[argv[index]];
    requireValue(
      key && !seen.has(key) && typeof argv[index + 1] === 'string',
      'INVALID_NATIVE_ARGUMENTS',
    );
    seen.add(key);
    options[key] =
      key === 'allowHoldout' ? argv[index + 1] === 'true' : argv[index + 1];
    if (key === 'allowHoldout')
      requireValue(argv[index + 1] === 'true', 'INVALID_NATIVE_ARGUMENTS');
  }
  requireValue(
    ['catalogPath', 'outputsPath', 'runId', 'reportPath'].every((key) =>
      seen.has(key),
    ),
    'INVALID_NATIVE_ARGUMENTS',
  );
  requireValue(
    typeof options.runId === 'string' &&
      fixtureRun.test(options.runId) &&
      ['dev', 'calibration', 'holdout'].includes(options.split),
    'INVALID_NATIVE_ARGUMENTS',
  );
  requireValue(
    options.split !== 'holdout' || options.allowHoldout,
    'HOLDOUT_REQUIRES_EXPLICIT_OPT_IN',
  );
  for (const key of ['catalogPath', 'outputsPath', 'reportPath'])
    assertLocalJsonPath(options[key]);
  return options;
}
export async function cli(argv = process.argv.slice(2)) {
  try {
    const options = parseNativeArgs(argv);
    const reportPath = assertLocalJsonPath(options.reportPath);
    const report = await runNativeReplay(options);
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, {
      flag: 'wx',
      mode: 0o600,
    });
    process.stdout.write(
      `${JSON.stringify({ allPassed: report.allPassed, totals: report.totals, semanticModelAccuracy: report.semanticModelAccuracy, deploymentAuthorized: false })}\n`,
    );
    return report.allPassed ? 0 : 1;
  } catch (error) {
    process.stderr.write(
      `${JSON.stringify({ code: error instanceof NativeReplayError ? error.code : 'NATIVE_INPUT_OR_OUTPUT_FAILED', deploymentAuthorized: false, certification: 'NOT_CERTIFIED' })}\n`,
    );
    return 2;
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  process.exitCode = await cli();
