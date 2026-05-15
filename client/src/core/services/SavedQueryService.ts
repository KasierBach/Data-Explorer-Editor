import { apiService } from './api.service';
import type { SavedQuery } from './store/slices/querySlice';

export interface SaveSavedQueryPayload {
    name: string;
    sql: string;
    database?: string;
    connectionId?: string;
    organizationId?: string;
    visibility: 'private' | 'workspace';
    folderId?: string;
    tags: string[];
    description?: string;
}

export const SavedQueryService = {
    async getSavedQueries(): Promise<SavedQuery[]> {
        return await apiService.get<SavedQuery[]>('/saved-queries');
    },

    async createSavedQuery(payload: SaveSavedQueryPayload): Promise<SavedQuery> {
        return await apiService.post<SavedQuery>('/saved-queries', payload);
    },

    async updateSavedQuery(id: string, payload: Partial<SaveSavedQueryPayload>): Promise<SavedQuery> {
        return await apiService.patch<SavedQuery>(`/saved-queries/${id}`, payload);
    },

    async deleteSavedQuery(id: string): Promise<void> {
        await apiService.delete(`/saved-queries/${id}`);
    },
};
