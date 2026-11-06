import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLandingMotion } from './useLandingMotion';

const reduced = vi.hoisted(() => ({ value: false }));
vi.mock('framer-motion', () => ({ useReducedMotion: () => reduced.value }));

function MotionRegion({ paused = false }: { paused?: boolean }) {
    const { ref, motionEnabled, pointerEnabled, running, interaction } = useLandingMotion(paused);
    return (
        <div ref={ref} data-testid="region" data-enabled={motionEnabled} data-pointer={pointerEnabled} data-running={running} {...interaction}>
            <button type="button">First</button><button type="button">Second</button>
        </div>
    );
}

beforeEach(() => { reduced.value = false; });

describe('useLandingMotion ownership', () => {
    it('keeps loops and pointer depth running on mouse hover, but pauses for focus', async () => {
        render(<MotionRegion />);
        const region = screen.getByTestId('region');
        await waitFor(() => expect(region).toHaveAttribute('data-running', 'true'));

        const enter = new Event('pointerover', { bubbles: true });
        Object.defineProperty(enter, 'pointerType', { value: 'mouse' });
        fireEvent(region, enter);
        expect(region).toHaveAttribute('data-running', 'true');
        expect(region).toHaveAttribute('data-pointer', 'true');
        fireEvent.pointerOut(region);
        expect(region).toHaveAttribute('data-running', 'true');

        const first = screen.getByRole('button', { name: 'First' });
        const second = screen.getByRole('button', { name: 'Second' });
        fireEvent.focus(first);
        expect(region).toHaveAttribute('data-pointer', 'false');
        expect(region).toHaveAttribute('data-running', 'false');
        fireEvent.blur(first, { relatedTarget: second });
        expect(region).toHaveAttribute('data-running', 'false');
        fireEvent.blur(second, { relatedTarget: null });
        expect(region).toHaveAttribute('data-running', 'true');
    });

    it('freezes manual pause and reduced motion', async () => {
        const { rerender } = render(<MotionRegion />);
        const region = screen.getByTestId('region');
        await waitFor(() => expect(region).toHaveAttribute('data-enabled', 'true'));
        rerender(<MotionRegion paused />);
        expect(region).toHaveAttribute('data-enabled', 'false');
        expect(region).toHaveAttribute('data-pointer', 'false');
        expect(region).toHaveAttribute('data-running', 'false');
        reduced.value = true;
        rerender(<MotionRegion />);
        expect(region).toHaveAttribute('data-enabled', 'false');
    });

    it('freezes hidden and offscreen regions and cleans up its observer and listener', async () => {
        let intersect: IntersectionObserverCallback | undefined;
        const observe = vi.fn();
        const disconnect = vi.fn();
        const remove = vi.spyOn(document, 'removeEventListener');
        const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
        vi.stubGlobal('IntersectionObserver', class {
            constructor(callback: IntersectionObserverCallback) { intersect = callback; }
            observe = observe;
            disconnect = disconnect;
        });
        try {
            const { unmount } = render(<MotionRegion />);
            const region = screen.getByTestId('region');
            await waitFor(() => expect(region).toHaveAttribute('data-running', 'true'));
            expect(observe).toHaveBeenCalledWith(region);
            act(() => intersect?.([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver));
            expect(region).toHaveAttribute('data-enabled', 'false');
            act(() => intersect?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
            expect(region).toHaveAttribute('data-running', 'true');
            hidden.mockReturnValue(true);
            fireEvent(document, new Event('visibilitychange'));
            expect(region).toHaveAttribute('data-running', 'false');
            hidden.mockReturnValue(false);
            fireEvent(document, new Event('visibilitychange'));
            expect(region).toHaveAttribute('data-running', 'true');
            unmount();
            expect(disconnect).toHaveBeenCalledOnce();
            expect(remove).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
        } finally {
            hidden.mockRestore();
            remove.mockRestore();
            vi.unstubAllGlobals();
        }
    });

    it('keeps motion and content available when IntersectionObserver is unavailable', async () => {
        vi.stubGlobal('IntersectionObserver', undefined);
        try {
            render(<MotionRegion />);
            await waitFor(() => expect(screen.getByTestId('region')).toHaveAttribute('data-running', 'true'));
            expect(screen.getByRole('button', { name: 'First' })).toBeVisible();
        } finally {
            vi.unstubAllGlobals();
        }
    });
});
