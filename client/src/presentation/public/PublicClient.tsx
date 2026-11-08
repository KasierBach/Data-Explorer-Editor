import { useCallback, useEffect, useRef, useState } from 'react';
import { PublicSite } from './PublicSite';
import { getDocsDestination } from './docsNavigation';
import { PUBLIC_DOCS_NAVIGATION_EVENT } from './PublicNavigationContext';
import type { PublicRoute } from '@/core/seo/publicRoutes';
import type { PublicView } from './publicViews';

export function PublicClient({ route, View }: { route: PublicRoute; View: PublicView }) {
    const [authenticated, setAuthenticated] = useState(false);
    const [currentRoute, setCurrentRoute] = useState(route);
    const routeRef = useRef(route);
    const navigateDocs = useCallback((href: string) => {
        if (routeRef.current.kind !== 'docs') return false;
        const destination = getDocsDestination(href, window.location.href);
        if (!destination) return false;
        const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        if (destination.href !== currentHref) window.history.pushState(window.history.state, '', destination.href);
        routeRef.current = destination.route;
        setCurrentRoute(destination.route);
        window.dispatchEvent(new Event(PUBLIC_DOCS_NAVIGATION_EVENT));
        return true;
    }, []);
    useEffect(() => {
        document.getElementById('root')?.setAttribute('data-public-path', currentRoute.path);
    }, [currentRoute.path]);
    useEffect(() => {
        if (route.kind !== 'docs') return;
        const onPopState = () => {
            const destination = getDocsDestination(window.location.href, window.location.href);
            if (!destination) {
                window.location.reload();
                return;
            }
            routeRef.current = destination.route;
            setCurrentRoute(destination.route);
            window.dispatchEvent(new Event(PUBLIC_DOCS_NAVIGATION_EVENT));
        };
        window.addEventListener('popstate', onPopState);
        return () => window.removeEventListener('popstate', onPopState);
    }, [route.kind]);
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
    return <PublicSite route={currentRoute} View={View} isAuthenticated={authenticated} onLogout={logout} onNavigateDocs={currentRoute.kind === 'docs' ? navigateDocs : undefined} />;
}
