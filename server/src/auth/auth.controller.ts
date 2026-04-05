import { Controller, Post, Body, HttpCode, HttpStatus, Get, UseGuards, Req, Res, Ip } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordWithOtpDto } from './dto/reset-password-otp.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { Throttle } from '@nestjs/throttler';
import { ExchangeOauthCodeDto } from './dto/exchange-oauth-code.dto';
import { TokenService } from './token.service';

@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly tokenService: TokenService,
    ) {}

    @Post('login')
    @HttpCode(HttpStatus.OK)
    @Throttle({ default: { limit: 5, ttl: 60000 } })
    async login(@Body() loginDto: LoginDto, @Ip() ip: string) {
        return this.authService.login(loginDto, ip);
    }

    @Post('register')
    async register(@Body() registerDto: RegisterDto) {
        return this.authService.register(registerDto);
    }

    @Post('verify-email')
    @HttpCode(HttpStatus.OK)
    @Throttle({ default: { limit: 5, ttl: 60000 } })
    async verifyEmail(@Body() dto: VerifyEmailDto) {
        return this.authService.verifyEmail(dto);
    }

    @Post('resend-verification')
    @HttpCode(HttpStatus.OK)
    @Throttle({ default: { limit: 3, ttl: 60000 } })
    async resendVerification(@Body() dto: ResendVerificationDto) {
        return this.authService.resendVerificationEmail(dto);
    }

    @Post('forgot-password')
    @HttpCode(HttpStatus.OK)
    @Throttle({ default: { limit: 3, ttl: 60000 } }) // Max 3 requests per minute
    async forgotPassword(@Body() dto: ForgotPasswordDto) {
        return this.authService.forgotPassword(dto);
    }

    @Post('reset-password')
    @HttpCode(HttpStatus.OK)
    @Throttle({ default: { limit: 5, ttl: 60000 } })
    async resetPassword(@Body() dto: ResetPasswordWithOtpDto) {
        return this.authService.resetPasswordWithOtp(dto);
    }

    @Post('exchange-oauth-code')
    @HttpCode(HttpStatus.OK)
    @Throttle({ default: { limit: 10, ttl: 60000 } })
    async exchangeOauthCode(@Body() dto: ExchangeOauthCodeDto) {
        return this.authService.exchangeOauthCode(dto.code);
    }

    // --- Social Login Routes ---

    @Get('google')
    @UseGuards(AuthGuard('google'))
    async googleAuth() {
        // Guard redirects to Google
    }

    @Get('google/callback')
    @UseGuards(AuthGuard('google'))
    async googleAuthRedirect(@Req() req: any, @Res() res: Response) {
        const code = this.tokenService.createOauthExchangeToken(req.user.user.id);
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        res.redirect(`${frontendUrl}/login#code=${encodeURIComponent(code)}`);
    }

    @Get('github')
    @UseGuards(AuthGuard('github'))
    async githubAuth() {
        // Guard redirects to GitHub
    }

    @Get('github/callback')
    @UseGuards(AuthGuard('github'))
    async githubAuthRedirect(@Req() req: any, @Res() res: Response) {
        const code = this.tokenService.createOauthExchangeToken(req.user.user.id);
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        res.redirect(`${frontendUrl}/login#code=${encodeURIComponent(code)}`);
    }
}
