import { PublicRoutePage } from '@/presentation/public/PublicRoutePage';
import { resolvePublicRoute } from '@/core/seo/publicRoutes';

export function LandingPage() {
    return <PublicRoutePage route={resolvePublicRoute(window.location.pathname) ?? resolvePublicRoute('/')!} />;
}
