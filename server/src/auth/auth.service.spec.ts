import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { UsersService } from '../users/users.service';

const promiseBcrypt: {
  hash: (password: string, salt: number | string) => Promise<string>;
  compare: (password: string, hash: string) => Promise<boolean>;
} = bcrypt;
type BcryptHashSpy = jest.SpyInstance<
  ReturnType<typeof promiseBcrypt.hash>,
  Parameters<typeof promiseBcrypt.hash>
>;

jest.mock('bcryptjs', () => {
  const actual = jest.requireActual('bcryptjs');
  return {
    __esModule: true,
    ...actual,
    hash: jest.fn(actual.hash),
    compare: jest.fn(actual.compare),
  };
});

describe('AuthService - login', () => {
  let authService: AuthService;
  const mockPrisma: any = {
    user: { findUnique: jest.fn(), update: jest.fn() },
  };
  const mockMailService = {} as any;
  const mockOtpService = {} as any;
  const mockSeedService = {} as any;
  const mockTokenService = {} as any;
  const mockAuditService = { log: jest.fn() } as any;

  beforeEach(() => {
    mockPrisma.user.findUnique = jest.fn();
    mockPrisma.user.update = jest.fn();
    mockAuditService.log.mockClear();
    authService = new AuthService(
      mockPrisma,
      mockMailService,
      mockOtpService,
      mockSeedService,
      mockTokenService,
      mockAuditService,
    );
  });

  it('should throw UnauthorizedException when user not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    await expect(
      authService.login({
        email: 'notfound@example.com',
        password: 'pw',
      } as LoginDto),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(mockAuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.objectContaining({
          email: 'notfound@example.com',
          reason: 'User not found',
        }),
      }),
    );
  });

  it('returns English invalid-credentials copy when the caller requests en', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(
      (authService as any).login(
        {
          email: 'missing@example.com',
          password: 'pw',
        } as LoginDto,
        undefined,
        'en',
      ),
    ).rejects.toThrow('Invalid credentials');
  });

  it.each([
    ['vi', 'en', 'Thông tin đăng nhập không hợp lệ'],
    ['en', 'vi', 'Invalid credentials'],
  ] as const)(
    'uses request locale %s for an invalid password on a %s account',
    async (lang, userLang, message) => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'existing@example.com',
        provider: 'local',
        password: await bcrypt.hash('correct-password', 4),
        language: userLang,
      });

      await expect(
        authService.login(
          {
            email: 'existing@example.com',
            password: 'wrong-password',
          } as LoginDto,
          undefined,
          lang,
        ),
      ).rejects.toThrow(message);
    },
  );

  it.each([
    ['vi', 'en', 'Thông tin đăng nhập không hợp lệ'],
    ['en', 'vi', 'Invalid credentials'],
  ] as const)(
    'uses request locale %s for a %s local account without a password hash',
    async (lang, userLang, message) => {
      mockPrisma.user.findUnique.mockResolvedValue({
        provider: 'local',
        password: null,
        language: userLang,
      });

      await expect(
        authService.login(
          {
            email: 'local@example.com',
            password: 'pw',
          } as LoginDto,
          undefined,
          lang,
        ),
      ).rejects.toThrow(message);
    },
  );
  it('rejects registration when legal terms are not accepted', async () => {
    await expect(
      authService.register({
        name: 'No Consent',
        email: 'noconsent@example.com',
        password: 'secret123',
        acceptedLegal: false,
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('does not issue a session when an already verified account submits an OTP', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'verified@example.com',
      language: 'en',
      isEmailVerified: true,
    });

    await expect(
      authService.verifyEmail({
        email: 'verified@example.com',
        otp: '000000',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });
});

function createSessionHarness(overrides: Record<string, unknown> = {}) {
  const user = {
    id: 'user-1',
    email: 'user@example.com',
    role: 'user',
    language: 'en',
    provider: 'local',
    password: 'old-password-hash' as string | null,
    isBanned: false,
    isEmailVerified: true,
    refreshTokenHash: 'old-refresh-hash' as string | null,
    refreshTokenExpiry: new Date(Date.now() + 60_000) as Date | null,
    ...overrides,
  };
  const prisma = {
    user: {
      findUnique: jest.fn(async () => ({ ...user })),
      update: jest.fn(async ({ data }) => {
        Object.assign(user, data);
        return { ...user };
      }),
      updateMany: jest.fn(async ({ where, data }) => {
        if (
          where.id !== user.id ||
          ('password' in where && where.password !== user.password) ||
          ('refreshTokenHash' in where &&
            where.refreshTokenHash !== user.refreshTokenHash)
        ) {
          return { count: 0 };
        }
        Object.assign(user, data);
        return { count: 1 };
      }),
    },
  };
  const session = {
    accessToken: 'issued-access-token',
    accessTokenExpiresAt: 2_000_000_000,
    refreshToken: 'issued-refresh-token',
    refreshTokenExpiresAt: new Date(Date.now() + 120_000),
    user: { id: user.id, email: user.email, role: user.role },
  };
  const tokens = {
    generateSessionTokens: jest.fn(() => session),
    verifyRefreshToken: jest.fn(() => ({ sub: user.id })),
    verifyOauthExchangeToken: jest.fn(() => ({ sub: user.id })),
  };
  const otp = {
    isExpired: jest.fn(() => false),
    verifyOtp: jest.fn(async () => true),
  };
  const service = new AuthService(
    prisma as never,
    {} as never,
    otp as never,
    {} as never,
    tokens as never,
    { log: jest.fn(async () => undefined) } as never,
  );
  return { service, prisma, user, tokens, otp, session };
}

function pauseSessionHash(
  hashSpy: BcryptHashSpy,
  token = 'issued-refresh-token',
) {
  let resume!: (value: string) => void;
  let signalStarted!: () => void;
  const started = new Promise<void>((resolve) => {
    signalStarted = resolve;
  });
  const waiting = new Promise<string>((resolve) => {
    resume = resolve;
  });
  hashSpy.mockImplementation(async (value) => {
    if (value === token) {
      signalStarted();
      return waiting;
    }
    return 'new-password-hash';
  });
  return { started, resume };
}

describe('AuthService guarded session issuance', () => {
  let hashSpy: BcryptHashSpy;

  beforeEach(() => {
    jest.spyOn(promiseBcrypt, 'compare').mockResolvedValue(true);
    hashSpy = jest
      .spyOn(promiseBcrypt, 'hash')
      .mockResolvedValue('new-refresh-hash');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('issues a password login only against the verified password snapshot', async () => {
    const { service, prisma, session, user } = createSessionHarness();

    await expect(
      service.login({ email: user.email, password: 'old-password' }),
    ).resolves.toEqual({
      access_token: session.accessToken,
      accessTokenExpiresAt: session.accessTokenExpiresAt,
      refreshToken: session.refreshToken,
      refreshTokenExpiresAt: session.refreshTokenExpiresAt,
      user: session.user,
    });
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: user.id, password: 'old-password-hash' },
      data: {
        refreshTokenHash: 'new-refresh-hash',
        refreshTokenExpiry: session.refreshTokenExpiresAt,
      },
    });
  });

  it('rotates a refresh token only against its exact validated hash and password snapshot', async () => {
    const { service, prisma, user } = createSessionHarness();

    await service.refreshSession('old-refresh-token');

    expect(prisma.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: user.id,
          password: 'old-password-hash',
          refreshTokenHash: 'old-refresh-hash',
        },
      }),
    );
  });

  it.each(['self', 'admin'] as const)(
    'rejects an old login finishing after a %s password rotation',
    async (kind) => {
      const { service, prisma, user } = createSessionHarness();
      const gate = pauseSessionHash(hashSpy);
      const login = service.login({
        email: user.email,
        password: 'old-password',
      });
      await gate.started;

      const users = new UsersService(prisma as never);
      if (kind === 'self') {
        await users.changePassword(user.id, {
          currentPassword: 'old-password',
          newPassword: 'new-password',
        });
      } else {
        await users.resetPassword(user.id, { newPassword: 'new-password' });
      }
      const rejection = expect(login).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      gate.resume('stale-refresh-hash');
      await rejection;
      expect(user.password).toBe('new-password-hash');
      expect(user.refreshTokenHash).toBeNull();
      expect(user.refreshTokenExpiry).toBeNull();
    },
  );

  it.each(['self', 'admin', 'logout'] as const)(
    'rejects an old refresh finishing after %s revokes its session',
    async (kind) => {
      const { service, prisma, user } = createSessionHarness();
      const gate = pauseSessionHash(hashSpy);
      const refresh = service.refreshSession('old-refresh-token');
      await gate.started;

      const users = new UsersService(prisma as never);
      if (kind === 'self') {
        await users.changePassword(user.id, {
          currentPassword: 'old-password',
          newPassword: 'new-password',
        });
      } else if (kind === 'admin') {
        await users.resetPassword(user.id, { newPassword: 'new-password' });
      } else {
        await service.logout('old-refresh-token');
      }
      const rejection = expect(refresh).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      gate.resume('stale-refresh-hash');
      await rejection;
      expect(user.refreshTokenHash).toBeNull();
      expect(user.refreshTokenExpiry).toBeNull();
    },
  );

  it('does not let a losing concurrent refresh overwrite the winning refresh session', async () => {
    const { service, tokens, session, user } = createSessionHarness();
    tokens.generateSessionTokens
      .mockReturnValueOnce({
        ...session,
        refreshToken: 'pending-refresh-token',
      })
      .mockReturnValueOnce({
        ...session,
        refreshToken: 'winning-refresh-token',
      });
    const gate = pauseSessionHash(hashSpy, 'pending-refresh-token');
    const pending = service.refreshSession('old-refresh-token');
    await gate.started;

    const winner = await service.refreshSession('old-refresh-token');
    expect(winner.refreshToken).toBe('winning-refresh-token');
    const winningHash = user.refreshTokenHash;
    const rejection = expect(pending).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    gate.resume('stale-refresh-hash');
    await rejection;
    expect(user.refreshTokenHash).toBe(winningHash);
    expect(user.refreshTokenExpiry).toEqual(session.refreshTokenExpiresAt);
  });

  it('preserves OAuth exchange for a social account with a null password', async () => {
    const { service, prisma, user } = createSessionHarness({
      provider: 'google',
      password: null,
    });

    await expect(
      service.exchangeOauthCode('oauth-code'),
    ).resolves.toHaveProperty('access_token');
    expect(prisma.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: user.id, password: null },
      }),
    );
  });

  it('preserves verification and uses the updated verified-user snapshot to issue a session', async () => {
    const { service, prisma, user } = createSessionHarness({
      isEmailVerified: false,
      verifyOtp: 'otp-hash',
      verifyOtpExpiry: new Date(Date.now() + 60_000),
    });

    await expect(
      service.verifyEmail({ email: user.email, otp: '123456' }),
    ).resolves.toHaveProperty('access_token');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: user.id },
      data: { isEmailVerified: true, verifyOtp: null, verifyOtpExpiry: null },
    });
    expect(prisma.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: user.id, password: 'old-password-hash' },
      }),
    );
    expect(user.isEmailVerified).toBe(true);
  });

  it('rejects a guarded write that matches no user rather than returning tokens', async () => {
    const { service, prisma, user } = createSessionHarness();
    prisma.user.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.login({ email: user.email, password: 'old-password' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('does not wrap database errors from the guarded session write', async () => {
    const { service, prisma } = createSessionHarness();
    const failure = new Error('Database unavailable');
    prisma.user.updateMany.mockRejectedValue(failure);

    await expect(service.refreshSession('old-refresh-token')).rejects.toBe(
      failure,
    );
  });
});
