// @vitest-environment happy-dom
import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getRecoveryText, isChunkLoadError, showStartupFallback } from './startupRecovery';

afterEach(() => {
    vi.restoreAllMocks();
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
        const reload = vi.spyOn(window.location, 'reload').mockImplementation(() => undefined);

        showStartupFallback(root, 'en');
        showStartupFallback(root, 'en');

        expect(screen.getAllByRole('alert')).toHaveLength(1);
        expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
        expect(root.lastElementChild).toBe(prose);
        expect(screen.getByRole('alert')).toHaveFocus();
        expect(reload).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Reload page' }));
        expect(reload).toHaveBeenCalledTimes(1);
    });
});
