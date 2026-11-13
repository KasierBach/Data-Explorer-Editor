import { createHash } from 'node:crypto';

export const NATIVE_PROFILE_VERSION = 'a12-native-fixture-v1';
export const NATIVE_DATASET_VERSION = 'synthetic-curated-24.en-vi.v2';
export const NATIVE_SCHEMA_VERSION = 'synthetic-commerce.v1';
export const NATIVE_SEED_SHA256 =
  '96b04a0a8e4aaf2cfb2742085a2bf14615176a96674acd25fed4d1b19a290098';
export const NATIVE_SCHEMA_SHA256 =
  'b366af5318dff746c6d544d333b1034850a057f12ff5842763caa60408c661fb';
export const NATIVE_LIMITS = Object.freeze({
  rows: 200,
  bytes: 1024 * 1024,
  statementMs: 2000,
  wallMs: 5000,
});

export function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value !== null && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalJson(value[key])]),
    );
  return value;
}
export function digest(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
// Query serialization preserves Mongo compound $sort order. This is an exact
// replay allowlist, NOT a general SQL/MQL parser or a model-quality approval.
export function snapshotPlainJson(value) {
  let nodes = 0;
  const ancestors = new Set();
  const invalid = () => {
    throw new Error('NATIVE_QUERY_VALUE_INVALID');
  };
  const visit = (item, depth) => {
    if (++nodes > 50000 || depth > 24) invalid();
    if (item === null || typeof item === 'boolean') return item;
    if (typeof item === 'string') {
      if (item.length > 16000) invalid();
      return item;
    }
    if (typeof item === 'number') {
      if (!Number.isFinite(item)) invalid();
      return item;
    }
    if (typeof item !== 'object' || ancestors.has(item)) invalid();
    const array = Array.isArray(item);
    if (
      Object.getPrototypeOf(item) !==
      (array ? Array.prototype : Object.prototype)
    )
      invalid();
    const descriptors = Object.getOwnPropertyDescriptors(item);
    const keys = Reflect.ownKeys(descriptors);
    if (
      keys.some(
        (key) =>
          typeof key !== 'string' ||
          ['__proto__', 'constructor', 'prototype'].includes(key),
      )
    )
      invalid();
    if (array && (keys.length !== item.length + 1 || item.length > 50000))
      invalid();
    ancestors.add(item);
    const copy = array ? [] : {};
    for (const key of keys) {
      if (array && key === 'length') continue;
      const descriptor = descriptors[key];
      if (
        !Object.hasOwn(descriptor, 'value') ||
        !descriptor.enumerable ||
        (array && !/^(?:0|[1-9]\d*)$/.test(key))
      )
        invalid();
      copy[key] = visit(descriptor.value, depth + 1);
    }
    ancestors.delete(item);
    return Object.freeze(copy);
  };
  const snapshot = visit(value, 0);
  if (Buffer.byteLength(JSON.stringify(snapshot)) > 2 * 1024 * 1024) invalid();
  return snapshot;
}
export function queryDigest(query) {
  return digest(snapshotPlainJson(query));
}
const column = (name, type, nullable, oid) =>
  Object.freeze({ name, type, nullable, ...(oid ? { oid } : {}) });
const id = () => column('id', 'integer', false, 23);
const number = (name, nullable = false) =>
  column(name, 'number', nullable, 1700);
const text = (name) => column(name, 'string', false, 25);
const count = (name) => column(name, 'integer', false, 20);
const entry = (caseId, engine, hash, columns, controlQuery) =>
  Object.freeze({
    caseId,
    engine,
    querySha256: hash,
    columns: Object.freeze(columns),
    ...(controlQuery ? { controlQuery: snapshotPlainJson(controlQuery) } : {}),
  });

// Projection contracts are declared in code independently of expected bundles.
// Nullability is a declared fixture contract, not inferred from a sample row.
export const NATIVE_CASES = Object.freeze([
  entry(
    'sql-null-note',
    'sql',
    'd2bbe609a50920963a748ce57b26c1c5cef6593bda29336b0774b3f6b7393f5a',
    [id()],
  ),
  entry(
    'sql-count-null',
    'sql',
    '9bcaa863d19a75dbf6dcc006e02c6e430d58dad782c973de4825a9e73376091e',
    [count('total_rows'), count('known_amounts')],
  ),
  entry(
    'sql-utc-window',
    'sql',
    'c0ee645cdf9b69f7b6ff1354d6a7ab5d76a683c34aae9c02edc8e09ee1eb02c5',
    [id()],
  ),
  entry(
    'sql-region-multiset',
    'sql',
    'be77cf42921c6b758f435d99dddbc49034b246f86edf76e01220fa94e1ba414e',
    [text('region')],
  ),
  entry(
    'mongo-null-or-missing',
    'mongo',
    'f7ec71c67e02f11528d832873aa010ac6d351f8716b52db9be31c7897e7020a9',
    [column('id', 'integer', false)],
  ),
  entry(
    'mongo-tag-membership',
    'mongo',
    'feb1515f9ddaeb32640e437ba8047ad89a04d98943063653233b88fc5820b835',
    [column('id', 'integer', false)],
  ),
  entry(
    'mongo-region-sum',
    'mongo',
    '7b6668880dc9a3bc5600a991e9a9c6d2e9a79c97cf727336d24d7059ea5976bd',
    [column('region', 'string', false), column('total', 'number', false)],
  ),
  entry(
    'mongo-tag-occurrences',
    'mongo',
    'ef4e7e8b339963d79149219535d37edbc193252be411da5f4ba2002e32fa29b7',
    [column('tag', 'string', false), column('occurrences', 'integer', false)],
  ),
  entry(
    'sql-join-quantity',
    'sql',
    '3c948af68912aaf45d88387a7024255882f464afea3523755dc790369bd18907',
    [text('region'), count('units')],
  ),
  entry(
    'sql-left-join-count',
    'sql',
    '7c6706d6ea854338e45d5e9df15da44328e633b3488821a58d7aa170326e52db',
    [id(), count('order_count')],
  ),
  entry(
    'sql-average-known',
    'sql',
    '4e2f358dd14788efff333b3ffb97ef925314e3efe73f95a6f26a87cb9d1dca6a',
    [number('average_amount', true)],
  ),
  entry(
    'mongo-missing-only',
    'mongo',
    'b24e33ee864ec1b17131b7a2d04e68644dbccec03be8137ee46565474f952d59',
    [column('id', 'integer', false)],
  ),
  entry(
    'mongo-numeric-range',
    'mongo',
    '237813846e13f3da2dbe72a7ed5b17f98df1b6eb12dcef4daec009b74ae70625',
    [column('id', 'integer', false)],
  ),
  entry(
    'mongo-compound-sort-limit',
    'mongo',
    '6e6505a700f3a9ac649d97fd0e1eedadeed778e4061985e01af9953a391871d5',
    [column('id', 'integer', false)],
  ),
  entry(
    'sql-new-york-day',
    'sql',
    'b0ae49748604fc898ff6e7d76721f5c3f0c1de4342488446f0b98fcca1a2d19b',
    [id()],
  ),
  entry(
    'sql-empty-sum',
    'sql',
    '498eaca2fa8d8db8b05cdfeb47bde01b828c79ed536b4c364209502045ab8970',
    [number('total', true)],
  ),
  entry(
    'sql-having-distinct',
    'sql',
    'aa7bba80503b06c19bd93507af9eaa7864373082e80e1ae39cdfc6fa30e7ab81',
    [column('customer_id', 'integer', false, 23), count('paid_orders')],
  ),
  entry(
    'mongo-explicit-null',
    'mongo',
    '6ae21c2f547d7ab296da4a6b8264fdb721bbdf397a76b96538bae4a3f28fd131',
    [column('id', 'integer', false)],
  ),
  entry(
    'mongo-paid-projection',
    'mongo',
    '8de55d51190b58a3e0716d68231dd27d532fc3e0041fb0eb923278a3682d2537',
    [column('id', 'integer', false), column('amount', 'number', false)],
  ),
]);
export const NATIVE_ABSTENTIONS = Object.freeze([
  'sql-missing-phone',
  'sql-write-refusal',
  'mongo-missing-time-context',
  'mongo-missing-profit',
  'mongo-write-stage-refusal',
]);
const controls = [
  [
    'control-sql-empty-note',
    'sql',
    "SELECT id FROM orders WHERE note = '' ORDER BY id ASC",
    [id()],
  ],
  [
    'control-sql-overflow',
    'sql',
    'SELECT a.id FROM orders a CROSS JOIN orders b CROSS JOIN orders c',
    [id()],
  ],
  [
    'control-mongo-wrong-label',
    'mongo',
    {
      collection: 'invoices',
      pipeline: [
        { $match: { label: '' } },
        { $sort: { id: 1 } },
        { $project: { _id: 0, id: 1 } },
      ],
    },
    [column('id', 'integer', false)],
  ],
];
export const NATIVE_CONTROLS = Object.freeze(
  controls.map(([name, engine, query, columns]) =>
    entry(name, engine, queryDigest(query), columns, query),
  ),
);

export function resolveNativeQuery(engine, query) {
  if (
    (engine === 'sql' && typeof query !== 'string') ||
    !['sql', 'mongo'].includes(engine)
  )
    return null;
  try {
    const snapshot = snapshotPlainJson(query);
    if (
      engine === 'mongo' &&
      (snapshot === null ||
        Array.isArray(snapshot) ||
        typeof snapshot !== 'object')
    )
      return null;
    const hash = queryDigest(snapshot);
    return (
      [...NATIVE_CASES, ...NATIVE_CONTROLS].find(
        (profile) => profile.engine === engine && profile.querySha256 === hash,
      ) ?? null
    );
  } catch {
    return null;
  }
}
export function assertNativeProfile(catalog) {
  if (
    catalog.datasetVersion !== NATIVE_DATASET_VERSION ||
    catalog.schemaVersion !== NATIVE_SCHEMA_VERSION ||
    digest(canonicalJson(catalog.sourceFixtures)) !== NATIVE_SEED_SHA256 ||
    digest(canonicalJson(catalog.schema)) !== NATIVE_SCHEMA_SHA256 ||
    catalog.cases.length !== 24
  ) {
    throw new Error('NATIVE_PROFILE_BINDING_MISMATCH');
  }
  for (const item of catalog.cases) {
    const profile = NATIVE_CASES.find((value) => value.caseId === item.id);
    if (item.expected.response.kind === 'abstain') {
      if (!NATIVE_ABSTENTIONS.includes(item.id))
        throw new Error('NATIVE_PROFILE_CASE_MISMATCH');
    } else if (
      !profile ||
      profile.engine !== item.engine ||
      queryDigest(item.expected.response.query) !== profile.querySha256
    ) {
      throw new Error('NATIVE_PROFILE_CASE_MISMATCH');
    }
  }
  return catalog;
}
