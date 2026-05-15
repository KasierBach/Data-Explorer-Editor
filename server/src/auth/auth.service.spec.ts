import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

describe('AuthService - login', () => {
  let authService: AuthService;
  const mockPrisma: any = { user: { findUnique: jest.fn() } };
  const mockMailService = {} as any;
  const mockOtpService = {} as any;
  const mockSeedService = {} as any;
  const mockTokenService = {} as any;
  const mockAuditService = { log: jest.fn() } as any;

  beforeEach(() => {
    mockPrisma.user.findUnique = jest.fn();
    mockAuditService.log.mockClear();
    authService = new AuthService(
      mockPrisma,
      mockMailService,
      mockOtpService,
      mockSeedService,
      mockTokenService as any,
      mockAuditService as any,
    );
  });

  it('should throw UnauthorizedException when user not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    await expect(
      authService.login({ email: 'notfound@example.com', password: 'pw' } as LoginDto),
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
});
