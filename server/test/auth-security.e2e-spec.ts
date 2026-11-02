import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerStorage } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrismaService } from '../src/prisma/prisma.service';
import { createE2eApp, closeE2eApp } from './e2e-app';

describe('Auth security (full-stack e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let storage: ThrottlerStorageRedisService;
  let tokenA: string;
  let tokenB: string;
  let userBId: string;
  let connectionId: string;
  let fixtureDirectory: string;
  const suffix = randomUUID();
  const emailA = `e2e-security-a-${suffix}@example.com`;
  const emailB = `e2e-security-b-${suffix}@example.com`;
  const password = 'E2eTest!Passw0rd';
  const csrf = { 'x-requested-with': 'XMLHttpRequest' };

  beforeAll(async () => {
    app = await createE2eApp();
    prisma = app.get(PrismaService);
    storage = app.get(ThrottlerStorage);
    const hashed = await bcrypt.hash(password, 4);
    for (const email of [emailA, emailB]) {
      const user = await prisma.user.create({
        data: {
          email,
          password: hashed,
          role: 'user',
          provider: 'local',
          isOnboarded: true,
          isEmailVerified: true,
          language: 'en',
          legalAcceptedAt: new Date(),
          securityAlerts: false,
        },
      });
      if (email === emailB) userBId = user.id;
      const login = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email, password })
        .expect(200);
      const body = login.body.data ?? login.body;
      expect(body.user.id).toBe(user.id);
      expect(typeof body.access_token).toBe('string');
      expect(body.access_token.length).toBeGreaterThan(0);
      if (email === emailA) tokenA = body.access_token;
      else tokenB = body.access_token;
    }
    fixtureDirectory = mkdtempSync(join(tmpdir(), 'data-explorer-security-'));
    const database = join(fixtureDirectory, 'owner-b.sqlite');
    const db = new Database(database);
    try {
      db.exec(
        "CREATE TABLE private_items (name TEXT); INSERT INTO private_items VALUES ('owner-b-only');",
      );
    } finally {
      db.close();
    }
    const created = await request(app.getHttpServer())
      .post('/api/connections')
      .set('Authorization', `Bearer ${tokenB}`)
      .set(csrf)
      .send({
        name: 'Security fixture B',
        type: 'sqlite',
        database,
        allowQueryExecution: true,
      })
      .expect(201);
    connectionId = (created.body.data ?? created.body).id;
    expect(connectionId).toBeTruthy();
  }, 120_000);

  beforeEach(async () => {
    // Clear only limiter keys in the explicit fixture Redis DB; keep jobs/cache intact.
    const keys = (await storage.redis.keys('{*}:*')).filter((key) =>
      /^\{[a-f0-9]{64}:default\}:(hits|blocked)$/.test(key),
    );
    if (keys.length) await storage.redis.del(...keys);
  });

  afterAll(async () => {
    try {
      if (prisma)
        await prisma.user.deleteMany({
          where: { email: { in: [emailA, emailB] } },
        });
    } finally {
      try {
        if (app) await closeE2eApp(app);
      } finally {
        if (fixtureDirectory) rmSync(fixtureDirectory, { recursive: true });
      }
    }
  }, 120_000);

  it('does not load workstation mail, payment or AI credentials', () => {
    const config = app.get(ConfigService);
    for (const key of [
      'MAIL_USER',
      'MAIL_PASS',
      'GEMINI_API_KEY',
      'OPENROUTER_API_KEY',
      'MOMO_SECRET_KEY',
    ]) {
      expect(config.get(key)).toBeUndefined();
    }
  });

  describe('login brute-force protection', () => {
    it('does not reveal whether an email exists (uniform 401)', async () => {
      const responses = await Promise.all(
        [emailA, `missing-${suffix}@example.com`].map((email) =>
          request(app.getHttpServer())
            .post('/api/auth/login')
            .set('Accept-Language', 'en')
            .send({ email, password: 'definitely-wrong' }),
        ),
      );
      expect(responses[0].status).toBe(401);
      expect(responses[1].status).toBe(401);
      expect(responses[0].body.message).toBeDefined();
      expect(responses[0].body.message).toBe(responses[1].body.message);
    });

    it('uses the request language uniformly for missing and existing emails', async () => {
      const responses = await Promise.all(
        [emailA, `missing-vi-${suffix}@example.com`].map((email) =>
          request(app.getHttpServer())
            .post('/api/auth/login')
            .set('Accept-Language', 'vi')
            .send({ email, password: 'definitely-wrong' }),
        ),
      );

      expect(responses[0].status).toBe(401);
      expect(responses[1].status).toBe(401);
      expect(responses[0].body.message).toBe(
        'Thông tin đăng nhập không hợp lệ',
      );
      expect(responses[0].body.message).toBe(responses[1].body.message);
    });

    it('allows five failed attempts then blocks attempts six and seven', async () => {
      const statuses: number[] = [];
      for (let i = 0; i < 7; i++) {
        const res = await request(app.getHttpServer())
          .post('/api/auth/login')
          .send({
            email: `bruteforce-${suffix}@example.com`,
            password: 'wrong-password',
          });
        statuses.push(res.status);
        expect(res.body.message).toBeDefined();
      }
      expect(statuses).toEqual([401, 401, 401, 401, 401, 429, 429]);
    }, 60_000);
  });

  describe('token tampering', () => {
    it('rejects access token with modified signature', async () => {
      expect.assertions(4);
      const valid = await request(app.getHttpServer())
        .get('/api/users/me')
        .set('Authorization', `Bearer ${tokenA}`);
      expect(valid.status).toBe(200);
      const parts = tokenA.split('.');
      expect(parts).toHaveLength(3);
      parts[2] = (parts[2][0] === 'A' ? 'B' : 'A') + parts[2].slice(1);
      const tampered = parts.join('.');
      expect(tampered).not.toBe(tokenA);
      const res = await request(app.getHttpServer())
        .get('/api/users/me')
        .set('Authorization', `Bearer ${tampered}`);
      expect(res.status).toBe(401);
    });

    it('rejects alg=none token (algorithm confusion attack)', async () => {
      const header = Buffer.from(
        JSON.stringify({ alg: 'none', typ: 'JWT' }),
      ).toString('base64url');
      const payload = Buffer.from(
        JSON.stringify({ sub: userBId, role: 'admin' }),
      ).toString('base64url');
      const res = await request(app.getHttpServer())
        .get('/api/users/me')
        .set('Authorization', `Bearer ${header}.${payload}.`);
      expect(res.status).toBe(401);
    });

    it('rejects garbage token', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/users/me')
        .set('Authorization', 'Bearer not-a-jwt-at-all');
      expect(res.status).toBe(401);
    });
  });

  describe('authorization boundaries', () => {
    it('blocks unauthenticated access to query execution at the auth layer', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/query')
        .set(csrf)
        .send({ connectionId, sql: 'SELECT 1', limit: 10, offset: 0 });
      expect(res.status).toBe(401);
    });

    it('blocks unauthenticated access to admin endpoints', async () => {
      const res = await request(app.getHttpServer()).get('/api/users');
      expect(res.status).toBe(401);
    });

    it('does not accept the real connection of another user (ownership check)', async () => {
      expect.assertions(6);
      const persisted = await prisma.connection.findUniqueOrThrow({
        where: { id: connectionId },
      });
      expect(persisted.userId).toBe(userBId);
      const owner = await request(app.getHttpServer())
        .get(`/api/connections/${connectionId}`)
        .set('Authorization', `Bearer ${tokenB}`);
      expect(owner.status).toBe(200);
      const query = await request(app.getHttpServer())
        .post('/api/query')
        .set(csrf)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          connectionId,
          sql: 'SELECT name FROM private_items',
          limit: 10,
          offset: 0,
        });
      expect(query.status).toBe(201);
      expect((query.body.data ?? query.body).rows).toEqual([
        { name: 'owner-b-only' },
      ]);
      const deniedRead = await request(app.getHttpServer())
        .get(`/api/connections/${connectionId}`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect([403, 404]).toContain(deniedRead.status);
      const deniedQuery = await request(app.getHttpServer())
        .post('/api/query')
        .set(csrf)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          connectionId,
          sql: 'SELECT name FROM private_items',
          limit: 10,
          offset: 0,
        });
      expect([403, 404]).toContain(deniedQuery.status);
    });
  });
});
