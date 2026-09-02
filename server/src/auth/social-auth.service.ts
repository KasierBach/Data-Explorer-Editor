import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserUtils } from '../users/user.utils';

@Injectable()
export class SocialAuthService {
  constructor(private readonly prisma: PrismaService) {}

  async validateOAuthLogin(profile: any, provider: 'google' | 'github') {
    const { id, emails, name, photos, username } = profile;
    const emailEntry =
      emails?.find((entry: any) => entry?.verified === true) ?? emails?.[0];
    const email = emailEntry?.value;
    const emailVerified =
      provider === 'google'
        ? profile._json?.email_verified === true
        : emailEntry?.verified === true;

    // Improve avatar extraction (Github uses _json.avatar_url sometimes)
    let avatarUrl = photos?.[0]?.value;
    if (!avatarUrl && profile._json?.avatar_url) {
      avatarUrl = profile._json.avatar_url;
    }

    // Extract names using UserUtils
    const parsedName = UserUtils.parseName(
      name?.displayName || profile.displayName || '',
    );
    let { firstName } = parsedName;
    const { lastName } = parsedName;

    // Fallback for first name
    if (!firstName) firstName = username || 'User';

    // GH provides username directly
    const gitHubUsername = username || null;

    if (!email) {
      throw new Error('No email provided by the OAuth provider');
    }

    // Email linking requires a provider-verified address.
    let user = await this.prisma.user.findFirst({
      where: {
        providerId: id,
        provider,
      },
    });
    if (!user && emailVerified) {
      user = await this.prisma.user.findUnique({ where: { email } });
    }

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
        },
      });
    } else {
      if (!emailVerified) {
        throw new Error('OAuth provider email is not verified');
      }
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
          isOnboarded: false, // New users must complete onboarding
        },
      });
    }

    return user;
  }
}
