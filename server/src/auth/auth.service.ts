import { Injectable, UnauthorizedException } from '@nestjs/common';
import { LoginDto } from './dto/login.dto';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
    constructor(private readonly jwtService: JwtService) { }

    // Hardcoded for V1
    private readonly validUser = {
        email: 'admin@example.com',
        password: 'admin123', // In real app, verify hash
        name: 'Admin User'
    };

    async login(loginDto: LoginDto) {
        if (loginDto.email === this.validUser.email && loginDto.password === this.validUser.password) {
            const payload = { email: this.validUser.email, sub: 'admin' };
            return {
                access_token: this.jwtService.sign(payload),
                user: {
                    name: this.validUser.name,
                    email: this.validUser.email
                }
            };
        }

        throw new UnauthorizedException('Invalid credentials');
    }
}
