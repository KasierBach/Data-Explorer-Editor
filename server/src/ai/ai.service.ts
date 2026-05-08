import { Injectable } from '@nestjs/common';
import { AiChatCompletionService } from './ai.chat-completion.service';
import { AiSchemaService } from './ai.schema-service';
import { AiAutocompleteService } from './ai.autocomplete-service';

@Injectable()
export class AiService {
    constructor(
        private readonly chatService: AiChatCompletionService,
        private readonly schemaService: AiSchemaService,
        private readonly autocompleteService: AiAutocompleteService,
    ) { }

    async chat(params: any): Promise<any> {
        return this.chatService.chat(params);
    }

    async * chatStream(params: any): AsyncGenerator<any> {
        yield* this.chatService.chatStream(params);
    }

    async gatherSchemaContext(pool: any, strategy: any, database?: string, connectionId?: string): Promise<string> {
        return this.schemaService.gatherSchemaContext(pool, strategy, database, connectionId);
    }

    clearCache(connectionId: string, database?: string) {
        this.schemaService.clearCache(connectionId, database);
    }

    buildSchemaContext(tables: any[], columns: Map<string, any[]>, relationships: any[]): string {
        return this.schemaService.buildSchemaContext(tables, columns, relationships);
    }

    async suggestTablesBySemantic(searchTerm: string, tableNames: string[]): Promise<string[]> {
        return this.schemaService.suggestTablesBySemantic(searchTerm, tableNames);
    }

    async autocomplete(params: {
        beforeCursor: string;
        afterCursor?: string;
        schemaContext?: string;
        databaseType?: string;
    }): Promise<string> {
        return this.autocompleteService.autocomplete(params);
    }

    async generateSql(params: {
        query: string;
        databaseType?: string;
        schemaContext?: string;
    }): Promise<{ sql: string; explanation: string }> {
        return this.autocompleteService.generateSql(params);
    }

}
