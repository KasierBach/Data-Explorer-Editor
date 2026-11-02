import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../src/prisma/prisma.service';
import { CollaborationService } from '../src/collaboration/collaboration.service';
import { ResourceType } from '../src/permissions/enums/resource-type.enum';
import { createE2eApp, closeE2eApp } from './e2e-app';

type BackfillResult = {
  examined: number;
  copied: number;
  skipped: number;
  completed: boolean;
};

describe('R09 legacy comment migration on the guarded disposable application database', () => {
  const suffix = randomUUID();
  let app: INestApplication, prisma: PrismaService;
  let userId: string, organizationId: string, resourceId: string;
  let previousCheckpoint: Awaited<
    ReturnType<PrismaService['commentBackfill']['findMany']>
  >;
  const rootId = randomUUID(),
    replyId = randomUUID(),
    orphanId = randomUUID();
  const attachment = 'data:text/plain;base64,aGVsbG8=';
  const marker = 'legacy-audit-v1';
  const batch = async (size = 2) =>
    (
      await prisma.$queryRaw<
        BackfillResult[]
      >`SELECT * FROM data_explorer_backfill_comment_events(${size}::int)`
    )[0];

  beforeAll(async () => {
    app = await createE2eApp();
    prisma = app.get(PrismaService);
    // setup-env.cjs rejects any database other than the explicit local fixture.
    expect(new URL(process.env.DATABASE_URL ?? '').pathname).toBe(
      '/data_explorer_e2e',
    );
    userId = (
      await prisma.user.create({
        data: { email: `r09-backfill-${suffix}@example.test` },
      })
    ).id;
    organizationId = (
      await prisma.organization.create({
        data: {
          name: 'R09 legacy corpus',
          slug: `r09-backfill-${suffix}`,
          members: { create: { userId, role: 'OWNER' } },
        },
      })
    ).id;
    resourceId = (
      await prisma.connection.create({
        data: {
          name: 'R09 legacy',
          type: 'sqlite',
          database: ':memory:',
          userId,
          organizationId,
        },
      })
    ).id;
    previousCheckpoint = await prisma.commentBackfill.findMany();
    await prisma.commentBackfill.deleteMany();
    // No unrelated legacy writers may be included in this controlled replay.
    const existing = await prisma.auditLog.findMany({
      where: {
        organizationId: { not: null },
        action: {
          in: [
            'TEAM:COMMENT_CREATE',
            'TEAM:COMMENT_REPLY',
            'TEAM:COMMENT_EDIT',
            'TEAM:COMMENT_DELETE',
            'TEAM:COMMENT_RESOLVE',
          ],
        },
      },
      select: { details: true },
    });
    expect(
      existing.every((x) => JSON.parse(x.details ?? '{}').storageVersion === 2),
    ).toBe(true);
    const base = {
      commentId: rootId,
      threadId: rootId,
      parentCommentId: null,
      resourceType: 'CONNECTION',
      resourceId,
      body: 'Legacy root',
      mentions: [userId],
      attachments: [attachment],
    };
    const corpus: Array<[string, unknown]> = [
      ['CREATE', base],
      [
        'REPLY',
        {
          ...base,
          commentId: replyId,
          parentCommentId: rootId,
          body: 'Legacy reply',
        },
      ],
      ['EDIT', { ...base, body: 'Legacy edited' }],
      ['RESOLVE', base],
      ['DELETE', { ...base, commentId: replyId }],
      [
        'EDIT',
        { ...base, commentId: replyId, body: 'Stale edit after deletion' },
      ],
      ['CREATE', { ...base, body: 'Duplicate must not replace root' }],
      ['CREATE', '{invalid JSON'],
      [
        'CREATE',
        {
          ...base,
          commentId: randomUUID(),
          threadId: randomUUID(),
          attachments: ['data:text/html;base64,AAAA'],
        },
      ],
      [
        'CREATE',
        {
          ...base,
          commentId: randomUUID(),
          threadId: randomUUID(),
          resourceId: randomUUID(),
        },
      ],
      [
        'REPLY',
        {
          ...base,
          commentId: orphanId,
          threadId: randomUUID(),
          parentCommentId: randomUUID(),
          body: 'Orphan reply retained for inventory',
        },
      ],
      ['CREATE', { ...base, resourceType: null }],
      ['CREATE', { ...base, mentions: [{}] }],
      ['CREATE', { ...base, body: {} }],
    ];
    await prisma.auditLog.createMany({
      data: corpus.map(([action, details], index) => ({
        id: `r09-${suffix}-${String(index).padStart(3, '0')}`,
        action: `TEAM:COMMENT_${action}`,
        organizationId,
        userId,
        details:
          typeof details === 'string' ? details : JSON.stringify(details),
        // Equal timestamps exercise the stable audit-ID tie-breaker.
        createdAt: new Date(Date.now() - 60000),
      })),
    });
  });
  afterAll(async () => {
    try {
      if (organizationId)
        await prisma.auditLog.deleteMany({ where: { organizationId } });
      if (organizationId)
        await prisma.organization.delete({ where: { id: organizationId } });
      if (userId) await prisma.user.delete({ where: { id: userId } });
      if (previousCheckpoint) {
        await prisma.commentBackfill.deleteMany();
        if (previousCheckpoint.length)
          await prisma.commentBackfill.createMany({ data: previousCheckpoint });
      }
    } finally {
      if (app) await closeE2eApp(app);
    }
  });

  it('rejects invalid batch budgets, including NULL, without scanning or changing the checkpoint', async () => {
    for (const size of [0, 501])
      await expect(batch(size)).rejects.toThrow('between 1 and 500');
    await expect(
      prisma.$queryRaw`SELECT * FROM data_explorer_backfill_comment_events(NULL)`,
    ).rejects.toThrow('between 1 and 500');
    expect(await prisma.commentBackfill.count()).toBe(0);
  });

  it('commits each batch with its checkpoint, survives rollback/restart, and recovers only complete threads', async () => {
    expect(await batch()).toMatchObject({ copied: 2, completed: false });
    const checkpoint = await prisma.commentBackfill.findUniqueOrThrow({
      where: { id: marker },
    });
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT * FROM data_explorer_backfill_comment_events(2)`;
        throw new Error('R09 simulated interruption before commit');
      }),
    ).rejects.toThrow('before commit');
    expect(
      await prisma.commentBackfill.findUnique({ where: { id: marker } }),
    ).toEqual(checkpoint);
    expect(await prisma.commentEvent.count({ where: { organizationId } })).toBe(
      2,
    );
    await closeE2eApp(app);
    app = await createE2eApp();
    prisma = app.get(PrismaService);
    expect(
      await prisma.commentBackfill.findUnique({ where: { id: marker } }),
    ).toEqual(checkpoint);
    // An old writer after the captured watermark is never silently imported.
    const lateId = randomUUID();
    await prisma.auditLog.create({
      data: {
        action: 'TEAM:COMMENT_CREATE',
        organizationId,
        userId,
        details: JSON.stringify({
          commentId: lateId,
          threadId: lateId,
          resourceType: 'CONNECTION',
          resourceId,
          body: 'Late old writer',
        }),
      },
    });
    let result = await batch();
    for (let remaining = 8; !result.completed && remaining > 0; remaining--)
      result = await batch();
    expect(result).toEqual({
      examined: 14,
      copied: 7,
      skipped: 7,
      completed: true,
    });
    expect(await prisma.commentEvent.count({ where: { organizationId } })).toBe(
      7,
    );
    expect(await prisma.commentEvent.count({ where: { id: lateId } })).toBe(0);
    expect(await prisma.commentEvent.count({ where: { id: orphanId } })).toBe(
      1,
    );
    const reaction = await prisma.commentReaction.create({
      data: { commentId: rootId, userId, emoji: '👍' },
    });
    // Old storage may still hold reactions on a soft-deleted reply.
    await prisma.commentReaction.create({
      data: { commentId: replyId, userId, emoji: '👍' },
    });
    const threads = await app
      .get(CollaborationService)
      .listResourceComments(
        organizationId,
        userId,
        ResourceType.CONNECTION,
        resourceId,
      );
    expect(threads).toHaveLength(1);
    expect(threads[0]).toMatchObject({
      commentId: rootId,
      body: 'Legacy edited',
      attachments: [attachment],
      mentions: [{ id: userId }],
    });
    expect(threads[0].resolvedAt).not.toBeNull();
    expect(threads[0].replies).toHaveLength(1);
    expect(threads[0].replies[0]).toMatchObject({
      commentId: replyId,
      deleted: true,
      body: '',
      mentions: [],
    });
    expect(threads[0].replies[0].attachments).toBeUndefined();
    expect(threads[0].replies[0].reactions).toBeUndefined();
    expect(threads[0].reactions?.[0]).toMatchObject({ emoji: '👍', count: 1 });
    expect(await batch()).toEqual(result);
    // Replay the same captured window with existing durable rows: only skips grow.
    await prisma.commentBackfill.update({
      where: { id: marker },
      data: {
        lastCreatedAt: null,
        lastAuditId: null,
        examined: 0,
        copied: 0,
        skipped: 0,
        completed: false,
      },
    });
    let replay = await batch();
    for (let remaining = 8; !replay.completed && remaining > 0; remaining--)
      replay = await batch();
    expect(replay).toEqual({
      examined: 14,
      copied: 0,
      skipped: 14,
      completed: true,
    });
    expect(await prisma.commentEvent.count({ where: { organizationId } })).toBe(
      7,
    );
    expect(
      await prisma.commentReaction.findUnique({ where: { id: reaction.id } }),
    ).not.toBeNull();
  });

  it('enforces foreign keys and resource binding for new rows while exposing legacy orphan inventory', async () => {
    await expect(
      prisma.commentReaction.create({
        data: { commentId: randomUUID(), userId, emoji: '👍' },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
    await expect(
      prisma.commentEvent.create({
        data: {
          action: 'TEAM:COMMENT_CREATE',
          commentId: randomUUID(),
          threadId: randomUUID(),
          resourceType: 'CONNECTION',
          resourceId,
          organizationId,
          userId,
          details: '{}',
        },
      }),
    ).rejects.toThrow();
    const orphans = await prisma.$queryRaw<
      Array<{ id: string }>
    >`SELECT r.id FROM "CommentReaction" r LEFT JOIN "CommentEvent" e ON e.id=r."commentId" WHERE e.id IS NULL AND r."userId"=${userId}`;
    expect(orphans).toEqual([]);
  });
});
