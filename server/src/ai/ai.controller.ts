import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  InternalServerErrorException,
  Res,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { AiService } from './ai.service';
import { AiConnectionService } from './ai.connection-service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GenerateSqlDto } from './dto/generate-sql.dto';
import { AutocompleteDto } from './dto/autocomplete.dto';
import { ProviderModelsDto } from './dto/provider-models.dto';
import type { AuthenticatedRequest } from '../auth/auth-request.types';
import { AiExecutionLedgerService } from './ai-execution-ledger.service';
import {
  aiExecutionMetadata,
  createAiHttpExecution,
  isAiHttpFatalError,
  runAiLedgerOperation,
} from './ai-http-execution';
import { AuditAction, AuditService } from '../audit/audit.service';
import { AiSqlFeedbackDto } from './dto/ai-sql-feedback.dto';
import { ConfigService } from '@nestjs/config';
import { AiProviderConnectionService } from './ai-provider-connection.service';
import {
  aiHttpStoppedException,
  createAiHttpScope,
  writeAiSse,
} from './ai-http-lifecycle';
import {
  AiAccountPolicyService,
  isAiDisabledError,
} from './ai-account-policy.service';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly connectionService: AiConnectionService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
    private readonly providerConnections: AiProviderConnectionService,
    private readonly accountPolicy: AiAccountPolicyService,
    private readonly ledger: AiExecutionLedgerService,
  ) {}

  @Get('providers/status')
  getProviderStatus() {
    const providerKeys = {
      gemini: 'GEMINI_API_KEY',
      openrouter: 'OPENROUTER_API_KEY',
      groq: 'GROQ_API_KEY',
      cerebras: 'CEREBRAS_API_KEY',
      beeknoee: 'BEEKNOEE_API_KEY',
    } as const;

    return {
      providers: Object.fromEntries(
        Object.entries(providerKeys).map(([provider, key]) => [
          provider,
          Boolean(this.configService.get<string>(key)?.trim()),
        ]),
      ),
    };
  }

  @Post('generate-sql')
  @Throttle({ default: { limit: 12, ttl: 60000 } })
  async generateSql(
    @Body() body: GenerateSqlDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const scope = createAiHttpScope(req);
    const execution = createAiHttpExecution(scope, this.ledger);
    try {
      const request = await execution.start(
        this.accountPolicy,
        req.user.id,
        'chat',
        body,
      );
      const {
        connectionId,
        database,
        prompt,
        image,
        document,
        context,
        model,
        mode,
        routingMode,
        history,
        providerOverride,
        disabledProviders,
        fallbackProvider,
      } = body;

      const { connection, schemaContext } = await scope.run(() =>
        this.connectionService.getConnectionContext(
          connectionId,
          database,
          req.user.id,
          (pool, strategy, db, connId) =>
            scope.run(() =>
              this.aiService.gatherSchemaContext(
                pool,
                strategy,
                db,
                connId,
                prompt,
                {
                  ...request,
                },
              ),
            ),
        ),
      );

      try {
        const resolvedOverride = await scope.run(() =>
          this.providerConnections.resolveOverride(
            req.user.id,
            providerOverride,
          ),
        );
        const result = await scope.run(() =>
          this.aiService.chat({
            ...request,
            model,
            mode,
            prompt,
            schemaContext,
            databaseType: connection.type,
            image,
            document,
            context,
            routingMode,
            history,
            providerOverride: resolvedOverride,
            disabledProviders,
            fallbackProvider,
          }),
        );
        return await execution.complete(result);
      } catch (error) {
        if (isAiDisabledError(error) || isAiHttpFatalError(error)) throw error;
        const stopped = aiHttpStoppedException(error, scope.signal);
        if (stopped) throw stopped;
        throw new InternalServerErrorException('AI generation failed.');
      }
    } catch (error) {
      await execution.fail(error);
      throw isAiHttpFatalError(error)
        ? error
        : (aiHttpStoppedException(error, scope.signal) ?? error);
    } finally {
      try {
        await execution.release();
      } finally {
        scope.dispose();
      }
    }
  }

  @Post('generate-sql-stream')
  @Throttle({ default: { limit: 8, ttl: 60000 } })
  async generateSqlStream(
    @Body() body: GenerateSqlDto,
    @Res() res: Response,
    @Req() req: AuthenticatedRequest,
  ) {
    const scope = createAiHttpScope(req, res);
    const execution = createAiHttpExecution(scope, this.ledger);
    try {
      const request = await execution.start(
        this.accountPolicy,
        req.user.id,
        'chat',
        body,
      );
      const {
        connectionId,
        database,
        prompt,
        image,
        document,
        context,
        model,
        mode,
        routingMode,
        history,
        providerOverride,
        disabledProviders,
        fallbackProvider,
      } = body;

      const ctx = await scope.run(() =>
        this.connectionService.getConnectionContextForStream(
          connectionId,
          database,
          req.user.id,
          (pool, strategy, db, connId) =>
            scope.run(() =>
              this.aiService.gatherSchemaContext(
                pool,
                strategy,
                db,
                connId,
                prompt,
                {
                  ...request,
                },
              ),
            ),
        ),
      );

      scope.throwIfStopped();
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();

      await writeAiSse(
        res,
        scope,
        async () => {
          const resolvedOverride = await scope.run(() =>
            this.providerConnections.resolveOverride(
              req.user.id,
              providerOverride,
            ),
          );
          scope.throwIfStopped();
          return this.aiService.chatStream({
            ...request,
            model,
            mode,
            prompt,
            schemaContext: ctx.schemaContext,
            databaseType: ctx.connection.type,
            image,
            document,
            context,
            routingMode,
            history,
            providerOverride: resolvedOverride,
            disabledProviders,
            fallbackProvider,
          });
        },
        execution,
      );
    } catch (error) {
      await execution.fail(error);
      throw isAiHttpFatalError(error)
        ? error
        : (aiHttpStoppedException(error, scope.signal) ?? error);
    } finally {
      try {
        await execution.release();
      } finally {
        scope.dispose();
      }
    }
  }

  @Post('autocomplete')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async autocomplete(
    @Body() body: AutocompleteDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const scope = createAiHttpScope(req);
    const execution = createAiHttpExecution(scope, this.ledger);
    try {
      const request = await execution.start(
        this.accountPolicy,
        req.user.id,
        'autocomplete',
        body,
      );
      const {
        connectionId,
        database,
        beforeCursor,
        afterCursor,
        context,
        model,
        providerOverride,
        disabledProviders,
        fallbackProvider,
      } = body;

      const { connection, schemaContext } = await scope.run(() =>
        this.connectionService.getConnectionContext(
          connectionId,
          database,
          req.user.id,
          (pool, strategy, db, connId) =>
            scope.run(() =>
              this.aiService.gatherSchemaContext(
                pool,
                strategy,
                db,
                connId,
                context ? `${context}\n${beforeCursor}` : beforeCursor,
                {
                  ...request,
                },
              ),
            ),
        ),
      );

      const resolvedOverride = await scope.run(() =>
        this.providerConnections.resolveOverride(req.user.id, providerOverride),
      );
      const completion = await scope.run(() =>
        this.aiService.autocomplete({
          connectionId,
          database,
          ...request,
          disabledProviders,
          fallbackProvider,
          beforeCursor,
          afterCursor,
          schemaContext: context
            ? `${context}\n\n${schemaContext}`
            : schemaContext,
          databaseType: connection.type,
          model,
          providerOverride: resolvedOverride,
        }),
      );

      return await execution.complete({ completion });
    } catch (error) {
      await execution.fail(error);
      throw isAiHttpFatalError(error)
        ? error
        : (aiHttpStoppedException(error, scope.signal) ?? error);
    } finally {
      try {
        await execution.release();
      } finally {
        scope.dispose();
      }
    }
  }

  @Post('provider-models')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async listProviderModels(
    @Body() body: ProviderModelsDto,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.accountPolicy.assertEnabled(req.user.id);
    if (
      typeof body?.baseUrl !== 'string' ||
      !body.baseUrl.trim() ||
      body.baseUrl.length > 2000
    ) {
      throw new BadRequestException('A valid Base URL is required');
    }
    if (
      body.apiKey !== undefined &&
      (typeof body.apiKey !== 'string' || body.apiKey.length > 4000)
    ) {
      throw new BadRequestException('Invalid provider API key');
    }
    const models = await this.providerConnections.listModels(
      body.baseUrl.trim(),
      body.apiKey?.trim() || undefined,
      req.user.id,
    );
    return { models };
  }

  @Post('nlp-to-sql')
  @Throttle({ default: { limit: 12, ttl: 60000 } })
  async nlpToSql(
    @Body() body: GenerateSqlDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const scope = createAiHttpScope(req);
    const execution = createAiHttpExecution(scope, this.ledger);
    try {
      const request = await execution.start(
        this.accountPolicy,
        req.user.id,
        'generate_sql',
        body,
      );
      const generationId = execution.generationId!;
      const startedAt = Date.now();
      const {
        connectionId,
        database,
        prompt,
        model,
        mode,
        routingMode,
        providerOverride,
        disabledProviders,
        fallbackProvider,
      } = body;

      const { connection, schemaContext } = await scope.run(() =>
        this.connectionService.getConnectionContext(
          connectionId,
          database,
          req.user.id,
          (pool, strategy, db, connId) =>
            scope.run(() =>
              this.aiService.gatherSchemaContext(
                pool,
                strategy,
                db,
                connId,
                prompt,
                {
                  ...request,
                },
              ),
            ),
        ),
      );

      try {
        const resolvedOverride = await scope.run(() =>
          this.providerConnections.resolveOverride(
            req.user.id,
            providerOverride,
          ),
        );
        const result = await scope.run(() =>
          this.aiService.generateSql({
            ...request,
            query: prompt,
            databaseType: connection.type,
            schemaContext,
            model,
            mode,
            routingMode,
            providerOverride: resolvedOverride,
            disabledProviders,
            fallbackProvider,
          }),
        );

        const completed = await execution.complete(result);
        await scope
          .run(() =>
            this.auditService.log({
              action: AuditAction.AI_SQL_GENERATED,
              userId: req.user.id,
              details: {
                generationId,
                connectionId,
                databaseType: connection.type,
                requestedModel: model || null,
                provider: result.provider,
                model: result.model,
                mode: mode || 'fast',
                routingMode: result.routingMode,
                customProvider: Boolean(providerOverride),
                latencyMs: Date.now() - startedAt,
                usage: completed.usage,
                usageCoverage: completed.usageCoverage,
                attemptCount: completed.attemptCount,
                measuredAttemptCount: completed.measuredAttemptCount,
                costCoverage: completed.costCoverage,
              },
            }),
          )
          .catch(() => undefined);

        scope.throwIfStopped();
        return completed;
      } catch (error) {
        if (isAiDisabledError(error) || isAiHttpFatalError(error)) throw error;
        const stopped = aiHttpStoppedException(error, scope.signal);
        if (stopped) throw stopped;
        await scope
          .run(() =>
            this.auditService.log({
              action: AuditAction.AI_SQL_GENERATION_FAILED,
              userId: req.user.id,
              details: {
                generationId,
                connectionId,
                databaseType: connection.type,
                requestedModel: model || null,
                model: model || null,
                mode: mode || 'fast',
                routingMode: routingMode || null,
                customProvider: Boolean(providerOverride),
                latencyMs: Date.now() - startedAt,
              },
            }),
          )
          .catch(() => undefined);
        throw new InternalServerErrorException('AI generation failed.');
      }
    } catch (error) {
      await execution.fail(error);
      throw isAiHttpFatalError(error)
        ? error
        : (aiHttpStoppedException(error, scope.signal) ?? error);
    } finally {
      try {
        await execution.release();
      } finally {
        scope.dispose();
      }
    }
  }

  @Post('sql-feedback')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async recordSqlFeedback(
    @Body() body: AiSqlFeedbackDto,
    @Req() req: AuthenticatedRequest,
  ) {
    await runAiLedgerOperation(() =>
      this.ledger.feedback(req.user.id, body.generationId, body.rating),
    );
    await Promise.resolve()
      .then(() =>
        this.auditService.log({
          action: AuditAction.AI_SQL_FEEDBACK,
          userId: req.user.id,
          details: { generationId: body.generationId, rating: body.rating },
        }),
      )
      .catch(() => undefined);

    return { success: true };
  }
}

@Controller('ai-test')
@UseGuards(JwtAuthGuard)
export class AiTestController {
  constructor(
    private readonly aiService: AiService,
    private readonly connectionService: AiConnectionService,
    private readonly providerConnections: AiProviderConnectionService,
    private readonly accountPolicy: AiAccountPolicyService,
    private readonly ledger: AiExecutionLedgerService,
  ) {}

  @Post('autocomplete')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async autocomplete(
    @Body() body: AutocompleteDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const scope = createAiHttpScope(req);
    const execution = createAiHttpExecution(scope, this.ledger);
    try {
      const request = await execution.start(
        this.accountPolicy,
        req.user.id,
        'autocomplete',
        body,
      );
      const {
        connectionId,
        database,
        beforeCursor,
        afterCursor,
        context,
        model,
        providerOverride,
        disabledProviders,
        fallbackProvider,
      } = body;

      try {
        const { connection, schemaContext } = await scope.run(() =>
          this.connectionService.getConnectionContext(
            connectionId,
            database,
            req.user.id,
            (pool, strategy, db, connId) =>
              scope.run(() =>
                this.aiService.gatherSchemaContext(
                  pool,
                  strategy,
                  db,
                  connId,
                  context ? `${context}\n${beforeCursor}` : beforeCursor,
                  {
                    ...request,
                  },
                ),
              ),
          ),
        );

        const resolvedOverride = await scope.run(() =>
          this.providerConnections.resolveOverride(
            req.user.id,
            providerOverride,
          ),
        );
        const completion = await scope.run(() =>
          this.aiService.autocomplete({
            connectionId,
            database,
            ...request,
            disabledProviders,
            fallbackProvider,
            beforeCursor,
            afterCursor,
            schemaContext: context
              ? `${context}\n\n${schemaContext}`
              : schemaContext,
            databaseType: connection.type,
            model,
            providerOverride: resolvedOverride,
          }),
        );
        return await execution.complete({ completion, error: null });
      } catch (err) {
        if (isAiDisabledError(err) || isAiHttpFatalError(err)) throw err;
        const stopped = aiHttpStoppedException(err, scope.signal);
        if (stopped) throw stopped;
        const failed = await execution.fail(err);
        return {
          completion: '',
          error: 'AI generation failed.',
          ...(failed ? aiExecutionMetadata(failed) : {}),
        };
      }
    } catch (error) {
      await execution.fail(error);
      throw isAiHttpFatalError(error)
        ? error
        : (aiHttpStoppedException(error, scope.signal) ?? error);
    } finally {
      try {
        await execution.release();
      } finally {
        scope.dispose();
      }
    }
  }
}
