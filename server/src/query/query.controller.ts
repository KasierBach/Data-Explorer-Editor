import {
  Controller,
  Post,
  Body,
  Patch,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { QueryService } from './query.service';
import { CreateQueryDto } from './dto/create-query.dto';
import { UpdateRowDto } from './dto/update-row.dto';
import { InsertRowDto } from './dto/insert-row.dto';
import { DeleteRowsDto } from './dto/delete-rows.dto';
import { UpdateSchemaDto } from './dto/update-schema.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

interface JwtUser {
  id: string;
  email: string;
  role: string;
}

interface RequestWithUser extends Request {
  user: JwtUser;
}

@Controller('query')
@UseGuards(JwtAuthGuard)
export class QueryController {
  constructor(private readonly queryService: QueryService) {}

  @Post()
  executeQuery(
    @Body() createQueryDto: CreateQueryDto,
    @Req() req: RequestWithUser,
  ) {
    return this.queryService.executeQuery(createQueryDto, req.user.id);
  }

  @Patch('row')
  updateRow(@Body() updateRowDto: UpdateRowDto, @Req() req: RequestWithUser) {
    return this.queryService.updateRow(updateRowDto, req.user.id);
  }

  @Post('row')
  insertRow(@Body() insertRowDto: InsertRowDto, @Req() req: RequestWithUser) {
    return this.queryService.insertRow(insertRowDto, req.user.id);
  }

  @Post('delete-rows')
  deleteRows(
    @Body() deleteRowsDto: DeleteRowsDto,
    @Req() req: RequestWithUser,
  ) {
    return this.queryService.deleteRows(deleteRowsDto, req.user.id);
  }

  @Post('schema')
  updateSchema(
    @Body() updateSchemaDto: UpdateSchemaDto,
    @Req() req: RequestWithUser,
  ) {
    return this.queryService.updateSchema(updateSchemaDto, req.user.id);
  }

  @Post('seed')
  async seedFailed(
    @Body() body: { connectionId: string },
    @Req() req: RequestWithUser,
  ) {
    return this.queryService.seedData(body.connectionId, req.user.id);
  }

  @Post('database')
  async createDatabase(
    @Body() body: { connectionId: string; name: string },
    @Req() req: RequestWithUser,
  ) {
    return this.queryService.createDatabase(
      body.connectionId,
      body.name,
      req.user.id,
    );
  }

  @Delete('database')
  async dropDatabase(
    @Body() body: { connectionId: string; name: string },
    @Req() req: RequestWithUser,
  ) {
    return this.queryService.dropDatabase(
      body.connectionId,
      body.name,
      req.user.id,
    );
  }

  @Post('import')
  async importData(
    @Body()
    body: {
      connectionId: string;
      schema: string;
      table: string;
      data: Record<string, unknown>[];
    },
    @Req() req: RequestWithUser,
  ) {
    return this.queryService.importData(body, req.user.id);
  }
}
