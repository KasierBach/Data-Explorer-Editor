import {
  Controller, Get, Post, Put, Delete, Body, Param, UseGuards, HttpCode, HttpStatus, Req,
} from '@nestjs/common';
import { OrganizationsService } from './services/organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/auth-request.types';

@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Req() req: AuthenticatedRequest, @Body() dto: CreateOrganizationDto) {
    return this.organizationsService.create(req.user.id, dto);
  }

  @Get('me')
  async findMy(@Req() req: AuthenticatedRequest) {
    return this.organizationsService.findMyOrganizations(req.user.id);
  }

  @Get('invitations/me')
  async listMyInvitations(@Req() req: AuthenticatedRequest) {
    return this.organizationsService.listMyInvitations(req.user.id);
  }

  @Post('invitations/:invitationId/accept')
  async acceptInvitation(
    @Req() req: AuthenticatedRequest,
    @Param('invitationId') invitationId: string,
  ) {
    return this.organizationsService.acceptInvitation(invitationId, req.user.id);
  }

  @Delete('invitations/:invitationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async declineInvitation(
    @Req() req: AuthenticatedRequest,
    @Param('invitationId') invitationId: string,
  ) {
    await this.organizationsService.declineInvitation(invitationId, req.user.id);
  }

  @Get(':id')
  async findOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.organizationsService.findById(id, req.user.id);
  }

  @Put(':id')
  async update(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: UpdateOrganizationDto) {
    return this.organizationsService.update(id, req.user.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    await this.organizationsService.delete(id, req.user.id);
  }

  @Post(':id/members')
  @HttpCode(HttpStatus.CREATED)
  async inviteMember(
    @Req() req: AuthenticatedRequest,
    @Param('id') organizationId: string,
    @Body() dto: InviteMemberDto,
  ) {
    return this.organizationsService.inviteMember(organizationId, req.user.id, dto);
  }

  @Put(':id/members/:userId')
  async updateMemberRole(
    @Req() req: AuthenticatedRequest,
    @Param('id') organizationId: string,
    @Param('userId') targetUserId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.organizationsService.updateMemberRole(organizationId, req.user.id, targetUserId, dto.role);
  }

  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(
    @Req() req: AuthenticatedRequest,
    @Param('id') organizationId: string,
    @Param('userId') targetUserId: string,
  ) {
    await this.organizationsService.removeMember(organizationId, req.user.id, targetUserId);
  }

  @Get(':id/members')
  async listMembers(@Req() req: AuthenticatedRequest, @Param('id') organizationId: string) {
    return this.organizationsService.listMembers(organizationId, req.user.id);
  }

  @Get(':id/connections')
  async listConnections(@Req() req: AuthenticatedRequest, @Param('id') organizationId: string) {
    return this.organizationsService.listConnections(organizationId, req.user.id);
  }

  @Get(':id/queries')
  async listQueries(@Req() req: AuthenticatedRequest, @Param('id') organizationId: string) {
    return this.organizationsService.listQueries(organizationId, req.user.id);
  }

  @Get(':id/dashboards')
  async listDashboards(@Req() req: AuthenticatedRequest, @Param('id') organizationId: string) {
    return this.organizationsService.listDashboards(organizationId, req.user.id);
  }

  @Get(':id/activities')
  async listActivities(@Req() req: AuthenticatedRequest, @Param('id') organizationId: string) {
    return this.organizationsService.getActivityLogs(organizationId, req.user.id);
  }
}
