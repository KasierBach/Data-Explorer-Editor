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
import { Throttle } from '@nestjs/throttler';
import { QueryService } from './query.service';
import { CreateQueryDto } from './dto/create-query.dto';
import { FetchTableWindowDto } from './dto/fetch-table-window.dto';
import { UpdateRowDto } from './dto/update-row.dto';
import { InsertRowDto } from './dto/insert-row.dto';
import { DeleteRowsDto } from './dto/delete-rows.dto';
import { UpdateSchemaDto } from './dto/update-schema.dto';
import { SeedDataDto } from './dto/seed-data.dto';
import { ManageDatabaseDto } from './dto/manage-database.dto';
import { ImportDataDto } from './dto/import-data.dto';
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
  @Throttle({ default: { limit: 45, ttl: 60000 } })
  executeQuery(
    @Body() createQueryDto: CreateQueryDto,
    @Req() req: RequestWithUser,
  ) {
    return this.queryService.executeQuery(createQueryDto, req.user.id);
  }

  @Post('table-window')
  @Throttle({ default: { limit: 180, ttl: 60000 } })
  fetchTableWindow(
    @Body() fetchTableWindowDto: FetchTableWindowDto,
    @Req() req: RequestWithUser,
  ) {
    return this.queryService.fetchTableWindow(fetchTableWindowDto, req.user.id);
  }

  @Patch('row')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  updateRow(@Body() updateRowDto: UpdateRowDto, @Req() req: RequestWithUser) {
    return this.queryService.updateRow(updateRowDto, req.user.id);
  }

  @Post('row')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  insertRow(@Body() insertRowDto: InsertRowDto, @Req() req: RequestWithUser) {
    return this.queryService.insertRow(insertRowDto, req.user.id);
  }

  @Post('delete-rows')
  @Throttle({ default: { limit: 45, ttl: 60000 } })
  deleteRows(
    @Body() deleteRowsDto: DeleteRowsDto,
    @Req() req: RequestWithUser,
  ) {
    return this.queryService.deleteRows(deleteRowsDto, req.user.id);
  }

  @Post('schema')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  updateSchema(
    @Body() updateSchemaDto: UpdateSchemaDto,
    @Req() req: RequestWithUser,
  ) {
    return this.queryService.updateSchema(updateSchemaDto, req.user.id);
  }

  @Post('seed')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async seedFailed(
    @Body() body: SeedDataDto,
    @Req() req: RequestWithUser,
  ) {
    return this.queryService.seedData(body.connectionId, req.user.id);
  }

  @Post('database')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async createDatabase(
    @Body() body: ManageDatabaseDto,
    @Req() req: RequestWithUser,
  ) {
    return this.queryService.createDatabase(
      body.connectionId,
      body.name,
      req.user.id,
    );
  }

  @Delete('database')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async dropDatabase(
    @Body() body: ManageDatabaseDto,
    @Req() req: RequestWithUser,
  ) {
    return this.queryService.dropDatabase(
      body.connectionId,
      body.name,
      req.user.id,
    );
  }

  @Post('import')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async importData(
    @Body() body: ImportDataDto,
    @Req() req: RequestWithUser,
  ) {
    return this.queryService.importData(body, req.user.id);
  }
}
