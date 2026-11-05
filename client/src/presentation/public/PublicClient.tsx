import { useEffect, useState } from 'react';
import { PublicSite } from './PublicSite';
import type { PublicRoute } from '@/core/seo/publicRoutes';
import type { PublicView } from './publicViews';

export function PublicClient({ route, View }: { route: PublicRoute; View: PublicView }) {
    const [authenticated, setAuthenticated] = useState(false);
    useEffect(() => {
        document.getElementById('root')?.setAttribute('data-public-hydrated', 'true');
        let active = true;
        let unsubscribe: (() => void) | undefined;
        void Promise.all([import('@/core/services/store'), import('@/core/services/AuthService')]).then(async ([{ useAppStore }, { AuthService }]) => {
            if (!active) return;
            unsubscribe = useAppStore.subscribe(state => { if (active) setAuthenticated(state.isAuthenticated); });
            try {
                const data = await AuthService.refreshSession();
                if (active && data.access_token && data.user) useAppStore.getState().restoreSession(data.access_token, data.user, data.accessTokenExpiresAt ?? null);
            } catch {
                // Public pages stay readable without an active session.
            } finally {
                if (active) useAppStore.getState().setAuthBootstrapped(true);
            }
        });
        return () => { active = false; unsubscribe?.(); };
    }, []);
    const logout = async () => {
        const { AuthService } = await import('@/core/services/AuthService');
        await AuthService.logoutAndRedirect('/login');
    };
    return <PublicSite route={route} View={View} isAuthenticated={authenticated} onLogout={logout} />;
}
