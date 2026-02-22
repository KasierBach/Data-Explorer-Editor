import { Module, Global } from '@nestjs/common';
import { DatabaseStrategyFactory } from './strategy.factory';

@Global()
@Module({
    providers: [DatabaseStrategyFactory],
    exports: [DatabaseStrategyFactory],
})
export class DatabaseStrategiesModule { }
