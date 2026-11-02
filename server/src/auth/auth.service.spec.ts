import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

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
