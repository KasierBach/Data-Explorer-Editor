import { Injectable, UnauthorizedException } from '@nestjs/common';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
    // Hardcoded for V1
    private readonly validUser = {
        email: 'admin@example.com',
        password: 'admin123', // In real app, verify hash
        name: 'Admin User'
    };

    async login(loginDto: LoginDto) {
        if (loginDto.email === this.validUser.email && loginDto.password === this.validUser.password) {
            // Return user info (no JWT yet, just simple session simulation)
            return {
                success: true,
                user: {
                    name: this.validUser.name,
                    email: this.validUser.email
                }
            };
        }

        throw new UnauthorizedException('Invalid credentials');
    }
}
