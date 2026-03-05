import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
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
  executeQuery(@Body() createQueryDto: CreateQueryDto, @Req() req: any) {
    return this.queryService.executeQuery(createQueryDto, req.user.id);
  }

  @Patch('row')
  updateRow(@Body() updateRowDto: UpdateRowDto, @Req() req: any) {
    return this.queryService.updateRow(updateRowDto, req.user.id);
  }

  @Post('schema')
  updateSchema(@Body() updateSchemaDto: UpdateSchemaDto, @Req() req: any) {
    return this.queryService.updateSchema(updateSchemaDto, req.user.id);
  }

  @Post('seed')
  async seedFailed(@Body() body: { connectionId: string }, @Req() req: any) {
    return this.queryService.seedData(body.connectionId, req.user.id);
  }

  @Post('database')
  async createDatabase(@Body() body: { connectionId: string; name: string }, @Req() req: any) {
    return this.queryService.createDatabase(body.connectionId, body.name, req.user.id);
  }

  @Delete('database')
  async dropDatabase(@Body() body: { connectionId: string; name: string }, @Req() req: any) {
    return this.queryService.dropDatabase(body.connectionId, body.name, req.user.id);
  }
}
