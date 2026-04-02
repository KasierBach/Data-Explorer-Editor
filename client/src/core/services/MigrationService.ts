import { apiService } from './api.service';
import { API_BASE_URL } from '../config/env';
import { useAppStore } from './store';

export interface StartMigrationPayload {
    sourceConnectionId: string;
    sourceSchema: string;
    sourceTable: string;
    targetConnectionId: string;
    targetSchema: string;
    targetTable: string;
}

export interface MigrationJob {
    id: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    processedRows: number;
    error?: string;
}

export const migrationService = {
    startMigration: async (payload: StartMigrationPayload): Promise<{ jobId: string }> => {
        return await apiService.post<{ jobId: string }>('/migration/start', payload);
    },

    /**
     * Subscribe to real-time migration progress via Server-Sent Events (SSE).
     * Returns a cleanup function to close the connection.
     */
    subscribeToProgress: (
        jobId: string,
        onProgress: (job: MigrationJob) => void,
        onError?: (error: string) => void,
    ): (() => void) => {
        const token = useAppStore.getState().accessToken;
        const url = `${API_BASE_URL}/migration/progress/${jobId}`;

        const eventSource = new EventSource(url);

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data) as MigrationJob;
                onProgress(data);

                if (data.status === 'completed' || data.status === 'failed') {
                    eventSource.close();
                }
            } catch (err) {
                console.error('Failed to parse SSE data:', err);
            }
        };

        eventSource.onerror = () => {
            onError?.('Connection to migration progress lost');
            eventSource.close();
        };

        // Return cleanup function
        return () => eventSource.close();
    },
};
