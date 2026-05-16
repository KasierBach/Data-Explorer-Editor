import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { OnboardingDto } from './dto/onboarding.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateBillingDto } from './dto/update-billing.dto';
import * as bcrypt from 'bcryptjs';
import { UnauthorizedException } from '@nestjs/common';

@Injectable()
export class UsersService {
  private readonly SALT_ROUNDS = 10;

  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        bio: true,
        isOnboarded: true,
        role: true,
        jobRole: true,
        username: true,
        phoneNumber: true,
        address: true,
        provider: true,
        theme: true,
        language: true,
        emailNotifications: true,
        failedQueryAlerts: true,
        productUpdates: true,
        securityAlerts: true,
        plan: true,
        billingDate: true,
        paymentMethod: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    // Check for username uniqueness if provided
    if (dto.username) {
      const existing = await this.prisma.user.findUnique({
        where: { username: dto.username },
      });
      if (existing && existing.id !== userId) {
        throw new ConflictException('Username is already taken');
      }
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        bio: true,
        username: true,
        jobRole: true,
        phoneNumber: true,
        address: true,
      },
    });
  }

  async updateSettings(userId: string, dto: UpdateSettingsDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: {
        id: true,
        theme: true,
        language: true,
        emailNotifications: true,
        failedQueryAlerts: true,
        productUpdates: true,
        securityAlerts: true,
      },
    });
  }

  async updateBilling(userId: string, dto: UpdateBillingDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        plan: dto.plan,
        paymentMethod: dto.paymentMethod,
        billingDate:
          dto.plan === 'pro'
            ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            : null,
      },
      select: {
        id: true,
        plan: true,
        billingDate: true,
        paymentMethod: true,
      },
    });
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid user or social login account');
    }

    const isMatch = await bcrypt.compare(dto.currentPassword, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Current password does not match');
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, this.SALT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return { message: 'Password updated successfully' };
  }

  async deleteAccount(userId: string) {
    await this.prisma.user.delete({ where: { id: userId } });
    return { message: 'Account deleted successfully' };
  }

  async onboarding(userId: string, dto: OnboardingDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Only allow onboarding once for security
    if (user.isOnboarded && user.role !== 'admin') {
      throw new ConflictException('User is already onboarded');
    }

    // Check if username is already taken by someone else
    const existingUsername = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });
    if (existingUsername && existingUsername.id !== userId) {
      throw new ConflictException('Username is already taken');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        username: dto.username,
        jobRole: dto.jobRole,
        phoneNumber: dto.phoneNumber || null,
        address: dto.address || null,
        isOnboarded: true,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        isOnboarded: true,
        role: true,
        jobRole: true,
        username: true,
        phoneNumber: true,
        address: true,
      },
    });

    return updatedUser;
  }

  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        createdAt: true,
        isOnboarded: true,
        isBanned: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async toggleBan(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role === 'admin') {
      throw new ConflictException('Cannot ban an admin account');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: { isBanned: !user.isBanned },
      select: {
        id: true,
        isBanned: true,
      },
    });

    return {
      message: updatedUser.isBanned
        ? 'User has been banned'
        : 'User access restored',
    };
  }

  async resetPassword(id: string, dto: ResetPasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, this.SALT_ROUNDS);

    await this.prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    });

    return { message: 'Password reset successfully' };
  }

  async updateRole(id: string, dto: UpdateRoleDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: { role: dto.role },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
      },
    });

    return updatedUser;
  }
}
