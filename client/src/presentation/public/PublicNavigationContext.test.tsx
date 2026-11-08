import { act, cleanup, renderHook } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolvePublicRoute } from '@/core/seo/publicRoutes';
import { PUBLIC_DOCS_NAVIGATION_EVENT, PublicDocsNavigationContext, PublicNavigationContext, usePublicNavigation } from './PublicNavigationContext';

const originalUrl = window.location.href;
const originalState = window.history.state;

afterEach(() => {
    cleanup();
    window.history.replaceState(originalState, '', originalUrl);
    vi.restoreAllMocks();
});

describe('PublicNavigationContext', () => {
    it('keeps the route context optional and does not invent a navigation callback', () => {
        const { result } = renderHook(() => usePublicNavigation());
        expect(result.current.route).toBeNull();
        expect(result.current.navigateDocs).toBeUndefined();
        expect(result.current.languageUrls).toBeUndefined();
        expect(result.current.path('/docs/editor?q=sql#query')).toBe('/docs/editor?q=sql#query');
    });

    it('adds the optional callback without changing route metadata or localized suffixes', () => {
        const route = resolvePublicRoute('/en/docs/editor')!;
        const navigateDocs = vi.fn(() => true);
        window.history.replaceState(null, '', '/en/docs/editor?scope=sql#query');
        const { result } = renderHook(() => usePublicNavigation(), {
            wrapper: ({ children }) => <PublicNavigationContext.Provider value={route}><PublicDocsNavigationContext.Provider value={navigateDocs}>{children}</PublicDocsNavigationContext.Provider></PublicNavigationContext.Provider>,
        });
        expect(result.current.route).toBe(route);
        expect(result.current.route).toMatchObject({ lang: 'en', sectionId: 'editor', title: route.title, canonical: route.canonical, description: route.description });
        expect(result.current.navigateDocs).toBe(navigateDocs);
        expect(result.current.path('/docs/results?sort=desc#rows')).toBe('/en/docs/results?sort=desc#rows');
        expect(result.current.path('/en/docs/results#rows')).toBe('/en/docs/results#rows');
        expect(result.current.path('/sql-explorer')).toBe('/sql-explorer');
        expect(result.current.path('https://external.example.test/docs/editor')).toBe('https://external.example.test/docs/editor');
        expect(result.current.languageUrls).toEqual({ vi: '/docs/editor?scope=sql#query', en: '/en/docs/editor?scope=sql#query' });
        expect(result.current.navigateDocs?.('/en/docs/results#rows')).toBe(true);
        expect(navigateDocs).toHaveBeenCalledWith('/en/docs/results#rows');
    });

    it.each(['hashchange', 'popstate', PUBLIC_DOCS_NAVIGATION_EVENT])('updates language URLs when %s announces a changed hash', eventName => {
        const route = resolvePublicRoute('/en/docs/editor')!;
        window.history.replaceState(null, '', '/en/docs/editor#before');
        const { result } = renderHook(() => usePublicNavigation(), {
            wrapper: ({ children }) => <PublicNavigationContext.Provider value={route}>{children}</PublicNavigationContext.Provider>,
        });
        expect(result.current.languageUrls?.vi).toBe('/docs/editor#before');
        act(() => {
            window.history.replaceState(null, '', '/en/docs/editor?retained=1#after');
            window.dispatchEvent(new Event(eventName));
        });
        expect(result.current.languageUrls).toEqual({ vi: '/docs/editor?retained=1#after', en: '/en/docs/editor?retained=1#after' });
        expect(result.current.route).toBe(route);
    });

    it('removes all hash subscriptions on unmount', () => {
        const add = vi.spyOn(window, 'addEventListener');
        const remove = vi.spyOn(window, 'removeEventListener');
        const { unmount } = renderHook(() => usePublicNavigation());
        unmount();
        for (const eventName of ['hashchange', 'popstate', PUBLIC_DOCS_NAVIGATION_EVENT]) {
            const subscription = add.mock.calls.find(([name]) => name === eventName);
            expect(subscription).toBeDefined();
            expect(remove).toHaveBeenCalledWith(eventName, subscription![1]);
        }
    });

    it('uses an empty server hash snapshot while retaining localized routes', () => {
        window.history.replaceState(null, '', '/en/docs/editor#client-only');
        function Probe() {
            const navigation = usePublicNavigation();
            return <span data-vi={navigation.languageUrls?.vi} data-en={navigation.languageUrls?.en}>{navigation.path('/docs/results?tab=all#rows')}</span>;
        }
        const html = renderToStaticMarkup(<PublicNavigationContext.Provider value={resolvePublicRoute('/en/docs/editor')}><Probe /></PublicNavigationContext.Provider>);
        expect(html).toContain('data-vi="/docs/editor"');
        expect(html).toContain('data-en="/en/docs/editor"');
        expect(html).toContain('/en/docs/results?tab=all#rows');
        expect(html).not.toContain('client-only');
    });
});
