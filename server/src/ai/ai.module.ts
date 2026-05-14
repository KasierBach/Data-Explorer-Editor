import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController, AiTestController } from './ai.controller';
import { AiChatCompletionService } from './ai.chat-completion.service';
import { AiChatService } from './ai.chat.service';
import { AiChatController } from './ai.chat.controller';
import { ConnectionsModule } from '../connections/connections.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AiPromptBuilderService } from './ai.prompt-builder.service';
import { AiRoutingService } from './ai.routing.service';
import { AiSchemaContextService } from './ai.schema-context.service';
import { AiProviderRunnerService } from './ai.provider-runner.service';
import { AiSchemaService } from './ai.schema-service';
import { AiAutocompleteService } from './ai.autocomplete-service';
import { AiConnectionService } from './ai.connection-service';

const isProd = process.env.NODE_ENV === 'production';

@Module({
    imports: [ConnectionsModule, PrismaModule],
    controllers: [AiController, AiChatController, ...(isProd ? [] : [AiTestController])],
    providers: [
        AiService,
        AiChatCompletionService,
        AiChatService,
        AiPromptBuilderService,
        AiRoutingService,
        AiSchemaContextService,
        AiProviderRunnerService,
        AiSchemaService,
        AiAutocompleteService,
        AiConnectionService,
    ],
    exports: [
        AiService,
        AiChatCompletionService,
        AiSchemaContextService,
        AiSchemaService,
        AiAutocompleteService,
    ],
})
export class AiModule { }
