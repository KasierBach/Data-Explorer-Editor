import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import {
  Binary,
  BSONRegExp,
  Decimal128,
  Long,
  MaxKey,
  MinKey,
  MongoClient,
  ObjectId,
  Timestamp,
} from 'mongodb';
import Redis from 'ioredis';
import request from 'supertest';
import { MongoDbStrategy } from '../src/database-strategies/mongodb.strategy';
import { PrismaService } from '../src/prisma/prisma.service';
import { closeE2eApp, createE2eApp } from './e2e-app';

interface WireResult {
  rows: Record<string, unknown>[];
  columns: string[];
  rowCount: number;
  totalCount?: number;
  hasNextPage?: boolean;
  truncated?: boolean;
}

describe('R14 native NoSQL read types and key browsing', () => {
  const suffix = randomUUID().replaceAll('-', '');
  const database = `r14_read_${suffix}`;
  const prefix = `r14-read:${suffix}`;
  const objectId = new ObjectId('0123456789abcdef01234567');
  const createdAt = new Date('2026-10-31T01:02:03.456Z');
  const decimalText = '12345678901234567890.12345678901234';
  const binaryBytes = Buffer.from([0, 255, 128, 65, 10]);
  const maximum = '9223372036854775807';
  const minimum = '-9223372036854775808';
  let app: INestApplication;
  let prisma: PrismaService;
  let mongo: MongoClient;
  let redis: Redis;
  let userId: string;
  let outsiderId: string;
  let token: string;
  let outsiderToken: string;
  let mongoConnectionId: string;
  let mongoWritableConnectionId: string;
  let redisConnectionId: string;
  const pageKeys = Array.from(
    { length: 205 },
    (_, index) => `${prefix}:page:${String(index).padStart(3, '0')}`,
  );
  const keys = [
    `${prefix}:exact`,
    `${prefix}:glob:a1`,
    `${prefix}:glob:b2`,
    `${prefix}:glob:c3`,
    `${prefix}:types:string`,
    `${prefix}:types:hash`,
    `${prefix}:types:list`,
    ...pageKeys,
  ];

  const query = (
    connectionId: string,
    sql: string,
    limit = 100,
    offset = 0,
    authorization = token,
  ) =>
    request(app.getHttpServer())
      .post('/api/query')
      .set('x-requested-with', 'XMLHttpRequest')
      .set('Authorization', `Bearer ${authorization}`)
      .send({ connectionId, sql, limit, offset, includeTotalCount: false });

  async function readRedis(
    sql: string,
    limit = 100,
    offset = 0,
  ): Promise<WireResult> {
    const response = await query(redisConnectionId, sql, limit, offset);
    expect(response.status).toBe(201);
    return response.body.data as WireResult;
  }

  beforeAll(async () => {
    app = await createE2eApp();
    prisma = app.get(PrismaService);
    mongo = await new MongoClient(
      `mongodb://127.0.0.1:17017/${database}`,
    ).connect();
    redis = new Redis({ host: '127.0.0.1', port: 16379, db: 13 });
    const owner = await prisma.user.create({
      data: {
        email: `r14-read-owner-${suffix}@example.test`,
        isEmailVerified: true,
        isOnboarded: true,
        securityAlerts: false,
      },
    });
    userId = owner.id;
    const outsider = await prisma.user.create({
      data: {
        email: `r14-read-outsider-${suffix}@example.test`,
        isEmailVerified: true,
        isOnboarded: true,
        securityAlerts: false,
      },
    });
    outsiderId = outsider.id;
    const jwt = app.get(JwtService);
    token = jwt.sign({
      sub: owner.id,
      email: owner.email,
      role: 'user',
      type: 'access',
    });
    outsiderToken = jwt.sign({
      sub: outsider.id,
      email: outsider.email,
      role: 'user',
      type: 'access',
    });
    mongoConnectionId = (
      await prisma.connection.create({
        data: {
          userId,
          name: 'R14 BSON read fixture',
          type: 'mongodb',
          host: '127.0.0.1',
          port: 17017,
          database,
          readOnly: true,
          allowQueryExecution: true,
          allowSchemaChanges: false,
          allowImportExport: false,
        },
      })
    ).id;
    mongoWritableConnectionId = (
      await prisma.connection.create({
        data: {
          userId,
          name: 'R14 BSON distinct fixture',
          type: 'mongodb',
          host: '127.0.0.1',
          port: 17017,
          database,
          readOnly: false,
          allowQueryExecution: true,
          allowSchemaChanges: false,
          allowImportExport: false,
        },
      })
    ).id;
    redisConnectionId = (
      await prisma.connection.create({
        data: {
          userId,
          name: 'R14 Redis read fixture',
          type: 'redis',
          host: '127.0.0.1',
          port: 16379,
          database: '13',
          readOnly: true,
          allowQueryExecution: true,
          allowSchemaChanges: false,
          allowImportExport: false,
        },
      })
    ).id;
    await mongo
      .db()
      .collection('types')
      .insertOne({
        _id: objectId,
        createdAt,
        amount: Decimal128.fromString(decimalText),
        large: Long.fromString(maximum),
        negative: Long.fromString(minimum),
        safe: Long.fromString('42'),
        bytes: new Binary(binaryBytes),
        stamped: Timestamp.fromBits(15, 16),
        nested: {
          amount: Decimal128.fromString(decimalText),
          large: Long.fromString(maximum),
          refs: [objectId],
          bytes: new Binary(binaryBytes),
          createdAt,
        },
        ordinary: { high: 12, low: 34, unsigned: false },
        matcher: new BSONRegExp('^abc$', 'i'),
        bounds: { minimum: new MinKey(), maximum: new MaxKey() },
        note: 'Tiếng Việt, "quoted"\nline two',
      });
    const pipeline = redis.pipeline();
    pipeline.set(
      `${prefix}:exact`,
      'Tiếng Việt, "quoted"\nline two',
      'PX',
      120_000,
    );
    for (const key of [
      `${prefix}:glob:a1`,
      `${prefix}:glob:b2`,
      `${prefix}:glob:c3`,
      `${prefix}:types:string`,
      ...pageKeys,
    ])
      pipeline.set(key, key, 'PX', 120_000);
    pipeline.hset(`${prefix}:types:hash`, 'field', 'value');
    pipeline.pexpire(`${prefix}:types:hash`, 120_000);
    pipeline.rpush(`${prefix}:types:list`, 'one', 'two');
    pipeline.pexpire(`${prefix}:types:list`, 120_000);
    const results = await pipeline.exec();
    expect(results?.every(([error]) => !error)).toBe(true);
  }, 30_000);

  afterAll(async () => {
    try {
      if (redis) await redis.del(...keys);
      if (mongo) await mongo.db().dropDatabase();
      if (prisma) {
        await prisma.user.deleteMany({
          where: { id: { in: [userId, outsiderId].filter(Boolean) } },
        });
        expect(
          await prisma.connection.count({
            where: {
              id: {
                in: [
                  mongoConnectionId,
                  mongoWritableConnectionId,
                  redisConnectionId,
                ].filter(Boolean),
              },
            },
          }),
        ).toBe(0);
      }
      if (redis)
        expect(await redis.mget(...keys)).toEqual(keys.map(() => null));
      if (mongo)
        expect(await mongo.db().listCollections().toArray()).toEqual([]);
    } finally {
      await Promise.all([
        app ? closeE2eApp(app) : Promise.resolve(),
        mongo?.close(),
        redis?.quit(),
      ]);
    }
  });

  it.each(['find', 'aggregate'])(
    'preserves ObjectId, Date, Decimal128, large Long and binary through HTTP %s',
    async (action) => {
      const response = await query(
        mongoConnectionId,
        JSON.stringify({
          action,
          collection: 'types',
          ...(action === 'aggregate' ? { pipeline: [{ $match: {} }] } : {}),
        }),
      );
      expect(response.status).toBe(201);
      expect(response.body.data.rows).toEqual([
        {
          _id: objectId.toHexString(),
          createdAt: createdAt.toISOString(),
          amount: decimalText,
          large: maximum,
          negative: minimum,
          safe: 42,
          bytes: binaryBytes.toString('base64'),
          stamped: { $timestamp: '68719476751' },
          nested: {
            amount: decimalText,
            large: maximum,
            refs: [objectId.toHexString()],
            bytes: binaryBytes.toString('base64'),
            createdAt: createdAt.toISOString(),
          },
          ordinary: { high: 12, low: 34, unsigned: false },
          matcher: { pattern: '^abc$', options: 'i' },
          bounds: { minimum: { $minKey: 1 }, maximum: { $maxKey: 1 } },
          note: 'Tiếng Việt, "quoted"\nline two',
        },
      ]);
    },
  );

  it('serializes native bigint values requested through the driver without breaking HTTP JSON', async () => {
    const response = await query(
      mongoConnectionId,
      JSON.stringify({
        action: 'find',
        collection: 'types',
        options: {
          useBigInt64: true,
          projection: { _id: 0, large: 1, negative: 1 },
        },
      }),
    );
    expect(response.status).toBe(201);
    expect(response.body.data.rows).toEqual([
      { large: maximum, negative: minimum },
    ]);
  });

  it.each(['large', 'bytes'])(
    'serializes distinct BSON %s values using the same result contract',
    async (field) => {
      const response = await query(
        mongoWritableConnectionId,
        JSON.stringify({ action: 'distinct', collection: 'types', field }),
      );
      expect(response.status).toBe(201);
      expect(response.body.data.rows).toEqual([
        { value: field === 'large' ? maximum : binaryBytes.toString('base64') },
      ]);
    },
  );

  it('keeps the existing readonly restriction on distinct without changing the document', async () => {
    const response = await query(
      mongoConnectionId,
      JSON.stringify({
        action: 'distinct',
        collection: 'types',
        field: 'large',
      }),
    );
    expect(response.status).toBe(403);
    expect(await mongo.db().collection('types').countDocuments()).toBe(1);
  });

  it('does not expose native BSON storage buffers as nested metadata columns', async () => {
    const columns = await app
      .get(MongoDbStrategy)
      .getColumns(mongo, 'public', 'types');
    expect(columns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'amount', type: 'decimal128' }),
        expect.objectContaining({ name: 'large', type: 'long' }),
        expect.objectContaining({ name: 'bytes', type: 'binary' }),
        expect.objectContaining({ name: 'stamped', type: 'timestamp' }),
        expect.objectContaining({ name: 'matcher', type: 'regexp' }),
        expect.objectContaining({ name: 'bounds.minimum', type: 'minkey' }),
        expect.objectContaining({ name: 'bounds.maximum', type: 'maxkey' }),
      ]),
    );
    expect(
      columns
        .map((column) => column.name)
        .filter((name) =>
          /^(amount\.bytes|large\.(high|low|unsigned)|bytes\.(buffer|position|sub_type))/.test(
            name,
          ),
        ),
    ).toEqual([]);
  });

  it('does not expand BSON array values into storage fields while keeping document-array fields', async () => {
    await mongo
      .db()
      .collection('arraytypes')
      .insertOne({
        refs: [objectId],
        blobs: [new Binary(binaryBytes)],
        counters: [Long.fromString(maximum)],
        mixed: [Long.fromString(maximum), { detail: 'ordinary document' }],
      });
    const columns = await app
      .get(MongoDbStrategy)
      .getColumns(mongo, 'public', 'arraytypes');
    expect(columns.map((column) => column.name).sort()).toEqual([
      '_id',
      'blobs',
      'counters',
      'mixed',
      'mixed[].detail',
      'refs',
    ]);
  });

  it('keeps ordinary documents with BSON-looking discriminator fields readable and discoverable', async () => {
    const literalMarkers = mongo.db().collection('literalmarkers');
    await literalMarkers.insertOne({ markerSeed: true });
    await literalMarkers.updateOne({ markerSeed: true }, [
      {
        $set: {
          impostor: {
            $arrayToObject: [
              [
                { k: { $literal: '_bsontype' }, v: { $literal: 'ObjectId' } },
                {
                  k: { $literal: 'label' },
                  v: { $literal: 'literal document' },
                },
                {
                  k: { $literal: 'nested' },
                  v: { $literal: { enabled: true } },
                },
              ],
            ],
          },
        },
      },
      { $unset: 'markerSeed' },
    ]);

    const response = await query(
      mongoConnectionId,
      JSON.stringify({ action: 'find', collection: 'literalmarkers' }),
    );
    expect(response.status).toBe(201);
    expect(response.body.data.rows).toEqual([
      expect.objectContaining({
        impostor: {
          _bsontype: 'ObjectId',
          label: 'literal document',
          nested: { enabled: true },
        },
      }),
    ]);

    const columns = await app
      .get(MongoDbStrategy)
      .getColumns(mongo, 'public', 'literalmarkers');
    expect(columns.map((column) => column.name).sort()).toEqual([
      '_id',
      'impostor',
      'impostor._bsontype',
      'impostor.label',
      'impostor.nested',
      'impostor.nested.enabled',
    ]);
  });

  it('uses exact KEYS patterns instead of falling back to the entire database', async () => {
    const result = await readRedis(`KEYS ${prefix}:exact`);
    expect(result.rows).toEqual([{ key: `${prefix}:exact` }]);
    expect(result.rowCount).toBe(1);
    expect(result.totalCount).toBe(1);
    expect(result.hasNextPage).toBe(false);
  });

  it('honors Redis MATCH patterns with question marks and character classes', async () => {
    const result = await readRedis(`SCAN 0 MATCH ${prefix}:glob:[ab]?`);
    expect(result.rows.map((row) => row.key).sort()).toEqual([
      `${prefix}:glob:a1`,
      `${prefix}:glob:b2`,
    ]);
  });

  it('honors SCAN TYPE and COUNT options without admitting a different key type', async () => {
    const result = await readRedis(
      `SCAN 0 MATCH ${prefix}:types:* COUNT 2 TYPE hash`,
    );
    expect(result.rows).toEqual([{ key: `${prefix}:types:hash` }]);
    expect(result.hasNextPage).toBe(false);
  });

  it('detects the next Redis key page without inventing an exact total for a partial scan', async () => {
    const sql = `SCAN 0 MATCH ${prefix}:page:* COUNT 100`;
    const first = await readRedis(sql, 10);
    expect(first.rows).toHaveLength(10);
    expect(first.hasNextPage).toBe(true);
    expect(first.totalCount).toBeUndefined();
    const second = await readRedis(sql, 10, 10);
    expect(second.rows).toHaveLength(10);
    expect(second.hasNextPage).toBe(true);
    expect(second.totalCount).toBeUndefined();
    expect(
      new Set([...first.rows, ...second.rows].map((row) => row.key)).size,
    ).toBe(20);
    const all = await readRedis(sql, 500);
    expect(all.rows.map((row) => row.key).sort()).toEqual([...pageKeys].sort());
    expect(all.totalCount).toBe(pageKeys.length);
    expect(all.hasNextPage).toBe(false);
  });

  it.each([
    'SCAN 0 MATCH',
    'SCAN invalid-cursor MATCH *',
    'SCAN 0 COUNT 0',
    'SCAN 0 TYPE',
    'KEYS * extra-argument',
  ])(
    'rejects malformed key-browsing syntax instead of returning unrelated keys: %s',
    async (sql) => {
      const response = await query(redisConnectionId, sql);
      expect(response.status).toBe(400);
    },
  );

  it('preserves Unicode values, TTL and key types after native reads and WRONGTYPE', async () => {
    const key = `${prefix}:exact`;
    const before = await redis.pttl(key);
    const value = await readRedis(`GET ${key}`);
    expect(value.rows).toEqual([{ result: 'Tiếng Việt, "quoted"\nline two' }]);
    const type = await readRedis(`TYPE ${key}`);
    expect(type.rows).toEqual([{ result: 'string' }]);
    const hash = await readRedis(`HGETALL ${prefix}:types:hash`);
    expect(hash.rows).toEqual([{ result: ['field', 'value'] }]);
    const wrongType = await query(redisConnectionId, `LLEN ${key}`);
    expect(wrongType.status).toBe(400);
    expect(wrongType.body.reason).toBe('QUERY_VALIDATION_FAILED');
    expect(await redis.get(key)).toBe('Tiếng Việt, "quoted"\nline two');
    const after = await redis.pttl(key);
    expect(after).toBeGreaterThan(0);
    expect(after).toBeLessThanOrEqual(before);
  });

  it('denies an outsider after owner reads have warmed the connection pools', async () => {
    const mongoRead = await query(
      mongoConnectionId,
      JSON.stringify({ action: 'count', collection: 'types' }),
    );
    expect(mongoRead.status).toBe(201);
    expect(mongoRead.body.data.rows).toEqual([{ count: 1 }]);
    await readRedis(`GET ${prefix}:exact`);
    const deniedMongo = await query(
      mongoConnectionId,
      JSON.stringify({ action: 'find', collection: 'types' }),
      100,
      0,
      outsiderToken,
    );
    const deniedRedis = await query(
      redisConnectionId,
      `GET ${prefix}:exact`,
      100,
      0,
      outsiderToken,
    );
    expect([403, 404]).toContain(deniedMongo.status);
    expect([403, 404]).toContain(deniedRedis.status);
  });

  it('keeps read-only writes denied and native values unchanged', async () => {
    const mongoWrite = await query(
      mongoConnectionId,
      JSON.stringify({
        action: 'insertOne',
        collection: 'types',
        document: { note: 'must not write' },
      }),
    );
    const redisWrite = await query(
      redisConnectionId,
      `SET ${prefix}:exact must-not-write`,
    );
    expect(mongoWrite.status).toBe(403);
    expect(redisWrite.status).toBe(403);
    expect(await mongo.db().collection('types').countDocuments()).toBe(1);
    expect(
      (
        await mongo.db().collection('types').findOne({ _id: objectId })
      )?.large.toString(),
    ).toBe(maximum);
    expect(await redis.get(`${prefix}:exact`)).toBe(
      'Tiếng Việt, "quoted"\nline two',
    );
  });
});
