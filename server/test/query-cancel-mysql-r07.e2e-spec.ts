import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { createPool, type Pool, type RowDataPacket } from 'mysql2/promise';
import type { PoolConnection as NativeMysqlConnection } from 'mysql2';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { QueryService } from '../src/query/query.service';
import { ConnectionsService } from '../src/connections/connections.service';
import { encryptAttribute } from '../src/utils/crypto.util';
import { createE2eApp, closeE2eApp } from './e2e-app';

describe('R07 native MySQL query cancellation', () => {
  const tag = `r07_mysql_${randomUUID().replace(/-/g, '')}`;
  let app: INestApplication,
    prisma: PrismaService,
    mysql: Pool,
    service: QueryService;
  let userId: string, token: string, connectionId: string;
  const originalTimeout = process.env.QUERY_TIMEOUT_MS;
  const pending: Promise<unknown>[] = [];
  const auth = (path: string) =>
    request(app.getHttpServer())
      .post(path)
      .set('x-requested-with', 'XMLHttpRequest')
      .set('Authorization', `Bearer ${token}`);
  const run = (sql: string) => {
    const task = auth('/api/query')
      .send({ connectionId, sql, confirmed: true })
      .then((response) => response);
    pending.push(task);
    return task;
  };
  const running = async (marker: string) =>
    (
      await mysql.query<RowDataPacket[]>(
        "SELECT ID FROM information_schema.PROCESSLIST WHERE ID<>CONNECTION_ID() AND COMMAND='Query' AND INFO LIKE ?",
        [`%${marker}%`],
      )
    )[0];
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
    throw new Error('R07 MySQL execution did not settle in 3s');
  };
  beforeAll(async () => {
    app = await createE2eApp();
    prisma = app.get(PrismaService);
    service = app.get(QueryService);
    const user = await prisma.user.create({
      data: {
        email: `${tag}@example.test`,
        isEmailVerified: true,
        isOnboarded: true,
        securityAlerts: false,
      },
    });
    userId = user.id;
    token = app
      .get(JwtService)
      .sign({ sub: user.id, email: user.email, role: 'user', type: 'access' });
    connectionId = (
      await prisma.connection.create({
        data: {
          userId,
          name: 'R07 MySQL fixture',
          type: 'mysql',
          host: '127.0.0.1',
          port: 13306,
          username: 'e2e',
          password: encryptAttribute('r03-local-only'),
          database: 'data_explorer_r03',
          allowQueryExecution: true,
          readOnly: false,
        },
      })
    ).id;
    mysql = createPool({
      host: '127.0.0.1',
      port: 13306,
      user: 'e2e',
      password: 'r03-local-only',
      database: 'data_explorer_r03',
    });
    await mysql.query(
      `CREATE TABLE ${tag}(id INTEGER PRIMARY KEY) ENGINE=InnoDB`,
    );
  }, 30000);
  afterEach(async () => {
    if (originalTimeout === undefined) delete process.env.QUERY_TIMEOUT_MS;
    else process.env.QUERY_TIMEOUT_MS = originalTimeout;
    // Stop only owned statements on a failed assertion, after successful tests prove termination themselves.
    for (const row of await running(tag)) {
      const id = Number(row.ID);
      if (!Number.isSafeInteger(id) || id <= 0)
        throw new Error('Invalid owned MySQL thread');
      await mysql.query(`KILL QUERY ${id}`);
    }
    await Promise.allSettled(pending.splice(0));
    await mysql.query(`DELETE FROM ${tag}`);
  });
  afterAll(async () => {
    try {
      await Promise.allSettled(pending);
      await mysql?.query(`DROP TABLE IF EXISTS ${tag}`);
      if (userId) await prisma.user.delete({ where: { id: userId } });
    } finally {
      if (originalTimeout === undefined) delete process.env.QUERY_TIMEOUT_MS;
      else process.env.QUERY_TIMEOUT_MS = originalTimeout;
      await Promise.all([
        app ? closeE2eApp(app) : Promise.resolve(),
        mysql?.end(),
      ]);
    }
  });
  it('kills only the selected connection thread and retains the neighbor query', async () => {
    const selected = `${tag}_selected`,
      neighbor = `${tag}_neighbor`;
    const first = run(`SELECT SLEEP(5), 'selected' AS label /*${selected}*/`);
    const second = run(
      `SELECT SLEEP(1.5), 'neighbor' AS label /*${neighbor}*/`,
    );
    await waitFor(
      () => running(selected),
      (rows) => rows.length === 1,
    );
    await waitFor(
      () => running(neighbor),
      (rows) => rows.length === 1,
    );
    const entry = service
      .getActiveQueries(userId)
      .find((item) => item.sql.includes(selected))!;
    const cancellation = await auth(`/api/query/${entry.queryId}/cancel`)
      .send({})
      .expect(201);
    expect(cancellation.body.data ?? cancellation.body).toBe(true);
    await waitFor(
      () => running(selected),
      (rows) => rows.length === 0,
    );
    expect((await first).status).toBeGreaterThanOrEqual(400);
    const result = await second;
    expect(result.status).toBe(201);
    expect((result.body.data ?? result.body).rows[0].label).toBe('neighbor');
    expect(service.getActiveQueries(userId)).toEqual([]);
  }, 15000);
  it('stops the native statement before returning an application deadline error', async () => {
    process.env.QUERY_TIMEOUT_MS = '150';
    const marker = `${tag}_timeout`,
      task = run(`SELECT SLEEP(5) /*${marker}*/`);
    await waitFor(
      () => running(marker),
      (rows) => rows.length === 1,
    );
    await waitFor(
      () => running(marker),
      (rows) => rows.length === 0,
    );
    expect((await task).status).toBe(400);
    expect(service.getActiveQueries(userId)).toEqual([]);
  }, 15000);
  it('uses a dedicated control connection with valid transport options and preserves the source session', async () => {
    const warning = jest.spyOn(console, 'error');
    try {
      const connection = await prisma.connection.create({
        data: {
          userId,
          name: 'R07 one-session control fixture',
          type: 'mysql',
          host: '127.0.0.1',
          port: 13306,
          username: 'e2e',
          password: encryptAttribute('r03-local-only'),
          database: 'data_explorer_r03',
          allowQueryExecution: true,
          readOnly: false,
        },
      });
      const pool = (await app
        .get(ConnectionsService)
        .getPool(connection.id, 'data_explorer_r03', userId)) as Pool;
      pool.pool.config.connectionLimit = 1;
      const marker = `${tag}_one_session`;
      const task = auth('/api/query')
        .send({
          connectionId: connection.id,
          sql: `SELECT SLEEP(5) /*${marker}*/`,
        })
        .then((response) => response);
      pending.push(task);
      const rows = await waitFor(
        () => running(marker),
        (items) => items.length === 1,
      );
      const id = Number(rows[0].ID);
      const entry = service
        .getActiveQueries(userId)
        .find((item) => item.sql.includes(marker))!;
      const cancelled = await auth(`/api/query/${entry.queryId}/cancel`)
        .send({})
        .expect(201);
      expect(cancelled.body.data ?? cancelled.body).toBe(true);
      expect((await task).status).toBeGreaterThanOrEqual(400);
      const next = await auth('/api/query')
        .send({
          connectionId: connection.id,
          sql: 'SELECT CONNECTION_ID() AS id',
        })
        .expect(201);
      expect(Number((next.body.data ?? next.body).rows[0].id)).toBe(id);
      expect(
        warning.mock.calls.filter((args) =>
          String(args[0]).includes('invalid configuration option'),
        ),
      ).toEqual([]);
    } finally {
      warning.mockRestore();
    }
  }, 15000);

  it.each([false, true])(
    'does not orphan a MySQL statement when control login fails (native timeout=%s)',
    async (nativeTimeout) => {
      process.env.QUERY_TIMEOUT_MS = '750';
      const connection = await prisma.connection.create({
        data: {
          userId,
          name: `R07 failed MySQL control fixture ${nativeTimeout}`,
          type: 'mysql',
          host: '127.0.0.1',
          port: 13306,
          username: 'e2e',
          password: encryptAttribute('r03-local-only'),
          database: 'data_explorer_r03',
          allowQueryExecution: true,
          readOnly: false,
        },
      });
      const pool = (await app
        .get(ConnectionsService)
        .getPool(connection.id, 'data_explorer_r03', userId)) as Pool & {
        __statementTimeout?: number;
      };
      if (nativeTimeout) pool.__statementTimeout = 500;
      let acquired: NativeMysqlConnection | undefined;
      const acquire = (client: NativeMysqlConnection) => {
        acquired = client;
      };
      pool.pool.on('acquire', acquire);
      const marker = `${tag}_control_failure_${nativeTimeout}`;
      let password: string | undefined;
      try {
        const task = auth('/api/query')
          .send({
            connectionId: connection.id,
            sql: `SELECT SLEEP(3) /*${marker}*/`,
          })
          .then((response) => response);
        pending.push(task);
        await waitFor(
          () => running(marker),
          (rows) => rows.length === 1,
        );
        expect(acquired).toBeDefined();
        password = acquired!.config.password;
        acquired!.config.password = 'r07-invalid-control-password';
        expect((await task).status).toBeGreaterThanOrEqual(400);
        expect(await running(marker)).toEqual([]);
        expect(service.getActiveQueries(userId)).toEqual([]);
      } finally {
        pool.pool.removeListener('acquire', acquire);
        if (acquired) acquired.config.password = password;
      }
    },
    15000,
  );

  it('rolls back prior writes when a multi-statement query is cancelled', async () => {
    const marker = `${tag}_transaction`,
      task = run(
        `INSERT INTO ${tag}(id) VALUES(7); SELECT SLEEP(5) /*${marker}*/`,
      );
    await waitFor(
      () => running(marker),
      (rows) => rows.length === 1,
    );
    const entry = service
      .getActiveQueries(userId)
      .find((item) => item.sql.includes(marker))!;
    const cancellation = await auth(`/api/query/${entry.queryId}/cancel`)
      .send({})
      .expect(201);
    expect(cancellation.body.data ?? cancellation.body).toBe(true);
    await waitFor(
      () => running(marker),
      (rows) => rows.length === 0,
    );
    expect((await task).status).toBeGreaterThanOrEqual(400);
    expect((await mysql.query(`SELECT * FROM ${tag}`))[0]).toEqual([]);
    expect(service.getActiveQueries(userId)).toEqual([]);
  }, 15000);
});
