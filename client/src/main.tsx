import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import { resolvePublicRoute } from '@/core/seo/publicRoutes';
import { ErrorBoundary } from '@/presentation/components/shared/ErrorBoundary';
import { showStartupFallback } from './startupRecovery';
import './index.css';

const root = document.getElementById('root')!;
const route = resolvePublicRoute(window.location.pathname);

if (route) {
    void Promise.all([import('@/presentation/public/PublicClient'), import('@/presentation/public/publicViews')]).then(async ([{ PublicClient }, { loadPublicView }]) => {
        const View = await loadPublicView(route);
        const app = <StrictMode><ErrorBoundary lang={route.lang}><PublicClient route={route} View={View} /></ErrorBoundary></StrictMode>;
        if (root.hasAttribute('data-public-rendered')) hydrateRoot(root, app);
        else createRoot(root).render(app);
    }).catch(() => showStartupFallback(root, route.lang));
} else {
    void Promise.all([import('./App'), import('@/presentation/components/theme-provider')]).then(([{ default: App }, { ThemeProvider }]) => {
        document.querySelectorAll('[data-public-seo],title,meta[data-rh]').forEach(element => element.remove());
        createRoot(root).render(<StrictMode><HelmetProvider><ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme"><App /></ThemeProvider></HelmetProvider></StrictMode>);
    }).catch(() => showStartupFallback(root, document.documentElement.lang));
}
