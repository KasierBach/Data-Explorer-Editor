import { describe, expect, it } from 'vitest';
import { listPublicRoutes, publicPath, publicStructuredData, resolvePublicRoute, serializePublicData } from './publicRoutes';
import { publicSeoTags } from './publicMetadata';

// Public routes use URL locale; stored UI preferences must not affect crawl output.
describe('public SEO routes', () => {
    it('resolves stable Vietnamese and English routes and rejects unknown docs', () => {
        expect(resolvePublicRoute('/')?.lang).toBe('vi');
        expect(resolvePublicRoute('/en')?.lang).toBe('en');
        expect(resolvePublicRoute('/en/docs/editor')?.sectionId).toBe('editor');
        expect(resolvePublicRoute('/docs/not-a-section')).toBeNull();
        expect(resolvePublicRoute('/sql-explorer')).toBeNull();
        expect(publicPath('en', '/docs/results')).toBe('/en/docs/results');
    });

    it('lists only unique canonical public pages with reciprocal locales', () => {
        const routes = listPublicRoutes();
        expect(new Set(routes.map(route => route.path)).size).toBe(routes.length);
        expect(routes.length).toBeGreaterThan(12);
        for (const route of routes) {
            expect(route.canonical).toBe(`https://data-explorer-editor.vercel.app${route.path === '/' ? '' : route.path}`);
            expect(resolvePublicRoute(publicPath(route.lang === 'vi' ? 'en' : 'vi', route.basePath))).not.toBeNull();
            expect(route.path).not.toMatch(/sql-explorer|admin|billing\/return/);
        }
    });

    it('emits route-appropriate schema without inventing reviews or Pro benefits', () => {
        const landing = publicStructuredData(resolvePublicRoute('/')!);
        expect(landing['@graph'].some(node => node['@type'] === 'WebApplication')).toBe(true);
        const privacy = publicStructuredData(resolvePublicRoute('/privacy')!);
        expect(privacy['@graph'].some(node => node['@type'] === 'WebApplication')).toBe(false);
        expect(JSON.stringify(landing)).not.toMatch(/aggregateRating|review|Feature matrix/);
    });

    it('produces consistent title, locale alternates and image dimensions', () => {
        const tags = publicSeoTags(resolvePublicRoute('/en/docs/editor')!);
        expect(tags.title).toBe('Monaco Editor | Data Explorer');
        expect(tags.links.find(link => link.rel === 'canonical')?.href).toBe('https://data-explorer-editor.vercel.app/en/docs/editor');
        expect(tags.links.filter(link => link.rel === 'alternate')).toHaveLength(3);
        expect(tags.meta.find(meta => meta.property === 'og:image:width')?.content).toBe('1200');
        expect(tags.meta.find(meta => meta.property === 'og:image:height')?.content).toBe('630');
    });

    it('serializes embedded JSON safely', () => {
        const encoded = serializePublicData({ text: '</script><img src=x>&\u2028\u2029' });
        expect(encoded).not.toContain('<');
        expect(encoded).not.toContain('&');
        expect(JSON.parse(encoded).text).toBe('</script><img src=x>&\u2028\u2029');
    });
});
