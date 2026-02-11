import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConnectionsModule } from './connections/connections.module';
import { QueryModule } from './query/query.module';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { MetadataModule } from './metadata/metadata.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    ConnectionsModule,
    QueryModule,
    AuthModule,
    MetadataModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
