import { useEffect } from 'react';
import { useAppStore } from '@/core/services/store';
import { API_BASE_URL } from '@/core/config/env';
import { toast } from 'sonner';
import { apiService } from '@/core/services/api.service';

export function useNotifications() {
    const { isAuthenticated, accessToken, user } = useAppStore();

    useEffect(() => {
        if (!isAuthenticated || !accessToken) return;

        const baseUrl = API_BASE_URL;
        let cancelled = false;
        let eventSource: EventSource | null = null;
        let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

        const handleMessage = (event: MessageEvent) => {
            try {
                const payload = JSON.parse(event.data);

                switch (payload.type) {
                    case 'success':
                        toast.success(payload.message);
                        break;
                    case 'error':
                        toast.error(payload.message);
                        break;
                    case 'info':
                        toast.info(payload.message);
                        break;
                    case 'export_completed':
                        toast.success('Export Task Completed', {
                            description: payload.message,
                            action: payload.downloadUrl ? {
                                label: 'Download',
                                onClick: () => window.open(payload.downloadUrl, '_blank')
                            } : undefined
                        });
                        break;
                    default:
                        toast(payload.message || 'New notification');
                }
            } catch (e) {
                console.error('Failed to parse notification payload', e);
            }
        };

        const cleanupSource = () => {
            eventSource?.close();
            eventSource = null;
        };

        const connect = async () => {
            if (cancelled) return;

            if (reconnectTimeout) {
                clearTimeout(reconnectTimeout);
                reconnectTimeout = null;
            }

            cleanupSource();

            try {
                const response = await apiService.post<{ ticket: string }>('/notifications/stream-ticket', {});
                if (cancelled) return;

                const sseUrl = `${baseUrl}/notifications/stream?ticket=${encodeURIComponent(response.ticket)}`;
                eventSource = new EventSource(sseUrl);
                eventSource.onmessage = handleMessage;
                eventSource.onerror = (err) => {
                    console.error('SSE connection error', err);
                    cleanupSource();

                    if (!cancelled) {
                        reconnectTimeout = setTimeout(() => {
                            void connect();
                        }, 3000);
                    }
                };
            } catch (err) {
                console.error('Failed to open notifications stream', err);
                if (!cancelled) {
                    reconnectTimeout = setTimeout(() => {
                        void connect();
                    }, 5000);
                }
            }
        };

        void connect();

        return () => {
            cancelled = true;
            if (reconnectTimeout) clearTimeout(reconnectTimeout);
            cleanupSource();
        };
    }, [isAuthenticated, accessToken, user?.id]);
}
