import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { ConnectionsModule } from '../connections/connections.module';
import { AiModule } from '../ai/ai.module';
import { SearchIndexRepository } from './search-index.repository';

@Module({
  imports: [ConnectionsModule, AiModule],
  controllers: [SearchController],
  providers: [SearchService, SearchIndexRepository],
  exports: [SearchService],
})
export class SearchModule {}
