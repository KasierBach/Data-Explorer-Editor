import { useEffect } from 'react';
import { useAppStore } from '@/core/services/store';
import { toast } from 'sonner';

export function useNotifications() {
    const { isAuthenticated, accessToken, user } = useAppStore();

    useEffect(() => {
        if (!isAuthenticated || !accessToken) return;

        const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
        const sseUrl = `${baseUrl}/notifications/stream?token=${accessToken}`;
        
        const eventSource = new EventSource(sseUrl);

        eventSource.onmessage = (event) => {
            try {
                const payload = JSON.parse(event.data);
                
                // Handle different types of notifications
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

        eventSource.onerror = (err) => {
            console.error('SSE connection error', err);
            // eventSource.close(); // Browser will auto-reconnect usually
        };

        return () => {
            eventSource.close();
        };
    }, [isAuthenticated, accessToken, user?.id]);
}
