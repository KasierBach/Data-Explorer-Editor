import { Controller, Post, Body, UseGuards, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { AiService } from './ai.service';
import { ConnectionsService } from '../connections/connections.service';
import { DatabaseStrategyFactory } from '../database-strategies';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GenerateSqlDto } from './dto/generate-sql.dto';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
    constructor(
        private readonly aiService: AiService,
        private readonly connectionsService: ConnectionsService,
        private readonly strategyFactory: DatabaseStrategyFactory,
    ) { }

    @Post('generate-sql')
    async generateSql(@Body() body: GenerateSqlDto) {
        const { connectionId, database, prompt, image, context, model, mode } = body;

        console.log(`[AI] generate-sql request: connectionId=${connectionId}, database=${database}, prompt="${prompt}"`);

        // Step 1: Get connection info
        let connection: any;
        try {
            connection = await this.connectionsService.findOne(connectionId);
            console.log(`[AI] Found connection: ${connection.name} (${connection.type})`);
        } catch (error) {
            console.error(`[AI] Connection lookup failed for ID "${connectionId}":`, error.message);
            throw new BadRequestException(`Connection "${connectionId}" not found. Please re-select your connection.`);
        }

        // Step 2: Get database pool
        let pool: any;
        try {
            pool = await this.connectionsService.getPool(connectionId, database);
            console.log(`[AI] Pool acquired for database: ${database || connection.database}`);
        } catch (error) {
            console.error(`[AI] Failed to get pool:`, error.message);
            throw new InternalServerErrorException(`Cannot connect to database: ${error.message}`);
        }

        const strategy = this.strategyFactory.getStrategy(connection.type);

        // Step 3: Gather schema context
        let schemaContext = '';
        try {
            const schemas = await strategy.getSchemas(pool, database);
            const allTables: any[] = [];
            const columnMap = new Map<string, any[]>();
            const skipSchemas = ['pg_catalog', 'information_schema', 'pg_toast'];

            for (const schema of schemas) {
                const schemaName = typeof schema === 'string' ? schema : (schema as any).name;
                if (!schemaName || skipSchemas.includes(schemaName)) continue;

                try {
                    const tables = await strategy.getTables(pool, schemaName, database);
                    for (const table of tables) {
                        const tableName = typeof table === 'string' ? table : (table as any).name;
                        if (!tableName) continue;
                        allTables.push({ name: tableName, schema: schemaName });

                        try {
                            const cols = await strategy.getColumns(pool, schemaName, tableName);
                            columnMap.set(`${schemaName}.${tableName}`, cols);
                        } catch { /* skip columns we can't read */ }
                    }
                } catch { /* skip schemas we can't read */ }
            }

            // Get relationships
            let relationships: any[] = [];
            try {
                relationships = await strategy.getRelationships(pool);
            } catch { /* no relationships available */ }

            schemaContext = this.aiService.buildSchemaContext(allTables, columnMap, relationships);
            console.log(`[AI] Schema context built: ${allTables.length} tables found`);
        } catch (error) {
            console.error(`[AI] Schema gathering failed:`, error.message);
            // Continue with empty context rather than failing completely
            schemaContext = '(Could not load schema information)';
        }

        // Step 4: Call AI (chat - can handle both SQL and general questions)
        try {
            const result = await this.aiService.chat({
                model,
                mode,
                prompt,
                schemaContext,
                databaseType: connection.type,
                image,
                context,
            });
            console.log(`[AI] Response generated successfully`);
            return result;
        } catch (error) {
            console.error(`[AI] Gemini API call failed:`, error.message);
            throw new InternalServerErrorException(`AI generation failed: ${error.message}`);
        }
    }
}
