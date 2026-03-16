import { Injectable, UnauthorizedException, ConflictException, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService implements OnModuleInit {
    private readonly SALT_ROUNDS = 10;

    constructor(
        private readonly jwtService: JwtService,
        private readonly prisma: PrismaService,
    ) { }

    async onModuleInit() {
        await this.seedAdmin();
    }

    async login(loginDto: LoginDto) {
        const user = await this.prisma.user.findUnique({
            where: { email: loginDto.email },
        });

        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }

        // Only check password if the user signed up with local provider
        if (!user.password && user.provider !== 'local') {
             throw new UnauthorizedException('Please login using your Social account (Google/GitHub).');
        }

        const isPasswordValid = await bcrypt.compare(loginDto.password, user.password!);
        if (!isPasswordValid) {
            throw new UnauthorizedException('Invalid credentials');
        }

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
            },
        };
    }

    async register(registerDto: RegisterDto) {
        const existingUser = await this.prisma.user.findUnique({
            where: { email: registerDto.email },
        });

        if (existingUser) {
            throw new ConflictException('Email already registered');
        }

        const hashedPassword = await bcrypt.hash(registerDto.password, this.SALT_ROUNDS);
        
        // Simple split of name for backward compatibility with existing register flow
        const nameParts = registerDto.name.split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ');

        const user = await this.prisma.user.create({
            data: {
                email: registerDto.email,
                password: hashedPassword,
                firstName,
                lastName,
                role: 'user',
                provider: 'local',
                isOnboarded: false // Local users also need to complete onboarding
            },
        });

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
            },
        };
    }

    private async seedAdmin() {
        const userCount = await this.prisma.user.count();
        if (userCount === 0) {
            const adminEmail = process.env.ADMIN_EMAIL || 'admin@dataexplorer.com';
            const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
            const hashedPassword = await bcrypt.hash(adminPassword, this.SALT_ROUNDS);
            await this.prisma.user.create({
                data: {
                    firstName: 'System',
                    lastName: 'Admin',
                    email: adminEmail,
                    password: hashedPassword,
                    role: 'admin',
                    provider: 'local',
                    isOnboarded: true, // Auto onboard admin
                    username: 'admin'
                },
            });
            console.log(`[Auth] Default admin seeded: ${adminEmail} (password: ***)`);
        }
    }
}
