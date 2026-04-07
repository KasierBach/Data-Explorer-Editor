import { useEffect, useRef } from 'react';
import { useAppStore } from '@/core/services/store';
import { SavedQueryService } from '@/core/services/SavedQueryService';

export function useSyncSavedQueries() {
    const { isAuthenticated, accessToken, setSavedQueries } = useAppStore();
    const hasFetched = useRef(false);

    useEffect(() => {
        if (!isAuthenticated || !accessToken) {
            hasFetched.current = false;
            return;
        }

        if (hasFetched.current) return;

        hasFetched.current = true;

        const fetchSavedQueries = async () => {
            try {
                const data = await SavedQueryService.getSavedQueries();
                if (Array.isArray(data)) {
                    setSavedQueries(data);
                }
            } catch (error) {
                console.warn('useSyncSavedQueries: Failed to fetch saved queries', error);
            }
        };

        void fetchSavedQueries();
    }, [isAuthenticated, accessToken, setSavedQueries]);
}
