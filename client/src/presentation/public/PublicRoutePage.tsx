import { lazy } from 'react';
import { useAppStore } from '@/core/services/store';
import { AuthService } from '@/core/services/AuthService';
import { PublicSite } from './PublicSite';
import { loadPublicView } from './publicViews';
import { resolvePublicRoute, type PublicRoute } from '@/core/seo/publicRoutes';

interface RouteSiteProps {
    route: PublicRoute;
    isAuthenticated: boolean;
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
    const Site = route.kind === 'landing' ? LandingSite : route.kind === 'docs' ? DocumentationSite : route.kind === 'changelog' ? ChangelogSite : LegalSite;
    return <Site route={route} isAuthenticated={isAuthenticated} />;
}
