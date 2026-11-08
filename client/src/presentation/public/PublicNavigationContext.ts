import { createContext, useContext, useSyncExternalStore } from 'react';
import { publicPath, resolvePublicRoute, type PublicLanguage, type PublicRoute } from '@/core/seo/publicRoutes';
import type { DocsNavigate } from './docsNavigation';

export const PublicNavigationContext = createContext<PublicRoute | null>(null);
export const PublicDocsNavigationContext = createContext<DocsNavigate | undefined>(undefined);
export const PUBLIC_DOCS_NAVIGATION_EVENT = 'public-docs-navigation';

function subscribeHash(onChange: () => void) {
    window.addEventListener('hashchange', onChange);
    window.addEventListener('popstate', onChange);
    window.addEventListener(PUBLIC_DOCS_NAVIGATION_EVENT, onChange);
    return () => {
        window.removeEventListener('hashchange', onChange);
        window.removeEventListener('popstate', onChange);
        window.removeEventListener(PUBLIC_DOCS_NAVIGATION_EVENT, onChange);
    };
}

export function usePublicNavigation() {
    const route = useContext(PublicNavigationContext);
    const navigateDocs = useContext(PublicDocsNavigationContext);
    const suffix = useSyncExternalStore(subscribeHash, () => `${window.location.search}${window.location.hash}`, () => '');
    const hashIndex = suffix.indexOf('#');
    const hash = hashIndex >= 0 ? suffix.slice(hashIndex) : '';
    return {
        route,
        hash,
        navigateDocs,
        path: (path: string) => {
            const suffixStart = path.search(/[?#]/);
            const pathname = suffixStart < 0 ? path : path.slice(0, suffixStart);
            const suffix = suffixStart < 0 ? '' : path.slice(suffixStart);
            const target = resolvePublicRoute(pathname);
            return route && target ? `${publicPath(route.lang, target.basePath)}${suffix}` : path;
        },
        languageUrls: route ? { vi: `${publicPath('vi', route.basePath)}${suffix}`, en: `${publicPath('en', route.basePath)}${suffix}` } satisfies Record<PublicLanguage, string> : undefined,
    };
}
