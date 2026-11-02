import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import request from 'supertest';
import { firstValueFrom, toArray } from 'rxjs';
import { PrismaService } from '../src/prisma/prisma.service';
import { MigrationService } from '../src/migration/migration.service';
import { MigrationController } from '../src/migration/migration.controller';
import { encryptAttribute } from '../src/utils/crypto.util';
import { createE2eApp, closeE2eApp } from './e2e-app';

describe('R05 native migration worker, HTTP ownership and terminal progress', () => {
  const suffix = randomUUID().replace(/-/g, ''),
    source = `r05_source_${suffix}`,
    target = `r05_target_${suffix}`,
    broken = `r05_broken_${suffix}`;
  let app: INestApplication,
    postgres: Pool,
    prisma: PrismaService,
    service: MigrationService,
    queue: Queue;
  let userId: string,
    otherId: string,
    token: string,
    otherToken: string,
    sourceId: string,
    targetId: string;
  const jobs: string[] = [];
  const authorized = (method: 'post' | 'get', path: string, owner = true) =>
    request(app.getHttpServer())
      [method](path)
      .set('x-requested-with', 'XMLHttpRequest')
      .set('Authorization', `Bearer ${owner ? token : otherToken}`);
  const start = async (sourceTable = source) => {
    const response = await authorized('post', '/api/migration/start').send({
      sourceConnectionId: sourceId,
      targetConnectionId: targetId,
      sourceSchema: 'public',
      targetSchema: 'public',
      sourceTable,
      targetTable: target,
    });
    expect(response.status).toBe(201);
    const { jobId } = response.body.data ?? response.body;
    jobs.push(jobId);
    return jobId as string;
  };
  const terminal = async (jobId: string) => {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      const job = await queue.getJob(jobId);
      const state = await job!.getState();
      if (state === 'completed' || state === 'failed')
        return service.getPublicJob(jobId, userId);
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error(
      'R05 migration did not reach a terminal BullMQ state in 15s',
    );
  };
  const checksum = async (table: string) =>
    (
      await postgres.query(
        `SELECT COUNT(*)::int AS count,md5(string_agg(id::text||':'||note,',' ORDER BY id)) AS checksum FROM ${table}`,
      )
    ).rows[0];
  beforeAll(async () => {
    app = await createE2eApp();
    prisma = app.get(PrismaService);
    service = app.get(MigrationService);
    queue = app.get(getQueueToken('migration'));
    const user = await prisma.user.create({
      data: {
        email: `r05-${suffix}@example.com`,
        isEmailVerified: true,
        isOnboarded: true,
        securityAlerts: false,
      },
    });
    userId = user.id;
    const other = await prisma.user.create({
      data: {
        email: `r05-other-${suffix}@example.com`,
        isEmailVerified: true,
        isOnboarded: true,
        securityAlerts: false,
      },
    });
    otherId = other.id;
    token = app
      .get(JwtService)
      .sign({ sub: userId, email: user.email, role: 'user', type: 'access' });
    otherToken = app
      .get(JwtService)
      .sign({ sub: otherId, email: other.email, role: 'user', type: 'access' });
    const config = {
      type: 'postgres',
      host: '127.0.0.1',
      port: 15432,
      username: 'e2e',
      password: encryptAttribute('e2e-local-only'),
      database: 'data_explorer_e2e',
      userId,
      readOnly: false,
      allowQueryExecution: true,
    };
    sourceId = (
      await prisma.connection.create({
        data: { ...config, name: 'R05 source' },
      })
    ).id;
    targetId = (
      await prisma.connection.create({
        data: { ...config, name: 'R05 target' },
      })
    ).id;
    postgres = new Pool({ connectionString: process.env.E2E_DATABASE_URL });
    await postgres.query(
      `CREATE TABLE ${source}(id INTEGER PRIMARY KEY,note TEXT); CREATE TABLE ${target}(id INTEGER,note TEXT); CREATE VIEW ${broken} AS SELECT id,(1/(id-2))::text AS note FROM ${source}`,
    );
  }, 120000);
  beforeEach(async () => {
    await postgres.query(
      `ALTER TABLE ${target} DROP CONSTRAINT IF EXISTS reject_note; DELETE FROM ${source}; DELETE FROM ${target}; INSERT INTO ${source} SELECT n,'row-'||n FROM generate_series(1,5)n`,
    );
  });
  afterAll(async () => {
    try {
      for (const id of jobs) {
        const job = await queue?.getJob(id);
        if (job) await job.remove();
      }
      await postgres?.query(
        `DROP VIEW IF EXISTS ${broken}; DROP TABLE IF EXISTS ${source}; DROP TABLE IF EXISTS ${target}`,
      );
      if (userId) await prisma.user.delete({ where: { id: userId } });
      if (otherId) await prisma.user.delete({ where: { id: otherId } });
    } finally {
      await Promise.all([
        app ? closeE2eApp(app) : Promise.resolve(),
        postgres?.end(),
      ]);
    }
  }, 120000);
  it.each([5, 4505])(
    'copies %i rows with exact checksum and final native queue progress',
    async (count) => {
      if (count !== 5)
        await postgres.query(
          `DELETE FROM ${source}; INSERT INTO ${source} SELECT n,'row-'||n FROM generate_series(1,${count})n`,
        );
      const jobId = await start(),
        job = await terminal(jobId);
      expect(job).toMatchObject({
        status: 'completed',
        stage: 'completed',
        processedRows: count,
        batchesProcessed: Math.ceil(count / 2000),
      });
      expect(await checksum(target)).toEqual(await checksum(source));
      const ticketResponse = await authorized(
        'post',
        `/api/migration/progress-ticket/${jobId}`,
      ).send({});
      expect(ticketResponse.status).toBe(201);
      const { ticket } = ticketResponse.body.data ?? ticketResponse.body;
      const updates = await firstValueFrom(
        app.get(MigrationController).progress(jobId, ticket).pipe(toArray()),
      );
      expect(updates).toHaveLength(1);
      expect(updates[0].data).toMatchObject({
        status: 'completed',
        processedRows: count,
      });
      expect(service.eventEmitter.listenerCount(`migration-${jobId}`)).toBe(0);
    },
    30000,
  );
  it('turns a native source stream error into failed, and keeps HTTP alive', async () => {
    const jobId = await start(broken),
      job = await terminal(jobId);
    expect(job).toMatchObject({
      status: 'failed',
      stage: 'failed',
      processedRows: 0,
    });
    expect(job.error).toMatch(/division by zero/i);
    expect((await checksum(target)).count).toBe(0);
    expect((await authorized('get', '/api/health/live')).status).toBe(200);
  }, 30000);
  it('turns a target constraint failure into a failed worker without reporting partial success', async () => {
    await postgres.query(
      `ALTER TABLE ${target} ADD CONSTRAINT reject_note CHECK(note<>'row-2')`,
    );
    const jobId = await start(),
      job = await terminal(jobId);
    expect(job).toMatchObject({
      status: 'failed',
      stage: 'failed',
      processedRows: 0,
      batchesProcessed: 0,
    });
    expect(job.error).toMatch(/check constraint/i);
    expect((await checksum(target)).count).toBe(0);
    expect((await authorized('get', '/api/health/live')).status).toBe(200);
  }, 30000);
  it('preserves job ownership and refuses queue retry after a completed append', async () => {
    const jobId = await start();
    await terminal(jobId);
    expect(
      (
        await authorized(
          'post',
          `/api/migration/progress-ticket/${jobId}`,
          false,
        ).send({})
      ).status,
    ).toBe(403);
    await expect(service.getPublicJob(jobId, otherId)).rejects.toMatchObject({
      status: 403,
    });
    const job = await queue.getJob(jobId);
    await job!.retry('completed');
    const replay = await terminal(jobId);
    expect(replay.status).toBe('failed');
    expect(replay.error).toMatch(/restarted safely/i);
    expect(await checksum(target)).toEqual(await checksum(source));
  }, 30000);
});
