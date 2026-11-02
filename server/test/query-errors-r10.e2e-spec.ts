import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { createPool, Pool as MysqlPool } from 'mysql2/promise';
import { MongoClient } from 'mongodb';
import Redis from 'ioredis';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { encryptAttribute } from '../src/utils/crypto.util';
import { createE2eApp, closeE2eApp } from './e2e-app';

describe('R10 native query errors through HTTP', () => {
  const suffix = randomUUID().replace(/-/g, '');
  const table = `r10_errors_${suffix}`;
  const child = `r10_child_${suffix}`;
  const mongoDatabase = `r10_${suffix}`;
  const redisKey = `r10:${suffix}`;
  let app: INestApplication;
  let prisma: PrismaService;
  let pg: Pool;
  let mysql: MysqlPool;
  let mongo: MongoClient;
  let redis: Redis;
  let userId: string;
  let token: string;
  const ids: Record<string, string> = {};
  const schema: Record<string, string> = {
    postgres: 'public',
    mysql: 'data_explorer_r03',
  };
  const sql = async (engine: string, statement: string) =>
    engine === 'postgres'
      ? (await pg.query(statement)).rows
      : (await mysql.query(statement))[0];
  const query = (engine: string, statement: string) =>
    request(app.getHttpServer())
      .post('/api/query')
      .set('x-requested-with', 'XMLHttpRequest')
      .set('Authorization', `Bearer ${token}`)
      .send({
        connectionId: ids[engine],
        sql: statement,
        confirmed: true,
        includeTotalCount: false,
      });
  const row = (engine: string) => ({
    connectionId: ids[engine],
    schema: schema[engine],
    table,
  });
  const auth = (req: request.Test) =>
    req
      .set('x-requested-with', 'XMLHttpRequest')
      .set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    app = await createE2eApp();
    prisma = app.get(PrismaService);
    const user = await prisma.user.create({
      data: {
        email: `r10-${suffix}@example.com`,
        isEmailVerified: true,
        isOnboarded: true,
        securityAlerts: false,
      },
    });
    userId = user.id;
    token = app
      .get(JwtService)
      .sign({ sub: userId, email: user.email, role: 'user', type: 'access' });
    pg = new Pool({ connectionString: process.env.E2E_DATABASE_URL });
    mysql = createPool({
      host: '127.0.0.1',
      port: 13306,
      user: 'e2e',
      password: 'r03-local-only',
      database: 'data_explorer_r03',
    });
    mongo = await new MongoClient('mongodb://127.0.0.1:17017').connect();
    redis = new Redis(process.env.E2E_REDIS_URL!);
    for (const config of [
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
    ]) {
      const connection = await prisma.connection.create({
        data: {
          ...config,
          name: `R10 ${config.type}`,
          userId,
          readOnly: false,
          allowQueryExecution: true,
          allowSchemaChanges: true,
          allowImportExport: true,
        },
      });
      ids[config.type] = connection.id;
    }
    for (const engine of ['postgres', 'mysql']) {
      await sql(
        engine,
        `CREATE TABLE ${table}(id INTEGER PRIMARY KEY,slug VARCHAR(40) NOT NULL UNIQUE,note VARCHAR(40) NOT NULL)`,
      );
      await sql(
        engine,
        `CREATE TABLE ${child}(id INTEGER PRIMARY KEY,parent_id INTEGER REFERENCES ${table}(id))`,
      );
      // MySQL requires an explicit foreign-key constraint to enforce the reference.
      if (engine === 'mysql')
        await sql(
          engine,
          `ALTER TABLE ${child} ADD FOREIGN KEY(parent_id) REFERENCES ${table}(id)`,
        );
      await sql(
        engine,
        `INSERT INTO ${table} VALUES (1,'one','original'),(2,'two','neighbor')`,
      );
      await sql(engine, `INSERT INTO ${child} VALUES (1,1)`);
    }
    await mongo
      .db(mongoDatabase)
      .collection<{ _id: number; note: string }>('items')
      .insertOne({ _id: 1, note: 'original' });
    await redis.set(redisKey, 'original');
  });
  afterAll(async () => {
    try {
      for (const engine of ['postgres', 'mysql']) {
        await sql(engine, `DROP TABLE IF EXISTS ${child}`);
        await sql(engine, `DROP TABLE IF EXISTS ${table}`);
      }
      await mongo?.db(mongoDatabase).dropDatabase();
      await redis?.del(redisKey);
      if (prisma && userId) await prisma.user.delete({ where: { id: userId } });
    } finally {
      await Promise.all([
        app ? closeE2eApp(app) : Promise.resolve(),
        pg?.end(),
        mysql?.end(),
        mongo?.close(),
        redis?.quit(),
      ]);
    }
  });

  it.each(['generate-sql', 'generate-sql-stream'])(
    'AI %s denies another user before opening a stream or invoking a provider',
    async (endpoint) => {
      const outsider = await prisma.user.create({
        data: {
          email: `r10-ai-${endpoint}-${suffix}@example.com`,
          isEmailVerified: true,
          isOnboarded: true,
          securityAlerts: false,
        },
      });
      try {
        const outsiderToken = app.get(JwtService).sign({
          sub: outsider.id,
          email: outsider.email,
          role: 'user',
          type: 'access',
        });
        const response = await request(app.getHttpServer())
          .post(`/api/ai/${endpoint}`)
          .set('x-requested-with', 'XMLHttpRequest')
          .set('Authorization', `Bearer ${outsiderToken}`)
          .send({
            connectionId: ids.postgres,
            prompt: 'Show the available tables',
          });
        expect(response.status).toBe(404);
        expect(response.headers['content-type']).toContain('application/json');
        expect(response.body.statusCode).toBe(404);
      } finally {
        await prisma.user.delete({ where: { id: outsider.id } });
      }
    },
  );

  it.each(['postgres', 'mysql'])(
    '%s distinguishes native syntax, missing table and constraints',
    async (engine) => {
      for (const [statement, status, reason] of [
        ['SELECT FROM', 400, 'QUERY_SYNTAX_ERROR'],
        [`SELECT * FROM r10_missing_${suffix}`, 400, 'QUERY_OBJECT_NOT_FOUND'],
        [
          `INSERT INTO ${table} VALUES (3,'one','duplicate')`,
          409,
          'QUERY_CONFLICT',
        ],
        [
          `INSERT INTO ${table} VALUES (3,'three',NULL)`,
          400,
          'QUERY_VALIDATION_FAILED',
        ],
      ] as const) {
        const response = await query(engine, statement);
        expect(response.status).toBe(status);
        expect(response.body).toMatchObject({
          success: false,
          reason,
          statusCode: status,
        });
      }
      expect(await sql(engine, `SELECT * FROM ${table} ORDER BY id`)).toEqual([
        { id: 1, slug: 'one', note: 'original' },
        { id: 2, slug: 'two', note: 'neighbor' },
      ]);
    },
  );

  it.each(['postgres', 'mysql'])(
    '%s preserves structured mutation/import/browse failures and leaves rows unchanged',
    async (engine) => {
      const responses = [
        await auth(request(app.getHttpServer()).post('/api/query/row')).send({
          ...row(engine),
          data: { id: 3, slug: 'one', note: 'duplicate' },
        }),
        await auth(request(app.getHttpServer()).patch('/api/query/row')).send({
          ...row(engine),
          pkColumn: 'id',
          pkValue: 2,
          updates: { slug: 'one' },
        }),
        await auth(
          request(app.getHttpServer()).post('/api/query/delete-rows'),
        ).send({ ...row(engine), pkColumn: 'id', pkValues: [1] }),
        await auth(request(app.getHttpServer()).post('/api/query/import')).send(
          { ...row(engine), data: [{ id: 3, slug: 'one', note: 'duplicate' }] },
        ),
      ];
      for (const response of responses) {
        expect(response.status).toBe(409);
        expect(response.body.reason).toBe('QUERY_CONFLICT');
      }
      const missing = await auth(
        request(app.getHttpServer()).post('/api/query/table-window'),
      ).send({
        ...row(engine),
        table: `r10_missing_${suffix}`,
        includeTotalCount: false,
      });
      expect(missing.status).toBe(400);
      expect(missing.body.reason).toBe('QUERY_OBJECT_NOT_FOUND');
      expect(await sql(engine, `SELECT * FROM ${table} ORDER BY id`)).toEqual([
        { id: 1, slug: 'one', note: 'original' },
        { id: 2, slug: 'two', note: 'neighbor' },
      ]);
      expect(await sql(engine, `SELECT * FROM ${child}`)).toEqual([
        { id: 1, parent_id: 1 },
      ]);
    },
  );

  it('returns validation for native Redis WRONGTYPE without changing the key', async () => {
    const response = await query('redis', `LLEN ${redisKey}`);
    expect(response.status).toBe(400);
    expect(response.body.reason).toBe('QUERY_VALIDATION_FAILED');
    expect(await redis.get(redisKey)).toBe('original');
  });

  it('returns conflict for native Mongo duplicate keys without changing the document', async () => {
    const response = await query(
      'mongodb',
      JSON.stringify({
        collection: 'items',
        action: 'insertOne',
        document: { _id: 1, note: 'duplicate' },
      }),
    );
    expect(response.status).toBe(409);
    expect(response.body.reason).toBe('QUERY_CONFLICT');
    expect(
      await mongo
        .db(mongoDatabase)
        .collection<{ _id: number; note: string }>('items')
        .findOne({ _id: 1 }),
    ).toEqual({ _id: 1, note: 'original' });
  });
});
