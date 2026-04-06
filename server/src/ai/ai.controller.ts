import { Controller, Post, Body, UseGuards, BadRequestException, InternalServerErrorException, Res, Req } from '@nestjs/common';
import type { Response } from 'express';
import { AiService } from './ai.service';
import { ConnectionsService } from '../connections/connections.service';
import { DatabaseStrategyFactory } from '../database-strategies';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GenerateSqlDto } from './dto/generate-sql.dto';
import { AutocompleteDto } from './dto/autocomplete.dto';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
    constructor(
        private readonly aiService: AiService,
        private readonly connectionsService: ConnectionsService,
        private readonly strategyFactory: DatabaseStrategyFactory,
    ) { }

    @Post('generate-sql')
    async generateSql(@Body() body: GenerateSqlDto, @Req() req: any) {
        const { connectionId, database, prompt, image, context, model, mode, routingMode } = body;

        console.log(`[AI] generate-sql request: connectionId=${connectionId}, database=${database}, routingMode=${routingMode || 'auto'}, mode=${mode || 'planning'}, prompt="${prompt}"`);

        // Step 1: Get connection info
        let connection: any;
        try {
            connection = await this.connectionsService.findOne(connectionId, req.user.id);
            console.log(`[AI] Found connection: ${connection.name} (${connection.type})`);
        } catch (error) {
            console.error(`[AI] Connection lookup failed for ID "${connectionId}":`, error.message);
            throw new BadRequestException(`Connection "${connectionId}" not found. Please re-select your connection.`);
        }

        // Step 2: Get database pool
        let pool: any;
        try {
            pool = await this.connectionsService.getPool(connectionId, database, req.user.id);
            console.log(`[AI] Pool acquired for database: ${database || connection.database}`);
        } catch (error) {
            console.error(`[AI] Failed to get pool:`, error.message);
            throw new InternalServerErrorException(`Cannot connect to database: ${error.message}`);
        }

        const strategy = this.strategyFactory.getStrategy(connection.type);

        // Step 3: Gather schema context
        const schemaContext = await this.aiService.gatherSchemaContext(pool, strategy, database, connectionId);

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
                routingMode,
            });
            console.log(`[AI] Response generated successfully`);
            return result;
        } catch (error) {
            console.error(`[AI] AI provider call failed:`, error.message);
            throw new InternalServerErrorException(`AI generation failed: ${error.message}`);
        }
    }

    @Post('generate-sql-stream')
    async generateSqlStream(@Body() body: GenerateSqlDto, @Res() res: Response, @Req() req: any) {
        const { connectionId, database, prompt, image, context, model, mode, routingMode } = body;

        console.log(`[AI:Stream] generate-sql-stream request: routingMode=${routingMode || 'auto'}, mode=${mode || 'planning'}, prompt="${prompt}"`);

        // Setup SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();

        let connection: any;
        try {
            connection = await this.connectionsService.findOne(connectionId, req.user.id);
        } catch (error) {
            res.write(`data: ${JSON.stringify({ type: 'error', text: `Connection not found: ${error.message}` })}\n\n`);
            res.write('data: [DONE]\n\n');
            res.end();
            return;
        }

        let pool: any;
        try {
            pool = await this.connectionsService.getPool(connectionId, database, req.user.id);
        } catch (error) {
            res.write(`data: ${JSON.stringify({ type: 'error', text: `Cannot connect: ${error.message}` })}\n\n`);
            res.write('data: [DONE]\n\n');
            res.end();
            return;
        }

        const strategy = this.strategyFactory.getStrategy(connection.type);
        const schemaContext = await this.aiService.gatherSchemaContext(pool, strategy, database, connectionId);

        try {
            const stream = this.aiService.chatStream({
                model,
                mode,
                prompt,
                schemaContext,
                databaseType: connection.type,
                image,
                context,
                routingMode,
            });

            for await (const event of stream) {
                res.write(`data: ${JSON.stringify(event)}\n\n`);
            }
        } catch (error) {
            console.error(`[AI:Stream] Stream error:`, (error as any).message);
            res.write(`data: ${JSON.stringify({ type: 'error', text: (error as any).message })}\n\n`);
        }

        res.write('data: [DONE]\n\n');
        res.end();
    }

    @Post('autocomplete')
    async autocomplete(@Body() body: AutocompleteDto, @Req() req: any) {
        const { connectionId, database, beforeCursor, afterCursor } = body;

        console.log(`[AI:Autocomplete] Request received. Text ending with: "${beforeCursor.slice(-15)}"`);

        let connection: any;
        try {
            connection = await this.connectionsService.findOne(connectionId, req.user.id);
        } catch (error) {
            console.error(`[AI:Autocomplete] Connection lookup failed for ID "${connectionId}"`);
            throw new BadRequestException(`Connection not found`);
        }


        let pool: any;
        try {
            pool = await this.connectionsService.getPool(connectionId, database, req.user.id);
        } catch (error) {
            throw new InternalServerErrorException(`Cannot connect to database`);
        }

        const strategy = this.strategyFactory.getStrategy(connection.type);
        const schemaContext = await this.aiService.gatherSchemaContext(pool, strategy, database, connectionId);

        const completion = await this.aiService.autocomplete({
            beforeCursor,
            afterCursor,
            schemaContext,
            databaseType: connection.type,
        });

        console.log(`[AI:Autocomplete] Completion result: "${completion?.slice(0, 80) || '(empty)'}"`);

        return { completion };
    }
}
