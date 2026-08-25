import { SocialAuthService } from './social-auth.service';

describe('SocialAuthService', () => {
  const prisma = {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
  } as any;
  const service = new SocialAuthService(prisma);

  beforeEach(() => jest.clearAllMocks());

  it('does not link an existing account through an unverified provider email', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(
      service.validateOAuthLogin(
        {
          id: 'provider-user',
          emails: [{ value: 'victim@example.com', verified: false }],
          displayName: 'Attacker',
        },
        'github',
      ),
    ).rejects.toThrow('OAuth provider email is not verified');

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('links an existing account when the provider verifies the email', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      firstName: 'Existing',
      lastName: null,
      avatarUrl: null,
    });
    prisma.user.update.mockResolvedValue({ id: 'user-1' });

    await service.validateOAuthLogin(
      {
        id: 'github-user',
        emails: [{ value: 'user@example.com', verified: true }],
        displayName: 'Existing User',
      },
      'github',
    );

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'user@example.com' },
    });
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: expect.objectContaining({ providerId: 'github-user' }),
      }),
    );
  });
});
