import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { QueryService } from './query.service';
import { CreateQueryDto } from './dto/create-query.dto';
import { UpdateQueryDto } from './dto/update-query.dto';
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
  updateRow(@Body() updateRowDto: any) {
    return this.queryService.updateRow(updateRowDto);
  }

  @Post('schema')
  updateSchema(@Body() updateSchemaDto: any) {
    return this.queryService.updateSchema(updateSchemaDto);
  }

  @Post('seed')
  async seedFailed(@Body() body: { connectionId: string }) {
    return this.queryService.seedData(body.connectionId);
  }
}
