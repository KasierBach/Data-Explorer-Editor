import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { Agent } from 'node:http';
import { createPool, Pool as MysqlPool } from 'mysql2/promise';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { FreshnessService } from '../src/common/freshness/freshness.service';
import { encryptAttribute } from '../src/utils/crypto.util';
import { createE2eApp, closeE2eApp } from './e2e-app';

describe('R08 MySQL implicit commit freshness', () => {
  const agent = new Agent({ localAddress: '127.0.0.9' });
  const suffix = randomUUID().replace(/-/g, ''),
    table = `r08_${suffix}`;
  let app: INestApplication,
    mysql: MysqlPool,
    prisma: PrismaService,
    userId: string,
    connectionId: string,
    token: string;
  const run = (sql: string, includeTotalCount = false) =>
    request(app.getHttpServer())
      .post('/api/query')
      .agent(agent)
      .set('x-requested-with', 'XMLHttpRequest')
      .set('Authorization', `Bearer ${token}`)
      .send({ connectionId, sql, includeTotalCount, confirmed: true });
  const count = async () => {
    const response = await run(`SELECT * FROM ${table}`, true).expect(201);
    return (response.body.data ?? response.body).totalCount;
  };
  beforeAll(async () => {
    app = await createE2eApp();
    prisma = app.get(PrismaService);
    const user = await prisma.user.create({
      data: {
        email: `r08-mysql-${suffix}@example.test`,
        isEmailVerified: true,
        isOnboarded: true,
        securityAlerts: false,
      },
    });
    userId = user.id;
    token = app
      .get(JwtService)
      .sign({ sub: userId, email: user.email, role: 'user', type: 'access' });
    connectionId = (
      await prisma.connection.create({
        data: {
          userId,
          name: 'R08 MySQL fixture',
          type: 'mysql',
          host: '127.0.0.1',
          port: 13306,
          username: 'e2e',
          password: encryptAttribute('r03-local-only'),
          database: 'data_explorer_r03',
          allowQueryExecution: true,
          allowSchemaChanges: true,
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
    await mysql.query(`CREATE TABLE ${table}(id integer PRIMARY KEY)`);
  }, 30000);
  afterAll(async () => {
    try {
      await mysql?.query(`DROP TABLE IF EXISTS ${table}`);
      if (userId) await prisma.user.delete({ where: { id: userId } });
    } finally {
      await Promise.all([
        mysql?.end(),
        app ? closeE2eApp(app) : Promise.resolve(),
      ]);
      agent.destroy();
    }
  });
  beforeEach(async () => {
    await mysql.query(`TRUNCATE ${table}`);
    await app
      .get(FreshnessService)
      .invalidateConnection(connectionId, 'data_explorer_r03');
  });
  it('refreshes warm count when DDL committed an earlier insert but the batch later fails', async () => {
    expect(await count()).toBe(0);
    await run(
      `INSERT INTO ${table} VALUES(1); ALTER TABLE ${table} ADD COLUMN extra int; INSERT INTO ${table}(id) VALUES(1)`,
    )
      .expect(409)
      .expect((response) =>
        expect(response.body.reason).toBe('QUERY_CONFLICT'),
      );
    const [rows] = await mysql.query(`SELECT count(*) AS total FROM ${table}`);
    expect((rows as Array<{ total: number }>)[0].total).toBe(1);
    expect(await count()).toBe(1);
  });
  it('does not advertise a successful mutation after rollback or failure before any statement succeeds', async () => {
    const freshness = app.get(FreshnessService),
      key = () =>
        freshness.buildKey(
          'query',
          [connectionId, 'data_explorer_r03'],
          ['sentinel'],
        );
    const before = await key();
    await run(`INSERT INTO ${table}(missing) VALUES(2); SELECT 1`)
      .expect(400)
      .expect((response) =>
        expect(response.body.reason).toBe('QUERY_OBJECT_NOT_FOUND'),
      );
    expect(await key()).toBe(before);
    await run(
      `INSERT INTO ${table}(id) VALUES(2); INSERT INTO ${table}(id) VALUES(2)`,
    )
      .expect(409)
      .expect((response) =>
        expect(response.body.reason).toBe('QUERY_CONFLICT'),
      );
    const [rows] = await mysql.query(`SELECT id FROM ${table} ORDER BY id`);
    expect(rows).toEqual([]);
    expect(await count()).toBe(0);
  });
});
