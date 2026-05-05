import { Global, Module } from '@nestjs/common';
import { FreshnessService } from './freshness.service';

@Global()
@Module({
  providers: [FreshnessService],
  exports: [FreshnessService],
})
export class FreshnessModule {}
