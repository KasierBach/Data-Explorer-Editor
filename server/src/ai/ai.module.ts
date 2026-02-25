import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { ConnectionsModule } from '../connections/connections.module';

@Module({
    imports: [ConnectionsModule],
    controllers: [AiController],
    providers: [AiService],
})
export class AiModule { }
