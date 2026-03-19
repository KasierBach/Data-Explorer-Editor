import { Injectable, UnauthorizedException, ConflictException, OnModuleInit, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordWithOtpDto } from './dto/reset-password-otp.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

@Injectable()
export class AuthService implements OnModuleInit {
    private readonly SALT_ROUNDS = 10;
    private readonly OTP_EXPIRY_MINUTES = 15; // 15 mins for verification
    private readonly RESET_OTP_EXPIRY_MINUTES = 5;

    constructor(
        private readonly jwtService: JwtService,
        private readonly prisma: PrismaService,
        private readonly mailService: MailService,
    ) { }

    async onModuleInit() {
        await this.seedAdmin();
    }

    // ─── Login ──────────────────────────────────────────────────────

    async login(loginDto: LoginDto, clientIp?: string) {
        const user = await this.prisma.user.findUnique({
            where: { email: loginDto.email },
        });

        if (!user) {
            throw new UnauthorizedException('Thông tin đăng nhập không hợp lệ');
        }

        // Only check password if the user signed up with local provider
        if (!user.password && user.provider !== 'local') {
            throw new UnauthorizedException(`Tài khoản này được đăng nhập bằng ${user.provider}. Vui lòng đăng nhập qua ${user.provider}.`);
        }

        const isPasswordValid = await bcrypt.compare(loginDto.password, user.password!);
        if (!isPasswordValid) {
            throw new UnauthorizedException('Thông tin đăng nhập không hợp lệ');
        }

        // Banned Check
        if (user.isBanned) {
            throw new UnauthorizedException('Tài khoản của bạn đã bị khóa bởi quản trị viên.');
        }

        // Email Verification Check
        if (!user.isEmailVerified) {
            throw new UnauthorizedException({
                message: 'Vui lòng xác minh địa chỉ email',
                unverified: true,
                email: user.email,
            });
        }

        // Security alert: check if IP is new
        if (clientIp && user.lastLoginIp && user.lastLoginIp !== clientIp && user.securityAlerts) {
            const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
            const loginTime = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
            this.mailService.sendSecurityAlertEmail(user.email, displayName, clientIp, loginTime);
        }

        // Update last login IP
        await this.prisma.user.update({
            where: { id: user.id },
            data: { lastLoginIp: clientIp || null },
        });

        const payload = { email: user.email, sub: user.id, role: user.role };
        return {
            access_token: this.jwtService.sign(payload),
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                avatarUrl: user.avatarUrl,
                isOnboarded: user.isOnboarded,
            },
        };
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
        const nameParts = registerDto.name.split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ');

        const otp = crypto.randomInt(100000, 999999).toString();
        const hashedOtp = await bcrypt.hash(otp, this.SALT_ROUNDS);
        const expiry = new Date(Date.now() + this.OTP_EXPIRY_MINUTES * 60 * 1000);

        let user;
        if (existingUser) {
            // Update the unverified account with new info
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
            // Create new account
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

        const displayName = [firstName, lastName].filter(Boolean).join(' ') || registerDto.email;
        this.mailService.sendVerificationEmail(user.email, displayName, otp);

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
            return this.generateTokenResponse(user);
        }

        if (!user.verifyOtp || !user.verifyOtpExpiry) {
            throw new UnauthorizedException('Mã xác minh không hợp lệ.');
        }

        if (new Date() > user.verifyOtpExpiry) {
            throw new UnauthorizedException('Mã xác minh đã hết hạn. Vui lòng nhận mã mới.');
        }

        const isOtpValid = await bcrypt.compare(dto.otp, user.verifyOtp);
        if (!isOtpValid) {
            throw new UnauthorizedException('Mã xác minh không đúng.');
        }

        // OTP Valid. Mark as verified.
        const updatedUser = await this.prisma.user.update({
            where: { id: user.id },
            data: {
                isEmailVerified: true,
                verifyOtp: null,
                verifyOtpExpiry: null,
            },
        });

        // Return token to log them in instantly
        return this.generateTokenResponse(updatedUser);
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

        const otp = crypto.randomInt(100000, 999999).toString();
        const hashedOtp = await bcrypt.hash(otp, this.SALT_ROUNDS);
        const expiry = new Date(Date.now() + this.OTP_EXPIRY_MINUTES * 60 * 1000);

        await this.prisma.user.update({
            where: { id: user.id },
            data: { verifyOtp: hashedOtp, verifyOtpExpiry: expiry },
        });

        const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
        await this.mailService.sendVerificationEmail(user.email, displayName, otp);

        return { message: 'Mã xác minh mới đã được gửi.' };
    }

    // ─── Utility to Generate Token ──────────────────────────────────
    private generateTokenResponse(user: any) {
        const payload = { email: user.email, sub: user.id, role: user.role };
        return {
            access_token: this.jwtService.sign(payload),
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                avatarUrl: user.avatarUrl,
                isOnboarded: user.isOnboarded,
            },
        };
    }

    // ─── Forgot Password ────────────────────────────────────────────

    async forgotPassword(dto: ForgotPasswordDto) {
        const user = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });

        if (!user) {
            // Don't reveal whether the email exists
            return { message: 'If the email is registered, an OTP has been sent.' };
        }

        if (user.provider !== 'local') {
            throw new ConflictException(`Tài khoản này được đăng nhập bằng ${user.provider}. Vui lòng đăng nhập qua ${user.provider}.`);
        }

        // Generate 6-digit OTP
        const otp = crypto.randomInt(100000, 999999).toString();
        const hashedOtp = await bcrypt.hash(otp, this.SALT_ROUNDS);
        const expiry = new Date(Date.now() + this.RESET_OTP_EXPIRY_MINUTES * 60 * 1000);

        await this.prisma.user.update({
            where: { id: user.id },
            data: { resetOtp: hashedOtp, resetOtpExpiry: expiry },
        });

        const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
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

        // Check expiry
        if (new Date() > user.resetOtpExpiry) {
            // Clean up expired OTP
            await this.prisma.user.update({
                where: { id: user.id },
                data: { resetOtp: null, resetOtpExpiry: null },
            });
            throw new UnauthorizedException('Mã OTP đã hết hạn. Vui lòng yêu cầu lại.');
        }

        // Verify OTP
        const isOtpValid = await bcrypt.compare(dto.otp, user.resetOtp);
        if (!isOtpValid) {
            throw new UnauthorizedException('Mã xác minh không đúng.');
        }

        // Update password and clear OTP
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

    // ─── Seed Admin ─────────────────────────────────────────────────

    private async seedAdmin() {
        const userCount = await this.prisma.user.count();
        if (userCount === 0) {
            const adminEmail = process.env.ADMIN_EMAIL || 'admin@dataexplorer.com';
            const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
            const hashedPassword = await bcrypt.hash(adminPassword, this.SALT_ROUNDS);
            await this.prisma.user.create({
                data: {
                    firstName: 'System',
                    lastName: 'Admin',
                    email: adminEmail,
                    password: hashedPassword,
                    role: 'admin',
                    provider: 'local',
                    isOnboarded: true,
                    isEmailVerified: true, // Auto verify admin
                    username: 'admin',
                },
            });
            console.log(`[Auth] Default admin seeded: ${adminEmail} (password: ***)`);
        }
    }
}
