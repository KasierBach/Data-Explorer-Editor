import { useEffect, useRef, useState, type FocusEvent, type PointerEvent } from 'react';
import { useReducedMotion } from 'framer-motion';

export function useLandingMotion(paused = false) {
    const ref = useRef<HTMLDivElement>(null);
    const reducedMotion = useReducedMotion();
    const [onscreen, setOnscreen] = useState(true);
    const [visible, setVisible] = useState(() => typeof document === 'undefined' || !document.hidden);
    const [ready, setReady] = useState(false);
    const [hovered, setHovered] = useState(false);
    const [focused, setFocused] = useState(false);

    useEffect(() => {
        const frame = window.requestAnimationFrame(() => setReady(true));
        const onVisibilityChange = () => setVisible(!document.hidden);
        document.addEventListener('visibilitychange', onVisibilityChange);
        const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(([entry]) => {
            setOnscreen(entry.isIntersecting);
        }, { threshold: 0.05 });
        if (ref.current) observer?.observe(ref.current);
        return () => {
            window.cancelAnimationFrame(frame);
            observer?.disconnect();
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, []);

    return {
        ref,
        running: ready && !paused && !reducedMotion && onscreen && visible && !hovered && !focused,
        interaction: {
            onPointerEnter: (event: PointerEvent<HTMLDivElement>) => {
                if (event.pointerType === 'mouse') setHovered(true);
            },
            onPointerLeave: () => setHovered(false),
            onFocusCapture: () => setFocused(true),
            onBlurCapture: (event: FocusEvent<HTMLDivElement>) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
            },
        },
    };
}
