import { Injectable } from '@nestjs/common';
import { ConnectionsService } from '../connections/connections.service';
import { AiAccountPolicyService } from './ai-account-policy.service';
import { DatabaseStrategyFactory } from '../database-strategies';
import type { IDatabaseStrategy } from '../database-strategies/database-strategy.interface';

import type { Connection } from '../connections/entities/connection.entity';
import { queryDatabaseException } from '../query/query-error.util';

export interface ConnectionContext {
  connection: Connection;
  pool: unknown;
  strategy: IDatabaseStrategy;
  schemaContext: string;
}

export type SchemaContextGatherer = (
  pool: unknown,
  strategy: IDatabaseStrategy,
  database?: string,
  connectionId?: string,
) => Promise<string>;

@Injectable()
export class AiConnectionService {
  constructor(
    private readonly connectionsService: ConnectionsService,
    private readonly strategyFactory: DatabaseStrategyFactory,
    private readonly accountPolicy: AiAccountPolicyService,
  ) {}

  async getConnectionContext(
    connectionId: string,
    database: string | undefined,
    userId: string,
    gatherSchemaContext: SchemaContextGatherer,
  ): Promise<ConnectionContext> {
    await this.accountPolicy.assertEnabled(userId);
    await this.accountPolicy.assertConnectionEnabled(
      userId,
      connectionId,
      database,
    );
    const connection = await this.connectionsService.findOne(
      connectionId,
      userId,
    );
    try {
      const pool = await this.connectionsService.getPool(
        connectionId,
        database,
        userId,
      );
      const strategy = this.strategyFactory.getStrategy(connection.type);
      const schemaContext = await gatherSchemaContext(
        pool,
        strategy,
        database,
        connectionId,
      );
      return { connection, pool, strategy, schemaContext };
    } catch (error) {
      throw queryDatabaseException(
        error,
        connection.type,
        'Cannot load database context.',
      );
    }
  }

  async getConnectionContextForStream(
    connectionId: string,
    database: string | undefined,
    userId: string,
    gatherSchemaContext: SchemaContextGatherer,
  ): Promise<ConnectionContext> {
    return this.getConnectionContext(
      connectionId,
      database,
      userId,
      gatherSchemaContext,
    );
  }
}
