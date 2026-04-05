import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class TokenService {
    constructor(private readonly jwtService: JwtService) {}

    /**
     * Generates a token response with access_token and user profile data.
     */
    generateTokenResponse(user: any) {
        const payload = { 
            email: user.email, 
            sub: user.id, 
            role: user.role 
        };
        
        return {
            access_token: this.jwtService.sign(payload),
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                avatarUrl: user.avatarUrl,
                isOnboarded: user.isOnboarded,
                role: user.role,
                username: user.username,
                jobRole: user.jobRole
            },
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

    verifyMigrationProgressTicket(ticket?: string) {
        if (!ticket) {
            throw new UnauthorizedException('Missing migration progress ticket.');
        }

        try {
            const payload = this.jwtService.verify(ticket) as {
                sub?: string;
                jobId?: string;
                type?: string;
            };

            if (payload.type !== 'migration-progress' || !payload.sub || !payload.jobId) {
                throw new UnauthorizedException('Invalid migration progress ticket.');
            }

            return payload;
        } catch (error) {
            if (error instanceof UnauthorizedException) {
                throw error;
            }

            throw new UnauthorizedException('Migration progress ticket is invalid or expired.');
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
            const payload = this.jwtService.verify(ticket) as {
                sub?: string;
                type?: string;
            };

            if (payload.type !== 'oauth-exchange' || !payload.sub) {
                throw new UnauthorizedException('Invalid OAuth exchange token.');
            }

            return payload;
        } catch (error) {
            if (error instanceof UnauthorizedException) {
                throw error;
            }

            throw new UnauthorizedException('OAuth exchange token is invalid or expired.');
        }
    }
}
