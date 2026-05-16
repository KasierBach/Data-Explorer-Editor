import {
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/auth-request.types';
import { ResourceType } from '../permissions/enums/resource-type.enum';
import { PresenceService } from './presence.service';

@Controller('presence')
@UseGuards(JwtAuthGuard)
export class PresenceController {
  constructor(private readonly presenceService: PresenceService) {}

  @Post('organizations/:organizationId/teamspaces/:teamspaceId/heartbeat')
  heartbeatTeamspace(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') organizationId: string,
    @Param('teamspaceId') teamspaceId: string,
  ) {
    return this.presenceService.heartbeatTeamspace(
      organizationId,
      teamspaceId,
      req.user.id,
    );
  }

  @Get('organizations/:organizationId/teamspaces/:teamspaceId')
  listTeamspacePresence(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') organizationId: string,
    @Param('teamspaceId') teamspaceId: string,
  ) {
    return this.presenceService.listTeamspacePresence(
      organizationId,
      teamspaceId,
      req.user.id,
    );
  }

  @Delete('organizations/:organizationId/teamspaces/:teamspaceId')
  leaveTeamspace(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') organizationId: string,
    @Param('teamspaceId') teamspaceId: string,
  ) {
    return this.presenceService.leaveTeamspace(
      organizationId,
      teamspaceId,
      req.user.id,
    );
  }

  @Post(
    'organizations/:organizationId/resources/:resourceType/:resourceId/heartbeat',
  )
  heartbeatResource(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') organizationId: string,
    @Param('resourceType', new ParseEnumPipe(ResourceType))
    resourceType: ResourceType,
    @Param('resourceId') resourceId: string,
  ) {
    return this.presenceService.heartbeatResource(
      organizationId,
      resourceType,
      resourceId,
      req.user.id,
    );
  }

  @Get('organizations/:organizationId/resources/:resourceType/:resourceId')
  listResourcePresence(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') organizationId: string,
    @Param('resourceType', new ParseEnumPipe(ResourceType))
    resourceType: ResourceType,
    @Param('resourceId') resourceId: string,
  ) {
    return this.presenceService.listResourcePresence(
      organizationId,
      resourceType,
      resourceId,
      req.user.id,
    );
  }

  @Delete('organizations/:organizationId/resources/:resourceType/:resourceId')
  leaveResource(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') organizationId: string,
    @Param('resourceType', new ParseEnumPipe(ResourceType))
    resourceType: ResourceType,
    @Param('resourceId') resourceId: string,
  ) {
    return this.presenceService.leaveResource(
      organizationId,
      resourceType,
      resourceId,
      req.user.id,
    );
  }
}
