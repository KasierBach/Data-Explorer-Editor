import { Module, Global } from '@nestjs/common';
import { DatabaseStrategyFactory } from './strategy.factory';
import { PostgresStrategy } from './postgres.strategy';
import { MysqlStrategy } from './mysql.strategy';
import { MssqlStrategy } from './mssql.strategy';
import { MongoDbStrategy } from './mongodb.strategy';

@Global()
@Module({
    providers: [
        PostgresStrategy,
        MysqlStrategy,
        MssqlStrategy,
        MongoDbStrategy,
        DatabaseStrategyFactory,
    ],
    exports: [
        PostgresStrategy,
        MysqlStrategy,
        MssqlStrategy,
        MongoDbStrategy,
        DatabaseStrategyFactory,
    ],
})
export class DatabaseStrategiesModule { }
