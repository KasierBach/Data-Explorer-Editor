import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SocialAuthService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService,
    ) { }

    async validateOAuthLogin(profile: any, provider: 'google' | 'github') {
        const { id, emails, name, photos, username } = profile;
        const email = emails?.[0]?.value;
        const avatarUrl = photos?.[0]?.value;

        // Extract names
        let firstName = name?.givenName || '';
        let lastName = name?.familyName || '';
        
        // Github might only provide displayName
        if (!firstName && !lastName && name?.displayName) {
            const parts = name.displayName.split(' ');
            firstName = parts[0];
            lastName = parts.slice(1).join(' ');
        }
        
        // Github provides username directly
        const gitHubUsername = username || null;

        if (!email) {
            throw new Error('No email provided by the OAuth provider');
        }

        // 1. Check if user exists by providerId OR email
        let user = await this.prisma.user.findFirst({
            where: {
                OR: [
                    { providerId: id, provider },
                    { email } // Account linking if email matches
                ]
            }
        });

        // 2. If user exists but linked to local, update to include social data (or just log them in)
        if (user) {
            if (user.provider === 'local') {
                // Optionally link accounts
                user = await this.prisma.user.update({
                    where: { id: user.id },
                    data: {
                        provider,
                        providerId: id,
                        avatarUrl: user.avatarUrl || avatarUrl,
                    }
                });
            }
        } else {
            // 3. Register new user
            user = await this.prisma.user.create({
                data: {
                    email,
                    provider,
                    providerId: id,
                    firstName,
                    lastName,
                    avatarUrl,
                    username: gitHubUsername, // Might be null for Google
                    role: 'user',
                    isOnboarded: false // New users must complete onboarding
                }
            });
        }

        // Generate JWT Token
        const payload = { email: user.email, sub: user.id, role: user.role };
        return {
            access_token: this.jwtService.sign(payload),
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                avatarUrl: user.avatarUrl,
                isOnboarded: user.isOnboarded
            }
        };
    }
}
