import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useResizablePanel } from './useResizablePanel';

describe('useResizablePanel', () => {
    it('notifies only after the width changes, even when the callback identity changes', () => {
        const firstCallback = vi.fn();
        const secondCallback = vi.fn();
        const { result, rerender } = renderHook(
            ({ onWidthChange }) => useResizablePanel({
                initialWidth: 320,
                minWidth: 240,
                direction: 'left',
                onWidthChange,
            }),
            { initialProps: { onWidthChange: firstCallback } },
        );

        expect(firstCallback).not.toHaveBeenCalled();

        rerender({ onWidthChange: secondCallback });
        expect(secondCallback).not.toHaveBeenCalled();

        act(() => result.current.setWidth(400));

        expect(firstCallback).not.toHaveBeenCalled();
        expect(secondCallback).toHaveBeenCalledOnce();
        expect(secondCallback).toHaveBeenCalledWith(400);
    });
});
