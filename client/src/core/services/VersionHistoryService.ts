import { apiService } from './api.service';
import type {
    ErdWorkspaceEntity,
    RestoreVersionResponse,
    VersionHistoryDetail,
    VersionHistoryEntry,
    VersionedResourceType,
} from '@/core/domain/entities';
import type { SavedQuery } from './store/slices/querySlice';

export class VersionHistoryService {
    static async listVersions(resourceType: VersionedResourceType, resourceId: string): Promise<VersionHistoryEntry[]> {
        return apiService.get<VersionHistoryEntry[]>(`/version-history/${resourceType}/${resourceId}`);
    }

    static async getVersion<TSnapshot = Record<string, unknown>>(
        resourceType: VersionedResourceType,
        resourceId: string,
        versionId: string,
    ): Promise<VersionHistoryDetail<TSnapshot>> {
        return apiService.get<VersionHistoryDetail<TSnapshot>>(`/version-history/${resourceType}/${resourceId}/${versionId}`);
    }

    static async restoreSavedQueryVersion(
        resourceId: string,
        versionId: string,
    ): Promise<RestoreVersionResponse<SavedQuery>> {
        return apiService.post<RestoreVersionResponse<SavedQuery>>(`/version-history/QUERY/${resourceId}/${versionId}/restore`, {});
    }

    static async restoreErdWorkspaceVersion(
        resourceId: string,
        versionId: string,
    ): Promise<RestoreVersionResponse<ErdWorkspaceEntity>> {
        return apiService.post<RestoreVersionResponse<ErdWorkspaceEntity>>(`/version-history/ERD/${resourceId}/${versionId}/restore`, {});
    }
}
