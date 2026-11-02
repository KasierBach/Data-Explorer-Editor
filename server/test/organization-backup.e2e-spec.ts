import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../src/prisma/prisma.service';
import { Permission } from '../src/permissions/enums/permission.enum';
import { ResourceType } from '../src/permissions/enums/resource-type.enum';
import { OrganizationBackupPackage } from '../src/organizations/services/organization-backup.service';
import { createE2eApp, closeE2eApp } from './e2e-app';

describe('R02 organization backup (full-stack e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let orgId: string;
  let connectionId: string;
  let queryId: string;
  let dashboardId: string;
  let erdId: string;
  let backup: OrganizationBackupPackage;
  const users: Record<string, { id: string; token: string }> = {};
  const suffix = randomUUID();
  const roles = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER', 'OUTSIDER'] as const;
  const emails = roles.map((role) => `r02-${role}-${suffix}@example.com`);
  const policy = {
    OWNER: Object.values(Permission),
    ADMIN: Object.values(Permission),
    MEMBER: [],
    VIEWER: [],
  };
  const secret = `r02-connection-secret-${suffix}`;
  const payload = (res: request.Response) => res.body.data ?? res.body;
  const get = (path: string, role: string) =>
    request(app.getHttpServer())
      .get(path)
      .set('Authorization', `Bearer ${users[role].token}`);
  const restore = (role: string) =>
    request(app.getHttpServer())
      .post(`/api/organizations/${orgId}/backup/restore`)
      .set('Authorization', `Bearer ${users[role].token}`)
      .set('x-requested-with', 'XMLHttpRequest')
      .send({ backup });

  beforeAll(async () => {
    app = await createE2eApp();
    prisma = app.get(PrismaService);
    for (const [index, role] of roles.entries()) {
      const user = await prisma.user.create({
        data: {
          email: emails[index],
          role: 'user',
          isEmailVerified: true,
          isOnboarded: true,
          securityAlerts: false,
        },
      });
      users[role] = {
        id: user.id,
        token: app.get(JwtService).sign({
          sub: user.id,
          email: user.email,
          role: 'user',
          type: 'access',
        }),
      };
    }
    const org = await prisma.organization.create({
      data: {
        name: 'R02 synthetic',
        slug: `r02-${suffix}`,
        settings: { theme: 'dark' },
        members: {
          create: roles
            .filter((role) => role !== 'OUTSIDER')
            .map((role) => ({ userId: users[role].id, role })),
        },
      },
    });
    orgId = org.id;
    const connection = await prisma.connection.create({
      data: {
        name: 'No driver used',
        type: 'postgres',
        database: 'synthetic',
        password: secret,
        sshPrivateKey: secret,
        userId: users.OWNER.id,
        organizationId: orgId,
      },
    });
    connectionId = connection.id;
    const space = await prisma.teamspace.create({
      data: {
        name: 'Restricted',
        slug: 'restricted',
        organizationId: orgId,
        createdBy: users.OWNER.id,
      },
    });
    const query = await prisma.savedQuery.create({
      data: {
        name: 'Restricted SQL',
        sql: "SELECT 'r02-private-sql'",
        userId: users.OWNER.id,
        organizationId: orgId,
        connectionId,
        visibility: 'team',
        tags: ['synthetic'],
      },
    });
    queryId = query.id;
    const dashboard = await prisma.dashboard.create({
      data: {
        name: 'Restricted dashboard',
        userId: users.OWNER.id,
        organizationId: orgId,
        connectionId,
        visibility: 'team',
        widgets: {
          create: {
            title: 'Private snapshot',
            chartType: 'table',
            queryText: query.sql,
            dataSnapshot: [{ value: 'r02-private-snapshot' }],
            columns: ['value'],
            connectionId,
          },
        },
      },
    });
    dashboardId = dashboard.id;
    const erd = await prisma.erdWorkspace.create({
      data: {
        name: 'Restricted ERD',
        notes: 'r02-private-erd',
        layout: { nodes: [{ id: 'private-table' }] },
        userId: users.OWNER.id,
        organizationId: orgId,
        connectionId,
      },
    });
    erdId = erd.id;
    for (const [resourceType, resourceId] of [
      [ResourceType.QUERY, queryId],
      [ResourceType.DASHBOARD, dashboardId],
      [ResourceType.ERD, erdId],
    ] as const) {
      await prisma.organizationResource.create({
        data: {
          organizationId: orgId,
          resourceType,
          resourceId,
          permissions: policy,
          teamspaceId: space.id,
        },
      });
    }
    const res = await get(`/api/organizations/${orgId}/backup`, 'OWNER').expect(
      200,
    );
    backup = payload(res);
  }, 120_000);

  afterAll(async () => {
    try {
      // Organization relations use SetNull; delete fixture artifacts explicitly before the organization.
      if (prisma && orgId) {
        await prisma.savedQuery.deleteMany({
          where: { organizationId: orgId },
        });
        await prisma.dashboard.deleteMany({ where: { organizationId: orgId } });
        await prisma.erdWorkspace.deleteMany({
          where: { organizationId: orgId },
        });
        await prisma.organization.delete({ where: { id: orgId } });
      }
      if (prisma)
        await prisma.user.deleteMany({ where: { email: { in: emails } } });
    } finally {
      if (app) await closeE2eApp(app);
    }
  }, 120_000);

  it.each(['MEMBER', 'VIEWER', 'OUTSIDER'])(
    'denies full export and restore to %s without leaking restricted artifacts (E08)',
    async (role) => {
      if (role !== 'OUTSIDER') {
        const list = await get(
          `/api/organizations/${orgId}/queries`,
          role,
        ).expect(200);
        expect(payload(list)).toEqual([]);
      }
      const denied = await get(`/api/organizations/${orgId}/backup`, role);
      expect(denied.status).toBe(403);
      expect(JSON.stringify(denied.body)).not.toMatch(
        /r02-private-(sql|snapshot|erd)/,
      );
      await restore(role).expect(403);
      expect(
        await prisma.savedQuery.count({ where: { organizationId: orgId } }),
      ).toBe(1);
    },
  );

  it.each(['OWNER', 'ADMIN'])(
    'exports SQL, snapshot, ERD and policy links for %s without connection credentials',
    async (role) => {
      const res = await get(`/api/organizations/${orgId}/backup`, role).expect(
        200,
      );
      const result = payload(res) as OrganizationBackupPackage;
      expect(result.savedQueries).toEqual([
        expect.objectContaining({
          sourceId: queryId,
          sql: "SELECT 'r02-private-sql'",
        }),
      ]);
      expect(result.dashboards[0].widgets[0].dataSnapshot).toEqual([
        { value: 'r02-private-snapshot' },
      ]);
      expect(result.erdWorkspaces[0]).toEqual(
        expect.objectContaining({ sourceId: erdId, notes: 'r02-private-erd' }),
      );
      expect(result.resourcePolicies).toHaveLength(3);
      expect(
        result.resourcePolicies.every(
          (entry) => entry.teamspaceId === result.teamspaces[0].sourceId,
        ),
      ).toBe(true);
      expect(JSON.stringify(result)).not.toContain(secret);
      expect(result).not.toHaveProperty('connections');
    },
  );

  it.each(['OWNER', 'ADMIN'])(
    'round-trips a valid backup for %s without widening its restricted policies (E07)',
    async (role) => {
      const res = await restore(role).expect(201);
      expect(payload(res).created).toEqual({
        teamspaces: 1,
        savedQueries: 1,
        dashboards: 1,
        dashboardWidgets: 1,
        erdWorkspaces: 1,
        resourcePolicies: 3,
      });
      const query = await prisma.savedQuery.findFirstOrThrow({
        where: {
          organizationId: orgId,
          userId: users[role].id,
          id: { not: queryId },
        },
      });
      const dashboard = await prisma.dashboard.findFirstOrThrow({
        where: {
          organizationId: orgId,
          userId: users[role].id,
          id: { not: dashboardId },
        },
        include: { widgets: true },
      });
      const erd = await prisma.erdWorkspace.findFirstOrThrow({
        where: {
          organizationId: orgId,
          userId: users[role].id,
          id: { not: erdId },
        },
      });
      expect(query.sql).toBe(backup.savedQueries[0].sql);
      expect(query.connectionId).toBe(connectionId);
      expect(dashboard.widgets[0].dataSnapshot).toEqual(
        backup.dashboards[0].widgets[0].dataSnapshot,
      );
      expect(erd.layout).toEqual(backup.erdWorkspaces[0].layout);
      const links = await prisma.organizationResource.findMany({
        where: {
          organizationId: orgId,
          resourceId: { in: [query.id, dashboard.id, erd.id] },
        },
      });
      expect(links).toHaveLength(3);
      const restoredSpace = await prisma.teamspace.findFirstOrThrow({
        where: { organizationId: orgId, id: links[0].teamspaceId! },
      });
      expect(restoredSpace.id).not.toBe(backup.teamspaces[0].sourceId);
      for (const link of links) {
        expect(link.teamspaceId).toBe(restoredSpace.id);
        expect(link.permissions).toEqual(policy);
      }
      for (const deniedRole of ['MEMBER', 'VIEWER']) {
        const list = await get(
          `/api/organizations/${orgId}/queries`,
          deniedRole,
        ).expect(200);
        expect(payload(list)).toEqual([]);
      }
    },
  );
  it('denies export and restore immediately after admin demotion with the same JWT', async () => {
    const before = await prisma.savedQuery.count({
      where: { organizationId: orgId },
    });
    await prisma.organizationMember.update({
      where: {
        organizationId_userId: {
          organizationId: orgId,
          userId: users.ADMIN.id,
        },
      },
      data: { role: 'MEMBER' },
    });
    await get(`/api/organizations/${orgId}/backup`, 'ADMIN').expect(403);
    await restore('ADMIN').expect(403);
    expect(
      await prisma.savedQuery.count({ where: { organizationId: orgId } }),
    ).toBe(before);
  });
});
