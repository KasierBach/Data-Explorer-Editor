import { lazy, useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '@/core/services/store';
import { AuthService } from '@/core/services/AuthService';
import { PublicSite } from './PublicSite';
import { loadPublicView } from './publicViews';
import { resolvePublicRoute, type PublicRoute } from '@/core/seo/publicRoutes';
import { getDocsDestination, type DocsNavigate } from './docsNavigation';
import { PUBLIC_DOCS_NAVIGATION_EVENT } from './PublicNavigationContext';

interface RouteSiteProps {
    route: PublicRoute;
    isAuthenticated: boolean;
    onNavigateDocs?: DocsNavigate;
}

const loadSite = async (path: string) => {
    const View = await loadPublicView(resolvePublicRoute(path)!);
    return {
        default: function LoadedPublicSite(props: RouteSiteProps) {
            return <PublicSite embedded {...props} View={View} onLogout={() => AuthService.logoutAndRedirect('/login')} />;
        },
    };
};

const LandingSite = lazy(() => loadSite('/'));
const DocumentationSite = lazy(() => loadSite('/docs'));
const ChangelogSite = lazy(() => loadSite('/changelog'));
const LegalSite = lazy(() => loadSite('/legal'));

export function PublicRoutePage({ route }: { route: PublicRoute }) {
    const { isAuthenticated } = useAppStore();
    const location = useLocation();
    const navigate = useNavigate();
    const currentRoute = resolvePublicRoute(location.pathname) ?? route;
    const navigateDocs = useCallback((href: string) => {
        if (currentRoute.kind !== 'docs') return false;
        const destination = getDocsDestination(href, window.location.href);
        if (!destination) return false;
        navigate(destination.href);
        return true;
    }, [currentRoute.kind, navigate]);
    useEffect(() => {
        window.dispatchEvent(new Event(PUBLIC_DOCS_NAVIGATION_EVENT));
    }, [location.pathname, location.search, location.hash]);
    const Site = currentRoute.kind === 'landing' ? LandingSite : currentRoute.kind === 'docs' ? DocumentationSite : currentRoute.kind === 'changelog' ? ChangelogSite : LegalSite;
    return <Site route={currentRoute} isAuthenticated={isAuthenticated} onNavigateDocs={currentRoute.kind === 'docs' ? navigateDocs : undefined} />;
}
