import { resolvePublicRoute, type PublicRoute } from '@/core/seo/publicRoutes';

export type DocsNavigate = (href: string) => boolean;

export function getDocsDestination(href: string, base: string): { route: PublicRoute; href: string } | null {
    try {
        const source = new URL(base);
        const target = new URL(href, source);
        if (!['http:', 'https:'].includes(target.protocol) || target.origin !== source.origin || target.username || target.password) return null;
        const route = resolvePublicRoute(target.pathname);
        if (route?.kind !== 'docs') return null;
        return { route, href: `${route.path}${target.search}${target.hash}` };
    } catch {
        return null;
    }
}
