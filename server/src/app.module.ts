import { Module } from '@nestjs/common';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseStrategiesModule,
    PrismaModule,
    ConnectionsModule,
    QueryModule,
    AuthModule,
    MetadataModule,
    AiModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
