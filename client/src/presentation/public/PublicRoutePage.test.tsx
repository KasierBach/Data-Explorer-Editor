import { Suspense, useState } from 'react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolvePublicRoute, type PublicRoute } from '@/core/seo/publicRoutes';
import type { DocsNavigate } from './docsNavigation';
import type { PublicView, PublicViewProps } from './publicViews';
import { PublicRoutePage } from './PublicRoutePage';

interface SiteProps {
    route: PublicRoute;
    View: PublicView;
    isAuthenticated?: boolean;
    embedded?: boolean;
    onNavigateDocs?: DocsNavigate;
}

const mocks = vi.hoisted(() => ({ site: vi.fn(), loadPublicView: vi.fn() }));
vi.mock('./PublicSite', () => ({
    PublicSite: (props: SiteProps) => {
        mocks.site(props);
        return <props.View route={props.route} isAuthenticated={props.isAuthenticated} />;
    },
}));
vi.mock('./publicViews', () => ({ loadPublicView: mocks.loadPublicView }));
vi.mock('@/core/services/store', () => ({ useAppStore: () => ({ isAuthenticated: true }) }));
vi.mock('@/core/services/AuthService', () => ({ AuthService: { logoutAndRedirect: vi.fn() } }));

function StatefulView({ route }: PublicViewProps) {
    const [query, setQuery] = useState('');
    return <main><h1>{route.title}</h1><input aria-label="Preserved route search" value={query} onChange={event => setQuery(event.target.value)} /></main>;
}

function RouterHarness({ route }: { route: PublicRoute }) {
    const location = useLocation();
    const navigate = useNavigate();
    return <><output data-testid="router-location">{location.pathname + location.search + location.hash}</output><button type="button" onClick={() => navigate(-1)}>Back in router</button><Suspense fallback={<p>Loading public view</p>}><PublicRoutePage route={route} /></Suspense></>;
}

function latestProps(): SiteProps {
    return mocks.site.mock.calls.at(-1)![0] as SiteProps;
}

async function renderPage(location: string, route = resolvePublicRoute('/docs/editor')!) {
    render(<MemoryRouter initialEntries={[location]}><RouterHarness route={route} /></MemoryRouter>);
    await screen.findByRole('heading', { level: 1 });
}

beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadPublicView.mockResolvedValue(StatefulView);
});
afterEach(() => { vi.restoreAllMocks(); });

describe('PublicRoutePage documentation adapter', () => {
    it('derives route metadata from the router location instead of a stale initial route prop', async () => {
        await renderPage('/en/docs/first-query?tab=sql#examples');
        expect(latestProps().route).toEqual(resolvePublicRoute('/en/docs/first-query'));
        expect(latestProps()).toMatchObject({ embedded: true, isAuthenticated: true, View: StatefulView });
        expect(latestProps().onNavigateDocs).toEqual(expect.any(Function));
        expect(screen.getByTestId('router-location')).toHaveTextContent('/en/docs/first-query?tab=sql#examples');
    });

    it('navigates through the router, retains query/hash and preserves the lazy view and its state on back', async () => {
        await renderPage('/en/docs/editor');
        const input = screen.getByRole('textbox', { name: 'Preserved route search' });
        fireEvent.change(input, { target: { value: 'postgres' } });
        const url = window.location.href;
        const push = vi.spyOn(window.history, 'pushState');
        let accepted = false;
        act(() => { accepted = latestProps().onNavigateDocs!('/en/docs/results?sort=desc#rows'); });
        expect(accepted).toBe(true);
        await waitFor(() => expect(latestProps().route.path).toBe('/en/docs/results'));
        expect(latestProps().route).toEqual(resolvePublicRoute('/en/docs/results'));
        expect(screen.getByTestId('router-location')).toHaveTextContent('/en/docs/results?sort=desc#rows');
        expect(push).not.toHaveBeenCalled();
        expect(window.location.href).toBe(url);
        expect(latestProps().View).toBe(StatefulView);
        expect(screen.getByRole('textbox', { name: 'Preserved route search' })).toBe(input);
        expect(input).toHaveValue('postgres');
        fireEvent.click(screen.getByRole('button', { name: 'Back in router' }));
        await waitFor(() => expect(latestProps().route.path).toBe('/en/docs/editor'));
        expect(screen.getByTestId('router-location')).toHaveTextContent('/en/docs/editor');
        expect(input).toHaveValue('postgres');
    });

    it('leaves rejected destinations to the caller without touching router or native history', async () => {
        await renderPage('/en/docs/editor');
        const navigateDocs = latestProps().onNavigateDocs!;
        const push = vi.spyOn(window.history, 'pushState');
        for (const href of ['/en/changelog', '/docs/unknown-topic', 'https://external.example.test/docs/editor', 'mailto:help@example.test']) {
            let accepted = true;
            act(() => { accepted = navigateDocs(href); });
            expect(accepted).toBe(false);
        }
        expect(screen.getByTestId('router-location')).toHaveTextContent('/en/docs/editor');
        expect(push).not.toHaveBeenCalled();
    });

    it('does not provide docs navigation for a recognized non-docs location', async () => {
        await renderPage('/en/changelog');
        expect(latestProps().route).toEqual(resolvePublicRoute('/en/changelog'));
        expect(latestProps().onNavigateDocs).toBeUndefined();
    });

    it('falls back to the supplied route when the router pathname is not registered', async () => {
        const route = resolvePublicRoute('/docs/editor')!;
        await renderPage('/not-a-public-route', route);
        expect(latestProps().route).toBe(route);
        expect(latestProps().onNavigateDocs).toEqual(expect.any(Function));
    });
});
