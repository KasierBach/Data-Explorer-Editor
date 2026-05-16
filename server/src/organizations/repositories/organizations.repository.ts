import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { IOrganizationsRepository } from '../interfaces/organizations.repository.interface';
import { OrganizationRole } from '../entities/organization-role.enum';
import { ResourceType } from '../../permissions/enums/resource-type.enum';
import { Prisma } from '@prisma/client';

@Injectable()
export class OrganizationsRepository implements IOrganizationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.organization.findUnique({
      where: { id },
      include: { members: true },
    });
  }

  async findBySlug(slug: string) {
    return this.prisma.organization.findUnique({
      where: { slug },
      include: { members: true },
    });
  }

  async create(data: any) {
    return this.prisma.organization.create({
      data,
      include: { members: true },
    });
  }

  async update(id: string, data: any) {
    return this.prisma.organization.update({
      where: { id },
      data,
      include: { members: true },
    });
  }

  async delete(id: string) {
    await this.prisma.organization.delete({ where: { id } });
  }

  async findMember(organizationId: string, userId: string) {
    return this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: { organizationId, userId },
      },
    });
  }

  async findMembers(organizationId: string) {
    return this.prisma.organizationMember.findMany({
      where: { organizationId },
      include: { user: true },
      orderBy: { joinedAt: 'asc' },
    });
  }

  async addMember(data: any) {
    return this.prisma.organizationMember.create({
      data,
      include: { user: true },
    });
  }

  async updateMemberRole(
    organizationId: string,
    userId: string,
    role: OrganizationRole,
  ) {
    return this.prisma.organizationMember.update({
      where: {
        organizationId_userId: { organizationId, userId },
      },
      data: { role: role as any },
      include: { user: true },
    });
  }

  async removeMember(organizationId: string, userId: string) {
    await this.prisma.organizationMember.delete({
      where: {
        organizationId_userId: { organizationId, userId },
      },
    });
  }

  async findResource(
    resourceType: ResourceType,
    resourceId: string,
    organizationId: string,
  ) {
    return this.prisma.organizationResource.findUnique({
      where: {
        resourceType_resourceId_organizationId: {
          resourceType: resourceType as any,
          resourceId,
          organizationId,
        },
      },
    });
  }

  async addResource(data: any) {
    return this.prisma.organizationResource.create({ data });
  }

  async upsertResource(data: Prisma.OrganizationResourceCreateInput) {
    const payload = data as any;
    const organizationId =
      payload.organizationId ?? payload.organization?.connect?.id;
    if (!organizationId) {
      throw new Error(
        'organizationId is required to upsert an organization resource',
      );
    }

    return this.prisma.organizationResource.upsert({
      where: {
        resourceType_resourceId_organizationId: {
          resourceType: payload.resourceType,
          resourceId: payload.resourceId,
          organizationId,
        },
      },
      create: {
        resourceType: payload.resourceType,
        resourceId: payload.resourceId,
        organization: {
          connect: { id: organizationId },
        },
        permissions: payload.permissions,
      } as any,
      update: {
        permissions: payload.permissions,
      },
    });
  }

  async findResources(organizationId: string, resourceType?: ResourceType) {
    return this.prisma.organizationResource.findMany({
      where: {
        organizationId,
        ...(resourceType ? { resourceType: resourceType as any } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async removeResource(
    resourceType: ResourceType,
    resourceId: string,
    organizationId: string,
  ) {
    await this.prisma.organizationResource.delete({
      where: {
        resourceType_resourceId_organizationId: {
          resourceType: resourceType as any,
          resourceId,
          organizationId,
        },
      },
    });
  }
}
