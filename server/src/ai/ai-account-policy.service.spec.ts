import { Test } from '@nestjs/testing';
import { AiAccountPolicyService } from './ai-account-policy.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { ConnectionsService } from '../connections/connections.service';
import { AiEgressPolicyService } from './ai-egress-policy.service';
import type { ProviderPlan } from './ai.types';

function connectionFixture(database?: string | null) {
  const approval = {
    enabled: true,
    providers: ['groq'],
    origins: ['https://api.groq.com'],
  };
  const config = {
    get: (key: string) =>
      key === 'AI_EGRESS_POLICY_JSON'
        ? JSON.stringify({
            ...approval,
            connections: {
              connection: { ...approval, databases: ['analytics'] },
            },
            organizations: {
              organization: { ...approval, databases: ['analytics'] },
            },
          })
        : undefined,
  } as unknown as ConfigService;
  const connection = { database, organizationId: 'organization' };
  const findOne = jest.fn(async () => ({ ...connection }));
  const findUnique = jest.fn().mockResolvedValue({ aiEnabled: true });
  const egressPolicy = new AiEgressPolicyService(config);
  const service = new AiAccountPolicyService(
    { user: { findUnique } } as unknown as PrismaService,
    config,
    egressPolicy,
    { findOne } as unknown as ConnectionsService,
  );
  const plan: ProviderPlan = {
    provider: 'groq',
    model: 'fixture',
    baseUrl: 'https://api.groq.com/openai/v1',
  };
  return { service, connection, findOne, findUnique, egressPolicy, plan };
}

async function fixture() {
  const findUnique = jest.fn();
  const module = await Test.createTestingModule({
    providers: [
      AiAccountPolicyService,
      { provide: PrismaService, useValue: { user: { findUnique } } },
    ],
  }).compile();
  return { service: module.get(AiAccountPolicyService), findUnique };
}

describe('AI account policy', () => {
  it.each([null, {}, { aiEnabled: false }])(
    'denies an account without explicit server consent %j',
    async (account) => {
      const { service, findUnique } = await fixture();
      findUnique.mockResolvedValue(account);
      await expect(service.assertEnabled('actor')).rejects.toMatchObject({
        status: 403,
        response: expect.objectContaining({ reason: 'AI_DISABLED' }),
      });
      expect(findUnique).toHaveBeenCalledWith({
        where: { id: 'actor' },
        select: { aiEnabled: true },
      });
    },
  );

  it('checks the current account state on every provider attempt', async () => {
    const { service, findUnique } = await fixture();
    findUnique
      .mockResolvedValueOnce({ aiEnabled: true })
      .mockResolvedValueOnce({ aiEnabled: false });
    const beforeRequest = service.beforeProviderRequest('actor');
    await expect(beforeRequest()).resolves.toBeUndefined();
    await expect(beforeRequest()).rejects.toMatchObject({
      response: expect.objectContaining({ reason: 'AI_DISABLED' }),
    });
    expect(findUnique).toHaveBeenCalledTimes(2);
  });

  it.each([undefined, ''])(
    'denies an omitted/empty override when the server default is private (%j)',
    async (database) => {
      const f = connectionFixture('private');
      const readSchema = jest.fn();
      const dispatch = jest.fn();
      const beforeRequest = f.service.beforeProviderRequest(
        'actor',
        'connection',
        database,
      );
      const beforeAttempt = f.service.beforeProviderAttempt(
        'actor',
        'connection',
        database,
      );
      await expect(beforeRequest().then(readSchema)).rejects.toMatchObject({
        response: expect.objectContaining({ reason: 'AI_EGRESS_DENIED' }),
      });
      await expect(beforeAttempt(f.plan).then(dispatch)).rejects.toMatchObject({
        response: expect.objectContaining({ reason: 'AI_EGRESS_DENIED' }),
      });
      expect(readSchema).not.toHaveBeenCalled();
      expect(dispatch).not.toHaveBeenCalled();
      expect(f.findOne).toHaveBeenCalledWith('connection', 'actor');
    },
  );

  it.each([undefined, ''])(
    'allows the approved server database when the override is omitted/empty (%j)',
    async (database) => {
      const f = connectionFixture('analytics');
      const assertContext = jest.spyOn(f.egressPolicy, 'assertContext');
      const assertProvider = jest.spyOn(f.egressPolicy, 'assertProvider');
      await expect(
        f.service.assertConnectionEnabled('actor', 'connection', database),
      ).resolves.toBeUndefined();
      await expect(
        f.service.beforeProviderAttempt(
          'actor',
          'connection',
          database,
        )(f.plan),
      ).resolves.toBeUndefined();
      expect(assertContext).toHaveBeenCalledWith({
        connectionId: 'connection',
        organizationId: 'organization',
        database: 'analytics',
      });
      expect(assertProvider).toHaveBeenCalledWith(f.plan, {
        connectionId: 'connection',
        organizationId: 'organization',
        database: 'analytics',
      });
    },
  );

  it.each(['   ', ' analytics '])(
    'does not normalize an explicit database override into the approved default (%j)',
    async (database) => {
      const f = connectionFixture('analytics');
      const assertContext = jest.spyOn(f.egressPolicy, 'assertContext');
      await expect(
        f.service.assertConnectionEnabled('actor', 'connection', database),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        f.service.beforeProviderAttempt(
          'actor',
          'connection',
          database,
        )(f.plan),
      ).rejects.toMatchObject({ status: 403 });
      expect(assertContext).toHaveBeenCalledWith({
        connectionId: 'connection',
        organizationId: 'organization',
        database,
      });
    },
  );

  it('uses an approved explicit override instead of an excluded server default', async () => {
    const f = connectionFixture('private');
    await expect(
      f.service.assertConnectionEnabled('actor', 'connection', 'analytics'),
    ).resolves.toBeUndefined();
    await expect(
      f.service.beforeProviderAttempt(
        'actor',
        'connection',
        'analytics',
      )(f.plan),
    ).resolves.toBeUndefined();
  });

  it('denies an excluded explicit override even when the default database is approved', async () => {
    const f = connectionFixture('analytics');
    await expect(
      f.service.assertConnectionEnabled('actor', 'connection', 'private'),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      f.service.beforeProviderAttempt('actor', 'connection', 'private')(f.plan),
    ).rejects.toMatchObject({ status: 403 });
  });

  it.each([undefined, null, '', '   '])(
    'denies restricted scopes with no usable server default (%j)',
    async (database) => {
      const f = connectionFixture(database);
      await expect(
        f.service.assertConnectionEnabled('actor', 'connection'),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        f.service.beforeProviderAttempt('actor', 'connection')(f.plan),
      ).rejects.toMatchObject({ status: 403 });
    },
  );

  it('resolves the current database on every attempt rather than freezing an approved default', async () => {
    const f = connectionFixture('analytics');
    const beforeRequest = f.service.beforeProviderRequest(
      'actor',
      'connection',
    );
    const beforeAttempt = f.service.beforeProviderAttempt(
      'actor',
      'connection',
    );
    await expect(beforeRequest()).resolves.toBeUndefined();
    await expect(beforeAttempt(f.plan)).resolves.toBeUndefined();
    f.connection.database = 'private';
    const dispatch = jest.fn();
    await expect(beforeAttempt(f.plan).then(dispatch)).rejects.toMatchObject({
      status: 403,
    });
    await expect(beforeRequest()).rejects.toMatchObject({ status: 403 });
    expect(dispatch).not.toHaveBeenCalled();
    expect(f.findOne).toHaveBeenCalledTimes(4);
  });

  it('rechecks the current organization with the effective database on each hook', async () => {
    const f = connectionFixture('analytics');
    const beforeRequest = f.service.beforeProviderRequest(
      'actor',
      'connection',
    );
    const beforeAttempt = f.service.beforeProviderAttempt(
      'actor',
      'connection',
    );
    await expect(beforeRequest()).resolves.toBeUndefined();
    await expect(beforeAttempt(f.plan)).resolves.toBeUndefined();
    f.connection.organizationId = 'unapproved-organization';
    await expect(beforeRequest()).rejects.toMatchObject({ status: 403 });
    await expect(beforeAttempt(f.plan)).rejects.toMatchObject({ status: 403 });
  });

  it('does not fail open when policy storage is unavailable', async () => {
    const { service, findUnique } = await fixture();
    findUnique.mockRejectedValue(new Error('fixture storage unavailable'));
    await expect(service.assertEnabled('actor')).rejects.toThrow(
      'fixture storage unavailable',
    );
  });
});
