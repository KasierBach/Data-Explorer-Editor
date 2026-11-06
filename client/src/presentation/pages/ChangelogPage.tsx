import { useLocation } from 'react-router-dom';
import { resolvePublicRoute } from '@/core/seo/publicRoutes';
import { PublicRoutePage } from '@/presentation/public/PublicRoutePage';

export function ChangelogPage() {
    const { pathname } = useLocation();
    const current = resolvePublicRoute(pathname);
    return <PublicRoutePage route={current?.kind === 'changelog' ? current : resolvePublicRoute('/changelog')!} />;
}
