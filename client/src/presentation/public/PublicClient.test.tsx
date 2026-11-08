import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolvePublicRoute, type PublicRoute } from '@/core/seo/publicRoutes';
import type { DocsNavigate } from './docsNavigation';
import type { PublicView, PublicViewProps } from './publicViews';
import { PUBLIC_DOCS_NAVIGATION_EVENT } from './PublicNavigationContext';
import { PublicClient } from './PublicClient';

interface SiteProps {
    route: PublicRoute;
    View: PublicView;
    isAuthenticated?: boolean;
    onNavigateDocs?: DocsNavigate;
    onLogout?: () => void | Promise<void>;
}

const mocks = vi.hoisted(() => ({
    site: vi.fn(),
    refreshSession: vi.fn(),
    logoutAndRedirect: vi.fn(),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    restoreSession: vi.fn(),
    setAuthBootstrapped: vi.fn(),
    listeners: new Set<(state: { isAuthenticated: boolean }) => void>(),
}));

vi.mock('./PublicSite', () => ({
    PublicSite: (props: SiteProps) => {
        mocks.site(props);
        return <props.View route={props.route} isAuthenticated={props.isAuthenticated} />;
    },
}));
vi.mock('@/core/services/AuthService', () => ({ AuthService: { refreshSession: mocks.refreshSession, logoutAndRedirect: mocks.logoutAndRedirect } }));
vi.mock('@/core/services/store', () => ({
    useAppStore: {
        subscribe: (listener: (state: { isAuthenticated: boolean }) => void) => {
            mocks.subscribe(listener);
            mocks.listeners.add(listener);
            return () => { mocks.listeners.delete(listener); mocks.unsubscribe(); };
        },
        getState: () => ({ restoreSession: mocks.restoreSession, setAuthBootstrapped: mocks.setAuthBootstrapped }),
    },
}));

function StatefulView({ route, isAuthenticated }: PublicViewProps) {
    const [query, setQuery] = useState('');
    return <main><h1>{route.title}</h1><input aria-label="Preserved search" value={query} onChange={event => setQuery(event.target.value)} /><output data-testid="auth-state">{String(isAuthenticated)}</output></main>;
}

function latestProps(): SiteProps {
    return mocks.site.mock.calls.at(-1)![0] as SiteProps;
}

function renderClient(path = '/en/docs/editor') {
    window.history.replaceState(null, '', path);
    const root = document.createElement('div');
    root.id = 'root';
    root.dataset.publicClientTest = 'true';
    document.body.append(root);
    return { ...render(<PublicClient route={resolvePublicRoute(path.split(/[?#]/)[0])!} View={StatefulView} />, { container: root }), root };
}

const originalUrl = window.location.href;
const originalState = window.history.state;

beforeEach(() => {
    vi.clearAllMocks();
    mocks.listeners.clear();
    mocks.refreshSession.mockResolvedValue({});
});
afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.querySelector('[data-public-client-test]')?.remove();
    window.history.replaceState(originalState, '', originalUrl);
});

describe('PublicClient documentation navigation', () => {
    it('pushes a docs destination, updates metadata and root path, and preserves the view and its state', () => {
        const { root } = renderClient('/en/docs/editor?scope=sql#query');
        const input = screen.getByRole('textbox', { name: 'Preserved search' });
        fireEvent.change(input, { target: { value: 'postgres' } });
        const navigateDocs = latestProps().onNavigateDocs!;
        expect(navigateDocs).toEqual(expect.any(Function));
        const push = vi.spyOn(window.history, 'pushState');
        const dispatch = vi.spyOn(window, 'dispatchEvent');
        let accepted = false;
        act(() => { accepted = navigateDocs('/en/docs/results?mode=wide#rows'); });
        expect(accepted).toBe(true);
        expect(push).toHaveBeenCalledTimes(1);
        expect(window.location.pathname + window.location.search + window.location.hash).toBe('/en/docs/results?mode=wide#rows');
        expect(dispatch.mock.calls.some(([event]) => event.type === PUBLIC_DOCS_NAVIGATION_EVENT)).toBe(true);
        expect(latestProps().route).toEqual(resolvePublicRoute('/en/docs/results'));
        expect(root).toHaveAttribute('data-public-path', '/en/docs/results');
        expect(root).toHaveAttribute('data-public-hydrated', 'true');
        expect(latestProps().View).toBe(StatefulView);
        expect(latestProps().onNavigateDocs).toBe(navigateDocs);
        expect(screen.getByRole('textbox', { name: 'Preserved search' })).toBe(input);
        expect(input).toHaveValue('postgres');
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(resolvePublicRoute('/en/docs/results')!.title);
    });

    it('accepts the exact current docs URL without adding a history entry', () => {
        renderClient('/en/docs/editor?mode=wide#query');
        const push = vi.spyOn(window.history, 'pushState');
        let accepted = false;
        act(() => { accepted = latestProps().onNavigateDocs!('/en/docs/editor?mode=wide#query'); });
        expect(accepted).toBe(true);
        expect(push).not.toHaveBeenCalled();
        expect(latestProps().route.path).toBe('/en/docs/editor');
    });

    it('rejects external, unknown and non-docs destinations without changing history', () => {
        const { root } = renderClient();
        const navigateDocs = latestProps().onNavigateDocs!;
        const push = vi.spyOn(window.history, 'pushState');
        const url = window.location.href;
        for (const href of ['https://external.example.test/docs/editor', '/docs/unknown-topic', '/en/changelog', '/login', 'mailto:help@example.test']) {
            let accepted = true;
            act(() => { accepted = navigateDocs(href); });
            expect(accepted).toBe(false);
        }
        expect(push).not.toHaveBeenCalled();
        expect(window.location.href).toBe(url);
        expect(root).toHaveAttribute('data-public-path', '/en/docs/editor');
    });

    it('updates the current route on docs popstate and keeps the callback usable across successive topics', () => {
        const { root } = renderClient();
        const navigateDocs = latestProps().onNavigateDocs!;
        act(() => { navigateDocs('/en/docs/results#rows'); });
        act(() => {
            window.history.replaceState(null, '', '/docs/postgres?ssl=required#connection');
            window.dispatchEvent(new PopStateEvent('popstate'));
        });
        expect(latestProps().route).toEqual(resolvePublicRoute('/docs/postgres'));
        expect(root).toHaveAttribute('data-public-path', '/docs/postgres');
        expect(latestProps().onNavigateDocs).toBe(navigateDocs);
        act(() => { expect(navigateDocs('/en/docs/first-query#examples')).toBe(true); });
        expect(latestProps().route).toEqual(resolvePublicRoute('/en/docs/first-query'));
        expect(root).toHaveAttribute('data-public-path', '/en/docs/first-query');
    });

    it.each(['/en/changelog', '/not-a-public-route'])('requests the reload fallback for popstate to %s using a location stub', path => {
        const browserWindow = window;
        // jsdom exposes non-configurable Location methods through an internal delegate.
        const implementationKey = Object.getOwnPropertySymbols(window.location).find(key => key.description === 'impl');
        if (!implementationKey) throw new Error('Expected jsdom Location implementation');
        const implementation = Reflect.get(window.location, implementationKey) as { reload: () => void };
        const reload = vi.spyOn(implementation, 'reload').mockImplementation(() => {});
        renderClient();
        act(() => {
            browserWindow.history.replaceState(null, '', path);
            browserWindow.dispatchEvent(new PopStateEvent('popstate'));
        });
        expect(reload).toHaveBeenCalledTimes(1);
        expect(latestProps().route.path).toBe('/en/docs/editor');
    });

    it('does not take over docs links from an initial non-docs page', () => {
        renderClient('/en/changelog');
        const push = vi.spyOn(window.history, 'pushState');
        let accepted = true;
        act(() => { accepted = latestProps().onNavigateDocs?.('/en/docs/editor') ?? false; });
        expect(accepted).toBe(false);
        expect(push).not.toHaveBeenCalled();
        expect(latestProps().route.path).toBe('/en/changelog');
    });

    it('preserves anonymous auth bootstrap, auth updates and subscription cleanup', async () => {
        mocks.refreshSession.mockRejectedValueOnce(new Error('No public session'));
        const { unmount } = renderClient();
        await waitFor(() => expect(mocks.setAuthBootstrapped).toHaveBeenCalledWith(true));
        expect(mocks.refreshSession).toHaveBeenCalledTimes(1);
        expect(mocks.restoreSession).not.toHaveBeenCalled();
        expect(screen.getByTestId('auth-state')).toHaveTextContent('false');
        act(() => { for (const listener of mocks.listeners) listener({ isAuthenticated: true }); });
        expect(screen.getByTestId('auth-state')).toHaveTextContent('true');
        unmount();
        expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);
        expect(mocks.listeners.size).toBe(0);
    });
});
