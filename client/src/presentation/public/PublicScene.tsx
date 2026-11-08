import { useEffect, useState, type ReactNode } from 'react';
import { motion, useSpring } from 'framer-motion';
import { useLandingMotion } from '../modules/LandingPage/hooks/useLandingMotion';
import { usePublicExperience } from './PublicExperienceContext';

export function PublicScene({ children, kind, className = '' }: { children: ReactNode; kind: 'knowledge' | 'releases'; className?: string }) {
    const { paused } = usePublicExperience();
    const [finePointer, setFinePointer] = useState(false);
    const [focused, setFocused] = useState(false);
    const { ref, motionEnabled, running } = useLandingMotion(paused || focused);
    const rotateX = useSpring(0, { stiffness: 85, damping: 21 });
    const rotateY = useSpring(0, { stiffness: 85, damping: 21 });
    const depthEnabled = motionEnabled && finePointer;

    useEffect(() => {
        const media = typeof window.matchMedia === 'function' ? window.matchMedia('(min-width: 768px) and (hover: hover) and (pointer: fine)') : null;
        const update = () => setFinePointer(media?.matches ?? false);
        const frame = requestAnimationFrame(update);
        media?.addEventListener('change', update);
        const region = ref.current?.closest('.pe-scene-region');
        const focus = (event: Event) => setFocused((event.target as Element | null)?.matches(':focus-visible') ?? false);
        const blur = (event: Event) => {
            if (!region?.contains((event as FocusEvent).relatedTarget as Node | null)) setFocused(false);
        };
        region?.addEventListener('focusin', focus);
        region?.addEventListener('focusout', blur);
        return () => {
            cancelAnimationFrame(frame);
            media?.removeEventListener('change', update);
            region?.removeEventListener('focusin', focus);
            region?.removeEventListener('focusout', blur);
        };
    }, [ref]);

    useEffect(() => {
        if (!depthEnabled) {
            rotateX.jump(0);
            rotateY.jump(0);
        }
    }, [depthEnabled, rotateX, rotateY]);

    return (
        <div ref={ref} className={`pe-scene pe-scene-${kind} ${className}`} aria-hidden="true" data-running={running} data-depth-enabled={depthEnabled}
            onPointerMove={event => {
                if (!depthEnabled || event.pointerType !== 'mouse') return;
                const box = event.currentTarget.getBoundingClientRect();
                rotateX.set(Math.max(-0.5, Math.min(0.5, (event.clientY - box.top) / box.height - 0.5)) * -13);
                rotateY.set(Math.max(-0.5, Math.min(0.5, (event.clientX - box.left) / box.width - 0.5)) * 17);
            }}
            onPointerLeave={() => { rotateX.set(0); rotateY.set(0); }}>
            <div className="pe-scene-aura" />
            <div className="pe-scene-grid" />
            <motion.div className="pe-scene-tilt" style={{ rotateX, rotateY }}>{children}</motion.div>
        </div>
    );
}
