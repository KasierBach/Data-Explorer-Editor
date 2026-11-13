import { ConfigService } from '@nestjs/config';
import { AiEgressPolicyService } from './ai-egress-policy.service';

function fixture(policy?: unknown, killSwitch = false) {
  return new AiEgressPolicyService({
    get: (key: string) =>
      key === 'AI_KILL_SWITCH'
        ? String(killSwitch)
        : policy === undefined
          ? undefined
          : JSON.stringify(policy),
  } as unknown as ConfigService);
}
const approval = {
  enabled: true,
  providers: ['groq', 'gemini', 'custom'],
  origins: [
    'https://api.groq.com',
    'https://generativelanguage.googleapis.com',
    'https://approved.example',
  ],
};
const context = {
  connectionId: 'connection-a',
  organizationId: 'org-a',
  database: 'analytics',
};
const policy = {
  ...approval,
  organizations: { 'org-a': approval },
  connections: { 'connection-a': { ...approval, databases: ['analytics'] } },
};

describe('AI egress approval', () => {
  it.each([undefined, {}, { enabled: true }, { enabled: 'true' }])(
    'fails closed for missing or malformed deployment policy %j',
    (value) => {
      const service = fixture(value);
      expect(() =>
        service.assertProvider({
          provider: 'groq',
          model: 'fixture',
          baseUrl: 'https://api.groq.com/openai/v1',
        }),
      ).toThrow();
    },
  );

  it('requires separate connection and organization approval before context gathering', () => {
    const service = fixture({ ...approval });
    expect(() => service.assertContext(context)).toThrow();
    expect(() => fixture(policy).assertContext(context)).not.toThrow();
  });

  it('requires approved recipients on every fallback attempt', async () => {
    const check = fixture(policy).beforeProviderAttempt(context);
    await expect(
      check({
        provider: 'groq',
        model: 'fixture',
        baseUrl: 'https://api.groq.com/openai/v1',
      }),
    ).resolves.toBeUndefined();
    await expect(
      check({
        provider: 'openrouter',
        model: 'fixture',
        baseUrl: 'https://openrouter.ai/api/v1',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ reason: 'AI_EGRESS_DENIED' }),
    });
    await expect(
      check({
        provider: 'custom',
        model: 'fixture',
        baseUrl: 'https://not-approved.example/v1',
      }),
    ).rejects.toThrow();
  });

  it('denies disabled org, database drift and deployment kill switch', () => {
    expect(() =>
      fixture({
        ...policy,
        organizations: { 'org-a': { ...approval, enabled: false } },
      }).assertContext(context),
    ).toThrow();
    expect(() =>
      fixture(policy).assertContext({ ...context, database: 'private' }),
    ).toThrow();
    expect(() => fixture(policy, true).assertContext(context)).toThrow();
  });

  it.each(['root', 'organization', 'connection'] as const)(
    'rejects absent, empty and unapproved effective databases restricted by %s',
    async (scope) => {
      const restricted = { ...approval, databases: ['analytics'] };
      const value = {
        ...(scope === 'root' ? restricted : approval),
        organizations: {
          'org-a': scope === 'organization' ? restricted : approval,
        },
        connections: {
          'connection-a': scope === 'connection' ? restricted : approval,
        },
      };
      const service = fixture(value);
      for (const database of [undefined, '', '   ', 'private']) {
        const selected = { ...context, database };
        expect(() => service.assertContext(selected)).toThrow();
        await expect(
          service.beforeProviderAttempt(selected)({
            provider: 'groq',
            model: 'fixture',
            baseUrl: 'https://api.groq.com/openai/v1',
          }),
        ).rejects.toMatchObject({ status: 403 });
      }
      expect(() => service.assertContext(context)).not.toThrow();
    },
  );

  it('denies an explicit empty database allowlist instead of broadening it', () => {
    const service = fixture({ ...approval, databases: [] });
    expect(() => service.assertContext()).toThrow();
    expect(() => service.assertContext({ database: 'analytics' })).toThrow();
  });

  it('preserves root-only discovery when no scope imposes a database list', () => {
    expect(() =>
      fixture(approval).assertProvider({
        provider: 'groq',
        model: 'discovery',
        baseUrl: 'https://api.groq.com/openai/v1',
      }),
    ).not.toThrow();
  });

  it('does not permit user-controlled credentials or origin lookalikes', () => {
    const service = fixture(policy);
    expect(() =>
      service.assertProvider(
        {
          provider: 'custom',
          model: 'fixture',
          baseUrl: 'https://user:secret@approved.example/v1',
        },
        context,
      ),
    ).toThrow();
    expect(() =>
      service.assertProvider(
        {
          provider: 'custom',
          model: 'fixture',
          baseUrl: 'https://approved.example.attacker.test/v1',
        },
        context,
      ),
    ).toThrow();
  });
});
