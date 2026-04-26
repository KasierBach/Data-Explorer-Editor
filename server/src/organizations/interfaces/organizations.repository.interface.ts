import type { Organization, OrganizationMember, Prisma } from '@prisma/client';
import { OrganizationRole } from '../entities/organization-role.enum';
import { ResourceType } from '../../permissions/enums/resource-type.enum';

export interface IOrganizationsRepository {
  findById(id: string): Promise<Organization | null>;
  findBySlug(slug: string): Promise<Organization | null>;
  create(data: Prisma.OrganizationCreateInput): Promise<Organization>;
  update(id: string, data: Prisma.OrganizationUpdateInput): Promise<Organization>;
  delete(id: string): Promise<void>;

  findMember(organizationId: string, userId: string): Promise<OrganizationMember | null>;
  findMembers(organizationId: string): Promise<OrganizationMember[]>;
  addMember(data: Prisma.OrganizationMemberCreateInput): Promise<OrganizationMember>;
  updateMemberRole(organizationId: string, userId: string, role: OrganizationRole): Promise<OrganizationMember>;
  removeMember(organizationId: string, userId: string): Promise<void>;

  findResource(resourceType: ResourceType, resourceId: string, organizationId: string): Promise<any>;
  addResource(data: Prisma.OrganizationResourceCreateInput): Promise<any>;
  removeResource(resourceType: ResourceType, resourceId: string, organizationId: string): Promise<void>;
}
