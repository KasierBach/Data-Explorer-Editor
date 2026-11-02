import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, basename } from 'node:path';
import { Pool } from 'pg';
import { createPool, Pool as MysqlPool } from 'mysql2/promise';
import Database from 'better-sqlite3';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { encryptAttribute } from '../src/utils/crypto.util';
import { createE2eApp, closeE2eApp } from './e2e-app';

describe('R04 typed identities through HTTP and real databases', () => {
  const suffix = randomUUID().replace(/-/g, '');
  const table = `r04_rows_${suffix}`,
    textTable = `r04_text_${suffix}`,
    uuidTable = `r04_uuid_${suffix}`,
    decimalTable = `r04_decimal_${suffix}`,
    temporalTable = `r04_time_${suffix}`,
    nontransactionalTable = `r04_myisam_${suffix}`;
  let app: INestApplication,
    prisma: PrismaService,
    postgres: Pool,
    mysql: MysqlPool,
    sqlite: Database.Database;
  let userId: string, token: string, directory: string;
  const ids: Record<string, string> = {};
  const schemas: Record<string, string> = {
    postgres: 'public',
    mysql: 'data_explorer_r03',
    sqlite: 'main',
  };
  const query = async (engine: string, sql: string) =>
    engine === 'postgres'
      ? (await postgres.query(sql)).rows
      : engine === 'mysql'
        ? (await mysql.query(sql))[0]
        : (() => {
            const stmt = sqlite.prepare(sql);
            return stmt.reader ? stmt.all() : stmt.run();
          })();
  const mutation = (engine: string, payload: object, remove = false) => {
    const req = remove
      ? request(app.getHttpServer()).post('/api/query/delete-rows')
      : request(app.getHttpServer()).patch('/api/query/row');
    return req
      .set('x-requested-with', 'XMLHttpRequest')
      .set('Authorization', `Bearer ${token}`)
      .send({
        connectionId: ids[engine],
        schema: schemas[engine],
        table,
        ...payload,
      });
  };
  const identity = (tenant: string, id: string) => [
    { column: 'tenant', value: tenant },
    { column: 'id', value: id },
  ];
  beforeAll(async () => {
    app = await createE2eApp();
    prisma = app.get(PrismaService);
    const user = await prisma.user.create({
      data: {
        email: `r04-${suffix}@example.com`,
        isEmailVerified: true,
        isOnboarded: true,
        securityAlerts: false,
      },
    });
    userId = user.id;
    token = app
      .get(JwtService)
      .sign({ sub: user.id, email: user.email, role: 'user', type: 'access' });
    postgres = new Pool({ connectionString: process.env.E2E_DATABASE_URL });
    mysql = createPool({
      host: '127.0.0.1',
      port: 13306,
      user: 'e2e',
      password: 'r03-local-only',
      database: 'data_explorer_r03',
      supportBigNumbers: true,
      bigNumberStrings: true,
    });
    directory = mkdtempSync(join(tmpdir(), 'r04-identity-'));
    const file = join(directory, 'test.sqlite');
    sqlite = new Database(file);
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
      { type: 'sqlite', database: file },
    ];
    for (const config of configs) {
      const c = await prisma.connection.create({
        data: {
          ...config,
          name: `R04 synthetic ${config.type}`,
          userId,
          readOnly: false,
          allowQueryExecution: true,
        },
      });
      ids[config.type] = c.id;
      await query(
        config.type,
        `CREATE TABLE ${table}(tenant VARCHAR(40) NOT NULL,id BIGINT NOT NULL,note VARCHAR(60),PRIMARY KEY(tenant,id))`,
      );
      await query(
        config.type,
        `CREATE TABLE ${textTable}(id VARCHAR(40) PRIMARY KEY,note VARCHAR(60))`,
      );
    }
    await query(
      'postgres',
      `CREATE TABLE ${temporalTable}(id TIMESTAMPTZ(6) PRIMARY KEY,note TEXT); INSERT INTO ${temporalTable} VALUES ('2026-01-01 00:00:00.123000+00','first'),('2026-01-01 00:00:00.123456+00','second')`,
    );
    await query(
      'postgres',
      `CREATE TABLE ${uuidTable}(id UUID PRIMARY KEY,note TEXT); INSERT INTO ${uuidTable} VALUES ('550e8400-e29b-41d4-a716-446655440000','before'),('550e8400-e29b-41d4-a716-446655440001','neighbor')`,
    );
    for (const engine of ['postgres', 'mysql']) {
      await query(
        engine,
        `CREATE TABLE ${decimalTable}(id DECIMAL(19,18) PRIMARY KEY,note VARCHAR(40))`,
      );
      await query(
        engine,
        `INSERT INTO ${decimalTable} VALUES (1.000000000000000000,'first'),(1.000000000000000001,'second')`,
      );
    }
    await query(
      'mysql',
      `CREATE TABLE ${nontransactionalTable}(tenant VARCHAR(40),id BIGINT,note VARCHAR(60),PRIMARY KEY(tenant,id)) ENGINE=MyISAM`,
    );
  }, 120000);
  beforeEach(async () => {
    for (const engine of Object.keys(ids)) {
      await query(engine, `DELETE FROM ${table}`);
      await query(
        engine,
        `INSERT INTO ${table} VALUES ('A',1,'a1'),('A',2,'a2'),('B',1,'b1'),('A',9007199254740993,'large')`,
      );
      await query(engine, `DELETE FROM ${textTable}`);
      await query(
        engine,
        `INSERT INTO ${textTable} VALUES ('001','first'),('1','second'),('550e8400-e29b-41d4-a716-446655440000','uuid')`,
      );
    }
  });
  afterAll(async () => {
    try {
      await query('postgres', `DROP TABLE IF EXISTS ${temporalTable}`);
      await query('postgres', `DROP TABLE IF EXISTS ${uuidTable}`);
      for (const engine of ['postgres', 'mysql'])
        await query(engine, `DROP TABLE IF EXISTS ${decimalTable}`);
      await query('mysql', `DROP TABLE IF EXISTS ${nontransactionalTable}`);
      for (const engine of Object.keys(ids)) {
        await query(engine, `DROP TABLE IF EXISTS ${table}`);
        await query(engine, `DROP TABLE IF EXISTS ${textTable}`);
      }
      if (prisma && userId) await prisma.user.delete({ where: { id: userId } });
    } finally {
      await Promise.all([
        app ? closeE2eApp(app) : Promise.resolve(),
        postgres?.end(),
        mysql?.end(),
      ]);
      sqlite?.close();
      if (directory) {
        const resolved = realpathSync(directory);
        assert(
          dirname(resolved) === realpathSync(tmpdir()) &&
            basename(resolved).startsWith('r04-identity-'),
          'Unsafe R04 scratch path',
        );
        rmSync(resolved, { recursive: true });
      }
    }
  }, 120000);
  it('updates a native PostgreSQL UUID key without changing its neighbor', async () => {
    const response = await mutation('postgres', {
      table: uuidTable,
      pkColumn: 'id',
      pkValue: '550e8400-e29b-41d4-a716-446655440000',
      updates: { note: 'after' },
    });
    expect(response.status).toBe(200);
    expect(
      await query('postgres', `SELECT note FROM ${uuidTable} ORDER BY id`),
    ).toEqual([{ note: 'after' }, { note: 'neighbor' }]);
  });
  it.each(['postgres', 'mysql'])(
    'keeps exact decimal string keys on %s distinct',
    async (engine) => {
      const read = await request(app.getHttpServer())
        .post('/api/query')
        .set('x-requested-with', 'XMLHttpRequest')
        .set('Authorization', `Bearer ${token}`)
        .send({
          connectionId: ids[engine],
          sql: `SELECT id FROM ${decimalTable} ORDER BY id`,
          limit: 10,
        });
      expect(read.status).toBe(201);
      expect((read.body.data ?? read.body).rows).toEqual([
        { id: '1.000000000000000000' },
        { id: '1.000000000000000001' },
      ]);
      const response = await mutation(engine, {
        table: decimalTable,
        pkColumn: 'id',
        pkValue: '1.000000000000000001',
        updates: { note: 'exact' },
      });
      expect(response.status).toBe(200);
      expect(
        await query(engine, `SELECT note FROM ${decimalTable} ORDER BY id`),
      ).toEqual([{ note: 'first' }, { note: 'exact' }]);
    },
  );
  it('contains truncated temporal keys instead of mutating the other matching row', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/query')
      .set('x-requested-with', 'XMLHttpRequest')
      .set('Authorization', `Bearer ${token}`)
      .send({
        connectionId: ids.postgres,
        sql: `SELECT id,note FROM ${temporalTable} ORDER BY id`,
        limit: 10,
      });
    expect(response.status).toBe(201);
    const rows = (response.body.data ?? response.body).rows;
    expect(rows[0].id).toBe(rows[1].id);
    const update = await mutation('postgres', {
      table: temporalTable,
      pkColumn: 'id',
      pkValue: rows[1].id,
      updates: { note: 'wrong' },
    });
    expect(update.status).toBe(400);
    expect(
      await query('postgres', `SELECT note FROM ${temporalTable} ORDER BY id`),
    ).toEqual([{ note: 'first' }, { note: 'second' }]);
  });
  it('contains nontransactional MySQL tables before any stale-batch deletion', async () => {
    await query('mysql', `DELETE FROM ${nontransactionalTable}`);
    await query(
      'mysql',
      `INSERT INTO ${nontransactionalTable} VALUES ('A',1,'first'),('B',1,'second')`,
    );
    const response = await mutation(
      'mysql',
      {
        table: nontransactionalTable,
        pkColumn: 'tenant',
        pkValues: ['A', 'Z'],
        identities: [identity('A', '1'), identity('Z', '9')],
      },
      true,
    );
    expect(response.status).toBe(400);
    expect(
      await query(
        'mysql',
        `SELECT note FROM ${nontransactionalTable} ORDER BY tenant`,
      ),
    ).toEqual([{ note: 'first' }, { note: 'second' }]);
  });
  describe.each(['postgres', 'mysql', 'sqlite'])('%s', (engine) => {
    it('updates only A/1 with a complete composite identity', async () => {
      const response = await mutation(engine, {
        pkColumn: 'tenant',
        pkValue: 'A',
        identity: identity('A', '1'),
        updates: { note: 'changed' },
      });
      expect(response.status).toBe(200);
      expect((response.body.data ?? response.body).rowCount).toBe(1);
      expect(
        await query(engine, `SELECT note FROM ${table} ORDER BY tenant,id`),
      ).toEqual([
        { note: 'changed' },
        { note: 'a2' },
        { note: 'large' },
        { note: 'b1' },
      ]);
    });
    it('deletes A/2 and B/1 without deleting A/1', async () => {
      const response = await mutation(
        engine,
        {
          pkColumn: 'tenant',
          pkValues: ['A', 'B'],
          identities: [identity('A', '2'), identity('B', '1')],
        },
        true,
      );
      expect(response.status).toBe(201);
      expect((response.body.data ?? response.body).rowCount).toBe(2);
      expect(
        await query(engine, `SELECT note FROM ${table} ORDER BY tenant,id`),
      ).toEqual([{ note: 'a1' }, { note: 'large' }]);
    });
    it('keeps legacy text 001 distinct from 1', async () => {
      const response = await mutation(engine, {
        table: textTable,
        pkColumn: 'id',
        pkValue: '001',
        updates: { note: 'changed' },
      });
      expect(response.status).toBe(200);
      expect(
        await query(
          engine,
          `SELECT id,note FROM ${textTable} WHERE id IN ('001','1') ORDER BY id`,
        ),
      ).toEqual([
        { id: '001', note: 'changed' },
        { id: '1', note: 'second' },
      ]);
    });
    it('preserves a bigint key above the JavaScript safe integer range', async () => {
      const response = await mutation(engine, {
        pkColumn: 'tenant',
        pkValue: 'A',
        identity: identity('A', '9007199254740993'),
        updates: { note: 'precise' },
      });
      expect(response.status).toBe(200);
      expect(
        await query(
          engine,
          `SELECT note FROM ${table} WHERE id=9007199254740993`,
        ),
      ).toEqual([{ note: 'precise' }]);
    });
    it('returns a lossless bigint key to the client', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/query')
        .set('x-requested-with', 'XMLHttpRequest')
        .set('Authorization', `Bearer ${token}`)
        .send({
          connectionId: ids[engine],
          sql: `SELECT id FROM ${table} WHERE id=9007199254740993`,
          limit: 10,
        });
      expect(response.status).toBe(201);
      expect((response.body.data ?? response.body).rows).toEqual([
        { id: '9007199254740993' },
      ]);
    });
    it('rolls back the whole delete when one target is stale', async () => {
      const response = await mutation(
        engine,
        {
          pkColumn: 'tenant',
          pkValues: ['A', 'Z'],
          identities: [identity('A', '1'), identity('Z', '9')],
        },
        true,
      );
      expect(response.status).toBe(409);
      expect(
        await query(engine, `SELECT note FROM ${table} ORDER BY tenant,id`),
      ).toEqual([
        { note: 'a1' },
        { note: 'a2' },
        { note: 'large' },
        { note: 'b1' },
      ]);
    });
    it('rejects an incomplete legacy composite key', async () => {
      const response = await mutation(engine, {
        pkColumn: 'tenant',
        pkValue: 'A',
        updates: { note: 'wrong' },
      });
      expect(response.status).toBe(400);
      expect(
        await query(engine, `SELECT note FROM ${table} ORDER BY tenant,id`),
      ).toEqual([
        { note: 'a1' },
        { note: 'a2' },
        { note: 'large' },
        { note: 'b1' },
      ]);
    });
  });
});
