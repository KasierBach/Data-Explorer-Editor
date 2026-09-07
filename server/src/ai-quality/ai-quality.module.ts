import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import {
  AiQualityController,
  AiUsageController,
} from './ai-quality.controller';
import { AiQualityService } from './ai-quality.service';

@Module({
  imports: [PrismaModule],
  controllers: [AiQualityController, AiUsageController],
  providers: [AiQualityService],
})
export class AiQualityModule {}
