import { apiService } from './api.service';
import { API_BASE_URL } from '../config/env';

export interface StartMigrationPayload {
    sourceConnectionId: string;
    sourceSchema: string;
    sourceTable: string;
    targetConnectionId: string;
    targetSchema: string;
    targetTable: string;
}

export interface MigrationColumnDiff {
    name: string;
    status: 'added' | 'removed' | 'changed' | 'unchanged';
    changes: string[];
}

export interface MigrationIndexDiff {
    name: string;
    status: 'added' | 'removed' | 'changed' | 'unchanged';
    changes: string[];
}

export interface MigrationReviewSummary {
    canProceed: boolean;
    blockers: string[];
    warnings: string[];
    rollbackCaveats: string[];
    estimatedImpact: {
        addedColumns: number;
        removedColumns: number;
        changedColumns: number;
        addedIndices: number;
        removedIndices: number;
        changedIndices: number;
    };
    source: {
        connectionId: string;
        connectionName: string;
        schema: string;
        table: string;
        rowCount: number | null;
        columnCount: number;
        indexCount: number;
    };
    target: {
        connectionId: string;
        connectionName: string;
        schema: string;
        table: string;
        rowCount: number | null;
        columnCount: number;
        indexCount: number;
    };
    columnDiffs: MigrationColumnDiff[];
    indexDiffs: MigrationIndexDiff[];
}

export interface MigrationJob {
    id: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    stage?: 'queued' | 'validating' | 'connecting' | 'preflight' | 'streaming' | 'completed' | 'failed';
    processedRows: number;
    batchesProcessed?: number;
    error?: string;
}

const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 2000;

export const migrationService = {
    startMigration: async (payload: StartMigrationPayload): Promise<{ jobId: string }> => {
        return await apiService.post<{ jobId: string }>('/migration/start', payload);
    },

    previewMigration: async (payload: StartMigrationPayload): Promise<MigrationReviewSummary> => {
        return await apiService.post<MigrationReviewSummary>('/migration/preview', payload);
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

        const connect = async () => {
            if (terminated) return;

            let ticket: string;
            try {
                const response = await apiService.post<{ ticket: string }>(`/migration/progress-ticket/${jobId}`, {});
                ticket = response.ticket;
            } catch {
                onError?.('Unable to authorize migration progress stream');
                return;
            }

            const url = `${API_BASE_URL}/migration/progress/${jobId}?ticket=${encodeURIComponent(ticket)}`;

            eventSource = new EventSource(url);

            eventSource.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data) as unknown;

                    // Filter out server heartbeat pings
                    if (data === '__heartbeat__') return;

                    // Reset retry count on successful message
                    retryCount = 0;

                    onProgress(data as MigrationJob);

                    if ((data as MigrationJob).status === 'completed' || (data as MigrationJob).status === 'failed') {
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
