import { useState, useCallback, useEffect, useRef, useMemo } from 'react';

interface UseVerticalResizablePanelOptions {
    initialHeight: number;
    minHeight: number;
    maxHeight?: number;
    onHeightChange?: (height: number) => void;
}

/**
 * Hook for creating vertically resizable panels (top-bottom split).
 * Similar to useResizablePanel but for height.
 */
export function useVerticalResizablePanel({
    initialHeight,
    minHeight,
    maxHeight,
    onHeightChange
}: UseVerticalResizablePanelOptions) {
    const [isDragging, setIsDragging] = useState(false);
    const [height, setHeight] = useState(initialHeight);

    const isDraggingRef = useRef(false);
    const minHeightRef = useRef(minHeight);
    const maxHeightRef = useRef(maxHeight);

    useEffect(() => {
        minHeightRef.current = minHeight;
        maxHeightRef.current = maxHeight;
    }, [minHeight, maxHeight]);

    const startResizing = useCallback((e: React.MouseEvent | React.PointerEvent | React.TouchEvent) => {
        e.preventDefault();
        e.stopPropagation();
        isDraggingRef.current = true;
        setIsDragging(true);
        document.body.style.cursor = 'row-resize';
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

    const getClientY = (event: MouseEvent | PointerEvent | TouchEvent) => {
        if ('touches' in event && event.touches.length > 0) {
            return event.touches[0].clientY;
        }
        if ('changedTouches' in event && event.changedTouches.length > 0) {
            return event.changedTouches[0].clientY;
        }
        return (event as MouseEvent | PointerEvent).clientY;
    };

    const resize = useCallback((e: MouseEvent | PointerEvent | TouchEvent) => {
        if (!isDraggingRef.current) return;

        // In a vertical split where this panel is at the bottom, 
        // the height is the distance from the bottom of the viewport.
        let newHeight = window.innerHeight - getClientY(e);

        newHeight = Math.max(minHeightRef.current, newHeight);

        if (maxHeightRef.current) {
            const absoluteMaxHeight = maxHeightRef.current <= 1
                ? window.innerHeight * maxHeightRef.current
                : maxHeightRef.current;
            newHeight = Math.min(newHeight, absoluteMaxHeight);
        }

        setHeight(newHeight);
    }, []);

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

    // Use ref for callback to avoid infinite loops if the function is not memoized
    const onHeightChangeRef = useRef(onHeightChange);
    useEffect(() => {
        onHeightChangeRef.current = onHeightChange;
    }, [onHeightChange]);

    // Notify parent of height changes when drag completes
    useEffect(() => {
        if (!isDragging && onHeightChangeRef.current) {
            onHeightChangeRef.current(height);
        }
    }, [isDragging, height]);

    return useMemo(() => ({
        height,
        setHeight,
        isDragging,
        startResizing
    }), [height, isDragging, startResizing]);
}
