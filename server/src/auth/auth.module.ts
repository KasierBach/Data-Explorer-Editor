import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SocialAuthService } from './social-auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt-auth.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { GithubStrategy } from './strategies/github.strategy';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
    imports: [
        PassportModule,
        JwtModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: async (configService: ConfigService) => ({
                secret: configService.get<string>('JWT_SECRET'),
                signOptions: { expiresIn: '1d' },
            }),
        }),
    ],
    controllers: [AuthController],
    providers: [
        AuthService, 
        SocialAuthService, 
        JwtStrategy, 
        GoogleStrategy, 
        GithubStrategy
    ],
    exports: [AuthService, SocialAuthService],
})
export class AuthModule { }
