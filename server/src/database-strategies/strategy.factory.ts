import { Injectable, BadRequestException } from '@nestjs/common';
import type { IDatabaseStrategy } from './database-strategy.interface';
import { PostgresStrategy } from './postgres.strategy';
import { MysqlStrategy } from './mysql.strategy';
import { MssqlStrategy } from './mssql.strategy';

@Injectable()
export class DatabaseStrategyFactory {
    private readonly strategies: Map<string, IDatabaseStrategy>;

    constructor() {
        this.strategies = new Map<string, IDatabaseStrategy>([
            ['postgres', new PostgresStrategy()],
            ['mysql', new MysqlStrategy()],
            ['mssql', new MssqlStrategy()],
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
