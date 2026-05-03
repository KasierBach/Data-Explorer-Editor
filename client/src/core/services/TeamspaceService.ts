import { apiService } from './api.service';

export interface TeamspaceCreator {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
}

export interface TeamspaceEntity {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
  organizationId: string;
  resourceCount: number;
  creator?: TeamspaceCreator | null;
}

export interface CreateTeamspacePayload {
  name: string;
  description?: string;
}

export interface UpdateTeamspacePayload {
  name?: string;
  description?: string | null;
}

export interface AssignResourceTeamspacePayload {
  teamspaceId?: string | null;
}

export class TeamspaceService {
  static async getTeamspaces(organizationId: string): Promise<TeamspaceEntity[]> {
    return apiService.get<TeamspaceEntity[]>(`/organizations/${organizationId}/teamspaces`);
  }

  static async createTeamspace(
    organizationId: string,
    payload: CreateTeamspacePayload,
  ): Promise<TeamspaceEntity> {
    return apiService.post<TeamspaceEntity>(`/organizations/${organizationId}/teamspaces`, payload);
  }

  static async updateTeamspace(
    organizationId: string,
    teamspaceId: string,
    payload: UpdateTeamspacePayload,
  ): Promise<TeamspaceEntity> {
    return apiService.patch<TeamspaceEntity>(
      `/organizations/${organizationId}/teamspaces/${teamspaceId}`,
      payload,
    );
  }

  static async deleteTeamspace(organizationId: string, teamspaceId: string): Promise<void> {
    await apiService.delete<void>(`/organizations/${organizationId}/teamspaces/${teamspaceId}`);
  }

  static async assignResourceTeamspace(
    organizationId: string,
    resourceType: string,
    resourceId: string,
    payload: AssignResourceTeamspacePayload,
  ): Promise<{ id: string; teamspaceId?: string | null }> {
    return apiService.patch<{ id: string; teamspaceId?: string | null }>(
      `/organizations/${organizationId}/resources/${resourceType}/${resourceId}/teamspace`,
      payload,
    );
  }
}
