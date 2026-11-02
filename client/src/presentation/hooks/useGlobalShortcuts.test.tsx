import { renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useGlobalShortcuts } from './useGlobalShortcuts';

const state = vi.hoisted(() => ({
    tabs: [{ id: 'query-1', type: 'query' }],
    activeTabId: 'query-1',
    openQueryTab: vi.fn(), openTab: vi.fn(), closeAllTabs: vi.fn(),
    toggleResultPanel: vi.fn(), toggleSidebar: vi.fn(), toggleAiPanel: vi.fn(),
}));
vi.mock('@/core/services/store', () => ({
    useAppStore: Object.assign(() => state, { getState: () => state }),
}));
afterEach(() => vi.clearAllMocks());

it('prevents browser Save while allowing the active editor handler for Ctrl/Cmd+S', () => {
    const { unmount } = renderHook(() => useGlobalShortcuts());
    const editorSave = vi.fn();
    window.addEventListener('keydown', editorSave, { capture: true });
    try {
        for (const modifier of ['ctrlKey', 'metaKey']) {
            const event = new KeyboardEvent('keydown', { key: 's', code: 'KeyS', [modifier]: true, cancelable: true });
            window.dispatchEvent(event);
            expect(event.defaultPrevented).toBe(true);
        }
        expect(editorSave).toHaveBeenCalledTimes(2);
    } finally {
        window.removeEventListener('keydown', editorSave, { capture: true });
        unmount();
    }
});
