import { apiService } from './api.service';

export type TeamResourcePermissionPolicy = Record<string, string[]> | null;

export interface TeamConnectionEntity {
  id: string;
  name: string;
  type: string;
  host: string;
  port?: number | null;
  database?: string | null;
  readOnly?: boolean | null;
  lastHealthStatus?: string | null;
  teamspaceId?: string | null;
  permissions?: TeamResourcePermissionPolicy;
}

export interface TeamQueryEntity {
  id: string;
  name: string;
  sql: string;
  teamspaceId?: string | null;
  permissions?: TeamResourcePermissionPolicy;
}

export interface TeamDashboardEntity {
  id: string;
  name: string;
  description?: string | null;
  teamspaceId?: string | null;
  permissions?: TeamResourcePermissionPolicy;
}

export interface OrganizationBackupPackage {
  version: 1;
  exportedAt: string;
  organization: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    settings: Record<string, unknown> | null;
  };
  notes: string[];
  teamspaces: Array<{
    sourceId: string;
    name: string;
    slug: string;
    description: string | null;
    createdBy: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  resourcePolicies: Array<{
    resourceType: string;
    resourceId: string;
    permissions: unknown;
    teamspaceId: string | null;
  }>;
  savedQueries: Array<{
    sourceId: string;
    name: string;
    sql: string;
    database: string | null;
    connectionId: string | null;
    visibility: string;
    folderId: string | null;
    tags: string[];
    description: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  dashboards: Array<{
    sourceId: string;
    name: string;
    description: string | null;
    visibility: string;
    connectionId: string | null;
    database: string | null;
    createdAt: string;
    updatedAt: string;
    widgets: Array<{
      sourceId: string;
      title: string;
      chartType: string;
      queryText: string | null;
      connectionId: string | null;
      database: string | null;
      columns: string[];
      xAxis: string | null;
      yAxis: string[];
      orderIndex: number;
      config: unknown;
      dataSnapshot: unknown;
      createdAt: string;
      updatedAt: string;
    }>;
  }>;
  erdWorkspaces: Array<{
    sourceId: string;
    name: string;
    notes: string | null;
    connectionId: string | null;
    database: string | null;
    layout: unknown;
    createdAt: string;
    updatedAt: string;
  }>;
}

export interface OrganizationBackupRestoreResult {
  organizationId: string;
  restoredAt: string;
  created: {
    teamspaces: number;
    savedQueries: number;
    dashboards: number;
    dashboardWidgets: number;
    erdWorkspaces: number;
    resourcePolicies: number;
  };
  warnings: string[];
}

export interface TeamActivityEntity {
  id: string;
  action: string;
  createdAt: string;
  userId?: string;
  organizationId?: string;
  details?: any;
  user?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email: string;
    username?: string | null;
    avatarUrl?: string | null;
  };
}

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

export interface OrganizationInvitationEntity {
  id: string;
  email: string;
  role: string;
  invitedBy?: string | null;
  invitedAt: string;
  organization: {
    id: string;
    name: string;
    slug: string;
    logoUrl?: string | null;
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

export interface InviteMemberResult {
  status: 'invitation-sent';
  email: string;
  role: string;
  invitation?: {
    id: string;
    email: string;
    role: string;
    organizationId: string;
  };
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

  static async getMyInvitations(): Promise<OrganizationInvitationEntity[]> {
    return apiService.get<OrganizationInvitationEntity[]>('/organizations/invitations/me');
  }

  static async inviteMember(id: string, payload: InviteMemberPayload): Promise<InviteMemberResult> {
    return apiService.post<InviteMemberResult>(`/organizations/${id}/members`, payload);
  }

  static async acceptInvitation(invitationId: string): Promise<{
    id: string;
    organizationId: string;
    organizationName: string;
    role: string;
  }> {
    return apiService.post<{
      id: string;
      organizationId: string;
      organizationName: string;
      role: string;
    }>(`/organizations/invitations/${invitationId}/accept`, {});
  }

  static async declineInvitation(invitationId: string): Promise<void> {
    await apiService.delete<void>(`/organizations/invitations/${invitationId}`);
  }

  static async updateMemberRole(id: string, userId: string, role: string): Promise<OrganizationMemberEntity> {
    return apiService.patch<OrganizationMemberEntity>(`/organizations/${id}/members/${userId}`, { role });
  }

  static async removeMember(id: string, userId: string): Promise<void> {
    await apiService.delete<void>(`/organizations/${id}/members/${userId}`);
  }

  static async getTeamConnections(id: string): Promise<TeamConnectionEntity[]> {
    return apiService.get<TeamConnectionEntity[]>(`/organizations/${id}/connections`);
  }

  static async getTeamQueries(id: string): Promise<TeamQueryEntity[]> {
    return apiService.get<TeamQueryEntity[]>(`/organizations/${id}/queries`);
  }

  static async getTeamDashboards(id: string): Promise<TeamDashboardEntity[]> {
    return apiService.get<TeamDashboardEntity[]>(`/organizations/${id}/dashboards`);
  }

  static async getTeamActivities(id: string): Promise<TeamActivityEntity[]> {
    return apiService.get<TeamActivityEntity[]>(`/organizations/${id}/activities`);
  }

  static async exportOrganizationBackup(id: string): Promise<OrganizationBackupPackage> {
    return apiService.get<OrganizationBackupPackage>(`/organizations/${id}/backup`);
  }

  static async restoreOrganizationBackup(id: string, backup: OrganizationBackupPackage): Promise<OrganizationBackupRestoreResult> {
    return apiService.post<OrganizationBackupRestoreResult>(`/organizations/${id}/backup/restore`, { backup });
  }
}
