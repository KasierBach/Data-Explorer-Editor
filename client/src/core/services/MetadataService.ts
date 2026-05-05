import { apiService } from './api.service';

export class MetadataService {
    static async refresh(connectionId: string, database?: string | null): Promise<void> {
        await apiService.post('/metadata/refresh', {
            connectionId,
            database: database || undefined,
        });
    }
}
