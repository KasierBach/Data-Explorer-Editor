import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OrganizationsRepository } from '../repositories/organizations.repository';
import { CreateOrganizationDto } from '../dto/create-organization.dto';
import { UpdateOrganizationDto } from '../dto/update-organization.dto';
import { OrganizationRole } from '../entities/organization-role.enum';
import { AuditService, AuditAction } from '../../audit/audit.service';
import { PermissionsService } from '../../permissions/services/permissions.service';
import { ResourceType } from '../../permissions/enums/resource-type.enum';
import { type ResourcePermissionPolicy } from '../../permissions/types/resource-permission-policy';
import { MailService } from '../../mail/mail.service';
import { UserUtils } from '../../users/user.utils';

@Injectable()
export class OrganizationsService {
  private readonly repository: OrganizationsRepository;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly permissions: PermissionsService,
    private readonly mailService: MailService,
  ) {
    this.repository = new OrganizationsRepository(prisma);
  }

  async create(userId: string, dto: CreateOrganizationDto) {
    const slug = this.generateSlug(dto.name);
    const organization = await this.repository.create({
      name: dto.name,
      slug,
      logoUrl: dto.logoUrl,
      settings: {},
    });

    await this.repository.addMember({
      organizationId: organization.id,
      userId,
      role: OrganizationRole.OWNER,
      joinedAt: new Date(),
    });

    await this.audit.log({
      action: AuditAction.TEAM_CREATE,
      userId,
      organizationId: organization.id,
      details: { name: dto.name }
    });

    const updatedOrg = await this.repository.findById(organization.id);
    return this.toEntity(updatedOrg, userId);
  }

  async findById(id: string, userId: string) {
    const org = await this.repository.findById(id);
    if (!org) throw new NotFoundException('Organization not found');

    await this.ensureMemberAccess(id, userId);
    return this.toEntity(org, userId);
  }

  async findMyOrganizations(userId: string) {
    const memberships = await this.prisma.organizationMember.findMany({
      where: { userId },
      include: { organization: { include: { members: { include: { user: { select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true } } } } } } },
    });

    return memberships.map(m => this.toEntity(m.organization, userId));
  }

  async update(id: string, userId: string, dto: UpdateOrganizationDto) {
    await this.ensureOwnerOrAdminAccess(id, userId);
    const organization = await this.repository.update(id, dto);
    return this.toEntity(organization, userId);
  }

  async delete(id: string, userId: string) {
    await this.ensureOwnerAccess(id, userId);
    await this.repository.delete(id);
  }

  async inviteMember(organizationId: string, inviterId: string, dto: { email: string; role: OrganizationRole }) {
    await this.ensureOwnerOrAdminAccess(organizationId, inviterId);
    const normalizedEmail = this.normalizeEmail(dto.email);
    const organization = await this.repository.findById(organizationId);
    if (!organization) throw new NotFoundException('Organization not found');

    const inviter = await this.prisma.user.findUnique({
      where: { id: inviterId },
      select: { firstName: true, lastName: true, email: true },
    });
    const inviterName = UserUtils.getDisplayName(inviter?.firstName, inviter?.lastName, inviter?.email);

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true },
    });

    if (user) {
      const existing = await this.repository.findMember(organizationId, user.id);
      if (existing) throw new ConflictException('User is already a member');
    }

    const invitation = await this.prisma.organizationInvitation.upsert({
      where: {
        organizationId_email: {
          organizationId,
          email: normalizedEmail,
        },
      },
      create: {
        organizationId,
        email: normalizedEmail,
        role: dto.role,
        invitedBy: inviterId,
      },
      update: {
        role: dto.role,
        invitedBy: inviterId,
        invitedAt: new Date(),
        acceptedAt: null,
        acceptedByUserId: null,
      },
    });

    await this.audit.log({
      action: AuditAction.TEAM_MEMBER_INVITE,
      userId: inviterId,
      organizationId,
      details: { memberEmail: normalizedEmail, role: dto.role, status: 'invitation-sent' }
    });

    void this.mailService.sendTeamInvitationEmail(
      normalizedEmail,
      organization.name,
      inviterName,
      dto.role,
      this.getInvitationLoginUrl(),
    ).catch((error) => {
      console.warn('[OrganizationsService] Failed to send invitation email', error);
    });

    return { status: 'invitation-sent', email: normalizedEmail, role: dto.role, invitation };
  }

  async listMyInvitations(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!user?.email) {
      return [];
    }

    const normalizedEmail = this.normalizeEmail(user.email);
    const invitations = await this.prisma.organizationInvitation.findMany({
      where: {
        email: normalizedEmail,
        acceptedAt: null,
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
          },
        },
      },
      orderBy: {
        invitedAt: 'desc',
      },
    });

    return invitations.map((invitation) => ({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      invitedBy: invitation.invitedBy,
      invitedAt: invitation.invitedAt,
      organization: invitation.organization,
    }));
  }

  async acceptInvitation(invitationId: string, userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user?.email) {
      throw new NotFoundException('User not found');
    }

    const invitation = await this.prisma.organizationInvitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (this.normalizeEmail(invitation.email) !== this.normalizeEmail(user.email)) {
      throw new ForbiddenException('This invitation does not belong to your account');
    }

    const existingMember = await this.repository.findMember(invitation.organizationId, user.id);
    if (!existingMember) {
      await this.prisma.organizationMember.create({
        data: {
          organizationId: invitation.organizationId,
          userId: user.id,
          role: invitation.role as OrganizationRole,
          invitedBy: invitation.invitedBy,
          joinedAt: new Date(),
        },
      });
    }

    await this.prisma.organizationInvitation.update({
      where: { id: invitation.id },
      data: {
        acceptedAt: new Date(),
        acceptedByUserId: user.id,
      },
    });

    await this.audit.log({
      action: AuditAction.TEAM_MEMBER_ACCEPT,
      userId,
      organizationId: invitation.organizationId,
      details: {
        memberEmail: invitation.email,
        role: invitation.role,
        invitedBy: invitation.invitedBy,
      },
    });

    const organization = await this.repository.findById(invitation.organizationId);
    return {
      id: invitation.id,
      organizationId: invitation.organizationId,
      organizationName: organization?.name ?? 'Team',
      role: invitation.role,
    };
  }

  async declineInvitation(invitationId: string, userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user?.email) {
      throw new NotFoundException('User not found');
    }

    const invitation = await this.prisma.organizationInvitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (this.normalizeEmail(invitation.email) !== this.normalizeEmail(user.email)) {
      throw new ForbiddenException('This invitation does not belong to your account');
    }

    await this.prisma.organizationInvitation.delete({
      where: { id: invitation.id },
    });

    return { id: invitation.id };
  }

  async updateMemberRole(organizationId: string, inviterId: string, targetUserId: string, role: OrganizationRole) {
    await this.ensureOwnerAccess(organizationId, inviterId);
    if (inviterId === targetUserId) throw new ForbiddenException('Cannot change your own role');

    const result = await this.repository.updateMemberRole(organizationId, targetUserId, role);

    await this.audit.log({
      action: AuditAction.TEAM_MEMBER_ROLE_CHANGE,
      userId: inviterId,
      organizationId,
      details: { targetUserId, newRole: role }
    });

    return result;
  }

  async removeMember(organizationId: string, inviterId: string, targetUserId: string) {
    await this.ensureOwnerOrAdminAccess(organizationId, inviterId);
    if (inviterId === targetUserId) throw new ForbiddenException('Cannot remove yourself');

    const targetMember = await this.repository.findMember(organizationId, targetUserId);
    if (targetMember?.role === OrganizationRole.OWNER) {
      throw new ForbiddenException('Cannot remove owner');
    }

    await this.repository.removeMember(organizationId, targetUserId);

    await this.audit.log({
      action: AuditAction.TEAM_MEMBER_REMOVE,
      userId: inviterId,
      organizationId,
      details: { targetUserId }
    });
  }

  async listMembers(organizationId: string, userId: string) {
    await this.ensureMemberAccess(organizationId, userId);
    return this.repository.findMembers(organizationId);
  }

  async getActivityLogs(organizationId: string, userId: string) {
    await this.ensureMemberAccess(organizationId, userId);
    return this.audit.getOrganizationLogs(organizationId);
  }

  async listConnections(organizationId: string, userId: string) {
    await this.ensureMemberAccess(organizationId, userId);

    const [connections, resourcePolicies] = await Promise.all([
      this.prisma.connection.findMany({
        where: { organizationId },
        select: {
          id: true,
          name: true,
          type: true,
          host: true,
          port: true,
          database: true,
          readOnly: true,
          allowQueryExecution: true,
          lastHealthStatus: true,
          createdAt: true,
          userId: true,
        },
      }),
      this.repository.findResources(organizationId, ResourceType.CONNECTION),
    ]);

    return this.attachResourcePolicies(connections, resourcePolicies);
  }

  async listQueries(organizationId: string, userId: string) {
    await this.ensureMemberAccess(organizationId, userId);

    const [queries, resourcePolicies] = await Promise.all([
      this.prisma.savedQuery.findMany({
        where: { organizationId },
        select: {
          id: true,
          name: true,
          sql: true,
          database: true,
          visibility: true,
          createdAt: true,
          userId: true,
          description: true,
        },
      }),
      this.repository.findResources(organizationId, ResourceType.QUERY),
    ]);

    return this.attachResourcePolicies(queries, resourcePolicies);
  }

  async listDashboards(organizationId: string, userId: string) {
    await this.ensureMemberAccess(organizationId, userId);

    const [dashboards, resourcePolicies] = await Promise.all([
      this.prisma.dashboard.findMany({
        where: { organizationId },
        select: {
          id: true,
          name: true,
          description: true,
          visibility: true,
          createdAt: true,
          userId: true,
        },
      }),
      this.repository.findResources(organizationId, ResourceType.DASHBOARD),
    ]);

    return this.attachResourcePolicies(dashboards, resourcePolicies);
  }

  async ensureResourcePolicy(
    resourceType: ResourceType,
    resourceId: string,
    organizationId: string,
    permissions?: ResourcePermissionPolicy,
  ) {
    return this.repository.upsertResource({
      organizationId,
      resourceType: resourceType as any,
      resourceId,
      permissions: permissions ?? this.permissions.buildDefaultResourcePolicy(),
    } as any);
  }

  async removeResourcePolicy(resourceType: ResourceType, resourceId: string, organizationId: string) {
    try {
      await this.repository.removeResource(resourceType, resourceId, organizationId);
    } catch {
      // The resource may already have been detached. That's fine.
    }
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private getInvitationLoginUrl(): string {
    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
    return `${frontendUrl}/login`;
  }

  private async ensureMemberAccess(organizationId: string, userId: string) {
    const member = await this.repository.findMember(organizationId, userId);
    if (!member) throw new ForbiddenException('You are not a member');
  }

  private async ensureOwnerOrAdminAccess(organizationId: string, userId: string) {
    const member = await this.repository.findMember(organizationId, userId);
    if (!member) throw new ForbiddenException('You are not a member');

    const allowed = [OrganizationRole.OWNER, OrganizationRole.ADMIN];
    if (!allowed.includes(member.role as OrganizationRole)) {
      throw new ForbiddenException('Only owners and admins can perform this action');
    }
  }

  private async ensureOwnerAccess(organizationId: string, userId: string) {
    const member = await this.repository.findMember(organizationId, userId);
    if (member?.role !== OrganizationRole.OWNER) {
      throw new ForbiddenException('Only owners can perform this action');
    }
  }

  private attachResourcePolicies<T extends { id: string }>(
    items: T[],
    resourcePolicies: Array<{ resourceId: string; permissions: unknown }>,
  ) {
    const policyMap = new Map(resourcePolicies.map((resource) => [resource.resourceId, resource.permissions]));

    return items.map((item) => ({
      ...item,
      permissions: policyMap.get(item.id) ?? null,
    }));
  }

  private toEntity(organization: any, currentUserId: string) {
    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      logoUrl: organization.logoUrl,
      settings: organization.settings,
      createdAt: organization.createdAt,
      updatedAt: organization.updatedAt,
      memberCount: organization.members?.length || 0,
      currentUserRole: organization.members?.find((m: any) => m.userId === currentUserId)?.role,
    };
  }
}
