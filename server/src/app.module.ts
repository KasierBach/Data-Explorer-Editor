import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { LoggerMiddleware } from './common/middlewares/logger.middleware';
import { CsrfMiddleware } from './common/middlewares/csrf.middleware';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerStorageRedisService } from 'nestjs-throttler-storage-redis';
import { redisStore } from 'cache-manager-redis-yet';

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
import { MigrationModule } from './migration/migration.module';
import { SavedQueriesModule } from './saved-queries/saved-queries.module';
import { DashboardsModule } from './dashboards/dashboards.module';
import { ErdWorkspacesModule } from './erd-workspaces/erd-workspaces.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SearchModule } from './search/search.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          url: configService.get<string>('REDIS_URL') || 'redis://localhost:6379',
        },
      }),
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const store = await redisStore({
          url: configService.get<string>('REDIS_URL') || 'redis://localhost:6379',
          ttl: 60000,
        });
        return { store };
      },
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        throttlers: [{
          ttl: 60000,
          limit: 100,
        }],
        storage: new ThrottlerStorageRedisService(
          configService.get<string>('REDIS_URL') || 'redis://localhost:6379',
        ),
      }),
    }),
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
    MigrationModule,
    SavedQueriesModule,
    DashboardsModule,
    ErdWorkspacesModule,
    NotificationsModule,
    SearchModule,
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
    consumer.apply(LoggerMiddleware, CsrfMiddleware).forRoutes('*');
  }
}
