import { Controller, Post, Body, HttpCode, HttpStatus, Get, UseGuards, Req, Res } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { Throttle } from '@nestjs/throttler';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Post('login')
    @HttpCode(HttpStatus.OK)
    @Throttle({ default: { limit: 5, ttl: 60000 } }) // Max 5 login attempts per minute
    async login(@Body() loginDto: LoginDto) {
        return this.authService.login(loginDto);
    }

    @Post('register')
    async register(@Body() registerDto: RegisterDto) {
        return this.authService.register(registerDto);
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
        // req.user comes from GoogleStrategy's validate method
        const token = req.user.access_token;
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        res.redirect(`${frontendUrl}/login?token=${token}`);
    }

    @Get('github')
    @UseGuards(AuthGuard('github'))
    async githubAuth() {
        // Guard redirects to GitHub
    }

    @Get('github/callback')
    @UseGuards(AuthGuard('github'))
    async githubAuthRedirect(@Req() req: any, @Res() res: Response) {
        const token = req.user.access_token;
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        res.redirect(`${frontendUrl}/login?token=${token}`);
    }
}

