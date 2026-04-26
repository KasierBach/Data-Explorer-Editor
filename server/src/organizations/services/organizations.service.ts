import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OrganizationsRepository } from '../repositories/organizations.repository';
import { CreateOrganizationDto } from '../dto/create-organization.dto';
import { UpdateOrganizationDto } from '../dto/update-organization.dto';
import { OrganizationRole } from '../entities/organization-role.enum';
import { AuditService, AuditAction } from '../../audit/audit.service';

@Injectable()
export class OrganizationsService {
  private readonly repository: OrganizationsRepository;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
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

    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new NotFoundException('User not found');

    const existing = await this.repository.findMember(organizationId, user.id);
    if (existing) throw new ConflictException('User is already a member');

    const result = await this.repository.addMember({
      organizationId,
      userId: user.id,
      role: dto.role,
      invitedBy: inviterId,
    });

    await this.audit.log({
      action: AuditAction.TEAM_MEMBER_INVITE,
      userId: inviterId,
      organizationId,
      details: { memberEmail: dto.email, role: dto.role }
    });

    return result;
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

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
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
