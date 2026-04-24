import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ErdWorkspacesService } from './erd-workspaces.service';
import { CreateErdWorkspaceDto } from './dto/create-erd-workspace.dto';
import { UpdateErdWorkspaceDto } from './dto/update-erd-workspace.dto';
import type { AuthenticatedRequest } from '../auth/auth-request.types';

@Controller('erd-workspaces')
@UseGuards(JwtAuthGuard)
export class ErdWorkspacesController {
  constructor(private readonly erdWorkspacesService: ErdWorkspacesService) {}

  @Get()
  findAll(@Req() req: AuthenticatedRequest, @Query('connectionId') connectionId?: string) {
    return this.erdWorkspacesService.findAll(req.user.id, connectionId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.erdWorkspacesService.findOne(id, req.user.id);
  }

  @Post()
  create(@Body() dto: CreateErdWorkspaceDto, @Req() req: AuthenticatedRequest) {
    return this.erdWorkspacesService.create(dto, req.user.id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateErdWorkspaceDto, @Req() req: AuthenticatedRequest) {
    return this.erdWorkspacesService.update(id, dto, req.user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.erdWorkspacesService.remove(id, req.user.id);
  }
}
