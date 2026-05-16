import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getRequiredSecret } from '../common/utils/secret.util';

const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
const NOTIFICATIONS_STREAM_TICKET_TTL_SECONDS = 15 * 60;

@Injectable()
export class TokenService {
  constructor(private readonly jwtService: JwtService) {}

  // Allow a small amount of clock skew to avoid false negatives
  // when multiple services/machines have slightly different times.
  private readonly clockToleranceSeconds = 5;

  private getRefreshSecret() {
    const configured = (process.env.REFRESH_TOKEN_SECRET || '').trim();
    if (configured) {
      return getRequiredSecret('REFRESH_TOKEN_SECRET', {
        minLength: 32,
        disallowValues: ['super-secret-key', 'your-secret-key'],
      });
    }

    return getRequiredSecret('JWT_SECRET', {
      minLength: 32,
      disallowValues: ['super-secret-key', 'your-secret-key'],
    });
  }

  private buildAccessPayload(user: any) {
    return {
      email: user.email,
      sub: user.id,
      role: user.role,
    };
  }

  buildUserProfile(user: any) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      isOnboarded: user.isOnboarded,
      role: user.role,
      username: user.username,
      jobRole: user.jobRole,
    };
  }

  createAccessToken(user: any) {
    return this.jwtService.sign(this.buildAccessPayload(user), {
      expiresIn: `${ACCESS_TOKEN_TTL_SECONDS}s`,
    });
  }

  createRefreshToken(user: any) {
    return this.jwtService.sign(
      {
        sub: user.id,
        type: 'refresh',
      },
      {
        expiresIn: `${REFRESH_TOKEN_TTL_SECONDS}s`,
        secret: this.getRefreshSecret(),
      },
    );
  }

  getAccessTokenExpiryTimestamp() {
    return Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SECONDS;
  }

  getRefreshTokenExpiryDate() {
    return new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);
  }

  generateSessionTokens(user: any) {
    return {
      accessToken: this.createAccessToken(user),
      refreshToken: this.createRefreshToken(user),
      accessTokenExpiresAt: this.getAccessTokenExpiryTimestamp(),
      refreshTokenExpiresAt: this.getRefreshTokenExpiryDate(),
      user: this.buildUserProfile(user),
    };
  }

  createMigrationProgressTicket(userId: string, jobId: string) {
    return this.jwtService.sign(
      {
        sub: userId,
        jobId,
        type: 'migration-progress',
      },
      {
        expiresIn: '2m',
      },
    );
  }

  createNotificationsStreamTicket(userId: string) {
    return this.jwtService.sign(
      {
        sub: userId,
        type: 'notifications-stream',
      },
      {
        expiresIn: `${NOTIFICATIONS_STREAM_TICKET_TTL_SECONDS}s`,
      },
    );
  }

  verifyNotificationsStreamTicket(ticket?: string) {
    if (!ticket) {
      throw new UnauthorizedException('Missing notifications stream ticket.');
    }

    try {
      const payload = this.jwtService.verify(ticket, {
        clockTolerance: this.clockToleranceSeconds,
      });

      if (payload.type !== 'notifications-stream' || !payload.sub) {
        throw new UnauthorizedException('Invalid notifications stream ticket.');
      }

      return payload;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException(
        'Notifications stream ticket is invalid or expired.',
      );
    }
  }

  verifyMigrationProgressTicket(ticket?: string) {
    if (!ticket) {
      throw new UnauthorizedException('Missing migration progress ticket.');
    }

    try {
      const payload = this.jwtService.verify(ticket, {
        clockTolerance: this.clockToleranceSeconds,
      });

      if (
        payload.type !== 'migration-progress' ||
        !payload.sub ||
        !payload.jobId
      ) {
        throw new UnauthorizedException('Invalid migration progress ticket.');
      }

      return payload;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException(
        'Migration progress ticket is invalid or expired.',
      );
    }
  }

  verifyRefreshToken(token?: string) {
    if (!token) {
      throw new UnauthorizedException('Missing refresh token.');
    }

    try {
      const payload = this.jwtService.verify(token, {
        secret: this.getRefreshSecret(),
        clockTolerance: this.clockToleranceSeconds,
      });

      if (payload.type !== 'refresh' || !payload.sub) {
        throw new UnauthorizedException('Invalid refresh token.');
      }

      return payload;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('Refresh token is invalid or expired.');
    }
  }

  createOauthExchangeToken(userId: string) {
    return this.jwtService.sign(
      {
        sub: userId,
        type: 'oauth-exchange',
      },
      {
        expiresIn: '2m',
      },
    );
  }

  verifyOauthExchangeToken(ticket?: string) {
    if (!ticket) {
      throw new UnauthorizedException('Missing OAuth exchange token.');
    }

    try {
      const payload = this.jwtService.verify(ticket, {
        clockTolerance: this.clockToleranceSeconds,
      });

      if (payload.type !== 'oauth-exchange' || !payload.sub) {
        throw new UnauthorizedException('Invalid OAuth exchange token.');
      }

      return payload;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException(
        'OAuth exchange token is invalid or expired.',
      );
    }
  }
}
