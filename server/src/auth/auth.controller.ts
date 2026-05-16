import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  UseGuards,
  Req,
  Res,
  Ip,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import type { AuthenticatedRequest } from './auth-request.types';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordWithOtpDto } from './dto/reset-password-otp.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { Throttle } from '@nestjs/throttler';
import { ExchangeOauthCodeDto } from './dto/exchange-oauth-code.dto';
import { TokenService } from './token.service';
import {
  extractCookie,
  getClearedRefreshTokenCookieOptions,
  getRefreshTokenCookieOptions,
  REFRESH_TOKEN_COOKIE,
} from './auth-cookie.util';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly tokenService: TokenService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async login(
    @Body() loginDto: LoginDto,
    @Ip() ip: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const session = await this.authService.login(loginDto, ip);
    res.cookie(
      REFRESH_TOKEN_COOKIE,
      session.refreshToken,
      getRefreshTokenCookieOptions(
        session.refreshTokenExpiresAt.getTime() - Date.now(),
      ),
    );

    return {
      access_token: session.access_token,
      accessTokenExpiresAt: session.accessTokenExpiresAt,
      user: session.user,
    };
  }

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async verifyEmail(
    @Body() dto: VerifyEmailDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const session = await this.authService.verifyEmail(dto);
    res.cookie(
      REFRESH_TOKEN_COOKIE,
      session.refreshToken,
      getRefreshTokenCookieOptions(
        session.refreshTokenExpiresAt.getTime() - Date.now(),
      ),
    );

    return {
      access_token: session.access_token,
      accessTokenExpiresAt: session.accessTokenExpiresAt,
      user: session.user,
    };
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerificationEmail(dto);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
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
  async exchangeOauthCode(
    @Body() dto: ExchangeOauthCodeDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const session = await this.authService.exchangeOauthCode(dto.code);
    res.cookie(
      REFRESH_TOKEN_COOKIE,
      session.refreshToken,
      getRefreshTokenCookieOptions(
        session.refreshTokenExpiresAt.getTime() - Date.now(),
      ),
    );

    return {
      access_token: session.access_token,
      accessTokenExpiresAt: session.accessTokenExpiresAt,
      user: session.user,
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = extractCookie(req, REFRESH_TOKEN_COOKIE);
    const session = await this.authService.refreshSession(refreshToken);
    res.cookie(
      REFRESH_TOKEN_COOKIE,
      session.refreshToken,
      getRefreshTokenCookieOptions(
        session.refreshTokenExpiresAt.getTime() - Date.now(),
      ),
    );

    return {
      access_token: session.access_token,
      accessTokenExpiresAt: session.accessTokenExpiresAt,
      user: session.user,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = extractCookie(req, REFRESH_TOKEN_COOKIE);
    const result = await this.authService.logout(refreshToken);
    res.cookie(REFRESH_TOKEN_COOKIE, '', getClearedRefreshTokenCookieOptions());
    return result;
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {
    // Guard redirects to Google
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    const code = this.tokenService.createOauthExchangeToken(req.user.id);
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
  async githubAuthRedirect(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    const code = this.tokenService.createOauthExchangeToken(req.user.id);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/login#code=${encodeURIComponent(code)}`);
  }
}
