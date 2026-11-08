import { describe, expect, it } from 'vitest';
import { DOCS_TOPICS } from '@/core/docs/docsCatalog';
import { publicPath, resolvePublicRoute } from '@/core/seo/publicRoutes';
import { getDocsDestination } from './docsNavigation';

const base = 'https://docs.example.test/en/docs/editor?existing=1#old';

describe('getDocsDestination', () => {
    it.each([
        ['/docs', '/docs', '/docs'],
        ['/en/docs/results?sort=desc#rows', '/en/docs/results?sort=desc#rows', '/en/docs/results'],
        ['https://docs.example.test/docs/postgres?ssl=required#connection', '/docs/postgres?ssl=required#connection', '/docs/postgres'],
        ['//docs.example.test/en/docs/editor#query', '/en/docs/editor#query', '/en/docs/editor'],
        ['./results?mode=wide#result-grid', '/en/docs/results?mode=wide#result-grid', '/en/docs/results'],
        ['/en/docs/results?q=a%20b#row%202', '/en/docs/results?q=a%20b#row%202', '/en/docs/results'],
    ])('resolves %s with a registered route and an intact relative URL', (href, destination, path) => {
        expect(getDocsDestination(href, base)).toEqual({ route: resolvePublicRoute(path), href: destination });
    });

    it('accepts every registered documentation topic in both languages', () => {
        for (const lang of ['vi', 'en'] as const) for (const topic of DOCS_TOPICS) {
            const path = publicPath(lang, `/docs/${topic.id}`);
            const result = getDocsDestination(`${path}?from=search#heading`, base);
            expect(result).toEqual({ route: resolvePublicRoute(path), href: `${path}?from=search#heading` });
            expect(result?.route.kind).toBe('docs');
            expect(result?.route.lang).toBe(lang);
        }
    });

    it('resolves query-only and fragment-only URLs against the current documentation page', () => {
        expect(getDocsDestination('?tab=sql#examples', base)?.href).toBe('/en/docs/editor?tab=sql#examples');
        expect(getDocsDestination('#examples', base)?.href).toBe('/en/docs/editor?existing=1#examples');
    });

    it.each([
        'https://external.example.test/en/docs/editor',
        '//external.example.test/docs/editor',
        'http://docs.example.test/docs/editor',
        'https://docs.example.test:8443/docs/editor',
        'javascript:alert(1)',
        'data:text/html,docs',
        'mailto:docs@example.test',
        'ftp://docs.example.test/docs/editor',
        '/',
        '/en/changelog#release',
        '/privacy',
        '/login',
        '/docs/not-a-registered-topic',
        '/en/docs/editor/nested',
    ])('refuses %s without fabricating a documentation route', href => {
        expect(getDocsDestination(href, base)).toBeNull();
    });
});
