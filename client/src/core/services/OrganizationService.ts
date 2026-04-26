import { apiService } from './api.service';

export interface OrganizationEntity {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  settings?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  memberCount: number;
  currentUserRole: string;
}

export interface OrganizationMemberEntity {
  id: string;
  role: string;
  invitedBy?: string;
  invitedAt: string;
  joinedAt?: string;
  userId: string;
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    avatarUrl?: string;
  };
}

export interface CreateOrganizationPayload {
  name: string;
  logoUrl?: string;
}

export interface UpdateOrganizationPayload {
  name?: string;
  logoUrl?: string;
  settings?: Record<string, unknown>;
}

export interface InviteMemberPayload {
  email: string;
  role: string;
}

export class OrganizationService {
  static async getMyOrganizations(): Promise<OrganizationEntity[]> {
    return apiService.get<OrganizationEntity[]>('/organizations/me');
  }

  static async getOrganization(id: string): Promise<OrganizationEntity> {
    return apiService.get<OrganizationEntity>(`/organizations/${id}`);
  }

  static async createOrganization(payload: CreateOrganizationPayload): Promise<OrganizationEntity> {
    return apiService.post<OrganizationEntity>('/organizations', payload);
  }

  static async updateOrganization(id: string, payload: UpdateOrganizationPayload): Promise<OrganizationEntity> {
    return apiService.patch<OrganizationEntity>(`/organizations/${id}`, payload);
  }

  static async deleteOrganization(id: string): Promise<void> {
    await apiService.delete<void>(`/organizations/${id}`);
  }

  static async getMembers(id: string): Promise<OrganizationMemberEntity[]> {
    return apiService.get<OrganizationMemberEntity[]>(`/organizations/${id}/members`);
  }

  static async inviteMember(id: string, payload: InviteMemberPayload): Promise<OrganizationMemberEntity> {
    return apiService.post<OrganizationMemberEntity>(`/organizations/${id}/members`, payload);
  }

  static async updateMemberRole(id: string, userId: string, role: string): Promise<OrganizationMemberEntity> {
    return apiService.patch<OrganizationMemberEntity>(`/organizations/${id}/members/${userId}`, { role });
  }

  static async removeMember(id: string, userId: string): Promise<void> {
    await apiService.delete<void>(`/organizations/${id}/members/${userId}`);
  }

  static async getTeamConnections(id: string): Promise<any[]> {
    return apiService.get<any[]>(`/organizations/${id}/connections`);
  }

  static async getTeamQueries(id: string): Promise<any[]> {
    return apiService.get<any[]>(`/organizations/${id}/queries`);
  }

  static async getTeamDashboards(id: string): Promise<any[]> {
    return apiService.get<any[]>(`/organizations/${id}/dashboards`);
  }

  static async getTeamActivities(id: string): Promise<any[]> {
    return apiService.get<any[]>(`/organizations/${id}/activities`);
  }
}
