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

        const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);
        if (!isPasswordValid) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const payload = { email: user.email, sub: user.id, role: user.role };
        return {
            access_token: this.jwtService.sign(payload),
            user: {
                name: user.name,
                email: user.email,
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

        const user = await this.prisma.user.create({
            data: {
                name: registerDto.name,
                email: registerDto.email,
                password: hashedPassword,
                role: 'user',
            },
        });

        const payload = { email: user.email, sub: user.id, role: user.role };
        return {
            access_token: this.jwtService.sign(payload),
            user: {
                name: user.name,
                email: user.email,
            },
        };
    }

    private async seedAdmin() {
        const userCount = await this.prisma.user.count();
        if (userCount === 0) {
            const hashedPassword = await bcrypt.hash('admin123', this.SALT_ROUNDS);
            await this.prisma.user.create({
                data: {
                    name: 'Admin',
                    email: 'admin@dataexplorer.com',
                    password: hashedPassword,
                    role: 'admin',
                },
            });
            console.log('[Auth] Default admin seeded: admin@dataexplorer.com / admin123');
        }
    }
}
