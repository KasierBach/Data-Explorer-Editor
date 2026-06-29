import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuditAction, AuditService } from '../audit/audit.service';
import {
  normalizeAppLanguage,
  pickLocalizedText,
  type AppLanguage,
} from '../common/utils/i18n.util';
import { MailService } from '../mail/mail.service';
import { OtpService } from '../otp/otp.service';
import { PrismaService } from '../prisma/prisma.service';
import { SeedService } from '../seed/seed.service';
import { UserUtils } from '../users/user.utils';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { ResetPasswordWithOtpDto } from './dto/reset-password-otp.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { TokenService } from './token.service';

interface SessionUser {
  id: string;
  email: string;
  role: string;
  firstName?: string | null;
  lastName?: string | null;
  provider?: string;
  password?: string | null;
  isBanned?: boolean;
  isEmailVerified?: boolean;
  lastLoginIp?: string | null;
  securityAlerts?: boolean;
  language?: string | null;
  legalAcceptedAt?: Date | null;
}

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  private readonly SALT_ROUNDS = 10;
  private readonly VERIFY_OTP_EXPIRY = 15;
  private readonly RESET_OTP_EXPIRY = 5;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly otpService: OtpService,
    private readonly seedService: SeedService,
    private readonly tokenService: TokenService,
    private readonly auditService: AuditService,
  ) {}

  async onModuleInit() {
    await this.seedService.seedAdmin();
  }

  private async issueSession(user: SessionUser) {
    const session = this.tokenService.generateSessionTokens(user);
    const refreshTokenHash = await bcrypt.hash(
      session.refreshToken,
      this.SALT_ROUNDS,
    );

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        refreshTokenHash,
        refreshTokenExpiry: session.refreshTokenExpiresAt,
      },
    });

    return {
      access_token: session.accessToken,
      accessTokenExpiresAt: session.accessTokenExpiresAt,
      refreshToken: session.refreshToken,
      refreshTokenExpiresAt: session.refreshTokenExpiresAt,
      user: session.user,
    };
  }

  private async revokeRefreshSession(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        refreshTokenHash: null,
        refreshTokenExpiry: null,
      },
    });
  }

  private resolveLanguage(
    preferred?: string | null,
    fallback: AppLanguage = 'vi',
  ): AppLanguage {
    return normalizeAppLanguage(preferred ?? fallback);
  }

  private t(lang: AppLanguage, vi: string, en: string): string {
    return pickLocalizedText(lang, vi, en);
  }

  private providerLoginMessage(provider: string, lang: AppLanguage): string {
    return this.t(
      lang,
      `Tài khoản này được đăng nhập bằng ${provider}. Vui lòng đăng nhập qua ${provider}.`,
      `This account uses ${provider} sign-in. Please continue with ${provider}.`,
    );
  }

  private genericOtpSentMessage(lang: AppLanguage): string {
    return this.t(
      lang,
      'Nếu email đã được đăng ký, mã OTP đã được gửi.',
      'If the email is registered, an OTP has been sent.',
    );
  }

  async login(loginDto: LoginDto, clientIp?: string, lang: AppLanguage = 'vi') {
    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email },
    });

    if (!user) {
      await this.auditService.log({
        action: AuditAction.AUTH_LOGIN_FAILED,
        details: { email: loginDto.email, reason: 'User not found' },
        ipAddress: clientIp,
      });
      throw new UnauthorizedException(
        this.t(lang, 'Thông tin đăng nhập không hợp lệ', 'Invalid credentials'),
      );
    }

    const userLang = this.resolveLanguage(user.language, lang);

    if (!user.password && user.provider !== 'local') {
      throw new UnauthorizedException(
        this.providerLoginMessage(user.provider, userLang),
      );
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password!,
    );

    if (!isPasswordValid) {
      await this.auditService.log({
        action: AuditAction.AUTH_LOGIN_FAILED,
        userId: user.id,
        details: { email: loginDto.email, reason: 'Invalid password' },
        ipAddress: clientIp,
      });
      throw new UnauthorizedException(
        this.t(
          userLang,
          'Thông tin đăng nhập không hợp lệ',
          'Invalid credentials',
        ),
      );
    }

    if (user.isBanned) {
      throw new UnauthorizedException(
        this.t(
          userLang,
          'Tài khoản của bạn đã bị khóa bởi quản trị viên.',
          'Your account has been banned by an administrator.',
        ),
      );
    }

    if (!user.isEmailVerified) {
      throw new UnauthorizedException({
        message: this.t(
          userLang,
          'Vui lòng xác minh địa chỉ email',
          'Please verify your email address',
        ),
        unverified: true,
        email: user.email,
      });
    }

    if (
      clientIp &&
      user.lastLoginIp &&
      user.lastLoginIp !== clientIp &&
      user.securityAlerts
    ) {
      const displayName = UserUtils.getDisplayName(
        user.firstName,
        user.lastName,
        user.email,
      );
      const loginTime = new Date().toLocaleString(
        userLang === 'vi' ? 'vi-VN' : 'en-US',
        {
          timeZone: 'Asia/Ho_Chi_Minh',
        },
      );

      void this.mailService
        .sendSecurityAlertEmail(
          user.email,
          displayName,
          clientIp,
          loginTime,
          userLang,
        )
        .catch((error: unknown) => {
          this.logger.warn(
            `Security alert email failed for ${user.email}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        });
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginIp: clientIp || null },
    });

    await this.auditService.log({
      action: AuditAction.AUTH_LOGIN_SUCCESS,
      userId: user.id,
      details: { email: user.email },
      ipAddress: clientIp,
    });

    return this.issueSession(user);
  }

  async register(registerDto: RegisterDto, lang: AppLanguage = 'vi') {
    const preferredLang = this.resolveLanguage(lang);

    if (!registerDto.acceptedLegal) {
      throw new BadRequestException(
        this.t(
          preferredLang,
          'Bạn cần đồng ý với điều khoản và chính sách trước khi đăng ký.',
          'You must accept the terms and privacy policy before registering.',
        ),
      );
    }
    const existingUser = await this.prisma.user.findUnique({
      where: { email: registerDto.email },
    });

    if (existingUser && existingUser.isEmailVerified) {
      throw new ConflictException(
        this.t(
          preferredLang,
          'Email này đã được sử dụng.',
          'This email is already in use.',
        ),
      );
    }

    const hashedPassword = await bcrypt.hash(
      registerDto.password,
      this.SALT_ROUNDS,
    );
    const { firstName, lastName } = UserUtils.parseName(registerDto.name);
    const otp = this.otpService.generateOtp();
    const hashedOtp = await this.otpService.hashOtp(otp);
    const expiry = this.otpService.getExpiryDate(this.VERIFY_OTP_EXPIRY);

    let user;
    if (existingUser) {
      user = await this.prisma.user.update({
        where: { id: existingUser.id },
        data: {
          password: hashedPassword,
          firstName,
          lastName,
          language: preferredLang,
          legalAcceptedAt: new Date(),
          verifyOtp: hashedOtp,
          verifyOtpExpiry: expiry,
        },
      });
    } else {
      user = await this.prisma.user.create({
        data: {
          email: registerDto.email,
          password: hashedPassword,
          firstName,
          lastName,
          role: 'user',
          provider: 'local',
          isOnboarded: false,
          isEmailVerified: false,
          language: preferredLang,
          legalAcceptedAt: new Date(),
          verifyOtp: hashedOtp,
          verifyOtpExpiry: expiry,
        },
      });
    }

    const displayName = UserUtils.getDisplayName(
      firstName,
      lastName,
      registerDto.email,
    );

    void this.mailService
      .sendVerificationEmail(user.email, displayName, otp, preferredLang)
      .catch((err) => {
        console.error(
          'Failed to send verification email in background:',
          err.message,
        );
      });

    await this.auditService.log({
      action: AuditAction.AUTH_REGISTER,
      userId: user.id,
      details: { email: user.email, name: registerDto.name },
    });

    return {
      message: this.t(
        preferredLang,
        'Đăng ký thành công. Vui lòng kiểm tra email để nhận mã xác minh.',
        'Registration successful. Please check your email for the verification code.',
      ),
      unverified: true,
      email: user.email,
    };
  }

  async verifyEmail(dto: VerifyEmailDto, lang: AppLanguage = 'vi') {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new NotFoundException(
        this.t(lang, 'Không tìm thấy tài khoản.', 'Account not found.'),
      );
    }

    const userLang = this.resolveLanguage(user.language, lang);

    if (user.isEmailVerified) {
      return this.issueSession(user);
    }

    if (!user.verifyOtp || !user.verifyOtpExpiry) {
      throw new UnauthorizedException(
        this.t(
          userLang,
          'Mã xác minh không hợp lệ.',
          'Verification code is invalid.',
        ),
      );
    }

    if (this.otpService.isExpired(user.verifyOtpExpiry)) {
      throw new UnauthorizedException(
        this.t(
          userLang,
          'Mã xác minh đã hết hạn. Vui lòng nhận mã mới.',
          'Verification code expired. Please request a new one.',
        ),
      );
    }

    const isOtpValid = await this.otpService.verifyOtp(dto.otp, user.verifyOtp);
    if (!isOtpValid) {
      throw new UnauthorizedException(
        this.t(
          userLang,
          'Mã xác minh không đúng.',
          'Verification code is incorrect.',
        ),
      );
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        verifyOtp: null,
        verifyOtpExpiry: null,
      },
    });

    return this.issueSession(updatedUser);
  }

  async resendVerificationEmail(
    dto: ResendVerificationDto,
    lang: AppLanguage = 'vi',
  ) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new NotFoundException(
        this.t(lang, 'Không tìm thấy tài khoản.', 'Account not found.'),
      );
    }

    const userLang = this.resolveLanguage(user.language, lang);

    if (user.isEmailVerified) {
      throw new ConflictException(
        this.t(
          userLang,
          'Tài khoản này đã được xác minh.',
          'This account is already verified.',
        ),
      );
    }

    const otp = this.otpService.generateOtp();
    const hashedOtp = await this.otpService.hashOtp(otp);
    const expiry = this.otpService.getExpiryDate(this.VERIFY_OTP_EXPIRY);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { verifyOtp: hashedOtp, verifyOtpExpiry: expiry },
    });

    const displayName = UserUtils.getDisplayName(
      user.firstName,
      user.lastName,
      user.email,
    );
    await this.mailService.sendVerificationEmail(
      user.email,
      displayName,
      otp,
      userLang,
    );

    return {
      message: this.t(
        userLang,
        'Mã xác minh mới đã được gửi.',
        'A new verification code has been sent.',
      ),
    };
  }

  async forgotPassword(dto: ForgotPasswordDto, lang: AppLanguage = 'vi') {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      return { message: this.genericOtpSentMessage(lang) };
    }

    const userLang = this.resolveLanguage(user.language, lang);

    if (user.provider !== 'local') {
      throw new ConflictException(
        this.providerLoginMessage(user.provider, userLang),
      );
    }

    const otp = this.otpService.generateOtp();
    const hashedOtp = await this.otpService.hashOtp(otp);
    const expiry = this.otpService.getExpiryDate(this.RESET_OTP_EXPIRY);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { resetOtp: hashedOtp, resetOtpExpiry: expiry },
    });

    const displayName = UserUtils.getDisplayName(
      user.firstName,
      user.lastName,
      user.email,
    );
    await this.mailService.sendPasswordResetEmail(
      user.email,
      displayName,
      otp,
      userLang,
    );

    return { message: this.genericOtpSentMessage(userLang) };
  }

  async resetPasswordWithOtp(
    dto: ResetPasswordWithOtpDto,
    lang: AppLanguage = 'vi',
  ) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.resetOtp || !user.resetOtpExpiry) {
      throw new UnauthorizedException(
        this.t(
          lang,
          'Mã không hợp lệ hoặc đã hết hạn.',
          'The code is invalid or has expired.',
        ),
      );
    }

    const userLang = this.resolveLanguage(user.language, lang);

    if (this.otpService.isExpired(user.resetOtpExpiry)) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { resetOtp: null, resetOtpExpiry: null },
      });
      throw new UnauthorizedException(
        this.t(
          userLang,
          'Mã OTP đã hết hạn. Vui lòng yêu cầu lại.',
          'The OTP has expired. Please request a new one.',
        ),
      );
    }

    const isOtpValid = await this.otpService.verifyOtp(dto.otp, user.resetOtp);
    if (!isOtpValid) {
      throw new UnauthorizedException(
        this.t(
          userLang,
          'Mã xác minh không đúng.',
          'Verification code is incorrect.',
        ),
      );
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, this.SALT_ROUNDS);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetOtp: null,
        resetOtpExpiry: null,
        refreshTokenHash: null,
        refreshTokenExpiry: null,
      },
    });

    return {
      message: this.t(
        userLang,
        'Cập nhật mật khẩu thành công.',
        'Password updated successfully.',
      ),
    };
  }

  async exchangeOauthCode(code: string, lang: AppLanguage = 'vi') {
    const payload = this.tokenService.verifyOauthExchangeToken(code);
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException(
        this.t(
          lang,
          'Không tìm thấy tài khoản OAuth.',
          'OAuth account not found.',
        ),
      );
    }

    const userLang = this.resolveLanguage(user.language, lang);

    if (user.isBanned) {
      throw new UnauthorizedException(
        this.t(
          userLang,
          'Tài khoản của bạn đã bị khóa bởi quản trị viên.',
          'Your account has been banned by an administrator.',
        ),
      );
    }

    return this.issueSession(user);
  }

  async refreshSession(refreshToken?: string, lang: AppLanguage = 'vi') {
    const payload = this.tokenService.verifyRefreshToken(refreshToken);
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.refreshTokenHash || !user.refreshTokenExpiry) {
      throw new UnauthorizedException(
        this.t(
          lang,
          'Không tìm thấy phiên làm việc.',
          'Refresh session not found.',
        ),
      );
    }

    const userLang = this.resolveLanguage(user.language, lang);

    if (user.isBanned) {
      throw new UnauthorizedException(
        this.t(
          userLang,
          'Tài khoản của bạn đã bị khóa bởi quản trị viên.',
          'Your account has been banned by an administrator.',
        ),
      );
    }

    if (user.refreshTokenExpiry.getTime() < Date.now()) {
      await this.revokeRefreshSession(user.id);
      throw new UnauthorizedException(
        this.t(userLang, 'Refresh token đã hết hạn.', 'Refresh token expired.'),
      );
    }

    const isMatch = await bcrypt.compare(refreshToken!, user.refreshTokenHash);
    if (!isMatch) {
      await this.revokeRefreshSession(user.id);
      throw new UnauthorizedException(
        this.t(
          userLang,
          'Refresh token không hợp lệ.',
          'Refresh token is invalid.',
        ),
      );
    }

    return this.issueSession(user);
  }

  async logout(refreshToken?: string, lang: AppLanguage = 'vi') {
    if (!refreshToken) {
      return {
        message: this.t(lang, 'Đã đăng xuất.', 'Logged out.'),
      };
    }

    try {
      const payload = this.tokenService.verifyRefreshToken(refreshToken);
      if (payload.sub) {
        await this.revokeRefreshSession(payload.sub);
      }
    } catch {
      // Ignore invalid refresh tokens while still clearing cookies on the client.
    }

    return {
      message: this.t(lang, 'Đã đăng xuất.', 'Logged out.'),
    };
  }
}
