import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-github2';
import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SocialAuthService } from '../social-auth.service';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  private readonly logger = new Logger(GithubStrategy.name);

  constructor(
    private socialAuthService: SocialAuthService,
    configService: ConfigService,
  ) {
    const clientID = (
      configService.get<string>('GITHUB_CLIENT_ID') || ''
    ).trim();
    const clientSecret = (
      configService.get<string>('GITHUB_CLIENT_SECRET') || ''
    ).trim();

    super({
      clientID: clientID || 'missing_client_id',
      clientSecret: clientSecret || 'missing_client_secret',
      callbackURL:
        configService.get<string>('GITHUB_CALLBACK_URL') ||
        'http://localhost:3001/api/auth/github/callback',
      scope: ['user:email'],
    });

    if (!clientID || !clientSecret) {
      this.logger.warn(
        'GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET is missing. Github Auth will not work.',
      );
    }
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: (error: Error | null, user?: unknown) => void,
  ): Promise<any> {
    try {
      // Github API might not return emails in the default profile object if they are private
      if (!profile.emails || profile.emails.length === 0) {
        // Best effort fallback to username if email is completely hidden
        profile.emails = [{ value: `${profile.username}@github.local` }];
      }

      const result = await this.socialAuthService.validateOAuthLogin(
        profile,
        'github',
      );
      done(null, result);
    } catch (error) {
      done(
        new UnauthorizedException(
          error instanceof Error
            ? error.message
            : 'GitHub authentication failed',
        ),
        false,
      );
    }
  }
}
