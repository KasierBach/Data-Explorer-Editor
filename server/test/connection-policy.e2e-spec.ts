import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import Database from 'better-sqlite3';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { FreshnessService } from '../src/common/freshness/freshness.service';
import { createE2eApp, closeE2eApp } from './e2e-app';

describe('R01 connection policy (full-stack e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let directory: string;
  let database: string;
  let orgId: string;
  let connectionId: string;
  let memberId: string;
  const tokens: Record<string, string> = {};
  const suffix = randomUUID();
  const emails = ['owner', 'member', 'outsider'].map(
    (name) => `r01-${name}-${suffix}@example.com`,
  );
  const csrf = { 'x-requested-with': 'XMLHttpRequest' };
  const post = (url: string, user: string, body: object) =>
    request(app.getHttpServer())
      .post(url)
      .set(csrf)
      .set('Authorization', `Bearer ${tokens[user]}`)
      .send(body);

  beforeAll(async () => {
    app = await createE2eApp();
    prisma = app.get(PrismaService);
    const users = [] as { id: string; email: string }[];
    for (let i = 0; i < emails.length; i++) {
      const user = await prisma.user.create({
        data: {
          email: emails[i],
          role: 'user',
          isEmailVerified: true,
          isOnboarded: true,
          securityAlerts: false,
        },
      });
      users.push(user);
      tokens[['owner', 'member', 'outsider'][i]] = app.get(JwtService).sign({
        sub: user.id,
        email: user.email,
        role: 'user',
        type: 'access',
      });
    }
    memberId = users[1].id;
    const org = await prisma.organization.create({
      data: {
        name: 'R01 synthetic',
        slug: `r01-${suffix}`,
        members: {
          create: [
            { userId: users[0].id, role: 'OWNER' },
            { userId: memberId, role: 'MEMBER' },
          ],
        },
      },
    });
    orgId = org.id;
    directory = mkdtempSync(join(tmpdir(), 'r01-policy-'));
    database = join(directory, 'policy.sqlite');
    const db = new Database(database);
    try {
      db.exec(
        "CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT); INSERT INTO items VALUES (1, 'private');",
      );
    } finally {
      db.close();
    }
    const connection = await prisma.connection.create({
      data: {
        name: 'R01 synthetic',
        type: 'sqlite',
        database,
        userId: users[0].id,
        organizationId: orgId,
        allowedDatabases: [database],
        roleQueryModes: { MEMBER: 'readonly' },
        allowQueryExecution: true,
        allowSchemaChanges: true,
        allowImportExport: true,
      },
    });
    connectionId = connection.id;
  }, 120_000);

  afterAll(async () => {
    try {
      if (orgId) await prisma.organization.delete({ where: { id: orgId } });
      if (prisma)
        await prisma.user.deleteMany({ where: { email: { in: emails } } });
    } finally {
      try {
        if (app) await closeE2eApp(app);
      } finally {
        if (directory) rmSync(directory, { recursive: true });
      }
    }
  }, 120_000);

  it('permits the owner and readonly member to read actual SQLite rows', async () => {
    for (const user of ['owner', 'member']) {
      const res = await post('/api/query', user, {
        connectionId,
        sql: 'SELECT * FROM items',
        limit: 10,
      });
      expect(res.status).toBe(201);
      expect((res.body.data ?? res.body).rows).toEqual([
        { id: 1, name: 'private' },
      ]);
    }
  });

  it('denies outsider metadata with both cold and owner-warmed cache (K01)', async () => {
    const url = `/api/metadata/databases?connectionId=${connectionId}`;
    const cold = await request(app.getHttpServer())
      .get(url)
      .set('Authorization', `Bearer ${tokens.outsider}`);
    expect([403, 404]).toContain(cold.status);
    await request(app.getHttpServer())
      .get(url)
      .set('Authorization', `Bearer ${tokens.owner}`)
      .expect(200);
    const warm = await request(app.getHttpServer())
      .get(url)
      .set('Authorization', `Bearer ${tokens.outsider}`);
    expect([403, 404]).toContain(warm.status);
  });

  it('denies sample cache reads and refresh without touching the cached evidence (K02)', async () => {
    // Synthetic cached sample; no Mongo driver/provider is used in this negative-path check.
    const key = `nosql_schema:${connectionId}:fixture:users`;
    await app.get(RedisService).set(key, [{ sampleValues: ['private'] }], 60);
    for (const refresh of [false, true]) {
      const res = await post('/api/nosql/analyze-schema', 'outsider', {
        connectionId,
        database: 'fixture',
        collection: 'users',
        refresh,
      });
      expect([403, 404]).toContain(res.status);
      expect(await app.get(RedisService).get(key)).toEqual([
        { sampleValues: ['private'] },
      ]);
    }
  });

  it.each(['POST', 'PATCH', 'DELETE'])(
    'denies %s row mutation for readonly role and preserves DB (T03)',
    async (method) => {
      const body = {
        connectionId,
        schema: 'main',
        table: 'items',
        ...(method === 'POST'
          ? { data: { id: 2, name: 'forbidden' } }
          : method === 'PATCH'
            ? { pkColumn: 'id', pkValue: 1, updates: { name: 'forbidden' } }
            : { pkColumn: 'id', pkValues: [1] }),
      };
      const req = request(app.getHttpServer());
      const res = await (
        method === 'POST'
          ? req.post('/api/query/row')
          : method === 'PATCH'
            ? req.patch('/api/query/row')
            : req.post('/api/query/delete-rows')
      )
        .set(csrf)
        .set('Authorization', `Bearer ${tokens.member}`)
        .send(body);
      expect(res.status).toBe(403);
      const db = new Database(database);
      try {
        expect(db.prepare('SELECT * FROM items').all()).toEqual([
          { id: 1, name: 'private' },
        ]);
      } finally {
        db.close();
      }
    },
  );

  it('denies database override for raw query and table-window on the warm connection (T05)', async () => {
    for (const endpoint of ['/api/query', '/api/query/table-window']) {
      const res = await post(endpoint, 'member', {
        connectionId,
        database: 'forbidden',
        ...(endpoint.endsWith('table-window')
          ? { schema: 'main', table: 'items' }
          : { sql: 'SELECT * FROM items', limit: 10 }),
      });
      expect(res.status).toBe(403);
    }
  });

  it('denies schema/import/seed writes for readonly members', async () => {
    for (const [url, body] of [
      ['/api/query/schema', { schema: 'main', table: 'items', operations: [] }],
      [
        '/api/query/import',
        {
          schema: 'main',
          table: 'items',
          data: [{ id: 2, name: 'forbidden' }],
        },
      ],
      ['/api/query/seed', {}],
    ] as const) {
      const res = url.endsWith('schema')
        ? await request(app.getHttpServer())
            .post(url)
            .set(csrf)
            .set('Authorization', `Bearer ${tokens.member}`)
            .send({ connectionId, ...body })
        : await post(url, 'member', { connectionId, ...body });
      expect(res.status).toBe(403);
    }
  });

  it('preserves owner writes and permits full team roles without changing readonly policy for other roles', async () => {
    await prisma.connection.update({
      where: { id: connectionId },
      data: { roleQueryModes: { MEMBER: 'full' } },
    });
    try {
      for (const [index, user] of ['owner', 'member'].entries()) {
        const res = await post('/api/query/row', user, {
          connectionId,
          schema: 'main',
          table: 'items',
          data: { id: index + 2, name: user },
        });
        expect(res.status).toBe(201);
      }
      const db = new Database(database);
      try {
        expect(db.prepare('SELECT COUNT(*) AS n FROM items').get()).toEqual({
          n: 3,
        });
      } finally {
        db.close();
      }
    } finally {
      await prisma.connection.update({
        where: { id: connectionId },
        data: { roleQueryModes: { MEMBER: 'readonly' } },
      });
      const db = new Database(database);
      try {
        db.exec('DELETE FROM items WHERE id > 1');
      } finally {
        db.close();
      }
    }
  });

  it('rechecks resource policy and membership before serving an already-warm cache with the same JWT', async () => {
    const url = `/api/metadata/databases?connectionId=${connectionId}`;
    await request(app.getHttpServer())
      .get(url)
      .set('Authorization', `Bearer ${tokens.owner}`)
      .expect(200);
    await request(app.getHttpServer())
      .get(url)
      .set('Authorization', `Bearer ${tokens.member}`)
      .expect(200);
    const key = await app
      .get(FreshnessService)
      .buildKey('databases', [connectionId], ['default']);
    expect(await app.get<Cache>(CACHE_MANAGER).get(key)).toBeDefined();
    await prisma.organizationResource.create({
      data: {
        organizationId: orgId,
        resourceType: 'CONNECTION',
        resourceId: connectionId,
        permissions: {
          OWNER: ['read', 'write', 'manage', 'delete', 'comment', 'share'],
          ADMIN: ['read', 'write'],
          MEMBER: [],
          VIEWER: [],
        },
      },
    });
    const denied = await request(app.getHttpServer())
      .get(url)
      .set('Authorization', `Bearer ${tokens.member}`);
    expect(denied.status).toBe(403);
    await prisma.organizationResource.deleteMany({
      where: { organizationId: orgId },
    });
    await prisma.organizationMember.delete({
      where: {
        organizationId_userId: { organizationId: orgId, userId: memberId },
      },
    });
    const revoked = await request(app.getHttpServer())
      .get(url)
      .set('Authorization', `Bearer ${tokens.member}`);
    expect([403, 404]).toContain(revoked.status);
  });
});
