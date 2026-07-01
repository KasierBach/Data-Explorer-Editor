import {
  BadRequestException,
  Controller,
  Post,
  Body,
  UseGuards,
  InternalServerErrorException,
  Res,
  Req,
} from '@nestjs/common';
import type { Response } from 'express';
import { AiService } from './ai.service';
import { AiConnectionService } from './ai.connection-service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GenerateSqlDto } from './dto/generate-sql.dto';
import { AutocompleteDto } from './dto/autocomplete.dto';
import type { AuthenticatedRequest } from '../auth/auth-request.types';
import { validateExternalUrl } from '../common/utils/ssrf-validator.util';

const normalizeProviderBaseUrl = (value: string) =>
  value.trim().replace(/\/+$/, '');

const extractProviderErrorMessage = (payload: unknown) => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const record = payload as Record<string, unknown>;
  if (typeof record.message === 'string' && record.message.trim()) {
    return record.message;
  }

  if (typeof record.error === 'string' && record.error.trim()) {
    return record.error;
  }

  if (record.error && typeof record.error === 'object') {
    const errorRecord = record.error as Record<string, unknown>;
    if (typeof errorRecord.message === 'string' && errorRecord.message.trim()) {
      return errorRecord.message;
    }
  }

  return null;
};

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly connectionService: AiConnectionService,
  ) {}

  @Post('generate-sql')
  async generateSql(
    @Body() body: GenerateSqlDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const {
      connectionId,
      database,
      prompt,
      image,
      context,
      model,
      mode,
      routingMode,
      history,
      providerOverride,
    } = body;

    const { connection, schemaContext } =
      await this.connectionService.getConnectionContext(
        connectionId,
        database,
        req.user.id,
        (pool, strategy, db, connId) =>
          this.aiService.gatherSchemaContext(pool, strategy, db, connId),
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
        history,
        providerOverride,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new InternalServerErrorException(
        `AI generation failed: ${message}`,
      );
    }
  }

  @Post('generate-sql-stream')
  async generateSqlStream(
    @Body() body: GenerateSqlDto,
    @Res() res: Response,
    @Req() req: AuthenticatedRequest,
  ) {
    const {
      connectionId,
      database,
      prompt,
      image,
      context,
      model,
      mode,
      routingMode,
      history,
      providerOverride,
    } = body;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const ctx = await this.connectionService.getConnectionContextForStream(
      connectionId,
      database,
      req.user.id,
      (pool, strategy, db, connId) =>
        this.aiService.gatherSchemaContext(pool, strategy, db, connId),
    );

    if (!ctx) {
      res.write(
        `data: ${JSON.stringify({ type: 'error', text: 'Connection not found' })}\n\n`,
      );
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
        history,
        providerOverride,
      });

      for await (const event of stream) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.write(
        `data: ${JSON.stringify({ type: 'error', text: message })}\n\n`,
      );
    }

    res.write('data: [DONE]\n\n');
    res.end();
  }

  @Post('autocomplete')
  async autocomplete(
    @Body() body: AutocompleteDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const {
      connectionId,
      database,
      beforeCursor,
      afterCursor,
      context,
      model,
      providerOverride,
    } = body;

    const { connection, schemaContext } =
      await this.connectionService.getConnectionContext(
        connectionId,
        database,
        req.user.id,
        (pool, strategy, db, connId) =>
          this.aiService.gatherSchemaContext(pool, strategy, db, connId),
      );

    const completion = await this.aiService.autocomplete({
      beforeCursor,
      afterCursor,
      schemaContext: context ? `${context}\n\n${schemaContext}` : schemaContext,
      databaseType: connection.type,
      model,
      providerOverride,
    });

    return { completion };
  }

  @Post('provider-models')
  async listProviderModels(
    @Body() body: { baseUrl?: string; apiKey?: string },
  ) {
    const baseUrl =
      typeof body?.baseUrl === 'string'
        ? normalizeProviderBaseUrl(body.baseUrl)
        : '';
    const apiKey = typeof body?.apiKey === 'string' ? body.apiKey.trim() : '';

    if (!baseUrl) {
      throw new BadRequestException('Base URL is required');
    }

    let requestUrl: string;
    try {
      requestUrl = new URL('models', `${baseUrl}/`).toString();
    } catch {
      throw new BadRequestException('Invalid Base URL');
    }
    if (!(await validateExternalUrl(requestUrl))) {
      throw new BadRequestException('Unsafe provider URL');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }
    if (baseUrl.includes('openrouter.ai')) {
      headers['HTTP-Referer'] =
        process.env.FRONTEND_URL || 'http://localhost:5173';
      headers['X-Title'] = 'Data Explorer';
    }

    let response: globalThis.Response;
    try {
      response = await fetch(requestUrl, {
        method: 'GET',
        headers,
        redirect: 'manual',
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to reach provider';
      throw new BadRequestException(message);
    }

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new BadRequestException(
        extractProviderErrorMessage(payload) ||
          `Provider returned ${response.status}`,
      );
    }

    const models = Array.isArray((payload as { data?: unknown[] } | null)?.data)
      ? Array.from(
          new Set(
            (payload as { data: Array<{ id?: unknown }> }).data
              .map((item) =>
                typeof item?.id === 'string' ? item.id.trim() : '',
              )
              .filter(Boolean),
          ),
        ).sort((left, right) => left.localeCompare(right))
      : [];

    return { models };
  }

  @Post('nlp-to-sql')
  async nlpToSql(
    @Body() body: GenerateSqlDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const {
      connectionId,
      database,
      prompt,
      model,
      mode,
      routingMode,
      providerOverride,
    } = body;

    const { connection, schemaContext } =
      await this.connectionService.getConnectionContext(
        connectionId,
        database,
        req.user.id,
        (pool, strategy, db, connId) =>
          this.aiService.gatherSchemaContext(pool, strategy, db, connId),
      );

    try {
      return await this.aiService.generateSql({
        query: prompt,
        databaseType: connection.type,
        schemaContext,
        model,
        mode,
        routingMode,
        providerOverride,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new InternalServerErrorException(message);
    }
  }
}

@Controller('ai-test')
@UseGuards(JwtAuthGuard)
export class AiTestController {
  constructor(
    private readonly aiService: AiService,
    private readonly connectionService: AiConnectionService,
  ) {}

  @Post('autocomplete')
  async autocomplete(
    @Body() body: AutocompleteDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const {
      connectionId,
      database,
      beforeCursor,
      afterCursor,
      context,
      model,
      providerOverride,
    } = body;

    try {
      const { connection, schemaContext } =
        await this.connectionService.getConnectionContext(
          connectionId,
          database,
          req.user.id,
          (pool, strategy, db, connId) =>
            this.aiService.gatherSchemaContext(pool, strategy, db, connId),
        );

      const completion = await this.aiService.autocomplete({
        beforeCursor,
        afterCursor,
        schemaContext: context
          ? `${context}\n\n${schemaContext}`
          : schemaContext,
        databaseType: connection.type,
        model,
        providerOverride,
      });
      return { completion, error: null };
    } catch (err) {
      return { completion: '', error: String(err) };
    }
  }
}
