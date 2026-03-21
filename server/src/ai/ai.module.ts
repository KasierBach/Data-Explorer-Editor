import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { AiChatService } from './ai.chat.service';
import { AiChatController } from './ai.chat.controller';
import { ConnectionsModule } from '../connections/connections.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [ConnectionsModule, PrismaModule],
    controllers: [AiController, AiChatController],
    providers: [AiService, AiChatService], 
})
export class AiModule { }