import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { AiChatService } from './ai.chat.service';
import { AiChatController } from './ai.chat.controller';
import { ConnectionsModule } from '../connections/connections.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AiPromptBuilderService } from './ai.prompt-builder.service';
import { AiRoutingService } from './ai.routing.service';
import { AiSchemaContextService } from './ai.schema-context.service';
import { AiProviderRunnerService } from './ai.provider-runner.service';

@Module({
    imports: [ConnectionsModule, PrismaModule],
    controllers: [AiController, AiChatController],
    providers: [
        AiService,
        AiChatService,
        AiPromptBuilderService,
        AiRoutingService,
        AiSchemaContextService,
        AiProviderRunnerService,
    ],
})
export class AiModule { }
