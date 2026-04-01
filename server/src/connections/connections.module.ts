import { Module } from '@nestjs/common';
import { ConnectionsService } from './connections.service';
import { ConnectionsController } from './connections.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { DatabaseStrategyFactory } from '../database-strategies/strategy.factory';
import { AuditModule } from '../audit/audit.module';

@Module({
    imports: [PrismaModule, AuditModule],
    controllers: [ConnectionsController],
    providers: [ConnectionsService, DatabaseStrategyFactory],
    exports: [ConnectionsService],
})
export class ConnectionsModule { }
