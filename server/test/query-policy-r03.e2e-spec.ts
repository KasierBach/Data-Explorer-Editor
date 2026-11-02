import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { Pool as PgPool } from 'pg';
import { createPool, Pool as MysqlPool } from 'mysql2/promise';
import { MongoClient } from 'mongodb';
import Redis from 'ioredis';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { Permission } from '../src/permissions/enums/permission.enum';
import { ResourceType } from '../src/permissions/enums/resource-type.enum';
import { PermissionsService } from '../src/permissions/services/permissions.service';
import { encryptAttribute } from '../src/utils/crypto.util';
import { createE2eApp, closeE2eApp } from './e2e-app';

describe('R03 query policy against real engines', () => {
  const suffix = randomUUID().replace(/-/g, '');
  const table = `r03_items_${suffix}`;
  const effect = `r03_effect_${suffix}`;
  const mongoDatabase = `r03_${suffix}`;
  const redisKey = `r03:${suffix}`;
  const connectionIds: Record<string, string> = {};
  let app: INestApplication;
  let prisma: PrismaService;
  let userId: string;
  let token: string;
  let viewerId: string;
  let viewerToken: string;
  let organizationId: string;
  let postgres: PgPool;
  let mysql: MysqlPool;
  let mongo: MongoClient;
  let redis: Redis;
  const post = (engine: string, sql: string, confirmed = false) =>
    request(app.getHttpServer())
      .post('/api/query')
      .set('x-requested-with', 'XMLHttpRequest')
      .set('Authorization', `Bearer ${token}`)
      .send({ connectionId: connectionIds[engine], sql, confirmed, limit: 10 });

  beforeAll(async () => {
    app = await createE2eApp();
    prisma = app.get(PrismaService);
    const user = await prisma.user.create({
      data: {
        email: `r03-${suffix}@example.com`,
        isEmailVerified: true,
        isOnboarded: true,
        securityAlerts: false,
      },
    });
    userId = user.id;
    token = app
      .get(JwtService)
      .sign({ sub: user.id, email: user.email, role: 'user', type: 'access' });
    const viewer = await prisma.user.create({
      data: {
        email: `r03-viewer-${suffix}@example.com`,
        isEmailVerified: true,
        isOnboarded: true,
        securityAlerts: false,
      },
    });
    viewerId = viewer.id;
    viewerToken = app.get(JwtService).sign({
      sub: viewer.id,
      email: viewer.email,
      role: 'user',
      type: 'access',
    });
    const organization = await prisma.organization.create({
      data: {
        name: 'R03 synthetic organization',
        slug: `r03-${suffix}`,
        members: {
          create: [
            { userId, role: 'OWNER' },
            { userId: viewerId, role: 'VIEWER' },
          ],
        },
      },
    });
    organizationId = organization.id;
    postgres = new PgPool({ connectionString: process.env.E2E_DATABASE_URL });
    mysql = createPool({
      host: '127.0.0.1',
      port: 13306,
      user: 'e2e',
      password: 'r03-local-only',
      database: 'data_explorer_r03',
    });
    mongo = await new MongoClient('mongodb://127.0.0.1:17017', {
      serverSelectionTimeoutMS: 5000,
    }).connect();
    redis = new Redis({
      host: '127.0.0.1',
      port: 16379,
      db: 15,
      maxRetriesPerRequest: 1,
    });
    await postgres.query(
      `CREATE TABLE ${table} (id INTEGER PRIMARY KEY); INSERT INTO ${table} VALUES (1)`,
    );
    await postgres.query(
      `CREATE FUNCTION ${effect}() RETURNS INTEGER LANGUAGE plpgsql AS $$ BEGIN DELETE FROM ${table}; RETURN 1; END $$`,
    );
    await mysql.query(`CREATE TABLE ${table} (id INTEGER PRIMARY KEY)`);
    await mysql.query(`INSERT INTO ${table} VALUES (1)`);
    await mysql.query(
      `CREATE FUNCTION ${effect}() RETURNS INTEGER MODIFIES SQL DATA BEGIN DELETE FROM ${table}; RETURN 1; END`,
    );
    await mongo
      .db(mongoDatabase)
      .collection('items')
      .insertOne({ id: 1, value: 'original' });
    await redis.set(redisKey, 'original');
    const configs = [
      {
        type: 'postgres',
        host: '127.0.0.1',
        port: 15432,
        username: 'e2e',
        password: encryptAttribute('e2e-local-only'),
        database: 'data_explorer_e2e',
      },
      {
        type: 'mysql',
        host: '127.0.0.1',
        port: 13306,
        username: 'e2e',
        password: encryptAttribute('r03-local-only'),
        database: 'data_explorer_r03',
      },
      {
        type: 'mongodb',
        host: '127.0.0.1',
        port: 17017,
        database: mongoDatabase,
      },
      { type: 'redis', host: '127.0.0.1', port: 16379, database: '15' },
    ];
    for (const config of configs) {
      const connection = await prisma.connection.create({
        data: {
          ...config,
          userId,
          name: `R03 synthetic ${config.type}`,
          readOnly: true,
          allowQueryExecution: true,
        },
      });
      connectionIds[config.type] = connection.id;
    }
  }, 120_000);

  afterAll(async () => {
    try {
      if (postgres) {
        await postgres.query(
          `DROP FUNCTION IF EXISTS ${effect}(); DROP TABLE IF EXISTS ${table}`,
        );
      }
      if (mysql) {
        await mysql.query(`DROP FUNCTION IF EXISTS ${effect}`);
        await mysql.query(`DROP TABLE IF EXISTS ${table}`);
      }
      if (mongo) await mongo.db(mongoDatabase).dropDatabase();
      if (redis) await redis.del(redisKey);
      if (prisma && organizationId)
        await prisma.organization.delete({ where: { id: organizationId } });
      if (prisma && viewerId)
        await prisma.user.delete({ where: { id: viewerId } });
      if (prisma && userId) await prisma.user.delete({ where: { id: userId } });
    } finally {
      await Promise.all([
        postgres?.end(),
        mysql?.end(),
        mongo?.close(),
        redis?.quit(),
        app ? closeE2eApp(app) : Promise.resolve(),
      ]);
    }
  }, 120_000);

  it.each(['postgres', 'mysql'])(
    'keeps literal keywords readable without running them: %s',
    async (engine) => {
      const response = await post(
        engine,
        "SELECT 'DELETE FROM users' AS harmless",
      );
      expect(response.status).toBe(201);
      expect((response.body.data ?? response.body).rows).toEqual([
        { harmless: 'DELETE FROM users' },
      ]);
    },
  );

  it.each(['postgres', 'mysql'])(
    'blocks quoted-comment stacked DELETE even when confirmed: %s',
    async (engine) => {
      const response = await post(
        engine,
        `SELECT '--' AS marker; DELETE FROM ${table}`,
        true,
      );
      expect(response.status).toBe(403);
      const result =
        engine === 'postgres'
          ? (await postgres.query(`SELECT * FROM ${table}`)).rows
          : (await mysql.query(`SELECT * FROM ${table}`))[0];
      expect(result).toEqual([{ id: 1 }]);
    },
  );

  it.each(['postgres', 'mysql'])(
    'uses native read-only mode against a side-effect function: %s',
    async (engine) => {
      const response = await post(engine, `SELECT ${effect}()`, true);
      expect(response.status).toBe(403);
      expect(response.body.reason).toBe('READ_ONLY_CONNECTION');
      const result =
        engine === 'postgres'
          ? (await postgres.query(`SELECT * FROM ${table}`)).rows
          : (await mysql.query(`SELECT * FROM ${table}`))[0];
      expect(result).toEqual([{ id: 1 }]);
      const read = await post(engine, `SELECT * FROM ${table}`);
      expect(read.status).toBe(201);
      expect((read.body.data ?? read.body).rows).toEqual([{ id: 1 }]);
    },
  );

  it.each([
    ['postgres', 'default'],
    ['postgres', 'full'],
    ['mysql', 'default'],
    ['mysql', 'full'],
  ])(
    'protects a READ-only resource user on a writable connection: %s/%s',
    async (engine, mode) => {
      const connectionId = connectionIds[engine];
      await prisma.connection.update({
        where: { id: connectionId },
        data: {
          readOnly: false,
          organizationId,
          roleQueryModes: mode === 'full' ? { VIEWER: 'full' } : {},
        },
      });
      try {
        const permissions = app.get(PermissionsService);
        expect(
          await permissions.checkPermission(
            viewerId,
            ResourceType.CONNECTION,
            connectionId,
            Permission.READ,
          ),
        ).toBe(true);
        expect(
          await permissions.checkPermission(
            viewerId,
            ResourceType.CONNECTION,
            connectionId,
            Permission.WRITE,
          ),
        ).toBe(false);
        const denied = await request(app.getHttpServer())
          .post('/api/query')
          .set('x-requested-with', 'XMLHttpRequest')
          .set('Authorization', `Bearer ${viewerToken}`)
          .send({
            connectionId,
            sql: `SELECT ${effect}()`,
            confirmed: true,
            includeTotalCount: true,
          });
        expect(denied.status).toBe(403);
        expect(denied.body.reason).toBe('READ_ONLY_CONNECTION');
        const result =
          engine === 'postgres'
            ? (await postgres.query(`SELECT * FROM ${table}`)).rows
            : (await mysql.query(`SELECT * FROM ${table}`))[0];
        expect(result).toEqual([{ id: 1 }]);
        const read = await request(app.getHttpServer())
          .post('/api/query')
          .set('x-requested-with', 'XMLHttpRequest')
          .set('Authorization', `Bearer ${viewerToken}`)
          .send({
            connectionId,
            sql: `SELECT * FROM ${table}`,
            includeTotalCount: true,
          });
        expect(read.status).toBe(201);
        expect((read.body.data ?? read.body).rows).toEqual([{ id: 1 }]);
        expect((read.body.data ?? read.body).totalCount).toBe(1);
      } finally {
        await prisma.connection.update({
          where: { id: connectionId },
          data: { readOnly: true, organizationId: null, roleQueryModes: {} },
        });
      }
    },
  );

  it.each(['mysql', 'mariadb'])(
    'rejects a hash-comment DELETE on a writable MySQL-family connection: %s',
    async (type) => {
      await prisma.connection.update({
        where: { id: connectionIds.mysql },
        data: { type, readOnly: false },
      });
      try {
        const denied = await post('mysql', `# '\nDELETE FROM ${table} # '`);
        expect(denied.status).toBe(400);
        expect(JSON.stringify(denied.body)).toMatch(/hash comment/i);
        expect((await mysql.query(`SELECT * FROM ${table}`))[0]).toEqual([
          { id: 1 },
        ]);
      } finally {
        await prisma.connection.update({
          where: { id: connectionIds.mysql },
          data: { type: 'mysql', readOnly: true },
        });
      }
    },
  );

  it.each(['postgres', 'mysql'])(
    'rolls back an earlier confirmed write when a later statement fails: %s',
    async (engine) => {
      await prisma.connection.update({
        where: { id: connectionIds[engine] },
        data: { readOnly: false },
      });
      try {
        const failed = await post(
          engine,
          `DELETE FROM ${table}; SELECT * FROM r03_missing_${suffix}`,
          true,
        );
        expect(failed.status).toBe(400);
        expect(failed.body.reason).toBe('QUERY_OBJECT_NOT_FOUND');
        const result =
          engine === 'postgres'
            ? (await postgres.query(`SELECT * FROM ${table}`)).rows
            : (await mysql.query(`SELECT * FROM ${table}`))[0];
        expect(result).toEqual([{ id: 1 }]);
      } finally {
        await prisma.connection.update({
          where: { id: connectionIds[engine] },
          data: { readOnly: true },
        });
      }
    },
  );

  it('runs a safe Mongo aggregate', async () => {
    const response = await post(
      'mongodb',
      JSON.stringify({
        action: 'aggregate',
        collection: 'items',
        pipeline: [{ $project: { _id: 0, id: 1, value: 1 } }],
      }),
    );
    expect(response.status).toBe(201);
    expect((response.body.data ?? response.body).rows).toEqual([
      { id: 1, value: 'original' },
    ]);
  });

  it.each(['$out', '$merge'])(
    'blocks Mongo aggregate writes and leaves the output absent: %s',
    async (stage) => {
      const response = await post(
        'mongodb',
        JSON.stringify({
          action: 'aggregate',
          collection: 'items',
          pipeline: [{ [stage]: 'copy' }],
        }),
        true,
      );
      expect(response.status).toBe(403);
      expect(
        await mongo
          .db(mongoDatabase)
          .listCollections({ name: 'copy' })
          .toArray(),
      ).toEqual([]);
      expect(
        await mongo.db(mongoDatabase).collection('items').countDocuments(),
      ).toBe(1);
    },
  );

  it('allows Redis GET and blocks SET without applying SQL grammar', async () => {
    const read = await post('redis', `GET ${redisKey}`);
    expect(read.status).toBe(201);
    expect(JSON.stringify((read.body.data ?? read.body).rows)).toContain(
      'original',
    );
    const denied = await post('redis', `SET ${redisKey} changed`, true);
    expect(denied.status).toBe(403);
    expect(await redis.get(redisKey)).toBe('original');
  });

  it('requires confirmation for the writable quoted-comment batch and commits only after confirmation', async () => {
    await prisma.connection.update({
      where: { id: connectionIds.postgres },
      data: { readOnly: false },
    });
    try {
      const sql = `SELECT '/*' AS marker; DELETE FROM ${table}; SELECT '*/' AS marker`;
      const denied = await post('postgres', sql);
      expect(denied.status).toBe(403);
      expect(denied.body.reason).toBe('DESTRUCTIVE_REQUIRES_CONFIRMATION');
      expect((await postgres.query(`SELECT * FROM ${table}`)).rows).toEqual([
        { id: 1 },
      ]);
      const confirmed = await post('postgres', sql, true);
      expect(confirmed.status).toBe(201);
      expect((await postgres.query(`SELECT * FROM ${table}`)).rows).toEqual([]);
    } finally {
      await postgres.query(
        `INSERT INTO ${table} VALUES (1) ON CONFLICT DO NOTHING`,
      );
      await prisma.connection.update({
        where: { id: connectionIds.postgres },
        data: { readOnly: true },
      });
    }
  });
});
