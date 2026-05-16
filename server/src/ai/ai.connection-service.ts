import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConnectionsService } from '../connections/connections.service';
import { DatabaseStrategyFactory } from '../database-strategies';
import type { IDatabaseStrategy } from '../database-strategies/database-strategy.interface';

import type { Connection } from '../connections/entities/connection.entity';

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
  ) {}

  async getConnectionContext(
    connectionId: string,
    database: string | undefined,
    userId: string,
    gatherSchemaContext: SchemaContextGatherer,
  ): Promise<ConnectionContext> {
    let connection: Connection;
    try {
      connection = await this.connectionsService.findOne(connectionId, userId);
    } catch {
      throw new BadRequestException(
        `Connection "${connectionId}" not found. Please re-select your connection.`,
      );
    }

    let pool: unknown;
    try {
      pool = await this.connectionsService.getPool(
        connectionId,
        database,
        userId,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new InternalServerErrorException(
        `Cannot connect to database: ${message}`,
      );
    }

    const strategy = this.strategyFactory.getStrategy(connection.type);
    const schemaContext = await gatherSchemaContext(
      pool,
      strategy,
      database,
      connectionId,
    );

    return { connection, pool, strategy, schemaContext };
  }

  async getConnectionContextForStream(
    connectionId: string,
    database: string | undefined,
    userId: string,
    gatherSchemaContext: SchemaContextGatherer,
  ): Promise<ConnectionContext | null> {
    let connection: Connection;
    try {
      connection = await this.connectionsService.findOne(connectionId, userId);
    } catch {
      return null;
    }

    let pool: unknown;
    try {
      pool = await this.connectionsService.getPool(
        connectionId,
        database,
        userId,
      );
    } catch {
      return null;
    }

    const strategy = this.strategyFactory.getStrategy(connection.type);
    const schemaContext = await gatherSchemaContext(
      pool,
      strategy,
      database,
      connectionId,
    );

    return { connection, pool, strategy, schemaContext };
  }
}
