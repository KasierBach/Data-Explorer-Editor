import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/auth-request.types';
import { TeamspacesService } from './teamspaces.service';
import { CreateTeamspaceDto } from './dto/create-teamspace.dto';
import { UpdateTeamspaceDto } from './dto/update-teamspace.dto';
import { AssignResourceTeamspaceDto } from './dto/assign-resource-teamspace.dto';
import { ResourceType } from '../permissions/enums/resource-type.enum';

@Controller('organizations/:organizationId')
@UseGuards(JwtAuthGuard)
export class TeamspacesController {
  constructor(private readonly teamspacesService: TeamspacesService) {}

  @Patch('teamspaces/:teamspaceId')
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') organizationId: string,
    @Param('teamspaceId') teamspaceId: string,
    @Body() dto: UpdateTeamspaceDto,
  ) {
    return this.teamspacesService.update(organizationId, teamspaceId, req.user.id, dto);
  }

  @Delete('teamspaces/:teamspaceId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') organizationId: string,
    @Param('teamspaceId') teamspaceId: string,
  ) {
    await this.teamspacesService.delete(organizationId, teamspaceId, req.user.id);
  }

  @Get('teamspaces')
  async listTeamspaces(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') organizationId: string,
  ) {
    return this.teamspacesService.list(organizationId, req.user.id);
  }

  @Post('teamspaces')
  @HttpCode(HttpStatus.CREATED)
  async createTeamspace(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') organizationId: string,
    @Body() dto: CreateTeamspaceDto,
  ) {
    return this.teamspacesService.create(organizationId, req.user.id, dto);
  }

  @Patch('resources/:resourceType/:resourceId/teamspace')
  async assignResourceTeamspace(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') organizationId: string,
    @Param('resourceType') resourceType: ResourceType,
    @Param('resourceId') resourceId: string,
    @Body() dto: AssignResourceTeamspaceDto,
  ) {
    return this.teamspacesService.assignResourceTeamspace(
      organizationId,
      resourceType,
      resourceId,
      req.user.id,
      dto.teamspaceId ?? null,
    );
  }
}
