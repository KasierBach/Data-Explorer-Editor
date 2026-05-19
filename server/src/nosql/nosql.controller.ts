import { Controller, Post, Body, UseGuards, Req, Delete } from '@nestjs/common';
import { NoSqlService } from './nosql.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Request } from 'express';

@Controller('nosql')
@UseGuards(JwtAuthGuard)
export class NoSqlController {
  constructor(private readonly nosqlService: NoSqlService) {}

  @Post('analyze-schema')
  async analyzeSchema(
    @Body()
    body: {
      connectionId: string;
      database: string;
      collection: string;
      sampleSize?: number;
      refresh?: boolean;
    },
    @Req() req: any,
  ) {
    return this.nosqlService.analyzeSchema({
      ...body,
      userId: req.user.id,
    });
  }

  @Delete('cache')
  async clearCache(
    @Body()
    body: {
      connectionId: string;
      database: string;
      collection: string;
    },
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
