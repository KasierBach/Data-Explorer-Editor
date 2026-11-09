import {
  ForbiddenException,
  HttpException,
  Injectable,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ConnectionsService } from '../connections/connections.service';
import { AiEgressPolicyService } from './ai-egress-policy.service';
import type { ProviderPlan } from './ai.types';

export function isAiDisabledError(error: unknown): error is HttpException {
  if (!(error instanceof HttpException)) return false;
  const response = error.getResponse();
  return (
    typeof response === 'object' &&
    response !== null &&
    'reason' in response &&
    ['AI_DISABLED', 'AI_EGRESS_DENIED'].includes(String(response.reason))
  );
}

@Injectable()
export class AiAccountPolicyService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly config: ConfigService = new ConfigService(),
    @Optional()
    private readonly egressPolicy: AiEgressPolicyService = new AiEgressPolicyService(
      config,
    ),
    @Optional() private readonly connectionsService?: ConnectionsService,
  ) {}

  async isEnabled(userId: string): Promise<boolean> {
    if (this.config.get<string>('AI_KILL_SWITCH') === 'true') return false;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { aiEnabled: true },
    });
    return user?.aiEnabled === true;
  }

  async assertEnabled(userId: string): Promise<void> {
    if (await this.isEnabled(userId)) return;
    throw new ForbiddenException({
      reason: 'AI_DISABLED',
      message:
        'AI is disabled for this account. Enable AI in settings before contacting a provider.',
    });
  }

  async assertConnectionEnabled(
    userId: string,
    connectionId: string,
    database?: string,
  ): Promise<void> {
    await this.assertEnabled(userId);
    if (!this.connectionsService)
      throw new ForbiddenException({
        reason: 'AI_EGRESS_DENIED',
        message: 'AI connection authorization is unavailable.',
      });
    const connection = await this.connectionsService.findOne(
      connectionId,
      userId,
    );
    this.egressPolicy.assertContext({
      connectionId,
      organizationId: connection.organizationId,
      // Match getPool's databaseOverride || connection.database exactly. Do not
      // normalize an override into a different (potentially approved) database.
      database: database || connection.database || undefined,
    });
  }

  beforeProviderRequest(
    userId: string,
    connectionId?: string,
    database?: string,
  ): () => Promise<void> {
    return () =>
      connectionId
        ? this.assertConnectionEnabled(userId, connectionId, database)
        : this.assertEnabled(userId);
  }

  beforeProviderAttempt(
    userId: string,
    connectionId?: string,
    database?: string,
  ) {
    return async (plan: ProviderPlan) => {
      await this.assertEnabled(userId);
      let organizationId: string | null | undefined;
      let effectiveDatabase = database;
      if (connectionId) {
        if (!this.connectionsService)
          throw new ForbiddenException({
            reason: 'AI_EGRESS_DENIED',
            message: 'AI connection authorization is unavailable.',
          });
        const connection = await this.connectionsService.findOne(
          connectionId,
          userId,
        );
        organizationId = connection.organizationId;
        // Resolve again on every attempt so changed server defaults cannot
        // reuse an earlier database or organization approval.
        effectiveDatabase = database || connection.database || undefined;
      }
      this.egressPolicy.assertProvider(plan, {
        connectionId,
        organizationId,
        database: effectiveDatabase,
      });
    };
  }
}
