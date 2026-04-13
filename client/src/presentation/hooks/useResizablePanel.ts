import { useState, useCallback, useEffect, useRef, useMemo } from 'react';

interface UseResizablePanelOptions {
    initialWidth: number;
    minWidth: number;
    maxWidth?: number;
    direction: 'left' | 'right';
    onWidthChange?: (width: number) => void;
}

/**
 * Hook for creating resizable panels with smooth drag behavior.
 * Uses refs for drag state to avoid stale closures and unnecessary
 * re-registration of event listeners during rapid mouse movements.
 * Returns a memoized object to prevent infinite re-render loops
 * when used as a dependency in useEffect.
 */
export function useResizablePanel({
    initialWidth,
    minWidth,
    maxWidth,
    direction,
    onWidthChange
}: UseResizablePanelOptions) {
    const [isDragging, setIsDragging] = useState(false);
    const [width, setWidth] = useState(initialWidth);

    // Use ref to track dragging state inside event handlers (avoids stale closure)
    const isDraggingRef = useRef(false);
    const directionRef = useRef(direction);
    const minWidthRef = useRef(minWidth);
    const maxWidthRef = useRef(maxWidth);

    // Keep refs in sync with props
    directionRef.current = direction;
    minWidthRef.current = minWidth;
    maxWidthRef.current = maxWidth;

    const startResizing = useCallback((e: React.MouseEvent | React.PointerEvent | React.TouchEvent) => {
        e.preventDefault();
        e.stopPropagation();
        isDraggingRef.current = true;
        setIsDragging(true);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        document.body.style.touchAction = 'none';
    }, []);

    const stopResizing = useCallback(() => {
        if (!isDraggingRef.current) return;
        isDraggingRef.current = false;
        setIsDragging(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.body.style.touchAction = '';
    }, []);

    const getClientX = (event: MouseEvent | PointerEvent | TouchEvent) => {
        if ('touches' in event && event.touches.length > 0) {
            return event.touches[0].clientX;
        }
        if ('changedTouches' in event && event.changedTouches.length > 0) {
            return event.changedTouches[0].clientX;
        }
        return (event as MouseEvent | PointerEvent).clientX;
    };

    const resize = useCallback((e: MouseEvent | PointerEvent | TouchEvent) => {
        if (!isDraggingRef.current) return;

        let newWidth: number;
        if (directionRef.current === 'left') {
            newWidth = getClientX(e);
        } else {
            newWidth = window.innerWidth - getClientX(e);
        }

        newWidth = Math.max(minWidthRef.current, newWidth);

        if (maxWidthRef.current) {
            const absoluteMaxWidth = maxWidthRef.current <= 1
                ? window.innerWidth * maxWidthRef.current
                : maxWidthRef.current;
            newWidth = Math.min(newWidth, absoluteMaxWidth);
        }

        setWidth(newWidth);
    }, []);

    // Register global pointer listeners once on mount, clean up on unmount
    useEffect(() => {
        const handleTouchMove = (event: TouchEvent) => {
            resize(event);
        };

        window.addEventListener('pointermove', resize);
        window.addEventListener('pointerup', stopResizing);
        window.addEventListener('pointercancel', stopResizing);
        window.addEventListener('mousemove', resize);
        window.addEventListener('mouseup', stopResizing);
        window.addEventListener('touchmove', handleTouchMove, { passive: false });
        window.addEventListener('touchend', stopResizing);
        window.addEventListener('touchcancel', stopResizing);

        return () => {
            window.removeEventListener('pointermove', resize);
            window.removeEventListener('pointerup', stopResizing);
            window.removeEventListener('pointercancel', stopResizing);
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', stopResizing);
            window.removeEventListener('touchcancel', stopResizing);
        };
    }, [resize, stopResizing]);

    // Notify parent of width changes when drag completes
    useEffect(() => {
        if (!isDragging && onWidthChange) {
            onWidthChange(width);
        }
    }, [isDragging, width, onWidthChange]);

    // Memoize return value to provide stable reference for consumers
    return useMemo(() => ({
        width,
        setWidth,
        isDragging,
        startResizing
    }), [width, isDragging, startResizing]);
}
