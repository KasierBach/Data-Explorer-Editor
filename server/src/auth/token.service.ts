import { Injectable } from '@nestjs/common';
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
}
