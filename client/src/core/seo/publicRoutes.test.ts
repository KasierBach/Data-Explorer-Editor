import { describe, expect, it } from 'vitest';
import { listPublicRoutes, publicPath, publicStructuredData, resolvePublicRoute, serializePublicData } from './publicRoutes';
import { publicSeoTags } from './publicMetadata';
import { DOCS_TOPICS, getDocTopic } from '@/core/docs/docsCatalog';

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

    it('uses catalog copy and actual review dates on docs only', () => {
        const routes = listPublicRoutes();
        expect(routes).toHaveLength((43 + 6) * 2);
        expect(routes.filter(route => route.kind === 'docs')).toHaveLength((43 + 1) * 2);
        for (const topic of DOCS_TOPICS) for (const lang of ['vi', 'en'] as const) {
            const route = resolvePublicRoute(publicPath(lang, `/docs/${topic.id}`))!;
            expect(route.description).toBe(lang === 'vi' ? topic.description : topic.descriptionEn);
            expect(route.dateModified).toBe(topic.updatedAt);
            expect(route.sectionId).toBe(topic.id);
        }
        for (const route of routes.filter(route => route.kind !== 'docs')) expect(route).not.toHaveProperty('dateModified');
        expect(resolvePublicRoute('/docs')?.dateModified).toBe(getDocTopic('introduction')?.updatedAt);
    });

    it('preserves slash normalization, locale and unknown-route boundaries', () => {
        expect(resolvePublicRoute('/en/docs/editor///')?.path).toBe('/en/docs/editor');
        expect(resolvePublicRoute('/en/docs/editor///')?.canonical).toBe('https://data-explorer-editor.vercel.app/en/docs/editor');
        expect(resolvePublicRoute('/docs/')?.sectionId).toBe('introduction');
        expect(resolvePublicRoute('/en/')?.canonical).toBe('https://data-explorer-editor.vercel.app/en');
        for (const path of ['/docs/editor/subpage', '/en/docs/unknown', '/en/sql-explorer', '/nosql-explorer', '/billing/return', '/admin', '/enigma']) expect(resolvePublicRoute(path)).toBeNull();
    });

    it('emits factual article/breadcrumb schema for docs, not authors or HowTo', () => {
        for (const lang of ['vi', 'en'] as const) {
            const route = resolvePublicRoute(publicPath(lang, '/docs/first-query'))!;
            const data = publicStructuredData(route);
            const article = data['@graph'].find(node => node['@type'] === 'TechArticle')!;
            expect(article.dateModified).toBe('2026-11-07');
            expect(article.headline).toBe(route.title);
            expect(article.url).toBe(route.canonical);
            expect(article.inLanguage).toBe(lang);
            const breadcrumb = data['@graph'].find(node => node['@type'] === 'BreadcrumbList')!;
            const crumbs = breadcrumb.itemListElement as Array<{ position: number; item: string; name: string }>;
            expect(crumbs.map(crumb => crumb.position)).toEqual([1, 2, 3]);
            expect(crumbs[2].item).toBe(route.canonical);
            expect(crumbs[2].name).toBe(lang === 'vi' ? getDocTopic('first-query')!.title : getDocTopic('first-query')!.titleEn);
            expect(JSON.stringify(data)).not.toMatch(/HowTo|author|datePublished|review|aggregateRating|award/);
        }
        for (const path of ['/', '/privacy', '/terms', '/legal', '/changelog']) {
            const data = publicStructuredData(resolvePublicRoute(path)!);
            expect(data['@graph'].some(node => node['@type'] === 'TechArticle')).toBe(false);
            expect(JSON.stringify(data)).not.toContain('dateModified');
        }
    });

    it('serializes embedded JSON safely', () => {
        const encoded = serializePublicData({ text: '</script><img src=x>&\u2028\u2029' });
        expect(encoded).not.toContain('<');
        expect(encoded).not.toContain('&');
        expect(JSON.parse(encoded).text).toBe('</script><img src=x>&\u2028\u2029');
    });
});
