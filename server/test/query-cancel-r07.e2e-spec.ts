import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { QueryService } from '../src/query/query.service';
import { ConnectionsService } from '../src/connections/connections.service';
import { encryptAttribute } from '../src/utils/crypto.util';
import { createE2eApp, closeE2eApp } from './e2e-app';

describe('R07 native PostgreSQL query execution ownership and cancellation', () => {
  const suffix = randomUUID().replace(/-/g, ''),
    table = `r07_cancel_${suffix}`;
  let app: INestApplication,
    prisma: PrismaService,
    postgres: Pool,
    service: QueryService;
  let ownerId: string,
    otherId: string,
    token: string,
    otherToken: string,
    connectionId: string;
  const initialTimeout = process.env.QUERY_TIMEOUT_MS;
  const pending: Promise<unknown>[] = [];
  const auth = (method: 'get' | 'post', path: string, owner = true) =>
    request(app.getHttpServer())
      [method](path)
      .set('x-requested-with', 'XMLHttpRequest')
      .set('Authorization', `Bearer ${owner ? token : otherToken}`);
  const run = (sql: string) => {
    const promise = auth('post', '/api/query')
      .send({ connectionId, sql, confirmed: true })
      .then((response) => response);
    pending.push(promise);
    return promise;
  };
  const waitFor = async <T>(
    read: () => Promise<T>,
    ready: (value: T) => boolean,
  ) => {
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) {
      const value = await read();
      if (ready(value)) return value;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error('R07 native state did not settle within 3s');
  };
  const active = () => service.getActiveQueries(ownerId);
  const running = async (marker: string) =>
    (
      await postgres.query<{ pid: number }>(
        "SELECT pid FROM pg_stat_activity WHERE state='active' AND pid<>pg_backend_pid() AND query LIKE $1",
        [`%${marker}%`],
      )
    ).rows;

  beforeAll(async () => {
    app = await createE2eApp();
    prisma = app.get(PrismaService);
    service = app.get(QueryService);
    const owner = await prisma.user.create({
      data: {
        email: `r07-${suffix}@example.test`,
        isEmailVerified: true,
        isOnboarded: true,
        securityAlerts: false,
      },
    });
    const other = await prisma.user.create({
      data: {
        email: `r07-other-${suffix}@example.test`,
        isEmailVerified: true,
        isOnboarded: true,
        securityAlerts: false,
      },
    });
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
          name: 'R07 fixture',
          type: 'postgres',
          host: '127.0.0.1',
          port: 15432,
          username: 'e2e',
          password: encryptAttribute('e2e-local-only'),
          database: 'data_explorer_e2e',
          readOnly: false,
          allowQueryExecution: true,
        },
      })
    ).id;
    postgres = new Pool({ connectionString: process.env.E2E_DATABASE_URL });
    await postgres.query(`CREATE TABLE ${table}(id INTEGER PRIMARY KEY)`);
  }, 30000);
  afterEach(async () => {
    if (initialTimeout === undefined) delete process.env.QUERY_TIMEOUT_MS;
    else process.env.QUERY_TIMEOUT_MS = initialTimeout;
    // Failure-path teardown stops only this suite's statements; each test asserts termination before teardown.
    await postgres.query(
      "SELECT pg_cancel_backend(pid) FROM pg_stat_activity WHERE pid<>pg_backend_pid() AND state='active' AND query LIKE $1",
      [`%${table}%`],
    );
    await Promise.allSettled(pending.splice(0));
    await postgres.query(`DELETE FROM ${table}`);
  });
  afterAll(async () => {
    try {
      await Promise.allSettled(pending);
      await postgres?.query(`DROP TABLE IF EXISTS ${table}`);
      if (ownerId) await prisma.user.delete({ where: { id: ownerId } });
      if (otherId) await prisma.user.delete({ where: { id: otherId } });
    } finally {
      if (initialTimeout === undefined) delete process.env.QUERY_TIMEOUT_MS;
      else process.env.QUERY_TIMEOUT_MS = initialTimeout;
      await Promise.all([
        app ? closeE2eApp(app) : Promise.resolve(),
        postgres?.end(),
      ]);
    }
  });

  it('cancels only the selected statement, denies another owner, and retires its handle', async () => {
    const marker = `${table}_selected`,
      neighbor = `${table}_neighbor`;
    const first = run(`SELECT pg_sleep(5), 'selected' AS label /*${marker}*/`);
    const second = run(
      `SELECT pg_sleep(1.5), 'neighbor' AS label /*${neighbor}*/`,
    );
    await waitFor(
      () => running(marker),
      (rows) => rows.length === 1,
    );
    await waitFor(
      () => running(neighbor),
      (rows) => rows.length === 1,
    );
    const entry = active().find((item) => item.sql.includes(marker))!;
    expect(entry).toBeDefined();
    const otherActive = await auth('get', '/api/query/active', false).expect(
      200,
    );
    expect(otherActive.body.data ?? otherActive.body).toEqual([]);
    await auth('post', `/api/query/${entry.queryId}/cancel`, false)
      .send({})
      .expect(403);
    const cancel = await auth('post', `/api/query/${entry.queryId}/cancel`)
      .send({})
      .expect(201);
    expect(cancel.body.data ?? cancel.body).toBe(true);
    await waitFor(
      () => running(marker),
      (rows) => rows.length === 0,
    );
    expect((await first).status).toBeGreaterThanOrEqual(400);
    const secondResponse = await second;
    expect(secondResponse.status).toBe(201);
    expect(
      (secondResponse.body.data ?? secondResponse.body).rows[0].label,
    ).toBe('neighbor');
    expect(active()).toEqual([]);
    const repeat = await auth('post', `/api/query/${entry.queryId}/cancel`)
      .send({})
      .expect(201);
    expect(repeat.body.data ?? repeat.body).toBe(false);
  }, 15000);

  it('stops the backend on application timeout and removes the execution registry entry', async () => {
    process.env.QUERY_TIMEOUT_MS = '150';
    const marker = `${table}_deadline`;
    const task = run(`SELECT pg_sleep(5) /*${marker}*/`);
    await waitFor(
      () => running(marker),
      (rows) => rows.length === 1,
    );
    await waitFor(
      () => running(marker),
      (rows) => rows.length === 0,
    );
    const response = await task;
    expect(response.status).toBe(400);
    expect(JSON.stringify(response.body)).toMatch(
      /maximum execution time|timeout|deadline/i,
    );
    expect(active()).toEqual([]);
  }, 15000);

  it('keeps the count phase registered and stops it on the same application deadline', async () => {
    process.env.QUERY_TIMEOUT_MS = '500';
    const marker = `${table}_count`;
    const task = auth('post', '/api/query')
      .send({
        connectionId,
        sql: `SELECT n FROM generate_series(1,2) n WHERE n=1 OR pg_sleep(5) IS NULL /*${marker}*/`,
        limit: 1,
        includeTotalCount: true,
      })
      .then((response) => response);
    pending.push(task);
    await waitFor(
      () => running(marker),
      (rows) => rows.length === 1,
    );
    expect(active()).toHaveLength(1);
    await waitFor(
      () => running(marker),
      (rows) => rows.length === 0,
    );
    expect((await task).status).toBe(400);
    expect(active()).toEqual([]);
  }, 15000);

  it('stops an execution when the HTTP client disconnects after sending its request', async () => {
    const marker = `${table}_disconnect`;
    const httpRequest = auth('post', '/api/query').send({
      connectionId,
      sql: `SELECT pg_sleep(5) /*${marker}*/`,
    });
    const outcome = httpRequest.then(
      (response) => ({ response }),
      (error) => ({ error }),
    );
    pending.push(outcome);
    await waitFor(
      () => running(marker),
      (rows) => rows.length === 1,
    );
    httpRequest.abort();
    await outcome;
    await waitFor(
      () => running(marker),
      (rows) => rows.length === 0,
    );
    await waitFor(
      async () => active(),
      (rows) => rows.length === 0,
    );
  }, 15000);

  it('handles a native PostgreSQL socket loss without killing the API or retaining the registry', async () => {
    const marker = `${table}_socket`,
      task = run(`SELECT pg_sleep(5) /*${marker}*/`);
    const rows = await waitFor(
      () => running(marker),
      (items) => items.length === 1,
    );
    await postgres.query('SELECT pg_terminate_backend($1)', [rows[0].pid]);
    expect((await task).status).toBeGreaterThanOrEqual(400);
    await waitFor(
      () => running(marker),
      (items) => items.length === 0,
    );
    expect(active()).toEqual([]);
    expect((await run('SELECT 1 AS healthy')).status).toBe(201);
  }, 15000);

  it('discards a backend after the shorter native client read timeout', async () => {
    const source = await prisma.connection.findUniqueOrThrow({
      where: { id: connectionId },
    });
    const short = await prisma.connection.create({
      data: {
        userId: ownerId,
        name: 'R07 short native deadline',
        type: source.type,
        host: source.host,
        port: source.port,
        username: source.username,
        password: source.password,
        database: source.database,
        readOnly: false,
        allowQueryExecution: true,
      },
    });
    const pool = (await app
      .get(ConnectionsService)
      .getPool(short.id, 'data_explorer_e2e', ownerId)) as Pool;
    pool.options.query_timeout = 100;
    pool.options.statement_timeout = 10000;
    const marker = `${table}_native_deadline`;
    const task = auth('post', '/api/query')
      .send({ connectionId: short.id, sql: `SELECT pg_sleep(5) /*${marker}*/` })
      .then((response) => response);
    pending.push(task);
    await waitFor(
      () => running(marker),
      (items) => items.length === 1,
    );
    const response = await task;
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(response.body)).toMatch(/read timeout/i);
    await waitFor(
      () => running(marker),
      (items) => items.length === 0,
    );
    expect(active()).toEqual([]);
  }, 15000);

  it.each([false, true])(
    'does not orphan a statement when control authentication fails (native timeout=%s)',
    async (nativeTimeout) => {
      process.env.QUERY_TIMEOUT_MS = '750';
      const connection = await prisma.connection.create({
        data: {
          userId: ownerId,
          name: `R07 failed control fixture ${nativeTimeout}`,
          type: 'postgres',
          host: '127.0.0.1',
          port: 15432,
          username: 'e2e',
          password: encryptAttribute('e2e-local-only'),
          database: 'data_explorer_e2e',
          allowQueryExecution: true,
          readOnly: false,
        },
      });
      const pool = (await app
        .get(ConnectionsService)
        .getPool(connection.id, 'data_explorer_e2e', ownerId)) as Pool;
      if (nativeTimeout) pool.options.query_timeout = 500;
      const password = pool.options.password,
        marker = `${table}_control_failure_${nativeTimeout}`;
      try {
        const task = auth('post', '/api/query')
          .send({
            connectionId: connection.id,
            sql: `SELECT pg_sleep(3) /*${marker}*/`,
          })
          .then((response) => response);
        pending.push(task);
        await waitFor(
          () => running(marker),
          (items) => items.length === 1,
        );
        pool.options.password = 'r07-intentionally-invalid-control-password';
        expect((await task).status).toBeGreaterThanOrEqual(400);
        expect(await running(marker)).toEqual([]);
        expect(active()).toEqual([]);
      } finally {
        pool.options.password = password;
      }
    },
    15000,
  );

  it('rolls back preceding writes when a multi-statement execution is cancelled', async () => {
    const marker = `${table}_transaction`;
    const task = run(
      `INSERT INTO ${table}(id) VALUES(7); SELECT pg_sleep(5) /*${marker}*/`,
    );
    await waitFor(
      () => running(marker),
      (rows) => rows.length === 1,
    );
    const entry = active().find((item) => item.sql.includes(marker))!;
    const cancel = await auth('post', `/api/query/${entry.queryId}/cancel`)
      .send({})
      .expect(201);
    expect(cancel.body.data ?? cancel.body).toBe(true);
    await waitFor(
      () => running(marker),
      (rows) => rows.length === 0,
    );
    expect((await task).status).toBeGreaterThanOrEqual(400);
    expect((await postgres.query(`SELECT * FROM ${table}`)).rows).toEqual([]);
    expect(active()).toEqual([]);
  }, 15000);
});
