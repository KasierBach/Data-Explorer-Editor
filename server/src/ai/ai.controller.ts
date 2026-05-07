import { Controller, Post, Body, UseGuards, InternalServerErrorException, Res, Req } from '@nestjs/common';
import type { Response } from 'express';
import { AiService } from './ai.service';
import { AiConnectionService } from './ai.connection-service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GenerateSqlDto } from './dto/generate-sql.dto';
import { AutocompleteDto } from './dto/autocomplete.dto';
import type { AuthenticatedRequest } from '../auth/auth-request.types';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
    constructor(
        private readonly aiService: AiService,
        private readonly connectionService: AiConnectionService,
    ) { }

    @Post('generate-sql')
    async generateSql(@Body() body: GenerateSqlDto, @Req() req: AuthenticatedRequest) {
        const { connectionId, database, prompt, image, context, model, mode, routingMode } = body;

        const { connection, schemaContext } = await this.connectionService.getConnectionContext(
            connectionId,
            database,
            req.user.id,
            (pool, strategy, db, connId) => this.aiService.gatherSchemaContext(pool, strategy, db, connId),
        );

        try {
            return await this.aiService.chat({
                model,
                mode,
                prompt,
                schemaContext,
                databaseType: connection.type,
                image,
                context,
                routingMode,
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            throw new InternalServerErrorException(`AI generation failed: ${message}`);
        }
    }

    @Post('generate-sql-stream')
    async generateSqlStream(@Body() body: GenerateSqlDto, @Res() res: Response, @Req() req: AuthenticatedRequest) {
        const { connectionId, database, prompt, image, context, model, mode, routingMode } = body;

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
            const message = error instanceof Error ? error.message : 'Unknown error';
            res.write(`data: ${JSON.stringify({ type: 'error', text: message })}\n\n`);
        }

        res.write('data: [DONE]\n\n');
        res.end();
    }

    @Post('autocomplete')
    async autocomplete(@Body() body: AutocompleteDto, @Req() req: AuthenticatedRequest) {
        const { connectionId, database, beforeCursor, afterCursor, context } = body;
        
        const { connection, schemaContext } = await this.connectionService.getConnectionContext(
            connectionId,
            database,
            req.user.id,
            (pool, strategy, db, connId) => this.aiService.gatherSchemaContext(pool, strategy, db, connId),
        );

        const completion = await this.aiService.autocomplete({
            beforeCursor,
            afterCursor,
            schemaContext: context ? `${context}\n\n${schemaContext}` : schemaContext,
            databaseType: connection.type,
        });

        return { completion };
    }

    @Post('nlp-to-sql')
    async nlpToSql(@Body() body: GenerateSqlDto, @Req() req: AuthenticatedRequest) {
        const { connectionId, database, prompt } = body;

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
            const message = error instanceof Error ? error.message : 'Unknown error';
            throw new InternalServerErrorException(message);
        }
    }
}
