import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { Agent } from 'node:http';
import { Pool } from 'pg';
import { MongoClient } from 'mongodb';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { QueryService } from '../src/query/query.service';
import { FreshnessService } from '../src/common/freshness/freshness.service';
import { AiSchemaContextService } from '../src/ai/ai.schema-context.service';
import { ConnectionsService } from '../src/connections/connections.service';
import { DatabaseStrategyFactory } from '../src/database-strategies';
import { MigrationService } from '../src/migration/migration.service';
import { encryptAttribute } from '../src/utils/crypto.util';
import { createE2eApp, closeE2eApp } from './e2e-app';

describe('R08 native cache identity, invalidation and authorization', () => {
  // Use a real separate loopback client so this suite cannot consume R00–R07's IP rate budget.
  const agent = new Agent({ localAddress: '127.0.0.8' });
  const suffix = randomUUID().replace(/-/g, ''),
    table = `r08_${suffix}`,
    upperTable = `R08_${suffix}`,
    mongoDb = `r08_${suffix}`;
  const database = 'data_explorer_e2e';
  let app: INestApplication,
    prisma: PrismaService,
    pg: Pool,
    mongo: MongoClient;
  let ownerId: string,
    otherId: string,
    token: string,
    otherToken: string,
    connectionId: string,
    mongoId: string;
  const body = (response: request.Response) =>
    response.body.data ?? response.body;
  const auth = (
    method: 'get' | 'post' | 'patch',
    path: string,
    other = false,
  ) =>
    request(app.getHttpServer())
      [method](path)
      .agent(agent)
      .set('x-requested-with', 'XMLHttpRequest')
      .set('Authorization', `Bearer ${other ? otherToken : token}`);
  const run = (sql: string, options: object = {}) =>
    auth('post', '/api/query').send({
      connectionId,
      sql,
      confirmed: true,
      ...options,
    });
  const count = async (sql = `SELECT * FROM ${table}`) =>
    body(await run(sql, { includeTotalCount: true }).expect(201)).totalCount;
  const columns = async () =>
    body(
      await auth('get', '/api/metadata/columns')
        .query({
          connectionId,
          tableId: `db:${database}.schema:public.table:${table}`,
        })
        .expect(200),
    );
  const generation = () =>
    app
      .get(FreshnessService)
      .buildKey('query', [connectionId, database], ['sentinel']);
  const sample = async (sampleSize = 100) =>
    body(
      await auth('post', '/api/nosql/analyze-schema')
        .send({
          connectionId: mongoId,
          database: mongoDb,
          collection: 'items',
          sampleSize,
        })
        .expect(201),
    );

  beforeAll(async () => {
    app = await createE2eApp();
    prisma = app.get(PrismaService);
    const createUser = (tag: string) =>
      prisma.user.create({
        data: {
          email: `r08-${tag}-${suffix}@example.test`,
          isEmailVerified: true,
          isOnboarded: true,
          securityAlerts: false,
        },
      });
    const owner = await createUser('owner'),
      other = await createUser('other');
    ownerId = owner.id;
    otherId = other.id;
    token = app
      .get(JwtService)
      .sign({ sub: ownerId, email: owner.email, role: 'user', type: 'access' });
    otherToken = app
      .get(JwtService)
      .sign({ sub: otherId, email: other.email, role: 'user', type: 'access' });
    connectionId = (
      await prisma.connection.create({
        data: {
          userId: ownerId,
          name: 'R08 PG fixture',
          type: 'postgres',
          host: '127.0.0.1',
          port: 15432,
          username: 'e2e',
          password: encryptAttribute('e2e-local-only'),
          database,
          allowQueryExecution: true,
          allowSchemaChanges: true,
          allowImportExport: true,
        },
      })
    ).id;
    mongoId = (
      await prisma.connection.create({
        data: {
          userId: ownerId,
          name: 'R08 Mongo fixture',
          type: 'mongodb',
          host: '127.0.0.1',
          port: 17017,
          database: mongoDb,
          allowQueryExecution: true,
          allowImportExport: true,
        },
      })
    ).id;
    pg = new Pool({ connectionString: process.env.E2E_DATABASE_URL });
    mongo = await new MongoClient('mongodb://127.0.0.1:17017').connect();
    await pg.query(
      `CREATE TABLE ${table}(id integer PRIMARY KEY, status text); CREATE TABLE "${upperTable}"(id integer PRIMARY KEY)`,
    );
  }, 30000);

  beforeEach(async () => {
    await pg.query(
      `TRUNCATE ${table}, "${upperTable}"; ALTER TABLE ${table} DROP COLUMN IF EXISTS extra; INSERT INTO ${table} VALUES(1,'ABC'),(2,'abc'),(3,'abc'); INSERT INTO "${upperTable}" VALUES(1)`,
    );
    await mongo.db(mongoDb).collection('items').deleteMany({});
    await mongo
      .db(mongoDb)
      .collection<{ _id: number; name?: string; later?: string }>('items')
      .insertMany([
        { _id: 1, name: 'first' },
        { _id: 2, later: 'second' },
      ]);
    await prisma.connection.update({
      where: { id: connectionId },
      data: { allowQueryExecution: true },
    });
    await auth('post', '/api/metadata/refresh')
      .send({ connectionId, database })
      .expect(201);
    await app.get(FreshnessService).bump('nosql-schema', [mongoId, mongoDb]);
  });

  afterAll(async () => {
    try {
      await pg?.query(`DROP TABLE IF EXISTS ${table}, "${upperTable}"`);
      await mongo?.db(mongoDb).dropDatabase();
      if (ownerId) await prisma.user.delete({ where: { id: ownerId } });
      if (otherId) await prisma.user.delete({ where: { id: otherId } });
      expect(
        (
          await pg.query(
            'SELECT tablename FROM pg_tables WHERE tablename = ANY($1)',
            [[table, upperTable]],
          )
        ).rows,
      ).toEqual([]);
    } finally {
      agent.destroy();
      await Promise.all([
        app ? closeE2eApp(app) : Promise.resolve(),
        pg?.end(),
        mongo?.close(),
      ]);
    }
  });

  it('keeps literal and quoted identifier casing with real counts, still caching identical counts', async () => {
    expect(await count(`SELECT * FROM ${table} WHERE status='ABC'`)).toBe(1);
    expect(await count(`SELECT * FROM ${table} WHERE status='abc'`)).toBe(2);
    expect(await count(`SELECT * FROM "${upperTable}"`)).toBe(1);
    expect(await count(`SELECT * FROM "${table}"`)).toBe(3);
    const strategy = app.get(DatabaseStrategyFactory).getStrategy('postgres'),
      spy = jest.spyOn(strategy, 'executeQuery');
    try {
      expect(await count(`SELECT * FROM "${table}"`)).toBe(3);
      expect(spy.mock.calls).toHaveLength(1); // Rows always execute; the identical count is cached.
    } finally {
      spy.mockRestore();
    }
  });

  it.each([
    [`INSERT INTO TABLE VALUES(4,'ABC')`, 4],
    [`UPDATE TABLE SET status='ABC' WHERE id=2`, 2],
    [`DELETE FROM TABLE WHERE id=2`, 2],
  ])(
    'raw DML refreshes a warm filtered count: %s',
    async (template, expected) => {
      const sql = String(template).replace('TABLE', table),
        isUpdate = sql.startsWith('UPDATE');
      const select = isUpdate
        ? `SELECT * FROM ${table} WHERE status='ABC'`
        : `SELECT * FROM ${table}`;
      expect(await count(select)).toBe(isUpdate ? 1 : 3);
      await run(sql).expect(201);
      expect(await count(select)).toBe(expected);
      expect(
        Number(
          (await pg.query(`SELECT count(*) AS count FROM (${select}) q`))
            .rows[0].count,
        ),
      ).toBe(expected);
    },
  );

  it('grid insert and import refresh count without a frontend refresh', async () => {
    expect(await count()).toBe(3);
    await auth('post', '/api/query/row')
      .send({
        connectionId,
        schema: 'public',
        table,
        data: { id: 4, status: 'ABC' },
      })
      .expect(201);
    expect(await count()).toBe(4);
    await auth('post', '/api/query/import')
      .send({
        connectionId,
        schema: 'public',
        table,
        data: [{ id: 5, status: 'ABC' }],
      })
      .expect(201);
    expect(await count()).toBe(5);
  });

  it('DDL refreshes warm columns, full metadata and AI context', async () => {
    expect(
      (await columns()).map((col: { name: string }) => col.name),
    ).not.toContain('extra');
    const ai = app.get(AiSchemaContextService),
      strategy = app.get(DatabaseStrategyFactory).getStrategy('postgres'),
      pool = await app
        .get(ConnectionsService)
        .getPool(connectionId, database, ownerId);
    const context = () =>
      ai.gatherSchemaContext(pool, strategy, database, connectionId, table);
    expect(await context()).not.toContain('extra');
    await auth('get', '/api/metadata/full')
      .query({
        connectionId,
        tableId: `db:${database}.schema:public.table:${table}`,
      })
      .expect(200);
    await run(`ALTER TABLE ${table} ADD COLUMN extra integer`).expect(201);
    expect(
      (await columns()).map((col: { name: string }) => col.name),
    ).toContain('extra');
    const full = body(
      await auth('get', '/api/metadata/full')
        .query({
          connectionId,
          tableId: `db:${database}.schema:public.table:${table}`,
        })
        .expect(200),
    );
    expect(full.columns.map((col: { name: string }) => col.name)).toContain(
      'extra',
    );
    expect(await context()).toContain('extra');
  });

  it('a failed transaction/import keeps data and generation unchanged', async () => {
    expect(await count()).toBe(3);
    const before = await generation();
    await run(
      `INSERT INTO ${table} VALUES(4,'ABC'); INSERT INTO ${table} VALUES(1,'duplicate')`,
    )
      .expect(409)
      .expect((response) =>
        expect(response.body.reason).toBe('QUERY_CONFLICT'),
      );
    expect(await generation()).toBe(before);
    expect(await count()).toBe(3);
    await auth('post', '/api/query/import')
      .send({
        connectionId,
        schema: 'public',
        table,
        data: [{ id: 4 }, { id: 1 }],
      })
      .expect(409)
      .expect((response) =>
        expect(response.body.reason).toBe('QUERY_CONFLICT'),
      );
    expect(await generation()).toBe(before);
    expect(
      Number(
        (await pg.query(`SELECT count(*) AS count FROM ${table}`)).rows[0]
          .count,
      ),
    ).toBe(3);
  });

  it('successful multi-statement commit and manual refresh update warm count', async () => {
    expect(await count()).toBe(3);
    await run(
      `INSERT INTO ${table} VALUES(4,'ABC'); INSERT INTO ${table} VALUES(5,'ABC')`,
    ).expect(201);
    expect(await count()).toBe(5);
    await pg.query(`INSERT INTO ${table} VALUES(6,'external')`);
    await auth('post', '/api/metadata/refresh')
      .send({ connectionId, database })
      .expect(201);
    expect(await count()).toBe(6);
  });

  it('denies another owner and disabled query access before cold or warm cache', async () => {
    for (const warm of [false, true]) {
      if (warm) {
        await count();
        await columns();
      }
      await auth('post', '/api/query', true)
        .send({
          connectionId,
          sql: `SELECT * FROM ${table}`,
          includeTotalCount: true,
        })
        .expect(404);
      await auth('get', '/api/metadata/columns', true)
        .query({
          connectionId,
          tableId: `db:${database}.schema:public.table:${table}`,
        })
        .expect(404);
    }
    await prisma.connection.update({
      where: { id: connectionId },
      data: { allowQueryExecution: false },
    });
    await run(`SELECT * FROM ${table}`, { includeTotalCount: true }).expect(
      403,
    );
    expect(
      Number(
        (await pg.query(`SELECT count(*) AS count FROM ${table}`)).rows[0]
          .count,
      ),
    ).toBe(3);
  });

  it('Mongo sample size changes identity; writes and partial ordered inserts refresh schema samples', async () => {
    expect(
      (await sample(1)).map((field: { name: string }) => field.name),
    ).not.toContain('later');
    expect(
      (await sample(100)).map((field: { name: string }) => field.name),
    ).toContain('later');
    const write = (payload: object) =>
      auth('post', '/api/query').send({
        connectionId: mongoId,
        sql: JSON.stringify({ collection: 'items', ...payload }),
      });
    await write({
      action: 'insertOne',
      document: { _id: 3, added: true },
    }).expect(201);
    expect(
      (await sample()).map((field: { name: string }) => field.name),
    ).toContain('added');
    await write({
      action: 'insertMany',
      documents: [{ _id: 4, partial: true }, { _id: 1 }],
    })
      .expect(409)
      .expect((response) =>
        expect(response.body.reason).toBe('QUERY_CONFLICT'),
      );
    expect(await mongo.db(mongoDb).collection('items').countDocuments()).toBe(
      4,
    );
    expect(
      (await sample()).map((field: { name: string }) => field.name),
    ).toContain('partial');
  });

  it('retains the native partial write error if cache invalidation also fails', async () => {
    const spy = jest
      .spyOn(app.get(FreshnessService), 'invalidateConnection')
      .mockRejectedValueOnce(new Error('cache unavailable'));
    try {
      await expect(
        app.get(QueryService).executeQuery(
          {
            connectionId: mongoId,
            sql: JSON.stringify({
              action: 'insertMany',
              collection: 'items',
              documents: [{ _id: 3 }, { _id: 1 }],
            }),
          },
          ownerId,
        ),
      ).rejects.toThrow('duplicate key');
      expect(await mongo.db(mongoDb).collection('items').countDocuments()).toBe(
        3,
      );
    } finally {
      spy.mockRestore();
    }
  });

  it('seed failure retains committed Mongo users and refreshes previously empty column metadata', async () => {
    await mongo
      .db(mongoDb)
      .createCollection('products', { validator: { price: { $lt: 0 } } });
    const read = async () =>
      body(
        await auth('get', '/api/metadata/columns')
          .query({
            connectionId: mongoId,
            tableId: `db:${mongoDb}.table:users`,
          })
          .expect(200),
      );
    expect(
      (await read()).map((column: { name: string }) => column.name),
    ).toEqual(['_id']);
    await auth('post', '/api/query/seed')
      .send({ connectionId: mongoId })
      .expect(500);
    expect(await mongo.db(mongoDb).collection('users').countDocuments()).toBe(
      3,
    );
    expect(
      (await read()).map((column: { name: string }) => column.name),
    ).toContain('name');
  });

  it('migration refreshes a warm target count after success and after earlier batches survive a later failure', async () => {
    const queue = app.get<Queue>(getQueueToken('migration')),
      service = app.get(MigrationService);
    let jobId: string | undefined;
    const start = async () => {
      const response = await auth('post', '/api/migration/start')
        .send({
          sourceConnectionId: connectionId,
          targetConnectionId: connectionId,
          sourceSchema: 'public',
          targetSchema: 'public',
          sourceTable: upperTable,
          targetTable: table,
        })
        .expect(201);
      jobId = body(response).jobId;
      if (!jobId) throw new Error('Migration fixture did not return jobId');
      const deadline = Date.now() + 15000;
      while (Date.now() < deadline) {
        const job = await queue.getJob(jobId);
        if (!job) throw new Error('Migration fixture job disappeared');
        const state = await job.getState();
        if (state === 'completed' || state === 'failed')
          return service.getPublicJob(jobId, ownerId);
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      throw new Error(
        'R08 migration did not settle within the existing R05 deadline',
      );
    };
    try {
      await pg.query(`TRUNCATE ${table}`);
      await auth('post', '/api/metadata/refresh')
        .send({ connectionId, database })
        .expect(201);
      expect(await count()).toBe(0);
      expect((await start()).status).toBe('completed');
      expect(await count()).toBe(1);
      if (!jobId)
        throw new Error('Completed migration fixture did not retain its jobId');
      await (await queue.getJob(jobId))?.remove();
      jobId = undefined;
      await pg.query(
        `TRUNCATE ${table}, "${upperTable}"; INSERT INTO "${upperTable}" SELECT n FROM generate_series(1,2100)n; ALTER TABLE ${table} ADD CONSTRAINT r08_batch_limit CHECK(id <= 2000)`,
      );
      await auth('post', '/api/metadata/refresh')
        .send({ connectionId, database })
        .expect(201);
      expect(await count()).toBe(0);
      const failed = await start();
      expect(failed.status).toBe('failed');
      expect(failed.processedRows).toBe(2000);
      expect(
        Number(
          (await pg.query(`SELECT count(*) AS total FROM ${table}`)).rows[0]
            .total,
        ),
      ).toBe(2000);
      expect(await count()).toBe(2000);
    } finally {
      if (jobId) await (await queue.getJob(jobId))?.remove();
      await pg.query(
        `ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS r08_batch_limit`,
      );
    }
  });

  it('database names differing only in case retain separate counts and fresh database metadata', async () => {
    const names = [`r08_scope_${suffix}`, `R08_scope_${suffix}`],
      pools: Pool[] = [],
      created: string[] = [];
    try {
      await auth('get', '/api/metadata/databases')
        .query({ connectionId })
        .expect(200);
      for (const [i, name] of names.entries()) {
        await auth('post', '/api/query/database')
          .send({ connectionId, name })
          .expect(201);
        created.push(name);
        expect(
          body(
            await auth('get', '/api/metadata/databases')
              .query({ connectionId })
              .expect(200),
          ),
        ).toContain(name);
        const url = new URL(process.env.E2E_DATABASE_URL || '');
        url.pathname = `/${name}`;
        const pool = new Pool({ connectionString: url.toString() });
        pools.push(pool);
        await pool.query(
          `CREATE TABLE items(id int); INSERT INTO items SELECT n FROM generate_series(1,${i + 1})n`,
        );
      }
      for (const [i, name] of names.entries()) {
        const result = body(
          await run('SELECT * FROM items', {
            database: name,
            includeTotalCount: true,
          }).expect(201),
        );
        expect(result.totalCount).toBe(i + 1);
        expect(result.rows).toHaveLength(i + 1);
      }
    } finally {
      await Promise.all(pools.map((pool) => pool.end()));
      for (const name of created) {
        await request(app.getHttpServer())
          .delete('/api/query/database')
          .agent(agent)
          .set('x-requested-with', 'XMLHttpRequest')
          .set('Authorization', `Bearer ${token}`)
          .send({ connectionId, name })
          .expect(200);
        expect(
          body(
            await auth('get', '/api/metadata/databases')
              .query({ connectionId })
              .expect(200),
          ),
        ).not.toContain(name);
      }
    }
  });
});
