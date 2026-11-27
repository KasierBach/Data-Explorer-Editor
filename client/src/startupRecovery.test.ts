// @vitest-environment happy-dom
import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getRecoveryText, isChunkLoadError, reloadPage, showStartupFallback } from './startupRecovery';

const originalLocation = window.location;

afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
    document.body.replaceChildren();
});

describe('independent startup recovery', () => {
    it.each(['vi', 'vi-VN', ''])('provides Vietnamese recovery without importing application state (%s)', lang => {
        expect(getRecoveryText(lang).reload).toBe('Tải lại trang');
        expect(getRecoveryText(lang).retry).toBe('Thử lại');
    });

    it.each(['en', 'en-US'])('provides English recovery (%s)', lang => {
        expect(getRecoveryText(lang).reload).toBe('Reload page');
        expect(getRecoveryText(lang).retry).toBe('Try again');
    });

    it.each([
        'Loading chunk 42 failed.',
        'Loading CSS chunk 42 failed.',
        'Failed to fetch dynamically imported module: https://example.test/chunk.js',
        'error loading dynamically imported module',
        'Importing a module script failed.',
        'Unable to preload CSS for /assets/app.css',
        'Failed to load module script',
    ])('recognizes an import failure without needing its URL (%s)', message => {
        expect(isChunkLoadError(new Error(message))).toBe(true);
        expect(isChunkLoadError(message)).toBe(true);
    });

    it('distinguishes chunk errors from ordinary network/render errors and unknown thrown values', () => {
        const chunk = new Error('opaque failure');
        chunk.name = 'ChunkLoadError';
        expect(isChunkLoadError(chunk)).toBe(true);
        for (const error of [new Error('Failed to fetch'), new Error('ordinary render error'), null, undefined, { message: 'ordinary error' }]) {
            expect(isChunkLoadError(error)).toBe(false);
        }
    });

    it('retains the exact prerendered document, installs one recovery alert and only reloads on a click', () => {
        document.body.innerHTML = '<div id="root" data-public-rendered="true"><main><h1>Readable documentation</h1><p>Prerendered prose.</p></main></div>';
        const root = document.getElementById('root')!;
        const prose = root.firstElementChild;
        const replace = vi.fn();
        const reload = vi.fn();
        Object.defineProperty(window, 'location', { configurable: true, value: { href: 'https://example.test/docs/results?locale=en#saved-section', replace, reload } });
        vi.spyOn(Date, 'now').mockReturnValue(1000);

        showStartupFallback(root, 'en');
        showStartupFallback(root, 'en');

        expect(screen.getAllByRole('alert')).toHaveLength(1);
        expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
        expect(root.lastElementChild).toBe(prose);
        expect(screen.getByRole('alert')).toHaveFocus();
        expect(replace).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Reload page' }));
        expect(replace).toHaveBeenCalledExactlyOnceWith('https://example.test/docs/results?locale=en&_recovery=rs#saved-section');
        expect(reload).not.toHaveBeenCalled();
    });

    it('uses a new bounded module marker for repeated user reloads at the same clock instant', () => {
        let href = 'https://example.test/docs/results?locale=en#saved-section';
        const replace = vi.fn((url: string) => { href = url; });
        const location = { get href() { return href; }, replace };
        vi.spyOn(Date, 'now').mockReturnValue(1000);
        reloadPage(location);
        reloadPage(location);
        reloadPage(location);
        expect(replace.mock.calls.map(([url]) => new URL(url).searchParams.get('_recovery'))).toEqual(['rs', 'rs_1', 'rs_2']);
        expect(new URL(href).searchParams.get('locale')).toBe('en');
        expect(new URL(href).hash).toBe('#saved-section');
    });
});
