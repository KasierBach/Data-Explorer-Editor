import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SocialAuthService } from '../social-auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
    constructor(
        private socialAuthService: SocialAuthService,
        configService: ConfigService,
    ) {
        super({
            clientID: (configService.get<string>('GOOGLE_CLIENT_ID') || process.env.GOOGLE_CLIENT_ID || '').trim(),
            clientSecret: (configService.get<string>('GOOGLE_CLIENT_SECRET') || process.env.GOOGLE_CLIENT_SECRET || '').trim(),
            callbackURL: configService.get<string>('GOOGLE_CALLBACK_URL') || process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/api/auth/google/callback',
            scope: ['email', 'profile'],
        });
    }

    async validate(accessToken: string, refreshToken: string, profile: any, done: VerifyCallback): Promise<any> {
        try {
            const result = await this.socialAuthService.validateOAuthLogin(profile, 'google');
            done(null, result);
        } catch (error) {
            done(new UnauthorizedException(error.message), false);
        }
    }
}
