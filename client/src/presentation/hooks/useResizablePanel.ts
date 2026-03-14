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

    const startResizing = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        isDraggingRef.current = true;
        setIsDragging(true);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }, []);

    const stopResizing = useCallback(() => {
        if (!isDraggingRef.current) return;
        isDraggingRef.current = false;
        setIsDragging(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    }, []);

    const resize = useCallback((e: MouseEvent) => {
        if (!isDraggingRef.current) return;

        let newWidth: number;
        if (directionRef.current === 'left') {
            newWidth = e.clientX;
        } else {
            newWidth = window.innerWidth - e.clientX;
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

    // Register global mouse listeners once on mount, clean up on unmount
    useEffect(() => {
        window.addEventListener('mousemove', resize);
        window.addEventListener('mouseup', stopResizing);

        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
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

