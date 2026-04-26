import { Module } from '@nestjs/common';
import { ConnectionsService } from './connections.service';
import { ConnectionsController } from './connections.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { DatabaseStrategyFactory } from '../database-strategies/strategy.factory';
import { AuditModule } from '../audit/audit.module';
import { SshTunnelService } from './ssh-tunnel.service';

@Module({
    imports: [PrismaModule, AuditModule],
    controllers: [ConnectionsController],
    providers: [ConnectionsService, DatabaseStrategyFactory, SshTunnelService],
    exports: [ConnectionsService, SshTunnelService],
})
export class ConnectionsModule { }
