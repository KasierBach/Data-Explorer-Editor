import { Injectable, UnauthorizedException, ConflictException, OnModuleInit, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { OtpService } from '../otp/otp.service';
import { SeedService } from '../seed/seed.service';
import { TokenService } from './token.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordWithOtpDto } from './dto/reset-password-otp.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { UserUtils } from '../users/user.utils';
import { AuditService, AuditAction } from '../audit/audit.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService implements OnModuleInit {
    private readonly SALT_ROUNDS = 10;
    private readonly VERIFY_OTP_EXPIRY = 15; // mins
    private readonly RESET_OTP_EXPIRY = 5; // mins

    constructor(
        private readonly prisma: PrismaService,
        private readonly mailService: MailService,
        private readonly otpService: OtpService,
        private readonly seedService: SeedService,
        private readonly tokenService: TokenService,
        private readonly auditService: AuditService,
    ) { }

    async onModuleInit() {
        await this.seedService.seedAdmin();
    }

    // ─── Login ──────────────────────────────────────────────────────

    async login(loginDto: LoginDto, clientIp?: string) {
        const user = await this.prisma.user.findUnique({
            where: { email: loginDto.email },
        });

        if (!user) {
            await this.auditService.log({
                action: AuditAction.AUTH_LOGIN_FAILED,
                details: { email: loginDto.email, reason: 'User not found' },
                ipAddress: clientIp
            });
            throw new UnauthorizedException('Thông tin đăng nhập không hợp lệ');
        }

        if (!user.password && user.provider !== 'local') {
            throw new UnauthorizedException(`Tài khoản này được đăng nhập bằng ${user.provider}. Vui lòng đăng nhập qua ${user.provider}.`);
        }

        const isPasswordValid = await bcrypt.compare(loginDto.password, user.password!);
        if (!isPasswordValid) {
            await this.auditService.log({
                action: AuditAction.AUTH_LOGIN_FAILED,
                userId: user.id,
                details: { email: loginDto.email, reason: 'Invalid password' },
                ipAddress: clientIp
            });
            throw new UnauthorizedException('Thông tin đăng nhập không hợp lệ');
        }

        if (user.isBanned) {
            throw new UnauthorizedException('Tài khoản của bạn đã bị khóa bởi quản trị viên.');
        }

        if (!user.isEmailVerified) {
            throw new UnauthorizedException({
                message: 'Vui lòng xác minh địa chỉ email',
                unverified: true,
                email: user.email,
            });
        }

        if (clientIp && user.lastLoginIp && user.lastLoginIp !== clientIp && user.securityAlerts) {
            const displayName = UserUtils.getDisplayName(user.firstName, user.lastName, user.email);
            const loginTime = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
            this.mailService.sendSecurityAlertEmail(user.email, displayName, clientIp, loginTime);
        }

        await this.prisma.user.update({
            where: { id: user.id },
            data: { lastLoginIp: clientIp || null },
        });

        await this.auditService.log({
            action: AuditAction.AUTH_LOGIN_SUCCESS,
            userId: user.id,
            details: { email: user.email },
            ipAddress: clientIp
        });

        return this.tokenService.generateTokenResponse(user);
    }

    // ─── Register ───────────────────────────────────────────────────

    async register(registerDto: RegisterDto) {
        const existingUser = await this.prisma.user.findUnique({
            where: { email: registerDto.email },
        });

        if (existingUser && existingUser.isEmailVerified) {
            throw new ConflictException('Email này đã được sử dụng.');
        }

        const hashedPassword = await bcrypt.hash(registerDto.password, this.SALT_ROUNDS);
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
                    verifyOtp: hashedOtp,
                    verifyOtpExpiry: expiry,
                },
            });
        }

        const displayName = UserUtils.getDisplayName(firstName, lastName, registerDto.email);
        this.mailService.sendVerificationEmail(user.email, displayName, otp).catch(err => {
            console.error('Failed to send verification email in background:', err.message);
        });

        await this.auditService.log({
            action: AuditAction.AUTH_REGISTER,
            userId: user.id,
            details: { email: user.email, name: registerDto.name }
        });

        return {
            message: 'Đăng ký thành công. Vui lòng kiểm tra email để nhận mã xác minh.',
            unverified: true,
            email: user.email,
        };
    }

    // ─── Email Verification ─────────────────────────────────────────

    async verifyEmail(dto: VerifyEmailDto) {
        const user = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });

        if (!user) {
            throw new NotFoundException('Không tìm thấy tài khoản.');
        }

        if (user.isEmailVerified) {
            return this.tokenService.generateTokenResponse(user);
        }

        if (!user.verifyOtp || !user.verifyOtpExpiry) {
            throw new UnauthorizedException('Mã xác minh không hợp lệ.');
        }

        if (this.otpService.isExpired(user.verifyOtpExpiry)) {
            throw new UnauthorizedException('Mã xác minh đã hết hạn. Vui lòng nhận mã mới.');
        }

        const isOtpValid = await this.otpService.verifyOtp(dto.otp, user.verifyOtp);
        if (!isOtpValid) {
            throw new UnauthorizedException('Mã xác minh không đúng.');
        }

        const updatedUser = await this.prisma.user.update({
            where: { id: user.id },
            data: {
                isEmailVerified: true,
                verifyOtp: null,
                verifyOtpExpiry: null,
            },
        });

        return this.tokenService.generateTokenResponse(updatedUser);
    }

    async resendVerificationEmail(dto: ResendVerificationDto) {
        const user = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });

        if (!user) {
            throw new NotFoundException('Không tìm thấy tài khoản.');
        }

        if (user.isEmailVerified) {
            throw new ConflictException('Tài khoản này đã được xác minh.');
        }

        const otp = this.otpService.generateOtp();
        const hashedOtp = await this.otpService.hashOtp(otp);
        const expiry = this.otpService.getExpiryDate(this.VERIFY_OTP_EXPIRY);

        await this.prisma.user.update({
            where: { id: user.id },
            data: { verifyOtp: hashedOtp, verifyOtpExpiry: expiry },
        });

        const displayName = UserUtils.getDisplayName(user.firstName, user.lastName, user.email);
        await this.mailService.sendVerificationEmail(user.email, displayName, otp);

        return { message: 'Mã xác minh mới đã được gửi.' };
    }

    // ─── Forgot Password ────────────────────────────────────────────

    async forgotPassword(dto: ForgotPasswordDto) {
        const user = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });

        if (!user) {
            return { message: 'If the email is registered, an OTP has been sent.' };
        }

        if (user.provider !== 'local') {
            throw new ConflictException(`Tài khoản này được đăng nhập bằng ${user.provider}. Vui lòng đăng nhập qua ${user.provider}.`);
        }

        const otp = this.otpService.generateOtp();
        const hashedOtp = await this.otpService.hashOtp(otp);
        const expiry = this.otpService.getExpiryDate(this.RESET_OTP_EXPIRY);

        await this.prisma.user.update({
            where: { id: user.id },
            data: { resetOtp: hashedOtp, resetOtpExpiry: expiry },
        });

        const displayName = UserUtils.getDisplayName(user.firstName, user.lastName, user.email);
        await this.mailService.sendPasswordResetEmail(user.email, displayName, otp);

        return { message: 'If the email is registered, an OTP has been sent.' };
    }

    // ─── Reset Password with OTP ────────────────────────────────────

    async resetPasswordWithOtp(dto: ResetPasswordWithOtpDto) {
        const user = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });

        if (!user || !user.resetOtp || !user.resetOtpExpiry) {
            throw new UnauthorizedException('Mã không hợp lệ hoặc đã hết hạn.');
        }

        if (this.otpService.isExpired(user.resetOtpExpiry)) {
            await this.prisma.user.update({
                where: { id: user.id },
                data: { resetOtp: null, resetOtpExpiry: null },
            });
            throw new UnauthorizedException('Mã OTP đã hết hạn. Vui lòng yêu cầu lại.');
        }

        const isOtpValid = await this.otpService.verifyOtp(dto.otp, user.resetOtp);
        if (!isOtpValid) {
            throw new UnauthorizedException('Mã xác minh không đúng.');
        }

        const hashedPassword = await bcrypt.hash(dto.newPassword, this.SALT_ROUNDS);
        await this.prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                resetOtp: null,
                resetOtpExpiry: null,
            },
        });

        return { message: 'Cập nhật mật khẩu thành công.' };
    }
}
