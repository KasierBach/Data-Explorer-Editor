import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolvePublicRoute } from '@/core/seo/publicRoutes';

beforeEach(() => { vi.resetModules(); });
afterEach(() => {
    vi.doUnmock('./DocumentationView');
    vi.restoreAllMocks();
});

describe('loadPublicView cache', () => {
    it('shares pending and fulfilled views across routes of the same kind', async () => {
        const View = () => null;
        let resolveModule!: (module: { DocumentationView: typeof View }) => void;
        vi.doMock('./DocumentationView', () => new Promise(resolve => { resolveModule = resolve; }));
        const { loadPublicView } = await import('./publicViews');

        const first = loadPublicView(resolvePublicRoute('/docs/editor')!);
        const second = loadPublicView(resolvePublicRoute('/en/docs/results')!);
        expect(second).toBe(first);
        await vi.waitFor(() => expect(resolveModule).toEqual(expect.any(Function)));
        resolveModule({ DocumentationView: View });
        await expect(first).resolves.toBe(View);
        expect(loadPublicView(resolvePublicRoute('/docs/results')!)).toBe(first);
    });

    it('evicts a rejected import so the next request can load a fresh view', async () => {
        const failure = new Error('Failed to fetch dynamically imported module: synthetic chunk');
        vi.doMock('./DocumentationView', () => Promise.reject(failure));
        const { loadPublicView } = await import('./publicViews');
        const route = resolvePublicRoute('/en/docs/results')!;
        const first = loadPublicView(route);
        const concurrent = loadPublicView(route);
        expect(concurrent).toBe(first);
        await expect(first).rejects.toThrow();

        const View = () => null;
        vi.doMock('./DocumentationView', () => ({ DocumentationView: View }));
        const retry = loadPublicView(route);
        expect(retry).not.toBe(first);
        await expect(retry).resolves.toBe(View);
        expect(loadPublicView(route)).toBe(retry);
    });
});
