import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getQueueToken } from '@nestjs/bullmq';
import {
  createPool as createMysqlPool,
  type RowDataPacket,
} from 'mysql2/promise';
import { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import request from 'supertest';
import { firstValueFrom, toArray } from 'rxjs';
import { PrismaService } from '../src/prisma/prisma.service';
import { MigrationService } from '../src/migration/migration.service';
import { MigrationController } from '../src/migration/migration.controller';
import { DatabaseStrategyFactory } from '../src/database-strategies';
import { FreshnessService } from '../src/common/freshness/freshness.service';
import { PermissionsService } from '../src/permissions/services/permissions.service';
import { Permission } from '../src/permissions/enums/permission.enum';
import { ResourceType } from '../src/permissions/enums/resource-type.enum';
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
    targetId: string,
    organizationId: string;
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
    const organization = await prisma.organization.create({
      data: {
        name: `R05 migration policy ${suffix}`,
        slug: `r05-migration-${suffix}`,
        members: {
          create: [
            { userId, role: 'OWNER' },
            { userId: otherId, role: 'MEMBER' },
          ],
        },
      },
    });
    organizationId = organization.id;
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
    const policy = app.get(PermissionsService).buildDefaultResourcePolicy();
    await prisma.organizationMember.upsert({
      where: { organizationId_userId: { organizationId, userId: otherId } },
      create: { organizationId, userId: otherId, role: 'MEMBER' },
      update: { role: 'MEMBER' },
    });
    for (const resourceId of [sourceId, targetId]) {
      await prisma.connection.update({
        where: { id: resourceId },
        data: {
          organizationId,
          readOnly: false,
          allowImportExport: true,
          allowedDatabases: ['data_explorer_e2e'],
          roleQueryModes: { MEMBER: 'full' },
        },
      });
      await prisma.organizationResource.upsert({
        where: {
          resourceType_resourceId_organizationId: {
            resourceType: ResourceType.CONNECTION,
            resourceId,
            organizationId,
          },
        },
        create: {
          resourceType: ResourceType.CONNECTION,
          resourceId,
          organizationId,
          permissions: policy,
        },
        update: { permissions: policy },
      });
    }
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
      if (organizationId)
        await prisma.organization.delete({ where: { id: organizationId } });
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
  it.each([
    'membership',
    'resource',
    'source-flag',
    'target-flag',
    'readOnly',
    'source-role',
    'target-role',
    'database',
  ])(
    'enforces current %s policy at native enqueue, preview and queued worker entry',
    async (denial) => {
      const dto = {
        sourceConnectionId: sourceId,
        targetConnectionId: targetId,
        sourceSchema: 'public',
        targetSchema: 'public',
        sourceTable: source,
        targetTable: target,
      };
      await queue.pause();
      let queuedId: string;
      try {
        const queued = await authorized(
          'post',
          '/api/migration/start',
          false,
        ).send(dto);
        expect(queued.status).toBe(201);
        queuedId = (queued.body.data ?? queued.body).jobId;
        jobs.push(queuedId);
        const waiting = await queue.getJob(queuedId);
        expect(waiting!.data.dto).toEqual(dto);

        if (denial === 'membership') {
          await prisma.organizationMember.delete({
            where: {
              organizationId_userId: { organizationId, userId: otherId },
            },
          });
        } else if (denial === 'resource') {
          const policy = app
            .get(PermissionsService)
            .buildDefaultResourcePolicy();
          policy.MEMBER = [Permission.READ];
          await prisma.organizationResource.update({
            where: {
              resourceType_resourceId_organizationId: {
                resourceType: ResourceType.CONNECTION,
                resourceId: targetId,
                organizationId,
              },
            },
            data: { permissions: policy },
          });
        } else {
          const sourceDenied = denial.startsWith('source');
          await prisma.connection.update({
            where: { id: sourceDenied ? sourceId : targetId },
            data: denial.endsWith('flag')
              ? { allowImportExport: false }
              : denial === 'readOnly'
                ? { readOnly: true }
                : denial.endsWith('role')
                  ? {
                      roleQueryModes: {
                        MEMBER: sourceDenied ? 'blocked' : 'readonly',
                      },
                    }
                  : { allowedDatabases: ['not_the_fixture_database'] },
          });
        }
        for (const endpoint of ['start', 'preview']) {
          const denied = await authorized(
            'post',
            `/api/migration/${endpoint}`,
            false,
          ).send(dto);
          expect(denied.status).toBe(denial === 'membership' ? 404 : 403);
        }
      } finally {
        await queue.resume();
      }
      const deadline = Date.now() + 15000;
      while (Date.now() < deadline) {
        const queued = await queue.getJob(queuedId!);
        if ((await queued!.getState()) === 'failed') break;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      const failed = await service.getPublicJob(queuedId!, otherId);
      expect(failed).toMatchObject({
        status: 'failed',
        stage: 'failed',
        processedRows: 0,
      });
      expect((await checksum(target)).count).toBe(0);
    },
    30000,
  );

  it('denies a native worker write when policy is revoked during metadata', async () => {
    const strategy = app.get(DatabaseStrategyFactory).getStrategy('postgres');
    const getFullMetadata = strategy.getFullMetadata.bind(strategy);
    const read = jest
      .spyOn(strategy, 'getFullMetadata')
      .mockImplementation(async (...args) => {
        const metadata = await getFullMetadata(...args);
        if (args[2] === target) {
          await prisma.connection.update({
            where: { id: targetId },
            data: { allowImportExport: false },
          });
        }
        return metadata;
      });
    try {
      const jobId = await start();
      const result = await terminal(jobId);
      expect(result).toMatchObject({
        status: 'failed',
        stage: 'failed',
        processedRows: 0,
      });
      expect(result.error).toMatch(/disabled/i);
      expect((await checksum(target)).count).toBe(0);
    } finally {
      read.mockRestore();
    }
  }, 30000);

  it('uses the selected MySQL schema database and refreshes its warm target scope', async () => {
    // This maintained native regression uses only the existing synthetic loopback fixture.
    const database = 'data_explorer_r03';
    const sourceTable = `r05_mysql_src_${suffix}`,
      targetTable = `r05_mysql_tgt_${suffix}`;
    const mysql = createMysqlPool({
      host: '127.0.0.1',
      port: 13306,
      user: 'e2e',
      password: 'r03-local-only',
      database,
    });
    const connectionIds: string[] = [];
    const strategy = app.get(DatabaseStrategyFactory).getStrategy('mysql');
    const pools = jest.spyOn(strategy, 'createPool');
    let trackedJobId: string | undefined;
    try {
      await mysql.query(`CREATE TABLE ${sourceTable}(id INTEGER,note TEXT);`);
      await mysql.query(`CREATE TABLE ${targetTable}(id INTEGER,note TEXT);`);
      await mysql.query(
        `INSERT INTO ${sourceTable} VALUES (1,'one'),(2,'two')`,
      );
      for (const name of ['source', 'target']) {
        const connection = await prisma.connection.create({
          data: {
            userId,
            organizationId,
            name: `R05 MySQL ${name} ${suffix}`,
            type: 'mysql',
            host: '127.0.0.1',
            port: 13306,
            username: 'e2e',
            password: encryptAttribute('r03-local-only'),
            database: 'r05_unselected_database',
            allowedDatabases: [database],
            readOnly: false,
            allowImportExport: true,
            roleQueryModes: { MEMBER: 'full' },
          },
        });
        connectionIds.push(connection.id);
      }
      const freshness = app.get(FreshnessService);
      const scope = [connectionIds[1], database];
      const warm = await freshness.buildKey('query', scope, [
        'R05 native target count',
      ]);
      const otherScope = await freshness.buildKey(
        'query',
        [connectionIds[1], 'r05_unselected_database'],
        ['R05 native target count'],
      );
      const response = await authorized(
        'post',
        '/api/migration/start',
        false,
      ).send({
        sourceConnectionId: connectionIds[0],
        targetConnectionId: connectionIds[1],
        sourceSchema: ` ${database} `,
        targetSchema: ` ${database} `,
        sourceTable: ` ${sourceTable} `,
        targetTable: ` ${targetTable} `,
      });
      expect(response.status).toBe(201);
      trackedJobId = (response.body.data ?? response.body).jobId;
      jobs.push(trackedJobId!);
      const deadline = Date.now() + 15000;
      while (Date.now() < deadline) {
        const job = await queue.getJob(trackedJobId!);
        if (['completed', 'failed'].includes(await job!.getState())) break;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      const result = await service.getPublicJob(trackedJobId!, otherId);
      expect(result).toMatchObject({ status: 'completed', processedRows: 2 });
      const [rows] = await mysql.query<RowDataPacket[]>(
        `SELECT id,note FROM ${targetTable} ORDER BY id`,
      );
      expect(rows).toEqual([
        { id: 1, note: 'one' },
        { id: 2, note: 'two' },
      ]);
      expect(
        await freshness.buildKey('query', scope, ['R05 native target count']),
      ).not.toBe(warm);
      expect(
        await freshness.buildKey(
          'query',
          [connectionIds[1], 'r05_unselected_database'],
          ['R05 native target count'],
        ),
      ).toBe(otherScope);
      expect(pools).toHaveBeenCalledTimes(2);
      for (const [config] of pools.mock.calls) {
        expect(config.database).toBe(database);
      }
    } finally {
      pools.mockRestore();
      if (trackedJobId) await (await queue.getJob(trackedJobId))?.remove();
      await Promise.all([
        mysql.query(`DROP TABLE IF EXISTS ${sourceTable},${targetTable}`),
        prisma.connection.deleteMany({ where: { id: { in: connectionIds } } }),
      ]);
      await mysql.end();
    }
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
