import { Module } from '@nestjs/common';
import { MetadataService } from './metadata.service';
import { MetadataController } from './metadata.controller';
import { ConnectionsModule } from '../connections/connections.module';

@Module({
    imports: [ConnectionsModule],
    controllers: [MetadataController],
    providers: [MetadataService],
})
export class MetadataModule { }
