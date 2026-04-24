import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SavedQueriesService } from './saved-queries.service';
import { CreateSavedQueryDto } from './dto/create-saved-query.dto';
import { UpdateSavedQueryDto } from './dto/update-saved-query.dto';
import type { AuthenticatedRequest } from '../auth/auth-request.types';

@Controller('saved-queries')
@UseGuards(JwtAuthGuard)
export class SavedQueriesController {
  constructor(private readonly savedQueriesService: SavedQueriesService) {}

  @Get()
  findAll(@Req() req: AuthenticatedRequest) {
    return this.savedQueriesService.findAllAvailable(req.user.id);
  }

  @Post()
  create(@Body() dto: CreateSavedQueryDto, @Req() req: AuthenticatedRequest) {
    return this.savedQueriesService.create(dto, req.user.id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSavedQueryDto, @Req() req: AuthenticatedRequest) {
    return this.savedQueriesService.update(id, dto, req.user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.savedQueriesService.remove(id, req.user.id);
  }
}
