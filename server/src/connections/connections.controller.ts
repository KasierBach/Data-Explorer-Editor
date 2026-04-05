import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { ConnectionsService } from './connections.service';
import { CreateConnectionDto } from './dto/create-connection.dto';
import { UpdateConnectionDto } from './dto/update-connection.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('connections')
@UseGuards(JwtAuthGuard)
export class ConnectionsController {
  constructor(private readonly connectionsService: ConnectionsService) { }

  @Post()
  create(@Body() createConnectionDto: CreateConnectionDto, @Req() req: any) {
    return this.connectionsService.create(createConnectionDto, req.user.id);
  }

  @Get()
  findAll(@Req() req: any) {
    return this.connectionsService.findAll(req.user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.connectionsService.findOne(id, req.user.id);
  }

  @Post(':id/health-check')
  checkHealth(@Param('id') id: string, @Req() req: any) {
    return this.connectionsService.checkHealth(id, req.user.id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateConnectionDto: UpdateConnectionDto, @Req() req: any) {
    return this.connectionsService.update(id, updateConnectionDto, req.user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.connectionsService.remove(id, req.user.id);
  }
}
