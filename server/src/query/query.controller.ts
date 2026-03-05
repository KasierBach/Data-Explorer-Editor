import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { QueryService } from './query.service';
import { CreateQueryDto } from './dto/create-query.dto';
import { UpdateQueryDto } from './dto/update-query.dto';
import { UpdateRowDto } from './dto/update-row.dto';
import { UpdateSchemaDto } from './dto/update-schema.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('query')
@UseGuards(JwtAuthGuard)
export class QueryController {
  constructor(private readonly queryService: QueryService) { }

  @Post()
  executeQuery(@Body() createQueryDto: CreateQueryDto) {
    return this.queryService.executeQuery(createQueryDto);
  }

  @Patch('row')
  updateRow(@Body() updateRowDto: UpdateRowDto) {
    return this.queryService.updateRow(updateRowDto);
  }

  @Post('schema')
  updateSchema(@Body() updateSchemaDto: UpdateSchemaDto) {
    return this.queryService.updateSchema(updateSchemaDto);
  }

  @Post('seed')
  async seedFailed(@Body() body: { connectionId: string }) {
    return this.queryService.seedData(body.connectionId);
  }

  @Post('database')
  async createDatabase(@Body() body: { connectionId: string; name: string }) {
    return this.queryService.createDatabase(body.connectionId, body.name);
  }

  @Delete('database')
  async dropDatabase(@Body() body: { connectionId: string; name: string }) {
    return this.queryService.dropDatabase(body.connectionId, body.name);
  }
}
