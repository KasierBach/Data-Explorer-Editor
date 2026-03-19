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
        
        // Improve avatar extraction (Github uses _json.avatar_url sometimes)
        let avatarUrl = photos?.[0]?.value;
        if (!avatarUrl && profile._json?.avatar_url) {
            avatarUrl = profile._json.avatar_url;
        }

        // Extract names
        let firstName = name?.givenName || '';
        let lastName = name?.familyName || '';
        
        // GH might not have family/given name, try displayName
        if (!firstName && !lastName && (name?.displayName || profile.displayName)) {
            const displayName = name?.displayName || profile.displayName;
            const parts = displayName.split(' ');
            firstName = parts[0];
            lastName = parts.slice(1).join(' ') || '';
        }

        // Fallback for first name
        if (!firstName) firstName = username || 'User';
        
        // GH provides username directly
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

        // Check if user is banned
        if (user && user.isBanned) {
            throw new Error('Your account has been banned by an administrator.');
        }

        // 2. If user exists, update profile data from provider (keep it fresh)
        if (user) {
            user = await this.prisma.user.update({
                where: { id: user.id },
                data: {
                    provider,
                    providerId: id,
                    avatarUrl: avatarUrl || user.avatarUrl,
                    firstName: user.firstName || firstName,
                    lastName: user.lastName || lastName,
                }
            });
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
                isOnboarded: user.isOnboarded,
                role: user.role,
                username: user.username,
                jobRole: user.jobRole
            }
        };
    }
}
