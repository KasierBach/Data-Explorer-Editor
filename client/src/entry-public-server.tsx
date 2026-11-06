import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { PublicClient } from '@/presentation/public/PublicClient';
import { loadPublicView } from '@/presentation/public/publicViews';
import { listPublicRoutes, type PublicRoute } from '@/core/seo/publicRoutes';
import { publicSeoTags } from '@/core/seo/publicMetadata';

export { listPublicRoutes, publicSeoTags };

export async function renderPublicPage(route: PublicRoute) {
    const View = await loadPublicView(route);
    const html = renderToString(<StrictMode><PublicClient route={route} View={View} /></StrictMode>);
    if (!html.includes('<main') || html.includes('data-static-content') || /<script\b/.test(html)) {
        throw new Error(`Public content render failed for ${route.path}`);
    }
    return { html, tags: publicSeoTags(route) };
}
