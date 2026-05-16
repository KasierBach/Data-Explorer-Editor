import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SocialAuthService } from '../social-auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private readonly logger = new Logger(GoogleStrategy.name);

  constructor(
    private socialAuthService: SocialAuthService,
    configService: ConfigService,
  ) {
    const clientID = (
      configService.get<string>('GOOGLE_CLIENT_ID') || ''
    ).trim();
    const clientSecret = (
      configService.get<string>('GOOGLE_CLIENT_SECRET') || ''
    ).trim();

    super({
      clientID: clientID || 'missing_client_id',
      clientSecret: clientSecret || 'missing_client_secret',
      callbackURL:
        configService.get<string>('GOOGLE_CALLBACK_URL') ||
        'http://localhost:3001/api/auth/google/callback',
      scope: ['email', 'profile'],
    });

    if (!clientID || !clientSecret) {
      this.logger.warn(
        'GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing. Google Auth will not work.',
      );
    }
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    try {
      const result = await this.socialAuthService.validateOAuthLogin(
        profile,
        'google',
      );
      done(null, result);
    } catch (error) {
      done(new UnauthorizedException(error.message), false);
    }
  }
}
