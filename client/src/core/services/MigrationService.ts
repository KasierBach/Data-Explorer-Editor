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

const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 2000;

export const migrationService = {
    startMigration: async (payload: StartMigrationPayload): Promise<{ jobId: string }> => {
        return await apiService.post<{ jobId: string }>('/migration/start', payload);
    },

    /**
     * Subscribe to real-time migration progress via Server-Sent Events (SSE).
     * Includes retry logic with exponential backoff on transient errors.
     * Returns a cleanup function to close the connection.
     */
    subscribeToProgress: (
        jobId: string,
        onProgress: (job: MigrationJob) => void,
        onError?: (error: string) => void,
    ): (() => void) => {
        let retryCount = 0;
        let eventSource: EventSource | null = null;
        let retryTimeout: ReturnType<typeof setTimeout> | null = null;
        let terminated = false;

        const connect = () => {
            if (terminated) return;

            const token = useAppStore.getState().accessToken;
            const url = `${API_BASE_URL}/migration/progress/${jobId}?token=${token}`;

            eventSource = new EventSource(url);

            eventSource.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data) as MigrationJob;

                    // Filter out server heartbeat pings
                    if ((data as any) === '__heartbeat__') return;

                    // Reset retry count on successful message
                    retryCount = 0;

                    onProgress(data);

                    if (data.status === 'completed' || data.status === 'failed') {
                        cleanup();
                    }
                } catch (err) {
                    console.error('Failed to parse SSE data:', err);
                }
            };

            // Filter heartbeat ping events sent as named events
            eventSource.addEventListener('ping', () => {
                // Heartbeat received — connection is alive, reset retry count
                retryCount = 0;
            });

            eventSource.onerror = () => {
                // Close current broken connection
                eventSource?.close();
                eventSource = null;

                if (terminated) return;

                if (retryCount < MAX_RETRIES) {
                    const delay = BASE_RETRY_DELAY_MS * Math.pow(2, retryCount);
                    retryCount++;
                    console.warn(`SSE connection lost, retrying in ${delay}ms (attempt ${retryCount}/${MAX_RETRIES})...`);
                    retryTimeout = setTimeout(connect, delay);
                } else {
                    onError?.('Connection to migration progress lost');
                }
            };
        };

        const cleanup = () => {
            terminated = true;
            if (retryTimeout) clearTimeout(retryTimeout);
            eventSource?.close();
            eventSource = null;
        };

        connect();

        // Return cleanup function
        return cleanup;
    },
};

