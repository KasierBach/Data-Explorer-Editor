import { createContext, useContext, useSyncExternalStore } from 'react';
import { publicPath, resolvePublicRoute, type PublicLanguage, type PublicRoute } from '@/core/seo/publicRoutes';

export const PublicNavigationContext = createContext<PublicRoute | null>(null);

function subscribeHash(onChange: () => void) {
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
}

export function usePublicNavigation() {
    const route = useContext(PublicNavigationContext);
    const hash = useSyncExternalStore(subscribeHash, () => window.location.hash, () => '');
    return {
        route,
        path: (path: string) => {
            const suffixStart = path.search(/[?#]/);
            const pathname = suffixStart < 0 ? path : path.slice(0, suffixStart);
            const suffix = suffixStart < 0 ? '' : path.slice(suffixStart);
            const target = resolvePublicRoute(pathname);
            return route && target ? `${publicPath(route.lang, target.basePath)}${suffix}` : path;
        },
        languageUrls: route ? { vi: `${publicPath('vi', route.basePath)}${hash}`, en: `${publicPath('en', route.basePath)}${hash}` } satisfies Record<PublicLanguage, string> : undefined,
    };
}
