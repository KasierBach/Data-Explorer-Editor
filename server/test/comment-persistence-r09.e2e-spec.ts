import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { Agent } from 'node:http';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { DataRetentionService } from '../src/maintenance/data-retention.service';
import { PermissionsService } from '../src/permissions/services/permissions.service';
import { Permission } from '../src/permissions/enums/permission.enum';
import { createE2eApp, closeE2eApp } from './e2e-app';

describe('R09 durable comments with real PostgreSQL and HTTP permissions', () => {
  const suffix = randomUUID().replace(/-/g, '');
  const agent = new Agent({ localAddress: '127.0.0.10' });
  let app: INestApplication, prisma: PrismaService;
  let organizationId: string, ownerId: string, memberId: string;
  let firstResource: string, targetResource: string;
  const tokens: Record<string, string> = {};
  const body = (response: request.Response) =>
    response.body.data ?? response.body;
  const api = (
    method: 'get' | 'post' | 'patch' | 'delete',
    route: string,
    actor = 'owner',
  ) =>
    request(app.getHttpServer())
      [method](route)
      .agent(agent)
      .set('x-requested-with', 'XMLHttpRequest')
      .set('Authorization', `Bearer ${tokens[actor]}`);
  const resourceRoute = () =>
    `/api/collaboration/organizations/${organizationId}/resources/CONNECTION/${targetResource}/comments`;
  const commentRoute = (id: string) =>
    `/api/collaboration/organizations/${organizationId}/comments/${id}`;
  const create = async (text = 'Pinned discussion') =>
    body(await api('post', resourceRoute()).send({ body: text }).expect(201));
  const list = async () => body(await api('get', resourceRoute()).expect(200));

  beforeAll(async () => {
    app = await createE2eApp();
    prisma = app.get(PrismaService);
    for (const actor of ['owner', 'member']) {
      const user = await prisma.user.create({
        data: {
          email: `r09-${actor}-${suffix}@example.test`,
          username: `r09_${actor}_${suffix}`,
          isEmailVerified: true,
          isOnboarded: true,
          securityAlerts: false,
        },
      });
      if (actor === 'owner') ownerId = user.id;
      else memberId = user.id;
      tokens[actor] = app.get(JwtService).sign({
        sub: user.id,
        email: user.email,
        role: 'user',
        type: 'access',
      });
    }
    organizationId = (
      await prisma.organization.create({
        data: {
          name: 'R09 synthetic',
          slug: `r09-${suffix}`,
          members: {
            create: [
              { userId: ownerId, role: 'OWNER' },
              { userId: memberId, role: 'MEMBER' },
            ],
          },
        },
      })
    ).id;
    const resources: string[] = [];
    for (const name of ['first', 'target'])
      resources.push(
        (
          await prisma.connection.create({
            data: {
              name: `R09 ${name}`,
              type: 'sqlite',
              database: ':memory:',
              userId: ownerId,
              organizationId,
            },
          })
        ).id,
      );
    [firstResource, targetResource] = resources;
  });
  beforeEach(async () => {
    await prisma.auditLog.deleteMany({ where: { organizationId } });
    await prisma.commentEvent.deleteMany({ where: { organizationId } });
    await prisma.organizationResource.deleteMany({ where: { organizationId } });
  });
  afterAll(async () => {
    try {
      if (organizationId)
        await prisma.organization.delete({ where: { id: organizationId } });
      await prisma.user.deleteMany({
        where: { id: { in: [ownerId, memberId].filter(Boolean) } },
      });
    } finally {
      if (app) await closeE2eApp(app);
      agent.destroy();
    }
  });

  it('returns the target comment and latest edit beyond 500 other-resource comment events', async () => {
    await prisma.auditLog.createMany({
      data: Array.from({ length: 501 }, (_, i) => {
        const commentId = randomUUID();
        return {
          action: 'TEAM:COMMENT_CREATE',
          organizationId,
          userId: ownerId,
          createdAt: new Date(Date.now() - 10000 + i),
          details: JSON.stringify({
            commentId,
            threadId: commentId,
            parentCommentId: null,
            resourceType: 'CONNECTION',
            resourceId: firstResource,
            body: 'Other resource',
            mentions: [],
          }),
        };
      }),
    });
    const thread = await create();
    await api('patch', commentRoute(thread.commentId))
      .send({ body: 'Edited target' })
      .expect(200);
    const threads = await list();
    expect(threads).toHaveLength(1);
    expect(threads[0]).toMatchObject({
      commentId: thread.commentId,
      body: 'Edited target',
    });
  });

  it('keeps the thread, edited reply, mention, reaction and resolution after audit retention cleanup', async () => {
    const thread = await create(`Pinned @r09_member_${suffix}`);
    expect(thread.mentions.map((x: { id: string }) => x.id)).toEqual([
      memberId,
    ]);
    const replied = body(
      await api('post', commentRoute(thread.commentId) + '/replies', 'member')
        .send({ body: 'A durable reply' })
        .expect(201),
    );
    const replyId = replied.replies[0].commentId;
    await api('patch', commentRoute(replyId), 'member')
      .send({ body: 'Edited reply' })
      .expect(200);
    await api('post', commentRoute(replyId) + '/reactions')
      .send({ emoji: '👍' })
      .expect(201);
    await api('post', commentRoute(thread.commentId) + '/resolve').expect(201);
    await prisma.auditLog.updateMany({
      where: { organizationId },
      data: { createdAt: new Date(Date.now() - 400 * 86400000) },
    });
    const cleanup = new DataRetentionService(
      prisma,
      new ConfigService({
        AUDIT_RETENTION_DAYS: 365,
        PAYMENT_PAYLOAD_RETENTION_DAYS: 0,
      }),
    );
    expect((await cleanup.runCleanup()).auditLogs).toBeGreaterThan(0);
    expect(await prisma.auditLog.count({ where: { organizationId } })).toBe(0);
    await closeE2eApp(app);
    app = await createE2eApp();
    prisma = app.get(PrismaService);
    const threads = await list();
    expect(threads).toHaveLength(1);
    expect(threads[0].commentId).toBe(thread.commentId);
    expect(threads[0].resolvedAt).not.toBeNull();
    expect(threads[0].mentions.map((x: { id: string }) => x.id)).toEqual([
      memberId,
    ]);
    expect(threads[0].replies[0]).toMatchObject({
      commentId: replyId,
      body: 'Edited reply',
    });
    expect(threads[0].replies[0].reactions[0]).toMatchObject({
      emoji: '👍',
      count: 1,
      userIds: [ownerId],
    });
  });

  it('keeps nested replies in the root thread and rejects a parent from another resource', async () => {
    const root = await create();
    const reply = body(
      await api('post', commentRoute(root.commentId) + '/replies', 'member')
        .send({ body: 'First reply' })
        .expect(201),
    ).replies[0];
    const nested = body(
      await api('post', commentRoute(reply.commentId) + '/replies')
        .send({ body: 'Nested reply' })
        .expect(201),
    );
    expect(nested.threadId).toBe(root.commentId);
    expect(nested.replies).toHaveLength(2);
    expect(nested.replies[1]).toMatchObject({
      threadId: root.commentId,
      parentCommentId: reply.commentId,
    });
    await api('post', resourceRoute().replace(targetResource, firstResource))
      .send({ body: 'Wrong parent', parentCommentId: reply.commentId })
      .expect(400);
    expect(await prisma.commentEvent.count({ where: { organizationId } })).toBe(
      3,
    );
  });

  it('keeps author-only editing and author/admin deletion, clearing deleted payloads and reactions', async () => {
    const attachment = 'data:text/plain;base64,aGVsbG8=';
    const root = body(
      await api('post', resourceRoute(), 'member')
        .send({
          body: `Member @r09_owner_${suffix}`,
          attachments: [attachment],
        })
        .expect(201),
    );
    await api('patch', commentRoute(root.commentId))
      .send({ body: 'Admin edit' })
      .expect(403);
    await api('patch', commentRoute(root.commentId), 'member')
      .send({ body: 'Author edit' })
      .expect(200);
    const reply = body(
      await api('post', commentRoute(root.commentId) + '/replies')
        .send({ body: 'Preserved reply' })
        .expect(201),
    ).replies[0];
    await api('delete', commentRoute(reply.commentId), 'member').expect(403);
    await api('post', commentRoute(root.commentId) + '/reactions')
      .send({ emoji: '👍' })
      .expect(201);
    await api('delete', commentRoute(root.commentId)).expect(204);
    const deleted = (await list())[0];
    expect(deleted).toMatchObject({ deleted: true, body: '', mentions: [] });
    expect(deleted.attachments).toBeUndefined();
    expect(deleted.reactions).toBeUndefined();
    expect(deleted.replies[0].commentId).toBe(reply.commentId);
    expect(
      await prisma.commentReaction.count({
        where: { commentId: root.commentId },
      }),
    ).toBe(0);
    await api('patch', commentRoute(root.commentId), 'member')
      .send({ body: 'Resurrect' })
      .expect(400);
    await api('post', commentRoute(root.commentId) + '/reactions')
      .send({ emoji: '👍' })
      .expect(400);
    await api('delete', commentRoute(reply.commentId)).expect(204);
  });

  it.each(['resource policy', 'membership'])(
    'denies read and every mutation after revoked %s with the same JWT',
    async (mode) => {
      const root = body(
        await api('post', resourceRoute(), 'member')
          .send({ body: 'Member owned comment' })
          .expect(201),
      );
      const before = await prisma.commentEvent.count({
        where: { organizationId },
      });
      try {
        if (mode === 'membership') {
          await prisma.organizationMember.delete({
            where: {
              organizationId_userId: { organizationId, userId: memberId },
            },
          });
        } else {
          const permissions = app
            .get(PermissionsService)
            .buildDefaultResourcePolicy();
          permissions.MEMBER = [];
          await prisma.organizationResource.create({
            data: {
              organizationId,
              resourceType: 'CONNECTION',
              resourceId: targetResource,
              permissions,
            },
          });
        }
        await api('get', resourceRoute(), 'member').expect(403);
        await api('post', resourceRoute(), 'member')
          .send({ body: 'Denied create' })
          .expect(403);
        await api('post', commentRoute(root.commentId) + '/replies', 'member')
          .send({ body: 'Denied reply' })
          .expect(403);
        await api('patch', commentRoute(root.commentId), 'member')
          .send({ body: 'Denied edit' })
          .expect(403);
        await api('delete', commentRoute(root.commentId), 'member').expect(403);
        await api(
          'post',
          commentRoute(root.commentId) + '/resolve',
          'member',
        ).expect(403);
        await api('post', commentRoute(root.commentId) + '/reactions', 'member')
          .send({ emoji: '👍' })
          .expect(403);
        expect(
          await prisma.commentEvent.count({ where: { organizationId } }),
        ).toBe(before);
        expect(
          await prisma.commentReaction.count({
            where: { commentId: root.commentId },
          }),
        ).toBe(0);
      } finally {
        if (mode === 'membership')
          await prisma.organizationMember.create({
            data: { organizationId, userId: memberId, role: 'MEMBER' },
          });
      }
    },
  );

  it('permits READ after COMMENT revocation but denies edit, reply, delete and reaction', async () => {
    const root = body(
      await api('post', resourceRoute(), 'member')
        .send({ body: 'Member comment' })
        .expect(201),
    );
    const permissions = app
      .get(PermissionsService)
      .buildDefaultResourcePolicy();
    permissions.MEMBER = [Permission.READ];
    await prisma.organizationResource.create({
      data: {
        organizationId,
        resourceType: 'CONNECTION',
        resourceId: targetResource,
        permissions,
      },
    });
    await api('get', resourceRoute(), 'member').expect(200);
    await api('patch', commentRoute(root.commentId), 'member')
      .send({ body: 'Denied edit' })
      .expect(403);
    await api('post', commentRoute(root.commentId) + '/replies', 'member')
      .send({ body: 'Denied reply' })
      .expect(403);
    await api('delete', commentRoute(root.commentId), 'member').expect(403);
    await api('post', commentRoute(root.commentId) + '/reactions', 'member')
      .send({ emoji: '👍' })
      .expect(403);
    // Resolving one's own thread only requires READ in the existing contract.
    await api(
      'post',
      commentRoute(root.commentId) + '/resolve',
      'member',
    ).expect(201);
  });

  it('rejects missing comments and wrong-organization references without inserting reactions or replies', async () => {
    const root = await create();
    await api('post', commentRoute(randomUUID()) + '/reactions')
      .send({ emoji: '👍' })
      .expect(404);
    const other = await prisma.organization.create({
      data: {
        name: 'R09 other',
        slug: `r09-other-${suffix}`,
        members: { create: { userId: ownerId, role: 'OWNER' } },
      },
    });
    try {
      await api(
        'post',
        commentRoute(root.commentId).replace(organizationId, other.id) +
          '/reactions',
      )
        .send({ emoji: '👍' })
        .expect(404);
      await api('post', resourceRoute().replace(organizationId, other.id))
        .send({ body: 'Wrong org' })
        .expect(404);
      await api('post', resourceRoute().replace(organizationId, other.id))
        .send({ body: 'Wrong parent', parentCommentId: root.commentId })
        .expect(404);
      expect(
        await prisma.commentReaction.count({
          where: { commentId: root.commentId },
        }),
      ).toBe(0);
      expect(
        await prisma.commentEvent.count({ where: { organizationId } }),
      ).toBe(1);
    } finally {
      await prisma.organization.delete({ where: { id: other.id } });
    }
  });

  it('commits durable state when the audit table rejects writes and rolls back durable failure with no audit success', async () => {
    // Native PostgreSQL triggers inject storage faults only for this owned cohort.
    await prisma.$executeRawUnsafe(
      `CREATE FUNCTION r09_audit_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."organizationId" = '${organizationId}' THEN RAISE EXCEPTION 'R09 injected audit outage'; END IF; RETURN NEW; END $$`,
    );
    await prisma.$executeRawUnsafe(
      'CREATE TRIGGER r09_audit_fault BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION r09_audit_fault()',
    );
    const log = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    let root;
    try {
      root = await create('Durable despite audit outage');
      expect((await list())[0].body).toBe('Durable despite audit outage');
      expect(await prisma.auditLog.count({ where: { organizationId } })).toBe(
        0,
      );
      expect(log).toHaveBeenCalled();
    } finally {
      log.mockRestore();
      await prisma.$executeRawUnsafe(
        'DROP TRIGGER r09_audit_fault ON "AuditLog"',
      );
      await prisma.$executeRawUnsafe('DROP FUNCTION r09_audit_fault()');
    }
    await api('post', commentRoute(root.commentId) + '/reactions')
      .send({ emoji: '👍' })
      .expect(201);
    await prisma.$executeRawUnsafe(
      `CREATE FUNCTION r09_event_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."organizationId" = '${organizationId}' THEN RAISE EXCEPTION 'R09 injected durable outage'; END IF; RETURN NEW; END $$`,
    );
    await prisma.$executeRawUnsafe(
      'CREATE TRIGGER r09_event_fault BEFORE INSERT ON "CommentEvent" FOR EACH ROW EXECUTE FUNCTION r09_event_fault()',
    );
    try {
      await api('delete', commentRoute(root.commentId)).expect(500);
      expect((await list())[0]).toMatchObject({
        deleted: false,
        body: 'Durable despite audit outage',
      });
      expect(
        await prisma.commentReaction.count({
          where: { commentId: root.commentId },
        }),
      ).toBe(1);
      expect(await prisma.auditLog.count({ where: { organizationId } })).toBe(
        0,
      );
    } finally {
      await prisma.$executeRawUnsafe(
        'DROP TRIGGER r09_event_fault ON "CommentEvent"',
      );
      await prisma.$executeRawUnsafe('DROP FUNCTION r09_event_fault()');
    }
  });

  it('serializes simultaneous toggles and leaves no reaction on a concurrently deleted comment', async () => {
    const root = await create();
    await prisma.$executeRawUnsafe(
      `CREATE FUNCTION r09_reaction_delay() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."commentId" = '${root.commentId}' THEN PERFORM pg_sleep(0.15); END IF; RETURN NEW; END $$`,
    );
    await prisma.$executeRawUnsafe(
      'CREATE TRIGGER r09_reaction_delay BEFORE INSERT ON "CommentReaction" FOR EACH ROW EXECUTE FUNCTION r09_reaction_delay()',
    );
    try {
      const toggles = await Promise.all(
        [0, 1].map(() =>
          api('post', commentRoute(root.commentId) + '/reactions').send({
            emoji: '👍',
          }),
        ),
      );
      expect(toggles.map((x) => x.status)).toEqual([201, 201]);
      expect(
        await prisma.commentReaction.count({
          where: { commentId: root.commentId },
        }),
      ).toBe(0);
      const [reaction, deletion] = await Promise.all([
        api('post', commentRoute(root.commentId) + '/reactions').send({
          emoji: '👍',
        }),
        api('delete', commentRoute(root.commentId)),
      ]);
      expect([201, 400]).toContain(reaction.status);
      expect(deletion.status).toBe(204);
      expect(
        await prisma.commentReaction.count({
          where: { commentId: root.commentId },
        }),
      ).toBe(0);
    } finally {
      await prisma.$executeRawUnsafe(
        'DROP TRIGGER r09_reaction_delay ON "CommentReaction"',
      );
      await prisma.$executeRawUnsafe('DROP FUNCTION r09_reaction_delay()');
    }
  });

  it('preserves shared comments anonymously after author deletion and cascades owned resources', async () => {
    const author = await prisma.user.create({
      data: { email: `r09-deleted-${suffix}@example.test` },
    });
    await prisma.organizationMember.create({
      data: { organizationId, userId: author.id, role: 'MEMBER' },
    });
    tokens.deleted = app.get(JwtService).sign({
      sub: author.id,
      email: author.email,
      role: 'user',
      type: 'access',
    });
    const root = body(
      await api('post', resourceRoute(), 'deleted')
        .send({ body: 'Shared durable content' })
        .expect(201),
    );
    const owned = await prisma.connection.create({
      data: {
        name: 'R09 deleted owner',
        type: 'sqlite',
        database: ':memory:',
        userId: author.id,
        organizationId,
      },
    });
    const ownedRoot = body(
      await api(
        'post',
        resourceRoute().replace(targetResource, owned.id),
        'deleted',
      )
        .send({ body: 'Owned content' })
        .expect(201),
    );
    await api('post', commentRoute(root.commentId) + '/reactions', 'deleted')
      .send({ emoji: '👍' })
      .expect(201);
    await prisma.user.delete({ where: { id: author.id } });
    expect((await list())[0]).toMatchObject({
      commentId: root.commentId,
      body: 'Shared durable content',
      author: { id: 'deleted-user', email: '' },
    });
    expect(
      await prisma.commentReaction.count({
        where: { commentId: root.commentId },
      }),
    ).toBe(0);
    expect(
      await prisma.commentEvent.count({
        where: { commentId: ownedRoot.commentId },
      }),
    ).toBe(0);
    expect(await prisma.connection.count({ where: { id: owned.id } })).toBe(0);
  });

  it('binds all four resource kinds and cascades comments/reactions on resource or organization deletion', async () => {
    const data = { name: 'R09 disposable', userId: ownerId, organizationId };
    const connection = await prisma.connection.create({
      data: { ...data, type: 'sqlite', database: ':memory:' },
    });
    const query = await prisma.savedQuery.create({
      data: { ...data, sql: 'SELECT 1' },
    });
    const dashboard = await prisma.dashboard.create({ data });
    const erd = await prisma.erdWorkspace.create({
      data: { ...data, layout: {} },
    });
    for (const [type, resource] of [
      ['CONNECTION', connection],
      ['QUERY', query],
      ['DASHBOARD', dashboard],
      ['ERD', erd],
    ] as const) {
      const root = body(
        await api(
          'post',
          resourceRoute().replace(
            `CONNECTION/${targetResource}`,
            `${type}/${resource.id}`,
          ),
        )
          .send({ body: type })
          .expect(201),
      );
      await api('post', commentRoute(root.commentId) + '/reactions')
        .send({ emoji: '👍' })
        .expect(201);
      if (type === 'CONNECTION')
        await prisma.connection.delete({ where: { id: resource.id } });
      if (type === 'QUERY')
        await prisma.savedQuery.delete({ where: { id: resource.id } });
      if (type === 'DASHBOARD')
        await prisma.dashboard.delete({ where: { id: resource.id } });
      if (type === 'ERD')
        await prisma.erdWorkspace.delete({ where: { id: resource.id } });
      expect(
        await prisma.commentEvent.count({ where: { resourceId: resource.id } }),
      ).toBe(0);
      expect(
        await prisma.commentReaction.count({
          where: { commentId: root.commentId },
        }),
      ).toBe(0);
    }
    const disposable = await prisma.organization.create({
      data: {
        name: 'R09 cascade',
        slug: `r09-cascade-${suffix}`,
        members: { create: { userId: ownerId, role: 'OWNER' } },
      },
    });
    const resource = await prisma.connection.create({
      data: {
        ...data,
        type: 'sqlite',
        database: ':memory:',
        organizationId: disposable.id,
      },
    });
    const root = body(
      await api(
        'post',
        resourceRoute()
          .replace(organizationId, disposable.id)
          .replace(targetResource, resource.id),
      )
        .send({ body: 'Organization content' })
        .expect(201),
    );
    await api(
      'post',
      commentRoute(root.commentId).replace(organizationId, disposable.id) +
        '/reactions',
    )
      .send({ emoji: '👍' })
      .expect(201);
    await prisma.organization.delete({ where: { id: disposable.id } });
    expect(
      await prisma.commentEvent.count({
        where: { organizationId: disposable.id },
      }),
    ).toBe(0);
    expect(
      await prisma.commentReaction.count({
        where: { commentId: root.commentId },
      }),
    ).toBe(0);
    // Existing resource contract detaches connections on org deletion.
    await prisma.connection.delete({ where: { id: resource.id } });
  });
});
