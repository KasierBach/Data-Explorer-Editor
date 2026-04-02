import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(private configService: ConfigService) {
        super({
            jwtFromRequest: ExtractJwt.fromExtractors([
                ExtractJwt.fromAuthHeaderAsBearerToken(),
                (req: any) => {
                    let token = null;
                    if (req && req.query && req.query.token) {
                        token = req.query.token;
                    }
                    return token;
                },
            ]),
            ignoreExpiration: false,
            secretOrKey: configService.get<string>('JWT_SECRET') || 'super-secret-key',
        });
    }

    async validate(payload: any) {
        return { id: payload.sub, email: payload.email, role: payload.role };
    }
}
