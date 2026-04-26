import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import type { IDatabaseStrategy } from './database-strategy.interface';
import { PostgresStrategy } from './postgres.strategy';
import { MysqlStrategy } from './mysql.strategy';
import { MssqlStrategy } from './mssql.strategy';
import { MongoDbStrategy } from './mongodb.strategy';
import { SqliteStrategy } from './sqlite.strategy';
import { ClickHouseStrategy } from './clickhouse.strategy';

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
        sqliteStrategy: SqliteStrategy,
        clickHouseStrategy: ClickHouseStrategy,
    ) {
        this.strategies = new Map<string, IDatabaseStrategy>([
            ['postgres', postgresStrategy],
            ['mysql', mysqlStrategy],
            ['mssql', mssqlStrategy],
            ['mongodb', mongoDbStrategy],
            ['mongodb+srv', mongoDbStrategy],
            ['sqlite', sqliteStrategy],
            ['clickhouse', clickHouseStrategy],
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
