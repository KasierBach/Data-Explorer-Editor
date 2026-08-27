import { Test } from '@nestjs/testing';
import Database from 'better-sqlite3';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';

/**
 * End-to-end tests that boot the full AppModule against real infrastructure:
 * - Postgres (app database, via DATABASE_URL)
 * - Redis (cache/throttler, via REDIS_URL)
 * - SQLite (a temp file used as the *explored* database for query execution)
 *
 * These tests cover the core flows: register/login, authenticated profile,
 * connections CRUD, query execution (including multi-statement transaction
 * rollback), and saved queries.
 */

describe('App (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  let connectionId: string;
  let sqliteDbPath: string;

  const testEmail = `e2e-user-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}@example.com`;
  const testPassword = 'E2eTest!Passw0rd';
  // The CSRF middleware requires this header on all mutating requests.
  const csrfHeader = { 'x-requested-with': 'XMLHttpRequest' };

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();

    prisma = app.get(PrismaService);

    // Seed a verified user directly so login works without email verification.
    const hashed = await bcrypt.hash(testPassword, 4);
    await prisma.user.create({
      data: {
        email: testEmail,
        password: hashed,
        firstName: 'E2E',
        lastName: 'Tester',
        role: 'user',
        provider: 'local',
        isOnboarded: true,
        isEmailVerified: true,
        language: 'en',
        legalAcceptedAt: new Date(),
      },
    });

    // Create a temp SQLite database for query-execution tests.
    sqliteDbPath = path.join(
      os.tmpdir(),
      `data-explorer-e2e-${Date.now()}-${Math.random().toString(36).slice(2)}.db`,
    );
    const db = new Database(sqliteDbPath);
    db.exec(
      `CREATE TABLE e2e_items (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL);
       INSERT INTO e2e_items (name) VALUES ('alpha'), ('beta');`,
    );
    db.close();
  }, 120_000);

  afterAll(async () => {
    try {
      if (connectionId) {
        await prisma.connection.deleteMany({ where: { id: connectionId } });
      }
      await prisma.user.deleteMany({ where: { email: testEmail } });
    } catch {
      // best-effort cleanup
    }
    try {
      if (sqliteDbPath && fs.existsSync(sqliteDbPath)) {
        fs.unlinkSync(sqliteDbPath);
      }
    } catch {
      // best-effort cleanup
    }
    await app.close();
  }, 120_000);

  // ─── Health ───

  it('GET /api/health/live returns ok', async () => {
    const res = await request(app.getHttpServer()).get('/api/health/live');
    expect(res.status).toBe(200);
  });

  it('GET /api/health/ready reports database and redis', async () => {
    const res = await request(app.getHttpServer()).get('/api/health/ready');
    expect(res.status).toBe(200);
    const body = res.body?.data ?? res.body;
    expect(body).toBeTruthy();
  });

  // ─── Auth ───

  it('POST /api/auth/login rejects invalid credentials', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: testEmail, password: 'wrong-password' });
    expect(res.status).toBe(401);
  });

  it('POST /api/auth/login returns an access token for the seeded user', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: testEmail, password: testPassword });
    expect(res.status).toBe(200);
    const body = res.body?.data ?? res.body;
    expect(body.access_token).toBeTruthy();
    expect(body.user.email).toBe(testEmail);
    accessToken = body.access_token;
  });

  it('GET /api/users/me returns the profile when authenticated', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    const body = res.body?.data ?? res.body;
    expect(body.email).toBe(testEmail);
  });

  it('GET /api/users/me rejects unauthenticated requests', async () => {
    const res = await request(app.getHttpServer()).get('/api/users/me');
    expect(res.status).toBe(401);
  });

  // ─── Connections ───

  it('POST /api/connections creates a SQLite connection', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/connections')
      .set('Authorization', `Bearer ${accessToken}`)
      .set(csrfHeader)
      .send({
        name: 'E2E SQLite',
        type: 'sqlite',
        database: sqliteDbPath,
        allowQueryExecution: true,
        allowSchemaChanges: true,
        allowImportExport: true,
      });
    expect(res.status).toBe(201);
    const body = res.body?.data ?? res.body;
    expect(body.id).toBeTruthy();
    expect(body.type).toBe('sqlite');
    connectionId = body.id;
  });

  it('GET /api/connections lists the created connection', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/connections')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    const body = res.body?.data ?? res.body;
    const found = (Array.isArray(body) ? body : []).find(
      (c: { id: string }) => c.id === connectionId,
    );
    expect(found).toBeTruthy();
  });

  // ─── Query execution ───

  it('POST /api/query executes a SELECT and returns rows', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/query')
      .set('Authorization', `Bearer ${accessToken}`)
      .set(csrfHeader)
      .send({
        connectionId,
        sql: 'SELECT id, name FROM e2e_items ORDER BY id',
        limit: 10,
        offset: 0,
        includeTotalCount: true,
      });
    expect(res.status).toBe(201);
    const body = res.body?.data ?? res.body;
    expect(body.rows).toHaveLength(2);
    expect(body.rows[0].name).toBe('alpha');
    expect(body.totalCount).toBe(2);
  });

  it('POST /api/query rolls back all statements when one fails (transaction)', async () => {
    // First statement inserts a row; second statement is invalid SQL.
    // With the transaction fix, the insert must be rolled back.
    const failing = await request(app.getHttpServer())
      .post('/api/query')
      .set('Authorization', `Bearer ${accessToken}`)
      .set(csrfHeader)
      .send({
        connectionId,
        sql: "INSERT INTO e2e_items (name) VALUES ('gamma'); SELECT * FROM nonexistent_table;",
        limit: 10,
        offset: 0,
      });
    expect(failing.status).toBeGreaterThanOrEqual(400);

    // Verify the insert was rolled back: still only the original 2 rows.
    const verify = await request(app.getHttpServer())
      .post('/api/query')
      .set('Authorization', `Bearer ${accessToken}`)
      .set(csrfHeader)
      .send({
        connectionId,
        sql: 'SELECT COUNT(*) AS cnt FROM e2e_items',
        limit: 10,
        offset: 0,
      });
    expect(verify.status).toBe(201);
    const verifyBody = verify.body?.data ?? verify.body;
    expect(Number(verifyBody.rows[0].cnt)).toBe(2);
  });

  it('POST /api/query commits all statements when the batch succeeds', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/query')
      .set('Authorization', `Bearer ${accessToken}`)
      .set(csrfHeader)
      .send({
        connectionId,
        sql: "INSERT INTO e2e_items (name) VALUES ('delta'); INSERT INTO e2e_items (name) VALUES ('epsilon'); SELECT COUNT(*) AS cnt FROM e2e_items;",
        limit: 10,
        offset: 0,
      });
    expect(res.status).toBe(201);
    const body = res.body?.data ?? res.body;
    expect(Number(body.rows[0].cnt)).toBe(4);
  });

  it('POST /api/query rejects queries without authentication', async () => {
    // CSRF middleware runs before auth, so the header is required to reach
    // the authentication layer.
    const res = await request(app.getHttpServer())
      .post('/api/query')
      .set(csrfHeader)
      .send({
        connectionId,
        sql: 'SELECT 1',
        limit: 10,
        offset: 0,
      });
    expect(res.status).toBe(401);
  });

  // ─── Saved queries ───

  it('POST /api/saved-queries creates and lists a saved query', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/saved-queries')
      .set('Authorization', `Bearer ${accessToken}`)
      .set(csrfHeader)
      .send({
        name: 'E2E saved query',
        sql: 'SELECT * FROM e2e_items',
        connectionId,
      });
    expect(createRes.status).toBe(201);
    const created = createRes.body?.data ?? createRes.body;
    expect(created.id).toBeTruthy();

    const listRes = await request(app.getHttpServer())
      .get('/api/saved-queries')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(listRes.status).toBe(200);
    const list = listRes.body?.data ?? listRes.body;
    const found = (Array.isArray(list) ? list : []).find(
      (q: { id: string }) => q.id === created.id,
    );
    expect(found).toBeTruthy();

    await request(app.getHttpServer())
      .delete(`/api/saved-queries/${created.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set(csrfHeader)
      .expect((res) => {
        expect([200, 204]).toContain(res.status);
      });
  });

  // ─── Validation ───

  it('POST /api/connections rejects non-whitelisted fields', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/connections')
      .set('Authorization', `Bearer ${accessToken}`)
      .set(csrfHeader)
      .send({
        name: 'Bad connection',
        type: 'sqlite',
        database: sqliteDbPath,
        evilField: 'should be rejected',
      });
    expect(res.status).toBe(400);
  });
});
