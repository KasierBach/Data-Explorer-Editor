import { Controller, Post, Body, UseGuards, Req, Delete } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { NoSqlService } from './nosql.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AnalyzeSchemaDto } from './dto/analyze-schema.dto';
import { ClearSchemaCacheDto } from './dto/clear-schema-cache.dto';

@Controller('nosql')
@UseGuards(JwtAuthGuard)
export class NoSqlController {
  constructor(private readonly nosqlService: NoSqlService) {}

  @Post('analyze-schema')
  @Throttle({ default: { limit: 12, ttl: 60000 } })
  async analyzeSchema(
    @Body() body: AnalyzeSchemaDto,
    @Req() req: any,
  ) {
    return this.nosqlService.analyzeSchema({
      ...body,
      userId: req.user.id,
    });
  }

  @Delete('cache')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async clearCache(
    @Body() body: ClearSchemaCacheDto,
    @Req() req: any,
  ) {
    await this.nosqlService.clearSchemaCache(
      body.connectionId,
      body.database,
      body.collection,
      req.user.id,
    );
    return { success: true };
  }
}
