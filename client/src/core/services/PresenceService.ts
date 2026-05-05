import { apiService } from './api.service';
import type { CollaborationResourceType } from './CollaborationService';

export interface PresenceParticipant {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    username: string | null;
    avatarUrl: string | null;
}

export interface PresenceEntry extends PresenceParticipant {
    displayName: string;
    lastSeen: number;
}

export const PresenceService = {
    async heartbeatTeamspace(organizationId: string, teamspaceId: string): Promise<PresenceEntry[]> {
        return apiService.post<PresenceEntry[]>(
            `/presence/organizations/${organizationId}/teamspaces/${teamspaceId}/heartbeat`,
            {},
        );
    },

    async leaveTeamspace(organizationId: string, teamspaceId: string): Promise<{ success: true }> {
        return apiService.delete<{ success: true }>(
            `/presence/organizations/${organizationId}/teamspaces/${teamspaceId}`,
        );
    },

    async heartbeatResource(
        organizationId: string,
        resourceType: CollaborationResourceType,
        resourceId: string,
    ): Promise<PresenceEntry[]> {
        return apiService.post<PresenceEntry[]>(
            `/presence/organizations/${organizationId}/resources/${resourceType}/${resourceId}/heartbeat`,
            {},
        );
    },

    async leaveResource(
        organizationId: string,
        resourceType: CollaborationResourceType,
        resourceId: string,
    ): Promise<{ success: true }> {
        return apiService.delete<{ success: true }>(
            `/presence/organizations/${organizationId}/resources/${resourceType}/${resourceId}`,
        );
    },
};
