import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SocialAuthService } from './social-auth.service';
import { TokenService } from './token.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt-auth.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { GithubStrategy } from './strategies/github.strategy';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { OtpModule } from '../otp/otp.module';
import { SeedModule } from '../seed/seed.module';

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
        OtpModule,
        SeedModule,
    ],
    controllers: [AuthController],
    providers: [
        AuthService, 
        SocialAuthService, 
        TokenService,
        JwtStrategy, 
        GoogleStrategy, 
        GithubStrategy
    ],
    exports: [AuthService, SocialAuthService, TokenService],
})
export class AuthModule { }
