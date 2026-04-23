import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConnectionsService } from '../connections/connections.service';
import { DatabaseStrategyFactory } from '../database-strategies';
import type { IDatabaseStrategy } from '../database-strategies/database-strategy.interface';

export interface ConnectionContext {
    connection: any;
    pool: any;
    strategy: IDatabaseStrategy;
    schemaContext: string;
}

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
        gatherSchemaContext: (pool: any, strategy: any, database?: string, connectionId?: string) => Promise<string>,
    ): Promise<ConnectionContext> {
        let connection: any;
        try {
            connection = await this.connectionsService.findOne(connectionId, userId);
        } catch (error) {
            throw new BadRequestException(`Connection "${connectionId}" not found. Please re-select your connection.`);
        }

        let pool: any;
        try {
            pool = await this.connectionsService.getPool(connectionId, database, userId);
        } catch (error) {
            throw new InternalServerErrorException(`Cannot connect to database: ${(error as any).message}`);
        }

        const strategy = this.strategyFactory.getStrategy(connection.type);
        const schemaContext = await gatherSchemaContext(pool, strategy, database, connectionId);

        return { connection, pool, strategy, schemaContext };
    }

    async getConnectionContextForStream(
        connectionId: string,
        database: string | undefined,
        userId: string,
        gatherSchemaContext: (pool: any, strategy: any, database?: string, connectionId?: string) => Promise<string>,
    ): Promise<ConnectionContext | null> {
        let connection: any;
        try {
            connection = await this.connectionsService.findOne(connectionId, userId);
        } catch {
            return null;
        }

        let pool: any;
        try {
            pool = await this.connectionsService.getPool(connectionId, database, userId);
        } catch {
            return null;
        }

        const strategy = this.strategyFactory.getStrategy(connection.type);
        const schemaContext = await gatherSchemaContext(pool, strategy, database, connectionId);

        return { connection, pool, strategy, schemaContext };
    }
}