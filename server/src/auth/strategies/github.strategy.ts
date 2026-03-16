import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-github2';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SocialAuthService } from '../social-auth.service';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
    constructor(
        private socialAuthService: SocialAuthService,
        configService: ConfigService,
    ) {
        super({
            clientID: (configService.get<string>('GITHUB_CLIENT_ID') || process.env.GITHUB_CLIENT_ID || '').trim(),
            clientSecret: (configService.get<string>('GITHUB_CLIENT_SECRET') || process.env.GITHUB_CLIENT_SECRET || '').trim(),
            callbackURL: configService.get<string>('GITHUB_CALLBACK_URL') || process.env.GITHUB_CALLBACK_URL || 'http://localhost:3001/api/auth/github/callback',
            scope: ['user:email'],
        });
    }

    async validate(accessToken: string, refreshToken: string, profile: any, done: Function): Promise<any> {
        try {
            // Github API might not return emails in the default profile object if they are private
            if (!profile.emails || profile.emails.length === 0) {
                // Best effort fallback to username if email is completely hidden
                profile.emails = [{ value: `${profile.username}@github.local` }];
            }
            
            const result = await this.socialAuthService.validateOAuthLogin(profile, 'github');
            done(null, result);
        } catch (error) {
            done(new UnauthorizedException(error.message), false);
        }
    }
}
