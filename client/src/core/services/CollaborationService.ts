import { apiService } from './api.service';

export type CollaborationResourceType = 'CONNECTION' | 'QUERY' | 'DASHBOARD' | 'ERD';

export interface CollaborationParticipant {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  avatarUrl?: string | null;
}

export interface CollaborationReply {
  commentId: string;
  threadId: string;
  parentCommentId: string | null;
  body: string;
  author: CollaborationParticipant;
  mentions: CollaborationParticipant[];
  createdAt: string;
  updatedAt: string;
}

export interface CollaborationThread {
  commentId: string;
  threadId: string;
  parentCommentId: null;
  resourceType: CollaborationResourceType;
  resourceId: string;
  organizationId: string;
  body: string;
  author: CollaborationParticipant;
  mentions: CollaborationParticipant[];
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  resolvedBy: CollaborationParticipant | null;
  replies: CollaborationReply[];
}

export interface CollaborationActivityLog {
  id: string;
  action: string;
  createdAt: string;
  userId?: string;
  organizationId?: string;
  details?: Record<string, unknown>;
  user?: CollaborationParticipant;
}

export interface CreateCommentPayload {
  body: string;
  parentCommentId?: string;
}

export class CollaborationService {
  static async getOrganizationActivity(organizationId: string, limit = 50): Promise<CollaborationActivityLog[]> {
    return apiService.get<CollaborationActivityLog[]>(
      `/collaboration/organizations/${organizationId}/activity?limit=${limit}`,
    );
  }

  static async getResourceComments(
    organizationId: string,
    resourceType: CollaborationResourceType,
    resourceId: string,
  ): Promise<CollaborationThread[]> {
    return apiService.get<CollaborationThread[]>(
      `/collaboration/organizations/${organizationId}/resources/${resourceType}/${resourceId}/comments`,
    );
  }

  static async createComment(
    organizationId: string,
    resourceType: CollaborationResourceType,
    resourceId: string,
    payload: CreateCommentPayload,
  ): Promise<CollaborationThread> {
    return apiService.post<CollaborationThread>(
      `/collaboration/organizations/${organizationId}/resources/${resourceType}/${resourceId}/comments`,
      payload,
    );
  }

  static async replyToComment(
    organizationId: string,
    commentId: string,
    payload: CreateCommentPayload,
  ): Promise<CollaborationThread> {
    return apiService.post<CollaborationThread>(
      `/collaboration/organizations/${organizationId}/comments/${commentId}/replies`,
      payload,
    );
  }

  static async resolveComment(
    organizationId: string,
    commentId: string,
  ): Promise<CollaborationThread> {
    return apiService.post<CollaborationThread>(
      `/collaboration/organizations/${organizationId}/comments/${commentId}/resolve`,
      {},
    );
  }
}
