import { Controller, Post, Body, UseGuards, BadRequestException, InternalServerErrorException, Res, Req } from '@nestjs/common';
import type { Response } from 'express';
import { AiService } from './ai.service';
import { AiConnectionService } from './ai.connection-service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GenerateSqlDto } from './dto/generate-sql.dto';
import { AutocompleteDto } from './dto/autocomplete.dto';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
    constructor(
        private readonly aiService: AiService,
        private readonly connectionService: AiConnectionService,
    ) { }

    @Post('generate-sql')
    async generateSql(@Body() body: GenerateSqlDto, @Req() req: any) {
        const { connectionId, database, prompt, image, context, model, mode, routingMode } = body;

        console.log(`[AI] generate-sql request: connectionId=${connectionId}, database=${database}, routingMode=${routingMode || 'auto'}, mode=${mode || 'planning'}, prompt="${prompt}"`);

        const { connection, schemaContext } = await this.connectionService.getConnectionContext(
            connectionId,
            database,
            req.user.id,
            (pool, strategy, db, connId) => this.aiService.gatherSchemaContext(pool, strategy, db, connId),
        );

        console.log(`[AI] Found connection: ${connection.name} (${connection.type})`);
        console.log(`[AI] Pool acquired for database: ${database || connection.database}`);

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

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();

        const ctx = await this.connectionService.getConnectionContextForStream(
            connectionId,
            database,
            req.user.id,
            (pool, strategy, db, connId) => this.aiService.gatherSchemaContext(pool, strategy, db, connId),
        );

        if (!ctx) {
            res.write(`data: ${JSON.stringify({ type: 'error', text: 'Connection not found' })}\n\n`);
            res.write('data: [DONE]\n\n');
            res.end();
            return;
        }

        try {
            const stream = this.aiService.chatStream({
                model,
                mode,
                prompt,
                schemaContext: ctx.schemaContext,
                databaseType: ctx.connection.type,
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

        const { connection, schemaContext } = await this.connectionService.getConnectionContext(
            connectionId,
            database,
            req.user.id,
            (pool, strategy, db, connId) => this.aiService.gatherSchemaContext(pool, strategy, db, connId),
        );

        const completion = await this.aiService.autocomplete({
            beforeCursor,
            afterCursor,
            schemaContext,
            databaseType: connection.type,
        });

        console.log(`[AI:Autocomplete] Completion result: "${completion?.slice(0, 80) || '(empty)'}"`);

        return { completion };
    }

    @Post('nlp-to-sql')
    async nlpToSql(@Body() body: GenerateSqlDto, @Req() req: any) {
        const { connectionId, database, prompt } = body;

        console.log(`[AI:NLP2SQL] Request: connectionId=${connectionId}, database=${database}, query="${prompt}"`);

        const { connection, schemaContext } = await this.connectionService.getConnectionContext(
            connectionId,
            database,
            req.user.id,
            (pool, strategy, db, connId) => this.aiService.gatherSchemaContext(pool, strategy, db, connId),
        );

        try {
            return await this.aiService.generateSql({
                query: prompt,
                databaseType: connection.type,
                schemaContext,
            });
        } catch (error) {
            throw new InternalServerErrorException(error.message);
        }
    }
}
