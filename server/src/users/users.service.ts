import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { OnboardingDto } from './dto/onboarding.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
    private readonly SALT_ROUNDS = 10;

    constructor(private readonly prisma: PrismaService) { }

    async findById(id: string) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
                isOnboarded: true,
                role: true,
                jobRole: true,
                username: true
            }
        });
        if (!user) throw new NotFoundException('User not found');
        return user;
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
        const existingUsername = await this.prisma.user.findUnique({ where: { username: dto.username } });
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
                isOnboarded: true
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
                username: true
            }
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
                isOnboarded: true
            },
            orderBy: {
                createdAt: 'desc',
            }
        });
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
            }
        });

        return updatedUser;
    }
}
