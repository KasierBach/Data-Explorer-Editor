import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { getRequiredSecret } from '../common/utils/secret.util';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor() {
        super({
            jwtFromRequest: ExtractJwt.fromExtractors([
                ExtractJwt.fromAuthHeaderAsBearerToken(),
            ]),
            ignoreExpiration: false,
            secretOrKey: getRequiredSecret('JWT_SECRET', {
                minLength: 32,
                disallowValues: ['super-secret-key', 'your-secret-key'],
            }),
        });
    }

    async validate(payload: { sub: string; email: string; role: string }) {
        return { id: payload.sub, email: payload.email, role: payload.role };
    }
}
