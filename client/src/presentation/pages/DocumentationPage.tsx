import { useLocation } from 'react-router-dom';
import { resolvePublicRoute } from '@/core/seo/publicRoutes';
import { PublicRoutePage } from '@/presentation/public/PublicRoutePage';

export function DocumentationPage() {
    const { pathname } = useLocation();
    const route = resolvePublicRoute(pathname) ?? resolvePublicRoute('/docs')!;
    return <PublicRoutePage route={route} />;
}
