import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import type { IDatabaseStrategy } from './database-strategy.interface';
import { PostgresStrategy } from './postgres.strategy';
import { MysqlStrategy } from './mysql.strategy';
import { MssqlStrategy } from './mssql.strategy';
import { MongoDbStrategy } from './mongodb.strategy';

export const DATABASE_STRATEGIES = 'DATABASE_STRATEGIES';

export interface DatabaseStrategyProvider {
    type: string;
    strategy: IDatabaseStrategy;
}

@Injectable()
export class DatabaseStrategyFactory {
    private readonly strategies: Map<string, IDatabaseStrategy>;

    constructor(
        postgresStrategy: PostgresStrategy,
        mysqlStrategy: MysqlStrategy,
        mssqlStrategy: MssqlStrategy,
        mongoDbStrategy: MongoDbStrategy,
    ) {
        this.strategies = new Map<string, IDatabaseStrategy>([
            ['postgres', postgresStrategy],
            ['mysql', mysqlStrategy],
            ['mssql', mssqlStrategy],
            ['mongodb', mongoDbStrategy],
            ['mongodb+srv', mongoDbStrategy],
        ]);
    }

    getStrategy(type: string): IDatabaseStrategy {
        const strategy = this.strategies.get(type);
        if (!strategy) {
            throw new BadRequestException(`Unsupported connection type: ${type}`);
        }
        return strategy;
    }
}
