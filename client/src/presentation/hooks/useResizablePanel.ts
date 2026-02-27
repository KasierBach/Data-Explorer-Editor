import { useState, useCallback, useEffect } from 'react';

interface UseResizablePanelOptions {
    initialWidth: number;
    minWidth: number;
    maxWidth?: number;
    direction: 'left' | 'right';
    onWidthChange?: (width: number) => void;
}

export function useResizablePanel({
    initialWidth,
    minWidth,
    maxWidth,
    direction,
    onWidthChange
}: UseResizablePanelOptions) {
    const [isDragging, setIsDragging] = useState(false);
    const [width, setWidth] = useState(initialWidth);

    const startResizing = useCallback((e: React.MouseEvent) => {
        setIsDragging(true);
        e.preventDefault();
        document.body.style.cursor = 'col-resize';
    }, []);

    const stopResizing = useCallback(() => {
        setIsDragging(false);
        document.body.style.cursor = 'default';
    }, []);

    const resize = useCallback((e: MouseEvent) => {
        if (!isDragging) return;

        let newWidth;
        if (direction === 'left') {
            newWidth = e.clientX;
        } else {
            newWidth = window.innerWidth - e.clientX;
        }

        newWidth = Math.max(minWidth, newWidth);

        if (maxWidth) {
            // Support percentage max width (e.g. 0.45 = 45vw)
            const absoluteMaxWidth = maxWidth <= 1 ? window.innerWidth * maxWidth : maxWidth;
            newWidth = Math.min(newWidth, absoluteMaxWidth);
        }

        setWidth(newWidth);
    }, [isDragging, direction, minWidth, maxWidth]);

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', resize);
            window.addEventListener('mouseup', stopResizing);
        } else {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        }
        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        };
    }, [isDragging, resize, stopResizing]);

    useEffect(() => {
        if (!isDragging && onWidthChange) {
            onWidthChange(width);
        }
    }, [isDragging, width, onWidthChange]);

    // Expose setter for external sync (e.g. from global store)
    return {
        width,
        setWidth,
        isDragging,
        startResizing
    };
}
