import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { LoggerMiddleware } from './common/middlewares/logger.middleware';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConnectionsModule } from './connections/connections.module';
import { QueryModule } from './query/query.module';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { MetadataModule } from './metadata/metadata.module';
import { DatabaseStrategiesModule } from './database-strategies';
import { AiModule } from './ai/ai.module';
import { UsersModule } from './users/users.module';
import { AuditModule } from './audit/audit.module';
import { MailModule } from './mail/mail.module';
import { OtpModule } from './otp/otp.module';
import { SeedModule } from './seed/seed.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),
    MailModule,
    DatabaseStrategiesModule,
    PrismaModule,
    ConnectionsModule,
    QueryModule,
    AuthModule,
    MetadataModule,
    AiModule,
    UsersModule,
    AuditModule,
    OtpModule,
    SeedModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
