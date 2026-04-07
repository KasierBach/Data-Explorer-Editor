import { apiService } from './api.service';
import type { ErdWorkspaceEntity } from '@/core/domain/entities';

export interface SaveErdWorkspacePayload {
    name: string;
    notes?: string;
    connectionId?: string;
    database?: string;
    layout: Record<string, any>;
}

export class ErdWorkspaceService {
    static async getWorkspaces(connectionId?: string): Promise<ErdWorkspaceEntity[]> {
        const query = connectionId ? `?connectionId=${encodeURIComponent(connectionId)}` : '';
        return apiService.get<ErdWorkspaceEntity[]>(`/erd-workspaces${query}`);
    }

    static async createWorkspace(payload: SaveErdWorkspacePayload): Promise<ErdWorkspaceEntity> {
        return apiService.post<ErdWorkspaceEntity>('/erd-workspaces', payload);
    }

    static async updateWorkspace(id: string, payload: Partial<SaveErdWorkspacePayload>): Promise<ErdWorkspaceEntity> {
        return apiService.patch<ErdWorkspaceEntity>(`/erd-workspaces/${id}`, payload);
    }

    static async deleteWorkspace(id: string): Promise<{ success: true }> {
        return apiService.delete<{ success: true }>(`/erd-workspaces/${id}`);
    }
}
