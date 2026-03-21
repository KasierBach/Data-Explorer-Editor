import { useEffect, useRef } from 'react';
import { useAppStore } from '@/core/services/store';
import { API_BASE_URL } from '@/core/config/env';

/**
 * Automatically fetches the user's saved connections from the backend
 * whenever the user is authenticated and the local store has no connections.
 * This acts as a safety net to ensure connections are always loaded,
 * regardless of how the user arrived at the app (login, page refresh, etc).
 */
export function useSyncConnections() {
    const { isAuthenticated, accessToken, setConnections } = useAppStore();
    const hasFetched = useRef(false);

    useEffect(() => {
        // Reset the fetch flag when user logs out
        if (!isAuthenticated) {
            hasFetched.current = false;
            return;
        }

        // Only fetch if authenticated, have a token, and haven't fetched yet this session
        if (!accessToken || hasFetched.current) return;

        hasFetched.current = true;

        const fetchConnections = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/connections`, {
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                });
                if (res.ok) {
                    const json = await res.json();
                    const data = (json && typeof json === 'object' && 'success' in json && 'data' in json) ? json.data : json;
                    if (Array.isArray(data)) {
                        setConnections(data);
                    }
                }
            } catch (err) {
                console.warn('useSyncConnections: Failed to fetch connections', err);
            }
        };

        fetchConnections();
    }, [isAuthenticated, accessToken, setConnections]);
}
