// @vitest-environment happy-dom
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    appModule: vi.fn(),
    publicModule: vi.fn(),
    publicView: vi.fn(),
    render: vi.fn(),
    createRoot: vi.fn(),
    hydrateRoot: vi.fn(),
}));

vi.mock('react-dom/client', () => ({
    createRoot: mocks.createRoot,
    hydrateRoot: mocks.hydrateRoot,
}));
vi.mock('./App', async () => {
    await mocks.appModule();
    return { default: () => null };
});
vi.mock('@/presentation/components/theme-provider', () => ({ ThemeProvider: () => null }));
vi.mock('@/presentation/public/PublicClient', async () => {
    await mocks.publicModule();
    return { PublicClient: () => null };
});
vi.mock('@/presentation/public/publicViews', () => ({ loadPublicView: mocks.publicView }));

beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.appModule.mockResolvedValue(undefined);
    mocks.publicModule.mockResolvedValue(undefined);
    mocks.publicView.mockResolvedValue(() => null);
    mocks.createRoot.mockReturnValue({ render: mocks.render });
    document.documentElement.lang = 'en';
    document.body.innerHTML = '<div id="root"></div>';
    localStorage.setItem('startup-test-draft', 'SELECT preserved_draft');
    sessionStorage.setItem('startup-test-session', 'preserved session');
});

afterEach(() => {
    vi.restoreAllMocks();
    document.body.replaceChildren();
    localStorage.removeItem('startup-test-draft');
    sessionStorage.removeItem('startup-test-session');
});

describe('startup import recovery', () => {
    it('catches a failed private import before mounting and only reloads on request', async () => {
        window.history.replaceState(null, '', '/login?token=SYNTHETIC_URL_SECRET#SYNTHETIC_HASH_SECRET');
        const reload = vi.spyOn(window.location, 'reload').mockImplementation(() => undefined);
        mocks.appModule.mockRejectedValueOnce(new Error('Failed to fetch dynamically imported module: SYNTHETIC_MODULE_SECRET'));

        await import('./main');

        const fallback = await screen.findByRole('alert');
        expect(fallback).toHaveTextContent('This page could not be loaded');
        expect(fallback.textContent).not.toMatch(/SYNTHETIC_|Failed to fetch/);
        expect(mocks.createRoot).not.toHaveBeenCalled();
        expect(reload).not.toHaveBeenCalled();
        expect(localStorage.getItem('startup-test-draft')).toBe('SELECT preserved_draft');
        expect(sessionStorage.getItem('startup-test-session')).toBe('preserved session');

        fireEvent.click(screen.getByRole('button', { name: 'Reload page' }));
        expect(reload).toHaveBeenCalledTimes(1);
        expect(localStorage.getItem('startup-test-draft')).toBe('SELECT preserved_draft');
    });

    it.each([
        ['/docs/editor', 'Không thể tải trang này', 'Tải lại trang'],
        ['/en/docs/editor', 'This page could not be loaded', 'Reload page'],
    ])('preserves prerendered public prose when the public client import fails at %s', async (path, heading, reloadLabel) => {
        window.history.replaceState(null, '', path);
        const root = document.getElementById('root')!;
        root.setAttribute('data-public-rendered', 'true');
        root.innerHTML = '<main><h1>Prerendered documentation</h1><p>Readable public prose.</p></main>';
        mocks.publicModule.mockRejectedValueOnce(new Error('SYNTHETIC_PUBLIC_CHUNK_SECRET'));

        await import('./main');

        expect(await screen.findByRole('alert')).toHaveTextContent(heading);
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Prerendered documentation');
        expect(screen.getByText('Readable public prose.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: reloadLabel })).toBeInTheDocument();
        expect(root.textContent).not.toContain('SYNTHETIC_PUBLIC_CHUNK_SECRET');
        expect(mocks.hydrateRoot).not.toHaveBeenCalled();
        expect(mocks.createRoot).not.toHaveBeenCalled();
    });

    it('catches a rejected public view promise before hydration', async () => {
        window.history.replaceState(null, '', '/en/docs/results');
        document.getElementById('root')!.setAttribute('data-public-rendered', 'true');
        mocks.publicView.mockRejectedValueOnce(new Error('SYNTHETIC_VIEW_SECRET'));

        await import('./main');

        expect(await screen.findByRole('alert')).toHaveTextContent('This page could not be loaded');
        expect(mocks.publicView).toHaveBeenCalledTimes(1);
        expect(mocks.hydrateRoot).not.toHaveBeenCalled();
    });

    it('hydrates a successful prerendered public page without a fallback', async () => {
        window.history.replaceState(null, '', '/en/docs/results');
        document.getElementById('root')!.setAttribute('data-public-rendered', 'true');

        await import('./main');

        await waitFor(() => expect(mocks.hydrateRoot).toHaveBeenCalledTimes(1));
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(mocks.createRoot).not.toHaveBeenCalled();
    });

    it('mounts a successful private import without a fallback', async () => {
        window.history.replaceState(null, '', '/login');

        await import('./main');

        await waitFor(() => expect(mocks.render).toHaveBeenCalledTimes(1));
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
});
